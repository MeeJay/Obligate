import { Router } from 'express';
import { appService } from '../services/app.service';
import { authService } from '../services/auth.service';
import { permissionGroupService } from '../services/permissionGroup.service';
import { configService } from '../services/config.service';
import { ssoSyncService } from '../services/ssoSync.service';
import { requireAdmin } from '../middleware/auth';
import { db } from '../db';
import { logger } from '../utils/logger';

export const adminRoutes = Router();

// Routes are mounted under /admin with requireAuth only; admin-only handlers
// individually use the requireAdmin middleware. A few user-management
// endpoints accept non-admin users who have group-manager rights covering
// the target user — those endpoints do their own scope check inline.

function isAdmin(req: any): boolean {
  return req.session?.role === 'admin';
}

async function canActOnUser(req: any, targetUserId: number): Promise<boolean> {
  return permissionGroupService.canActOnUser(req.session.userId, req.session.role, targetUserId);
}

// ── Connected Apps CRUD (admin only) ─────────────────────────────────────────

adminRoutes.get('/apps', requireAdmin, async (_req, res) => {
  try {
    const apps = await appService.listApps();
    res.json({ success: true, data: apps });
  } catch (err) {
    logger.error(err, 'Failed to list apps');
    res.status(500).json({ success: false, error: 'Failed to list apps' });
  }
});

adminRoutes.post('/apps', requireAdmin, async (req, res) => {
  try {
    const { appType, name, baseUrl, icon, color } = req.body;
    const app = await appService.createApp({ appType, name, baseUrl, icon, color });
    res.status(201).json({ success: true, data: app });
  } catch (err) {
    logger.error(err, 'Failed to create app');
    res.status(500).json({ success: false, error: 'Failed to create app' });
  }
});

adminRoutes.put('/apps/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const app = await appService.updateApp(id, req.body);
    if (!app) {
      res.status(404).json({ success: false, error: 'App not found' });
      return;
    }
    res.json({ success: true, data: app });
  } catch (err) {
    logger.error(err, 'Failed to update app');
    res.status(500).json({ success: false, error: 'Failed to update app' });
  }
});

adminRoutes.delete('/apps/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await appService.deleteApp(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'App not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'Failed to delete app');
    res.status(500).json({ success: false, error: 'Failed to delete app' });
  }
});

adminRoutes.get('/apps/:id/dashboard-stats', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const app = await db('connected_apps').where({ id, is_active: true }).first() as {
      base_url: string; api_key: string;
    } | undefined;
    if (!app) { res.json({ success: true, data: null }); return; }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${app.base_url}/api/auth/dashboard-stats`, {
      headers: { 'Authorization': `Bearer ${app.api_key}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) { res.json({ success: true, data: null }); return; }
    const data = await response.json() as { success: boolean; data?: unknown };
    res.json({ success: true, data: data.data ?? null });
  } catch {
    res.json({ success: true, data: null });
  }
});

adminRoutes.get('/apps/:id/remote-info', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const app = await db('connected_apps').where({ id, is_active: true }).first() as {
      base_url: string; api_key: string;
    } | undefined;
    if (!app) { res.json({ success: true, data: null }); return; }

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

adminRoutes.post('/apps/:id/regenerate-key', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const newKey = await appService.regenerateApiKey(id);
    if (!newKey) {
      res.status(404).json({ success: false, error: 'App not found' });
      return;
    }
    res.json({ success: true, data: { apiKey: newKey } });
  } catch (err) {
    logger.error(err, 'Failed to regenerate key');
    res.status(500).json({ success: false, error: 'Failed to regenerate key' });
  }
});

// ── Users CRUD (admin OR group manager with scope) ───────────────────────────

adminRoutes.get('/users', async (req: any, res) => {
  try {
    const [users, userGroups, activity] = await Promise.all([
      authService.listUsers(),
      permissionGroupService.getAllUserGroupAssignments(),
      authService.getAggregatedActivity(),
    ]);

    let scopedUsers = users;
    let actionableMap: Record<number, boolean> = {};
    if (!isAdmin(req)) {
      const [visible, actionable] = await Promise.all([
        permissionGroupService.getVisibleUserIds(req.session.userId),
        permissionGroupService.getActionableUserIds(req.session.userId),
      ]);
      const visibleSet = new Set(visible);
      const actionableSet = new Set(actionable);
      scopedUsers = users.filter(u => visibleSet.has(u.id));
      actionableMap = Object.fromEntries(scopedUsers.map(u => [u.id, actionableSet.has(u.id)]));
    } else {
      actionableMap = Object.fromEntries(users.map(u => [u.id, true]));
    }

    const activityMap: Record<number, { lastActivityAt: string; lastActivityApp: string } | null> = {};
    activity.forEach((v, k) => { activityMap[k] = v; });

    res.json({ success: true, data: scopedUsers, userGroups, activity: activityMap, actionable: actionableMap });
  } catch (err) {
    logger.error(err, 'Failed to list users');
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

adminRoutes.get('/users/:id/activity', async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ success: false, error: 'Invalid user id' });
      return;
    }
    if (!isAdmin(req) && !(await canActOnUser(req, userId))) {
      res.status(403).json({ success: false, error: 'Out of scope' });
      return;
    }

    const user = await db('users').where({ id: userId })
      .select('last_login_at', 'totp_enabled', 'created_at').first() as {
        last_login_at: Date | null; totp_enabled: boolean; created_at: Date;
      } | undefined;
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const rows = await db('user_app_links as ual')
      .join('connected_apps as ca', 'ca.id', 'ual.app_id')
      .where({ 'ual.user_id': userId, 'ca.is_active': true })
      .select(
        'ca.id as app_id', 'ca.app_type', 'ca.name', 'ca.color',
        'ual.first_login_at', 'ual.last_login_at', 'ual.enabled', 'ual.remote_user_id',
      ) as Array<{
        app_id: number; app_type: string; name: string; color: string | null;
        first_login_at: Date | null; last_login_at: Date | null;
        enabled: boolean; remote_user_id: number | null;
      }>;

    res.json({
      success: true,
      data: {
        obligateLastLogin: user.last_login_at?.toISOString() ?? null,
        totpEnabled: user.totp_enabled,
        createdAt: user.created_at.toISOString(),
        apps: rows
          .sort((a, b) => (b.last_login_at?.getTime() ?? 0) - (a.last_login_at?.getTime() ?? 0))
          .map(r => ({
            appId: r.app_id,
            appType: r.app_type,
            name: r.name,
            color: r.color,
            firstLoginAt: r.first_login_at?.toISOString() ?? null,
            lastLoginAt: r.last_login_at?.toISOString() ?? null,
            enabled: r.enabled,
            linked: r.remote_user_id != null,
          })),
      },
    });
  } catch (err) {
    logger.error(err, 'Failed to fetch user activity');
    res.status(500).json({ success: false, error: 'Failed to fetch user activity' });
  }
});

adminRoutes.post('/users', async (req: any, res) => {
  try {
    const { username, email, displayName, password, role, groupIds } = req.body as {
      username: string; email?: string; displayName?: string; password?: string;
      role?: 'admin' | 'user'; groupIds?: number[];
    };

    const requestedGroupIds = Array.isArray(groupIds) ? groupIds : [];

    if (!isAdmin(req)) {
      // Manager: cannot create admin users, must provide ≥1 group, all groups must be managed.
      if (role === 'admin') {
        res.status(403).json({ success: false, error: 'Only admins can create admin users' });
        return;
      }
      if (requestedGroupIds.length === 0) {
        res.status(400).json({ success: false, error: 'At least one permission group is required' });
        return;
      }
      const managed = new Set(await permissionGroupService.getManagedGroupIds(req.session.userId));
      if (!requestedGroupIds.every(gid => managed.has(gid))) {
        res.status(403).json({ success: false, error: 'One or more groups are outside your management scope' });
        return;
      }
    }

    const user = await authService.createUser({ username, email, displayName, password, role });

    for (const gid of requestedGroupIds) {
      await permissionGroupService.assignUserToGroup(user.id, gid);
    }

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    logger.error(err, 'Failed to create user');
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

adminRoutes.put('/users/:id', async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const before = await authService.getUserById(id);
    if (!before) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    if (!isAdmin(req)) {
      if (!(await canActOnUser(req, id))) {
        res.status(403).json({ success: false, error: 'Out of scope' });
        return;
      }
      // Managers can only toggle isActive; no role/email/displayName edits.
      const allowed: Record<string, unknown> = {};
      if (req.body.isActive !== undefined) allowed.isActive = req.body.isActive;
      if (Object.keys(allowed).length === 0) {
        res.status(403).json({ success: false, error: 'Managers can only toggle active status' });
        return;
      }
      req.body = allowed;
    }

    const user = await authService.updateUser(id, req.body);
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    if (before.isActive && !user.isActive) {
      ssoSyncService.pushUserChange(id, 'deactivate').catch(() => {});
    } else if (!before.isActive && user.isActive) {
      ssoSyncService.pushUserChange(id, 'reactivate').catch(() => {});
    }
    if (before.role !== user.role) {
      ssoSyncService.pushUserChange(id, 'update-role', { role: user.role }).catch(() => {});
    }

    res.json({ success: true, data: user });
  } catch (err) {
    logger.error(err, 'Failed to update user');
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

adminRoutes.put('/users/:id/password', async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!isAdmin(req) && !(await canActOnUser(req, id))) {
      res.status(403).json({ success: false, error: 'Out of scope' });
      return;
    }
    const { password } = req.body as { password?: string };
    const cfg = await configService.getAll();
    if (!password || password.length < cfg.minPasswordLength) { res.status(400).json({ success: false, error: `Password too short (min ${cfg.minPasswordLength} chars)` }); return; }
    const ok = await authService.changePassword(id, password);
    if (!ok) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

adminRoutes.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.session.userId) { res.status(400).json({ success: false, error: 'Cannot delete yourself' }); return; }

    await ssoSyncService.pushUserChange(id, 'delete');

    const ok = await authService.deleteUser(id);
    if (!ok) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    await db('user_app_links').where({ user_id: id }).del();
    await db('user_permission_groups').where({ user_id: id }).del();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// ── Permission Groups CRUD ───────────────────────────────────────────────────

// Listing is open to managers (they need to see their managed groups in the UI).
// Mutations are admin-only.
adminRoutes.get('/permission-groups', async (_req, res) => {
  try {
    const [groups, managers] = await Promise.all([
      permissionGroupService.listGroups(),
      permissionGroupService.getAllGroupManagers(),
    ]);
    res.json({ success: true, data: groups, managers });
  } catch (err) {
    logger.error(err, 'Failed to list permission groups');
    res.status(500).json({ success: false, error: 'Failed to list groups' });
  }
});

// "My managed groups" — used by the manager's user-create form to populate
// the (mandatory) group picker.
adminRoutes.get('/my-managed-groups', async (req: any, res) => {
  try {
    if (isAdmin(req)) {
      const groups = await permissionGroupService.listGroups();
      res.json({ success: true, data: groups });
      return;
    }
    const ids = await permissionGroupService.getManagedGroupIds(req.session.userId);
    if (ids.length === 0) { res.json({ success: true, data: [] }); return; }
    const groups = await permissionGroupService.listGroups();
    res.json({ success: true, data: groups.filter(g => ids.includes(g.id)) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list managed groups' });
  }
});

adminRoutes.post('/permission-groups', requireAdmin, async (req: any, res) => {
  try {
    const group = await permissionGroupService.createGroup({
      ...req.body,
      createdBy: req.session.userId,
    });
    res.status(201).json({ success: true, data: group });
  } catch (err) {
    logger.error(err, 'Failed to create permission group');
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
});

adminRoutes.put('/permission-groups/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const group = await permissionGroupService.updateGroup(id, req.body);
    if (!group) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }
    res.json({ success: true, data: group });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
});

adminRoutes.delete('/permission-groups/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await permissionGroupService.deleteGroup(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Group not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
});

// ── Permission Group Managers (admin only) ───────────────────────────────────

adminRoutes.get('/permission-groups/:id/managers', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userIds = await permissionGroupService.getManagersForGroup(id);
    res.json({ success: true, data: userIds });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list managers' });
  }
});

adminRoutes.put('/permission-groups/:id/managers', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { userIds } = req.body as { userIds?: number[] };
    if (!Array.isArray(userIds)) {
      res.status(400).json({ success: false, error: 'userIds array required' });
      return;
    }
    await permissionGroupService.setManagers(id, userIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to set managers' });
  }
});

// ── Permission Group Mappings (admin only) ───────────────────────────────────

adminRoutes.get('/permission-groups/:id/mappings', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const mappings = await permissionGroupService.getMappingsForGroup(id);
    res.json({ success: true, data: mappings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list mappings' });
  }
});

adminRoutes.post('/permission-groups/:id/mappings', requireAdmin, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const mapping = await permissionGroupService.addMapping({ groupId, ...req.body });
    res.status(201).json({ success: true, data: mapping });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add mapping' });
  }
});

adminRoutes.put('/permission-groups/:gid/mappings/:mid', requireAdmin, async (req, res) => {
  try {
    const mid = parseInt(req.params.mid, 10);
    const { appRole } = req.body as { appRole?: string };
    const mapping = await permissionGroupService.updateMapping(mid, { appRole });
    if (!mapping) { res.status(404).json({ success: false, error: 'Mapping not found' }); return; }
    res.json({ success: true, data: mapping });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update mapping' });
  }
});

adminRoutes.delete('/permission-groups/:gid/mappings/:mid', requireAdmin, async (req, res) => {
  try {
    const mid = parseInt(req.params.mid, 10);
    const deleted = await permissionGroupService.deleteMapping(mid);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Mapping not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete mapping' });
  }
});

// ── User ↔ Group assignments (admin or manager-with-scope) ───────────────────

adminRoutes.get('/users/:id/groups', async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!isAdmin(req) && !(await canActOnUser(req, userId))) {
      res.status(403).json({ success: false, error: 'Out of scope' });
      return;
    }
    const groups = await permissionGroupService.getGroupsForUser(userId);
    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list user groups' });
  }
});

adminRoutes.post('/users/:uid/groups/:gid', async (req: any, res) => {
  try {
    const userId = parseInt(req.params.uid, 10);
    const groupId = parseInt(req.params.gid, 10);

    if (!isAdmin(req)) {
      // Manager: target must already be entirely in scope AND the new group must be managed.
      if (!(await canActOnUser(req, userId))) {
        res.status(403).json({ success: false, error: 'Out of scope' });
        return;
      }
      const managed = await permissionGroupService.getManagedGroupIds(req.session.userId);
      if (!managed.includes(groupId)) {
        res.status(403).json({ success: false, error: 'Group is outside your management scope' });
        return;
      }
    }

    await permissionGroupService.assignUserToGroup(userId, groupId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to assign group' });
  }
});

adminRoutes.delete('/users/:uid/groups/:gid', async (req: any, res) => {
  try {
    const userId = parseInt(req.params.uid, 10);
    const groupId = parseInt(req.params.gid, 10);

    if (!isAdmin(req)) {
      if (!(await canActOnUser(req, userId))) {
        res.status(403).json({ success: false, error: 'Out of scope' });
        return;
      }
      const managed = await permissionGroupService.getManagedGroupIds(req.session.userId);
      if (!managed.includes(groupId)) {
        res.status(403).json({ success: false, error: 'Group is outside your management scope' });
        return;
      }
      // Prevent a manager from removing the user's last managed group — that
      // would orphan the user (no groups → no one can act on them but admin).
      const userGroups = await permissionGroupService.getGroupsForUser(userId);
      if (userGroups.length === 1 && userGroups[0].id === groupId) {
        res.status(400).json({ success: false, error: 'Cannot remove the last group — only an admin can fully unassign a user' });
        return;
      }
    }

    await permissionGroupService.removeUserFromGroup(userId, groupId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove group' });
  }
});

// ── App Settings (admin only) ────────────────────────────────────────────────

adminRoutes.get('/settings', requireAdmin, async (_req, res) => {
  try {
    const config = await configService.getAll();
    res.json({ success: true, data: { ...config, smtpPass: config.smtpPass ? '••••••••' : '' } });
  } catch (err) {
    logger.error(err, 'Failed to get settings');
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

adminRoutes.put('/settings', requireAdmin, async (req, res) => {
  try {
    const patch = req.body as Record<string, string>;
    if (patch.smtpPass === '••••••••') delete patch.smtpPass;
    const config = await configService.update(patch);
    res.json({ success: true, data: { ...config, smtpPass: config.smtpPass ? '••••••••' : '' } });
  } catch (err) {
    logger.error(err, 'Failed to update settings');
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});
