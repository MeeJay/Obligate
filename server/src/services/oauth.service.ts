import { db } from '../db';
import { generateToken } from '../utils/crypto';
import { logger } from '../utils/logger';
import { permissionGroupService } from './permissionGroup.service';
import { preferencesService } from './preferences.service';

const AUTH_CODE_TTL_MS = 60 * 1000; // 60 seconds
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastCleanup = 0;

export const oauthService = {
  /**
   * Generate a one-time authorization code for a user + app.
   */
  async generateCode(userId: number, appId: number, redirectUri: string): Promise<string> {
    // Periodic cleanup of expired codes
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
      lastCleanup = now;
      await db('auth_codes').where('expires_at', '<', new Date()).del().catch(() => {});
    }

    const code = generateToken(32);
    await db('auth_codes').insert({
      code,
      user_id: userId,
      app_id: appId,
      redirect_uri: redirectUri,
      expires_at: new Date(now + AUTH_CODE_TTL_MS),
    });
    return code;
  },

  /**
   * Exchange a one-time code for user info. Returns null if invalid/expired/used.
   * Atomically marks the code as used to prevent replay.
   */
  async exchangeCode(code: string, appId: number, redirectUri: string) {
    // Atomically claim the code
    const [row] = await db('auth_codes')
      .where({ code, app_id: appId, redirect_uri: redirectUri, used: false })
      .where('expires_at', '>', new Date())
      .update({ used: true })
      .returning('*') as Array<{
        user_id: number;
        app_id: number;
      }>;

    if (!row) return null;

    // Fetch user
    const user = await db('users').where({ id: row.user_id, is_active: true }).first() as {
      id: number; username: string; email: string | null; display_name: string | null;
      auth_source: string;
    } | undefined;
    if (!user) return null;

    // Check if user is explicitly disabled on this app
    const link = await db('user_app_links')
      .where({ user_id: user.id, app_id: appId })
      .first() as { enabled: boolean; remote_user_id: number | null } | undefined;

    if (link && !link.enabled) {
      logger.warn(`User ${user.id} (${user.username}) denied access to app ${appId} (disabled)`);
      return null;
    }

    // Resolve permissions for this app from permission groups
    const resolved = await permissionGroupService.resolveForUserAndApp(user.id, appId);

    // DENY access if user has no permission group mapping for this app (no role = no access)
    // This prevents users without explicit group assignments from accessing apps
    if (!resolved.role || resolved.role === '') {
      logger.warn(`User ${user.id} (${user.username}) denied access to app ${appId} (no permission group mapping)`);
      return null;
    }

    // Update or create app link on successful access
    if (link) {
      await db('user_app_links')
        .where({ user_id: user.id, app_id: appId })
        .update({ last_login_at: new Date() });
    } else {
      await db('user_app_links').insert({
        user_id: user.id,
        app_id: appId,
        enabled: true,
        first_login_at: new Date(),
        last_login_at: new Date(),
      }).onConflict(['user_id', 'app_id']).merge({ last_login_at: new Date() });
    }

    // Fetch preferences (common + app-specific)
    const [commonPrefs, appPrefs] = await Promise.all([
      preferencesService.getCommonPreferences(user.id),
      preferencesService.getAppPreferences(user.id, appId),
    ]);

    return {
      obligateUserId: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      role: resolved.role,
      tenants: resolved.tenants,
      teams: resolved.teams,
      capabilities: resolved.capabilities,
      authSource: user.auth_source as 'local' | 'ldap',
      linkedLocalUserId: link?.remote_user_id ?? null,
      preferences: {
        ...commonPrefs,
        appSpecific: appPrefs,
      },
    };
  },
};
