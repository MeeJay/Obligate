import { Router } from 'express';
import { appService } from '../services/app.service';
import { authService } from '../services/auth.service';
import { permissionGroupService } from '../services/permissionGroup.service';
import { logger } from '../utils/logger';

export const adminRoutes = Router();

// ── Connected Apps CRUD ──────────────────────────────────────────────────────

adminRoutes.get('/apps', async (_req, res) => {
  try {
    const apps = await appService.listApps();
    res.json({ success: true, data: apps });
  } catch (err) {
    logger.error(err, 'Failed to list apps');
    res.status(500).json({ success: false, error: 'Failed to list apps' });
  }
});

adminRoutes.post('/apps', async (req, res) => {
  try {
    const { appType, name, baseUrl, icon, color } = req.body;
    const app = await appService.createApp({ appType, name, baseUrl, icon, color });
    // Return the API key ONCE on creation
    res.status(201).json({ success: true, data: app });
  } catch (err) {
    logger.error(err, 'Failed to create app');
    res.status(500).json({ success: false, error: 'Failed to create app' });
  }
});

adminRoutes.put('/apps/:id', async (req, res) => {
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

adminRoutes.delete('/apps/:id', async (req, res) => {
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

adminRoutes.post('/apps/:id/regenerate-key', async (req, res) => {
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

// ── Users CRUD ───────────────────────────────────────────────────────────────

adminRoutes.get('/users', async (_req, res) => {
  try {
    const users = await authService.listUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    logger.error(err, 'Failed to list users');
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
});

adminRoutes.post('/users', async (req, res) => {
  try {
    const { username, email, displayName, password, role } = req.body;
    const user = await authService.createUser({ username, email, displayName, password, role });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    logger.error(err, 'Failed to create user');
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

// ── Permission Groups CRUD ───────────────────────────────────────────────────

adminRoutes.get('/permission-groups', async (_req, res) => {
  try {
    const groups = await permissionGroupService.listGroups();
    res.json({ success: true, data: groups });
  } catch (err) {
    logger.error(err, 'Failed to list permission groups');
    res.status(500).json({ success: false, error: 'Failed to list groups' });
  }
});

adminRoutes.post('/permission-groups', async (req, res) => {
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

adminRoutes.put('/permission-groups/:id', async (req, res) => {
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

adminRoutes.delete('/permission-groups/:id', async (req, res) => {
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

// ── Permission Group Mappings ────────────────────────────────────────────────

adminRoutes.get('/permission-groups/:id/mappings', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const mappings = await permissionGroupService.getMappingsForGroup(id);
    res.json({ success: true, data: mappings });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list mappings' });
  }
});

adminRoutes.post('/permission-groups/:id/mappings', async (req, res) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const mapping = await permissionGroupService.addMapping({ groupId, ...req.body });
    res.status(201).json({ success: true, data: mapping });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add mapping' });
  }
});

adminRoutes.delete('/permission-groups/:gid/mappings/:mid', async (req, res) => {
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

// ── User ↔ Group assignments ─────────────────────────────────────────────────

adminRoutes.get('/users/:id/groups', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const groups = await permissionGroupService.getGroupsForUser(userId);
    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list user groups' });
  }
});

adminRoutes.post('/users/:uid/groups/:gid', async (req, res) => {
  try {
    const userId = parseInt(req.params.uid, 10);
    const groupId = parseInt(req.params.gid, 10);
    await permissionGroupService.assignUserToGroup(userId, groupId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to assign group' });
  }
});

adminRoutes.delete('/users/:uid/groups/:gid', async (req, res) => {
  try {
    const userId = parseInt(req.params.uid, 10);
    const groupId = parseInt(req.params.gid, 10);
    await permissionGroupService.removeUserFromGroup(userId, groupId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to remove group' });
  }
});
