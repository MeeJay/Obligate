import { Router } from 'express';
import { db } from '../db';
import { authService } from '../services/auth.service';
import { preferencesService } from '../services/preferences.service';
import { configService } from '../services/config.service';
import { logger } from '../utils/logger';

export const accountRoutes = Router();

/**
 * GET /api/account/apps
 * List connected apps with the user's link status.
 */
accountRoutes.get('/apps', async (req, res) => {
  try {
    const userId = req.session.userId!;

    // Only return apps where the user has at least one permission group mapping
    const authorizedAppIds = await db('user_permission_groups as upg')
      .join('permission_group_app_mappings as pgam', 'pgam.group_id', 'upg.group_id')
      .where('upg.user_id', userId)
      .distinct('pgam.app_id')
      .pluck('pgam.app_id') as number[];

    if (authorizedAppIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const rows = await db('connected_apps as ca')
      .leftJoin('user_app_links as ual', function () {
        this.on('ual.app_id', 'ca.id').andOnVal('ual.user_id', userId);
      })
      .where('ca.is_active', true)
      .whereIn('ca.id', authorizedAppIds)
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

/**
 * PUT /api/account/password
 */
accountRoutes.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    const cfg = await configService.getAll();
    if (!newPassword || newPassword.length < cfg.minPasswordLength) {
      res.status(400).json({ success: false, error: `Password too short (min ${cfg.minPasswordLength} chars)` });
      return;
    }
    // Verify current password if user has one
    const user = await db('users').where({ id: req.session.userId! }).first() as { password_hash: string | null } | undefined;
    if (user?.password_hash && currentPassword) {
      const { comparePassword } = await import('../utils/crypto');
      const valid = await comparePassword(currentPassword, user.password_hash);
      if (!valid) { res.status(401).json({ success: false, error: 'Current password is incorrect' }); return; }
    }
    await authService.changePassword(req.session.userId!, newPassword);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

/**
 * GET /api/account/preferences
 * Returns common preferences + all app-specific preferences with schemas.
 */
accountRoutes.get('/preferences', async (req, res) => {
  try {
    const userId = req.session.userId!;
    const [common, appSchemas, allAppPrefs] = await Promise.all([
      preferencesService.getCommonPreferences(userId),
      preferencesService.getAllSchemasGroupedByApp(),
      preferencesService.getAllAppPreferences(userId),
    ]);

    // Merge schemas with user values
    const appSections = appSchemas.map(section => ({
      appId: section.appId,
      appName: section.appName,
      appType: section.appType,
      schemas: section.schemas,
      values: allAppPrefs[section.appId] ?? {},
    }));

    res.json({ success: true, data: { common, appSections } });
  } catch (err) {
    logger.error(err, 'Failed to get preferences');
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
});

/**
 * PUT /api/account/preferences/common
 */
accountRoutes.put('/preferences/common', async (req, res) => {
  try {
    await preferencesService.updateCommonPreferences(req.session.userId!, req.body);
    const common = await preferencesService.getCommonPreferences(req.session.userId!);
    res.json({ success: true, data: common });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

/**
 * PUT /api/account/preferences/app/:appId
 */
accountRoutes.put('/preferences/app/:appId', async (req, res) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const prefs = req.body as Record<string, string>;
    await preferencesService.setAppPreferences(req.session.userId!, appId, prefs);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update app preferences' });
  }
});
