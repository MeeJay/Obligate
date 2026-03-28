import { db } from '../db';
import { logger } from '../utils/logger';

/**
 * Push SSO user state changes to all connected apps.
 * Called when an admin deactivates, reactivates, or deletes a user on Obligate.
 */
export const ssoSyncService = {
  /**
   * Notify all connected apps of a user state change.
   * action: 'deactivate' | 'reactivate' | 'delete' | 'update-role'
   */
  async pushUserChange(obligateUserId: number, action: 'deactivate' | 'reactivate' | 'delete' | 'update-role', extra?: { role?: string }): Promise<void> {
    // Get user info
    const user = await db('users').where({ id: obligateUserId }).first() as {
      id: number; username: string; role: string; is_active: boolean;
    } | undefined;

    // For delete, user may already be gone — that's OK, we still notify apps
    const username = user?.username ?? `obligateUser#${obligateUserId}`;

    // Get all connected apps with their API keys
    const apps = await db('connected_apps')
      .where({ is_active: true })
      .select('id', 'name', 'base_url', 'api_key') as Array<{
        id: number; name: string; base_url: string; api_key: string;
      }>;

    // Get app links to know the remote_user_id for each app
    const links = await db('user_app_links')
      .where({ user_id: obligateUserId })
      .select('app_id', 'remote_user_id') as Array<{
        app_id: number; remote_user_id: number | null;
      }>;

    const linkMap = new Map(links.map(l => [l.app_id, l.remote_user_id]));

    for (const app of apps) {
      const remoteUserId = linkMap.get(app.id);
      if (!remoteUserId) continue; // User was never provisioned on this app

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${app.base_url}/api/auth/sso-user-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${app.api_key}`,
          },
          body: JSON.stringify({
            obligateUserId,
            obligateUsername: username,
            remoteUserId,
            action,
            role: extra?.role,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          logger.info(`SSO sync: ${action} user ${username} → ${app.name} OK`);
          // If deleted, clean up the app link
          if (action === 'delete') {
            await db('user_app_links').where({ user_id: obligateUserId, app_id: app.id }).del();
          }
        } else {
          logger.warn(`SSO sync: ${action} user ${username} → ${app.name} failed (${res.status})`);
        }
      } catch (err) {
        logger.warn(`SSO sync: ${action} user ${username} → ${app.name} unreachable`);
      }
    }
  },
};
