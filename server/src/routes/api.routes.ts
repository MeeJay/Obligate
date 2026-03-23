import { Router } from 'express';
import { appService } from '../services/app.service';
import { preferencesService } from '../services/preferences.service';
import { logger } from '../utils/logger';
import { db } from '../db';

export const apiRoutes = Router();

/**
 * Middleware: validate Bearer API key for server-to-server calls.
 */
async function requireAppBearer(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing Bearer token' });
    return;
  }
  const app = await appService.getAppByApiKey(authHeader.slice(7));
  if (!app) {
    res.status(401).json({ success: false, error: 'Invalid API key' });
    return;
  }
  req.appId = app.id;
  req.appType = app.app_type;
  next();
}

/**
 * GET /api/apps/connected
 * Returns all active connected apps (for cross-app navigation buttons).
 */
apiRoutes.get('/connected', requireAppBearer, async (_req, res) => {
  try {
    const apps = await appService.getConnectedAppsPublic();
    res.json({ success: true, data: apps });
  } catch (err) {
    logger.error(err, 'Failed to list connected apps');
    res.status(500).json({ success: false, error: 'Failed to list apps' });
  }
});

/**
 * POST /api/apps/sync-preference-schemas
 * App registers its specific preference fields (called on app startup or admin config change).
 */
apiRoutes.post('/sync-preference-schemas', requireAppBearer, async (req: any, res) => {
  try {
    const schemas = req.body.schemas as Array<{
      key: string; label: string; fieldType: string;
      options?: string[] | null; defaultValue?: string | null; sortOrder?: number;
    }>;
    if (!Array.isArray(schemas)) {
      res.status(400).json({ success: false, error: 'Missing schemas array' });
      return;
    }
    await preferencesService.syncSchemas(req.appId, schemas.map((s, i) => ({
      key: s.key,
      label: s.label,
      fieldType: s.fieldType as 'text' | 'select' | 'boolean' | 'number',
      options: s.options ?? null,
      defaultValue: s.defaultValue ?? null,
      sortOrder: s.sortOrder ?? i,
    })));
    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'Failed to sync preference schemas');
    res.status(500).json({ success: false, error: 'Failed to sync schemas' });
  }
});

/**
 * POST /api/apps/report-provision
 * App reports the local user ID after provisioning an Obligate user.
 */
apiRoutes.post('/report-provision', requireAppBearer, async (req: any, res) => {
  try {
    const { obligateUserId, remoteUserId } = req.body as {
      obligateUserId: number; remoteUserId: number;
    };
    if (!obligateUserId || !remoteUserId) {
      res.status(400).json({ success: false, error: 'Missing obligateUserId or remoteUserId' });
      return;
    }

    await db('user_app_links')
      .where({ user_id: obligateUserId, app_id: req.appId })
      .update({ remote_user_id: remoteUserId });

    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'Failed to report provision');
    res.status(500).json({ success: false, error: 'Failed to report provision' });
  }
});

/**
 * POST /api/devices/register
 * App registers a device UUID + path for cross-app linking.
 */
apiRoutes.post('/register', requireAppBearer, async (req: any, res) => {
  try {
    const { uuid, path } = req.body as { uuid: string; path: string };
    if (!uuid || !path) {
      res.status(400).json({ success: false, error: 'Missing uuid or path' });
      return;
    }

    await db('device_links')
      .insert({ device_uuid: uuid, app_id: req.appId, app_path: path, updated_at: new Date() })
      .onConflict(['device_uuid', 'app_id'])
      .merge({ app_path: path, updated_at: new Date() });

    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'Failed to register device');
    res.status(500).json({ success: false, error: 'Failed to register device' });
  }
});

/**
 * GET /api/apps/:id/remote-info
 * Fetch teams + tenants from a connected app (for mapping UI).
 */
apiRoutes.get('/:id/remote-info', requireAppBearer, async (req: any, res) => {
  try {
    const appId = parseInt(req.params.id, 10);
    const app = await db('connected_apps').where({ id: appId, is_active: true }).first() as {
      base_url: string; api_key: string;
    } | undefined;
    if (!app) { res.json({ success: true, data: null }); return; }

    // Call the target app's /api/auth/app-info endpoint with OUR api key as Bearer
    // The app validates this key against its own obligate_config.apiKey
    const response = await fetch(`${app.base_url}/api/auth/app-info`, {
      headers: { 'Authorization': `Bearer ${app.api_key}` },
    });
    if (!response.ok) { res.json({ success: true, data: null }); return; }
    const data = await response.json() as { success: boolean; data?: unknown };
    res.json({ success: true, data: data.data ?? null });
  } catch (err) {
    logger.error(err, 'Failed to fetch remote app info');
    res.json({ success: true, data: null });
  }
});

/**
 * GET /api/apps/user-preferences/:userId
 * Returns common + app-specific preferences for a given Obligate user.
 * Called by connected apps to sync preferences in real-time.
 */
apiRoutes.get('/user-preferences/:userId', requireAppBearer, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ success: false, error: 'Invalid userId' });
      return;
    }

    const [common, appPrefs] = await Promise.all([
      preferencesService.getCommonPreferences(userId),
      preferencesService.getAppPreferences(userId, req.appId),
    ]);

    res.json({ success: true, data: { ...common, appSpecific: appPrefs } });
  } catch (err) {
    logger.error(err, 'Failed to fetch user preferences');
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

/**
 * GET /api/devices/link?uuid=xxx&target_app=obliguard
 * Resolve a device UUID to a URL on another app.
 */
apiRoutes.get('/link', requireAppBearer, async (req, res) => {
  try {
    const { uuid, target_app } = req.query as { uuid?: string; target_app?: string };
    if (!uuid || !target_app) {
      res.status(400).json({ success: false, error: 'Missing uuid or target_app' });
      return;
    }

    const link = await db('device_links as dl')
      .join('connected_apps as ca', 'ca.id', 'dl.app_id')
      .where({ 'dl.device_uuid': uuid, 'ca.app_type': target_app, 'ca.is_active': true })
      .select('ca.base_url', 'dl.app_path')
      .first() as { base_url: string; app_path: string } | undefined;

    if (!link) {
      res.json({ success: true, data: null });
      return;
    }

    res.json({ success: true, data: { url: `${link.base_url}${link.app_path}` } });
  } catch (err) {
    logger.error(err, 'Failed to resolve device link');
    res.status(500).json({ success: false, error: 'Failed to resolve device link' });
  }
});
