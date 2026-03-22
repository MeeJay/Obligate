import { Router } from 'express';
import { db } from '../db';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

export const accountRoutes = Router();

/**
 * GET /api/account/apps
 * List connected apps with the user's link status.
 */
accountRoutes.get('/apps', async (req, res) => {
  try {
    const userId = req.session.userId!;
    const rows = await db('connected_apps as ca')
      .leftJoin('user_app_links as ual', function () {
        this.on('ual.app_id', 'ca.id').andOnVal('ual.user_id', userId);
      })
      .where('ca.is_active', true)
      .select(
        'ca.id', 'ca.app_type', 'ca.name', 'ca.base_url', 'ca.icon', 'ca.color',
        'ual.remote_user_id', 'ual.enabled', 'ual.first_login_at', 'ual.last_login_at',
      );

    res.json({
      success: true,
      data: rows.map(r => ({
        appId: r.id,
        appType: r.app_type,
        name: r.name,
        baseUrl: r.base_url,
        icon: r.icon,
        color: r.color,
        linked: r.remote_user_id != null,
        enabled: r.enabled ?? true,
        firstLoginAt: r.first_login_at?.toISOString() ?? null,
        lastLoginAt: r.last_login_at?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logger.error(err, 'Failed to list account apps');
    res.status(500).json({ success: false, error: 'Failed to list apps' });
  }
});

/**
 * GET /api/account/profile
 */
accountRoutes.get('/profile', async (req, res) => {
  try {
    const user = await authService.getUserById(req.session.userId!);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/account/profile
 */
accountRoutes.put('/profile', async (req, res) => {
  try {
    const { displayName, email, preferredLanguage } = req.body as {
      displayName?: string; email?: string; preferredLanguage?: string;
    };

    const update: Record<string, unknown> = { updated_at: new Date() };
    if (displayName !== undefined) update.display_name = displayName;
    if (email !== undefined) update.email = email;
    if (preferredLanguage !== undefined) update.preferred_language = preferredLanguage;

    await db('users').where({ id: req.session.userId! }).update(update);

    const user = await authService.getUserById(req.session.userId!);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});
