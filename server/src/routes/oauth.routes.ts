import { Router } from 'express';
import { oauthService } from '../services/oauth.service';
import { appService } from '../services/app.service';
import { requireAuth, AppError } from '../middleware/auth';
import { logger } from '../utils/logger';

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

    // If user is already authenticated, issue code immediately
    if (req.session?.userId) {
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
