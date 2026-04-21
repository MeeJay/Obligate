import { Router } from 'express';
import { db } from '../db';
import { oauthService } from '../services/oauth.service';
import { appService } from '../services/app.service';
import { permissionGroupService } from '../services/permissionGroup.service';
import { requireAuth, AppError } from '../middleware/auth';
import { logger } from '../utils/logger';

const REQUIRED_ENROLLMENT_VERSION = 1;

export const oauthRoutes = Router();

/**
 * GET /api/oauth/authorize
 * Entry point for the SSO flow. If user has a session, issue a code and redirect.
 * If not, redirect to the Obligate login page with return params.
 *
 * Query params: client_id (app API key), redirect_uri, state
 */
oauthRoutes.get('/authorize', async (req, res) => {
  try {
    const { client_id, redirect_uri, state } = req.query as {
      client_id?: string; redirect_uri?: string; state?: string;
    };

    if (!client_id || !redirect_uri) {
      res.status(400).json({ error: 'Missing client_id or redirect_uri' });
      return;
    }

    // Validate the app
    const app = await appService.getAppByApiKey(client_id);
    if (!app) {
      res.status(400).json({ error: 'Invalid client_id' });
      return;
    }

    // If user is already authenticated, check enrollment then issue code
    if (req.session?.userId) {
      // Check if user has completed enrollment — if not, redirect to enroll first
      const row = await db('users').where({ id: req.session.userId }).select('enrollment_version').first() as { enrollment_version: number } | undefined;
      if ((row?.enrollment_version ?? 0) < REQUIRED_ENROLLMENT_VERSION) {
        const enrollUrl = `/enroll?returnTo=${encodeURIComponent(req.originalUrl)}`;
        res.redirect(enrollUrl);
        return;
      }

      // Check if user has permission group mapping for this app
      const resolved = await permissionGroupService.resolveForUserAndApp(req.session.userId, app.id);
      if (!resolved.role) {
        // User has no permission to access this app — show an error page
        res.status(403).setHeader('Content-Type', 'text/html');
        res.end(`<!DOCTYPE html><html><head><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d1117;color:#8b949e;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.c{text-align:center;max-width:400px;padding:2rem}.h{color:#f85149;font-size:1.25rem;font-weight:600;margin-bottom:.5rem}.p{font-size:.875rem;margin-bottom:1.5rem}a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><div class="c"><div class="h">Access Denied</div><div class="p">You do not have permission to access this application. Contact your administrator to request access.</div><a href="/">Back to Obligate</a></div></body></html>`);
        return;
      }

      const code = await oauthService.generateCode(req.session.userId, app.id, redirect_uri);
      const separator = redirect_uri.includes('?') ? '&' : '?';
      const redirectUrl = `${redirect_uri}${separator}code=${code}${state ? `&state=${state}` : ''}`;
      res.redirect(redirectUrl);
      return;
    }

    // Not authenticated — redirect to login page with return params
    const loginUrl = `/login?returnTo=${encodeURIComponent(req.originalUrl)}`;
    res.redirect(loginUrl);
  } catch (err) {
    logger.error(err, 'OAuth authorize error');
    res.status(500).json({ error: 'Authorization failed' });
  }
});

/**
 * POST /api/oauth/token/exchange
 * Server-to-server code exchange. Called by connected apps.
 * Auth: Bearer <app_api_key>
 */
oauthRoutes.post('/token/exchange', async (req, res) => {
  try {
    // Validate Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing Bearer token' });
      return;
    }
    const apiKey = authHeader.slice(7);
    const app = await appService.getAppByApiKey(apiKey);
    if (!app) {
      res.status(401).json({ success: false, error: 'Invalid API key' });
      return;
    }

    const { code, redirect_uri } = req.body as { code?: string; redirect_uri?: string };
    if (!code || !redirect_uri) {
      res.status(400).json({ success: false, error: 'Missing code or redirect_uri' });
      return;
    }

    const result = await oauthService.exchangeCode(code, app.id, redirect_uri);
    if (!result) {
      res.status(401).json({ success: false, error: 'Invalid, expired, or already used code' });
      return;
    }

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(err, 'Token exchange error');
    res.status(500).json({ success: false, error: 'Exchange failed' });
  }
});

/**
 * POST /api/oauth/verify-totp
 * Server-to-server TOTP verification. Used by connected apps to validate a
 * fresh TOTP code for SSO-authenticated users when they perform a
 * "sensitive" action that requires step-up authentication.
 *
 * Auth: Bearer <app_api_key>
 * Body: { userId: number, code: string }
 *   - userId: the Obligate user id (what apps store as foreign_id)
 *   - code  : the 6-digit TOTP the user typed
 * Response: { success: boolean, data: { valid: boolean } }
 */
// ── Per-user rate limiter for /verify-totp ──────────────────────────────────
// Since a valid app Bearer key lets any connected app ask Obligate to
// validate a TOTP code for ANY user id, this endpoint is a cross-app
// brute-force primitive unless rate-limited. We keep a small in-process
// sliding window per userId: after MAX_FAILS wrong codes within WINDOW_MS,
// we return 429 for LOCKOUT_MS and refuse to call verifyTotp — the attempt
// log records every 429 so SOC tooling can catch a distributed spray.
const TFA_ATTEMPTS = new Map<number, { fails: number; firstAt: number; lockUntil: number }>();
const TFA_MAX_FAILS  = 5;
const TFA_WINDOW_MS  = 5 * 60 * 1000;   // 5 min
const TFA_LOCKOUT_MS = 15 * 60 * 1000;  // 15 min

function tfaGateCheck(userId: number): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  const rec = TFA_ATTEMPTS.get(userId);
  if (!rec) return { allowed: true };
  if (rec.lockUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.lockUntil - now) / 1000) };
  }
  // Reset the window if it has elapsed without crossing the threshold.
  if (now - rec.firstAt > TFA_WINDOW_MS) TFA_ATTEMPTS.delete(userId);
  return { allowed: true };
}

function tfaRegisterFail(userId: number): void {
  const now = Date.now();
  const rec = TFA_ATTEMPTS.get(userId) ?? { fails: 0, firstAt: now, lockUntil: 0 };
  rec.fails++;
  if (rec.fails >= TFA_MAX_FAILS) {
    rec.lockUntil = now + TFA_LOCKOUT_MS;
    rec.fails = 0;              // reset counter, lock is now the gate
    rec.firstAt = now;
  }
  TFA_ATTEMPTS.set(userId, rec);
}

function tfaRegisterSuccess(userId: number): void {
  TFA_ATTEMPTS.delete(userId);
}

oauthRoutes.post('/verify-totp', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing Bearer token' });
      return;
    }
    const apiKey = authHeader.slice(7);
    const app = await appService.getAppByApiKey(apiKey);
    if (!app) {
      res.status(401).json({ success: false, error: 'Invalid API key' });
      return;
    }

    const { userId, code } = req.body as { userId?: number; code?: string };
    if (!userId || !code) {
      res.status(400).json({ success: false, error: 'Missing userId or code' });
      return;
    }

    // ── Brute-force gate ──────────────────────────────────────────────
    const gate = tfaGateCheck(userId);
    if (!gate.allowed) {
      logger.warn({ userId, appId: app.id, retryAfterSec: gate.retryAfterSec },
        'verify-totp: user locked out after repeated failures');
      res.setHeader('Retry-After', String(gate.retryAfterSec));
      res.status(429).json({
        success: false,
        error: 'Too many failed 2FA attempts — try again later',
      });
      return;
    }

    const { db } = await import('../db');
    const { twoFactorService } = await import('../services/twoFactor.service');
    const row = await db('users').where({ id: userId }).first('id', 'totp_enabled', 'totp_secret');
    if (!row) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    if (!row.totp_enabled || !row.totp_secret) {
      res.status(409).json({ success: false, error: 'TOTP not configured for this user' });
      return;
    }

    const valid = twoFactorService.verifyTotp(row.totp_secret, String(code).trim());
    if (valid) {
      tfaRegisterSuccess(userId);
    } else {
      tfaRegisterFail(userId);
      logger.info({ userId, appId: app.id },
        'verify-totp: invalid code (brute-force counter incremented)');
    }
    res.json({ success: true, data: { valid } });
  } catch (err) {
    logger.error(err, 'verify-totp error');
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});
