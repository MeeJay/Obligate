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
  capabilities: string | string[] | null;
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
  const caps = r.capabilities;
  return {
    id: r.id,
    groupId: r.group_id,
    appId: r.app_id,
    appRole: r.app_role,
    tenantSlug: r.tenant_slug,
    teamName: r.team_name,
    capabilities: caps ? (typeof caps === 'string' ? JSON.parse(caps) : caps) : null,
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
    capabilities?: string[] | null;
  }): Promise<PermissionGroupAppMapping> {
    const [row] = await db('permission_group_app_mappings')
      .insert({
        group_id: data.groupId,
        app_id: data.appId,
        app_role: data.appRole,
        tenant_slug: data.tenantSlug ?? null,
        team_name: data.teamName ?? null,
        capabilities: data.capabilities ? JSON.stringify(data.capabilities) : null,
      })
      .returning('*') as MappingRow[];
    return rowToMapping(row);
  },

  async updateMapping(id: number, data: {
    appRole?: string;
    capabilities?: string[] | null;
  }): Promise<PermissionGroupAppMapping | null> {
    const update: Record<string, unknown> = {};
    if (data.appRole !== undefined) update.app_role = data.appRole;
    if (data.capabilities !== undefined) update.capabilities = data.capabilities ? JSON.stringify(data.capabilities) : null;
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

  // ── Resolution: user + app → effective role/tenants/teams/capabilities ────

  async resolveForUserAndApp(userId: number, appId: number): Promise<{
    role: string;
    tenants: Array<{ slug: string; role: string; capabilities: string[] }>;
    teams: string[];
    capabilities: string[];
  }> {
    const mappings = await db('user_permission_groups as upg')
      .join('permission_group_app_mappings as pgam', 'pgam.group_id', 'upg.group_id')
      .where({ 'upg.user_id': userId, 'pgam.app_id': appId })
      .select('pgam.app_role', 'pgam.tenant_slug', 'pgam.team_name', 'pgam.capabilities') as Array<{
        app_role: string;
        tenant_slug: string | null;
        team_name: string | null;
        capabilities: string | string[] | null;
      }>;

    if (mappings.length === 0) {
      return { role: '', tenants: [], teams: [], capabilities: [] };
    }

    // Highest privilege wins for global role
    let role = 'viewer';
    if (mappings.some(m => m.app_role === 'admin')) role = 'admin';
    else if (mappings.some(m => m.app_role === 'user')) role = 'user';

    // Collect per-tenant: role (highest wins) + capabilities (union)
    const tenantRoleMap = new Map<string, string>();
    const tenantCapsMap = new Map<string, Set<string>>();
    for (const m of mappings) {
      if (m.tenant_slug) {
        // Role
        const existing = tenantRoleMap.get(m.tenant_slug);
        if (!existing || m.app_role === 'admin' || (m.app_role === 'user' && existing === 'viewer')) {
          tenantRoleMap.set(m.tenant_slug, m.app_role);
        }
        // Capabilities
        const caps = m.capabilities ? (typeof m.capabilities === 'string' ? JSON.parse(m.capabilities) as string[] : m.capabilities) : [];
        if (!tenantCapsMap.has(m.tenant_slug)) tenantCapsMap.set(m.tenant_slug, new Set());
        for (const c of caps) tenantCapsMap.get(m.tenant_slug)!.add(c);
      }
    }
    const tenants = Array.from(tenantRoleMap.entries()).map(([slug, r]) => ({
      slug,
      role: r,
      capabilities: [...(tenantCapsMap.get(slug) ?? [])],
    }));

    // Collect unique team names
    const teams = [...new Set(mappings.filter(m => m.team_name).map(m => m.team_name!))];

    // Global capabilities = union of all
    const allCaps = new Set<string>();
    for (const m of mappings) {
      const caps = m.capabilities ? (typeof m.capabilities === 'string' ? JSON.parse(m.capabilities) as string[] : m.capabilities) : [];
      for (const c of caps) allCaps.add(c);
    }

    return { role, tenants, teams, capabilities: [...allCaps] };
  },
};
