import { Router } from 'express';
import { db } from '../db';
import { twoFactorService } from '../services/twoFactor.service';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

// Extend session for 2FA state
declare module 'express-session' {
  interface SessionData {
    pendingTotpSecret?: string;
  }
}

export const twoFactorRoutes = Router();

// ── Profile endpoints (require auth) ─────────────────────────────────────────

/** GET /api/profile/2fa/status */
twoFactorRoutes.get('/status', requireAuth, async (req, res) => {
  try {
    const row = await db('users').where({ id: req.session.userId }).select('totp_enabled', 'email').first() as {
      totp_enabled: boolean; email: string | null;
    } | undefined;
    res.json({
      success: true,
      data: { totpEnabled: row?.totp_enabled ?? false, email: row?.email ?? null },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get 2FA status' });
  }
});

/** POST /api/profile/2fa/totp/setup — generate secret + QR */
twoFactorRoutes.post('/totp/setup', requireAuth, async (req, res) => {
  try {
    const username = req.session.username ?? 'user';
    const { secret, uri } = twoFactorService.generateTotpSecret(username);
    const qrDataUrl = await twoFactorService.generateTotpQr(uri);

    // Store pending secret in session (not DB yet)
    req.session.pendingTotpSecret = secret;

    res.json({ success: true, data: { secret, qrDataUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to setup TOTP' });
  }
});

/** POST /api/profile/2fa/totp/enable — verify code + save */
twoFactorRoutes.post('/totp/enable', requireAuth, async (req, res) => {
  try {
    const { code } = req.body as { code?: string };
    const pendingSecret = req.session.pendingTotpSecret;
    if (!pendingSecret || !code) {
      res.status(400).json({ success: false, error: 'No pending TOTP setup or missing code' });
      return;
    }

    const valid = twoFactorService.verifyTotp(pendingSecret, code);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid code' });
      return;
    }

    await db('users').where({ id: req.session.userId }).update({
      totp_secret: pendingSecret,
      totp_enabled: true,
      updated_at: new Date(),
    });
    delete req.session.pendingTotpSecret;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to enable TOTP' });
  }
});

/** DELETE /api/profile/2fa/totp — disable TOTP */
twoFactorRoutes.delete('/totp', requireAuth, async (req, res) => {
  try {
    await db('users').where({ id: req.session.userId }).update({
      totp_secret: null,
      totp_enabled: false,
      updated_at: new Date(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to disable TOTP' });
  }
});

// ── Auth endpoint (2FA verification during login) ────────────────────────────

/** POST /api/profile/2fa/verify — verify code during login */
twoFactorRoutes.post('/verify', authLimiter, async (req, res) => {
  try {
    const userId = req.session.pendingMfaUserId;
    if (!userId) {
      res.status(400).json({ success: false, error: 'No pending 2FA session' });
      return;
    }

    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ success: false, error: 'Missing code' });
      return;
    }

    const row = await db('users').where({ id: userId }).first() as {
      id: number; username: string; role: string; totp_enabled: boolean; totp_secret: string | null;
    } | undefined;
    if (!row) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    let valid = false;
    if (row.totp_enabled && row.totp_secret) {
      valid = twoFactorService.verifyTotp(row.totp_secret, code);
    }

    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid code' });
      return;
    }

    // Complete the session
    req.session.userId = row.id;
    req.session.username = row.username;
    req.session.role = row.role;
    delete req.session.pendingMfaUserId;

    res.json({ success: true, data: { user: { id: row.id, username: row.username, role: row.role } } });
  } catch (err) {
    logger.error(err, '2FA verify error');
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});
