import { db } from '../db';
import { hashPassword, comparePassword } from '../utils/crypto';
import { logger } from '../utils/logger';
import type { ObligateUser } from '@obligate/shared';

interface UserRow {
  id: number;
  username: string;
  email: string | null;
  display_name: string | null;
  password_hash: string | null;
  role: string;
  is_active: boolean;
  auth_source: string;
  directory_id: number | null;
  ldap_dn: string | null;
  totp_enabled: boolean;
  totp_secret: string | null;
  preferred_language: string;
  created_at: Date;
  updated_at: Date;
}

function rowToUser(row: UserRow): ObligateUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role as 'admin' | 'user',
    isActive: row.is_active,
    authSource: row.auth_source as 'local' | 'ldap',
    directoryId: row.directory_id,
    ldapDn: row.ldap_dn,
    totpEnabled: row.totp_enabled,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export const authService = {
  async ensureDefaultAdmin(username: string, password: string): Promise<void> {
    const existing = await db('users').where({ username }).first();
    if (existing) return;

    const hash = await hashPassword(password);
    await db('users').insert({
      username,
      password_hash: hash,
      display_name: 'Administrator',
      role: 'admin',
      auth_source: 'local',
      is_active: true,
    });
    logger.info(`Default admin user "${username}" created`);
  },

  async login(username: string, password: string): Promise<ObligateUser | null> {
    const row = await db('users')
      .where({ username, is_active: true })
      .first() as UserRow | undefined;

    if (!row || !row.password_hash) return null;

    const valid = await comparePassword(password, row.password_hash);
    if (!valid) return null;

    return rowToUser(row);
  },

  async getUserById(id: number): Promise<ObligateUser | null> {
    const row = await db('users').where({ id }).first() as UserRow | undefined;
    if (!row) return null;
    return rowToUser(row);
  },

  async getUserByUsername(username: string): Promise<ObligateUser | null> {
    const row = await db('users').where({ username }).first() as UserRow | undefined;
    if (!row) return null;
    return rowToUser(row);
  },

  async createUser(data: {
    username: string;
    email?: string | null;
    displayName?: string | null;
    password?: string | null;
    role?: 'admin' | 'user';
    authSource?: 'local' | 'ldap';
    directoryId?: number | null;
    ldapDn?: string | null;
  }): Promise<ObligateUser> {
    const hash = data.password ? await hashPassword(data.password) : null;
    const [row] = await db('users')
      .insert({
        username: data.username,
        email: data.email ?? null,
        display_name: data.displayName ?? null,
        password_hash: hash,
        role: data.role ?? 'user',
        auth_source: data.authSource ?? 'local',
        directory_id: data.directoryId ?? null,
        ldap_dn: data.ldapDn ?? null,
        is_active: true,
      })
      .returning('*') as UserRow[];
    return rowToUser(row);
  },

  async updateUser(id: number, data: {
    email?: string | null;
    displayName?: string | null;
    role?: 'admin' | 'user';
    isActive?: boolean;
  }): Promise<ObligateUser | null> {
    const update: Record<string, unknown> = { updated_at: new Date() };
    if (data.email !== undefined) update.email = data.email;
    if (data.displayName !== undefined) update.display_name = data.displayName;
    if (data.role !== undefined) update.role = data.role;
    if (data.isActive !== undefined) update.is_active = data.isActive;

    const [row] = await db('users').where({ id }).update(update).returning('*') as UserRow[];
    if (!row) return null;
    return rowToUser(row);
  },

  async changePassword(id: number, newPassword: string): Promise<boolean> {
    const hash = await hashPassword(newPassword);
    const count = await db('users').where({ id }).update({ password_hash: hash, updated_at: new Date() });
    return count > 0;
  },

  async deleteUser(id: number): Promise<boolean> {
    const count = await db('users').where({ id }).del();
    return count > 0;
  },

  async listUsers(): Promise<ObligateUser[]> {
    const rows = await db('users').orderBy('username') as UserRow[];
    return rows.map(rowToUser);
  },
};
