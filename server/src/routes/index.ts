import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { oauthRoutes } from './oauth.routes';
import { adminRoutes } from './admin.routes';
import { apiRoutes } from './api.routes';
import { accountRoutes } from './account.routes';
import { twoFactorRoutes } from './twoFactor.routes';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const routes = Router();

// Public auth routes (login, logout)
routes.use('/auth', authRoutes);

// 2FA routes (mixed: profile endpoints require auth, verify is public with rate limit)
routes.use('/profile/2fa', twoFactorRoutes);

// OAuth flow (authorize, token exchange)
routes.use('/oauth', oauthRoutes);

// App-facing API (server-to-server, Bearer auth)
routes.use('/apps', apiRoutes);
routes.use('/devices', apiRoutes);

// User dashboard (requires auth)
routes.use('/account', requireAuth, accountRoutes);

// Admin routes (requires admin)
routes.use('/admin', requireAdmin, adminRoutes);
