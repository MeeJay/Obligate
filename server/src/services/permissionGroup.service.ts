import { db } from '../db';
import type { PermissionGroup, PermissionGroupAppMapping } from '@obligate/shared';

interface GroupRow {
  id: number;
  name: string;
  description: string | null;
  scope: string;
  tenant_id: number | null;
  created_by: number | null;
  created_at: Date;
}

interface MappingRow {
  id: number;
  group_id: number;
  app_id: number;
  app_role: string;
  tenant_slug: string | null;
  team_name: string | null;
}

function rowToGroup(row: GroupRow): PermissionGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scope: row.scope as 'global' | 'tenant',
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

function rowToMapping(r: MappingRow): PermissionGroupAppMapping {
  return {
    id: r.id,
    groupId: r.group_id,
    appId: r.app_id,
    appRole: r.app_role,
    tenantSlug: r.tenant_slug,
    teamName: r.team_name,
  };
}

export const permissionGroupService = {
  async listGroups(): Promise<PermissionGroup[]> {
    const rows = await db('permission_groups').orderBy('name') as GroupRow[];
    return rows.map(rowToGroup);
  },

  async getGroupById(id: number): Promise<PermissionGroup | null> {
    const row = await db('permission_groups').where({ id }).first() as GroupRow | undefined;
    if (!row) return null;
    return rowToGroup(row);
  },

  async createGroup(data: {
    name: string;
    description?: string | null;
    scope?: 'global' | 'tenant';
    tenantId?: number | null;
    createdBy?: number | null;
  }): Promise<PermissionGroup> {
    const [row] = await db('permission_groups')
      .insert({
        name: data.name,
        description: data.description ?? null,
        scope: data.scope ?? 'global',
        tenant_id: data.tenantId ?? null,
        created_by: data.createdBy ?? null,
      })
      .returning('*') as GroupRow[];
    return rowToGroup(row);
  },

  async updateGroup(id: number, data: {
    name?: string;
    description?: string | null;
  }): Promise<PermissionGroup | null> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.description !== undefined) update.description = data.description;
    if (Object.keys(update).length === 0) return this.getGroupById(id);

    const [row] = await db('permission_groups')
      .where({ id })
      .update(update)
      .returning('*') as GroupRow[];
    if (!row) return null;
    return rowToGroup(row);
  },

  async deleteGroup(id: number): Promise<boolean> {
    const count = await db('permission_groups').where({ id }).del();
    return count > 0;
  },

  // ── App Mappings ─────────────────────────────────────────────

  async getMappingsForGroup(groupId: number): Promise<PermissionGroupAppMapping[]> {
    const rows = await db('permission_group_app_mappings')
      .where({ group_id: groupId }) as MappingRow[];
    return rows.map(rowToMapping);
  },

  async addMapping(data: {
    groupId: number;
    appId: number;
    appRole: string;
    tenantSlug?: string | null;
    teamName?: string | null;
  }): Promise<PermissionGroupAppMapping> {
    const [row] = await db('permission_group_app_mappings')
      .insert({
        group_id: data.groupId,
        app_id: data.appId,
        app_role: data.appRole,
        tenant_slug: data.tenantSlug ?? null,
        team_name: data.teamName ?? null,
      })
      .returning('*') as MappingRow[];
    return rowToMapping(row);
  },

  async updateMapping(id: number, data: {
    appRole?: string;
  }): Promise<PermissionGroupAppMapping | null> {
    const update: Record<string, unknown> = {};
    if (data.appRole !== undefined) update.app_role = data.appRole;
    if (Object.keys(update).length === 0) return null;

    const [row] = await db('permission_group_app_mappings')
      .where({ id })
      .update(update)
      .returning('*') as MappingRow[];
    if (!row) return null;
    return rowToMapping(row);
  },

  async deleteMapping(id: number): Promise<boolean> {
    const count = await db('permission_group_app_mappings').where({ id }).del();
    return count > 0;
  },

  // ── User ↔ Group assignments ─────────────────────────────────

  async assignUserToGroup(userId: number, groupId: number): Promise<void> {
    await db('user_permission_groups')
      .insert({ user_id: userId, group_id: groupId })
      .onConflict(['user_id', 'group_id'])
      .ignore();
  },

  async removeUserFromGroup(userId: number, groupId: number): Promise<void> {
    await db('user_permission_groups')
      .where({ user_id: userId, group_id: groupId })
      .del();
  },

  async getGroupsForUser(userId: number): Promise<PermissionGroup[]> {
    const rows = await db('user_permission_groups as upg')
      .join('permission_groups as pg', 'pg.id', 'upg.group_id')
      .where('upg.user_id', userId)
      .select('pg.*') as GroupRow[];
    return rows.map(rowToGroup);
  },

  async getAllUserGroupAssignments(): Promise<Record<number, PermissionGroup[]>> {
    const rows = await db('user_permission_groups as upg')
      .join('permission_groups as pg', 'pg.id', 'upg.group_id')
      .select('upg.user_id', 'pg.*') as Array<GroupRow & { user_id: number }>;
    const result: Record<number, PermissionGroup[]> = {};
    for (const row of rows) {
      if (!result[row.user_id]) result[row.user_id] = [];
      result[row.user_id].push(rowToGroup(row));
    }
    return result;
  },

  // ── Resolution: user + app → effective role / tenants / teams ────
  //
  // Capabilities used to be tracked per mapping; that concept was removed —
  // a tenant's role (permission set) on the app side owns the capability
  // matrix, and the team scopes that role to a set of devices.

  async resolveForUserAndApp(userId: number, appId: number): Promise<{
    role: string;
    tenants: Array<{ slug: string; role: string }>;
    teams: string[];
  }> {
    const mappings = await db('user_permission_groups as upg')
      .join('permission_group_app_mappings as pgam', 'pgam.group_id', 'upg.group_id')
      .where({ 'upg.user_id': userId, 'pgam.app_id': appId })
      .select('pgam.app_role', 'pgam.tenant_slug', 'pgam.team_name') as Array<{
        app_role: string;
        tenant_slug: string | null;
        team_name: string | null;
      }>;

    if (mappings.length === 0) {
      return { role: '', tenants: [], teams: [] };
    }

    // Platform-wide ("global") role is derived ONLY from app-wide mappings
    // — those with NO tenant_slug, i.e. the "All tenants" toggle in the
    // Permission Groups UI. This is what makes the SSO model coherent for
    // relying-party apps (Obliance et al.):
    //
    //   • "Admin on All tenants"      (tenant_slug = NULL, admin) → global/platform admin
    //   • "Admin on a specific tenant" (tenant_slug = 'x',  admin) → tenant admin only
    //                                                                 (carried in tenants[] below)
    //
    // A user who only has tenant-scoped mappings still gets app access with
    // a baseline 'user' platform role (never '' — that would deny access).
    // Previously ANY admin mapping (even one tenant) set role='admin',
    // which silently turned tenant admins into platform admins on every app.
    const appWide = mappings.filter(m => !m.tenant_slug);
    let role: string;
    if (appWide.some(m => m.app_role === 'admin')) role = 'admin';
    else if (appWide.some(m => m.app_role === 'user')) role = 'user';
    else if (appWide.length > 0) role = appWide[0].app_role; // viewer / custom slug
    else role = 'user'; // only tenant-scoped mappings → access yes, global admin no

    // Per-tenant role (highest wins)
    const tenantRoleMap = new Map<string, string>();
    for (const m of mappings) {
      if (m.tenant_slug) {
        const existing = tenantRoleMap.get(m.tenant_slug);
        if (!existing || m.app_role === 'admin' || (m.app_role === 'user' && existing === 'viewer')) {
          tenantRoleMap.set(m.tenant_slug, m.app_role);
        }
      }
    }
    const tenants = Array.from(tenantRoleMap.entries()).map(([slug, r]) => ({ slug, role: r }));

    const teams = [...new Set(mappings.filter(m => m.team_name).map(m => m.team_name!))];

    return { role, tenants, teams };
  },
};
