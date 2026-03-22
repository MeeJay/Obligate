import { db } from '../db';
import { generateToken } from '../utils/crypto';
import type { ConnectedApp, AppType } from '@obligate/shared';

interface AppRow {
  id: number;
  app_type: string;
  name: string;
  base_url: string;
  api_key: string;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function rowToApp(row: AppRow): ConnectedApp {
  return {
    id: row.id,
    appType: row.app_type as AppType,
    name: row.name,
    baseUrl: row.base_url,
    apiKeySet: true, // never expose raw key
    icon: row.icon,
    color: row.color,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const appService = {
  async listApps(): Promise<ConnectedApp[]> {
    const rows = await db('connected_apps').orderBy('name') as AppRow[];
    return rows.map(rowToApp);
  },

  async getAppById(id: number): Promise<ConnectedApp | null> {
    const row = await db('connected_apps').where({ id }).first() as AppRow | undefined;
    if (!row) return null;
    return rowToApp(row);
  },

  async getAppByApiKey(apiKey: string): Promise<AppRow | null> {
    const row = await db('connected_apps')
      .where({ api_key: apiKey, is_active: true })
      .first() as AppRow | undefined;
    return row ?? null;
  },

  async createApp(data: {
    appType: AppType;
    name: string;
    baseUrl: string;
    icon?: string | null;
    color?: string | null;
  }): Promise<ConnectedApp & { apiKey: string }> {
    const apiKey = generateToken(32);
    const [row] = await db('connected_apps')
      .insert({
        app_type: data.appType,
        name: data.name,
        base_url: data.baseUrl.replace(/\/$/, ''),
        api_key: apiKey,
        icon: data.icon ?? null,
        color: data.color ?? null,
        is_active: true,
      })
      .returning('*') as AppRow[];
    return { ...rowToApp(row), apiKey };
  },

  async updateApp(id: number, data: {
    name?: string;
    baseUrl?: string;
    icon?: string | null;
    color?: string | null;
    isActive?: boolean;
  }): Promise<ConnectedApp | null> {
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.baseUrl !== undefined) update.base_url = data.baseUrl.replace(/\/$/, '');
    if (data.icon !== undefined) update.icon = data.icon;
    if (data.color !== undefined) update.color = data.color;
    if (data.isActive !== undefined) update.is_active = data.isActive;

    const [row] = await db('connected_apps')
      .where({ id })
      .update(update)
      .returning('*') as AppRow[];
    if (!row) return null;
    return rowToApp(row);
  },

  async deleteApp(id: number): Promise<boolean> {
    const count = await db('connected_apps').where({ id }).del();
    return count > 0;
  },

  async regenerateApiKey(id: number): Promise<string | null> {
    const apiKey = generateToken(32);
    const count = await db('connected_apps')
      .where({ id })
      .update({ api_key: apiKey, updated_at: new Date() });
    if (count === 0) return null;
    return apiKey;
  },

  /** Get active apps list for cross-app navigation (no sensitive data). */
  async getConnectedAppsPublic(): Promise<Array<{ appType: string; name: string; baseUrl: string; icon: string | null; color: string | null }>> {
    const rows = await db('connected_apps')
      .where({ is_active: true })
      .select('app_type', 'name', 'base_url', 'icon', 'color') as Array<{
        app_type: string; name: string; base_url: string; icon: string | null; color: string | null;
      }>;
    return rows.map(r => ({
      appType: r.app_type,
      name: r.name,
      baseUrl: r.base_url,
      icon: r.icon,
      color: r.color,
    }));
  },
};
