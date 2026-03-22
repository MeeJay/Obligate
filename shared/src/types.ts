// ── Users ────────────────────────────────────────────────────────────────────

export interface ObligateUser {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  role: 'admin' | 'user';
  isActive: boolean;
  authSource: 'local' | 'ldap';
  directoryId: number | null;
  ldapDn: string | null;
  totpEnabled: boolean;
  preferredLanguage: string;
  enrollmentVersion: number;
  createdAt: string;
  updatedAt: string;
}

// ── Connected Apps ───────────────────────────────────────────────────────────

export type AppType = 'obliview' | 'obliguard' | 'oblimap' | 'obliance';

export interface ConnectedApp {
  id: number;
  appType: AppType;
  name: string;
  baseUrl: string;
  apiKeySet: boolean;   // never expose raw key to client
  icon: string | null;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Auth Codes ───────────────────────────────────────────────────────────────

export interface AuthCode {
  id: number;
  code: string;
  userId: number;
  appId: number;
  redirectUri: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

// ── User-App Links ───────────────────────────────────────────────────────────

export interface UserAppLink {
  id: number;
  userId: number;
  appId: number;
  remoteUserId: number | null;
  enabled: boolean;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
}

// ── Permission Groups ────────────────────────────────────────────────────────

export interface PermissionGroup {
  id: number;
  name: string;
  description: string | null;
  scope: 'global' | 'tenant';
  tenantId: number | null;
  createdBy: number | null;
  createdAt: string;
}

export interface PermissionGroupAppMapping {
  id: number;
  groupId: number;
  appId: number;
  appRole: string;         // 'admin' | 'user' | 'viewer'
  tenantSlug: string | null;
  teamName: string | null;
}

// ── LDAP/AD Directories ──────────────────────────────────────────────────────

export interface LdapDirectory {
  id: number;
  name: string;
  domain: string;
  serverUrl: string;
  bindDn: string;
  baseDn: string;
  userSearchFilter: string;
  userSearchBase: string | null;
  groupSearchFilter: string | null;
  groupSearchBase: string | null;
  emailAttribute: string;
  displayNameAttribute: string;
  tlsRejectUnauthorized: boolean;
  isActive: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryDomainAlias {
  id: number;
  directoryId: number;
  domainAlias: string;
}

// ── AD Group Mappings ────────────────────────────────────────────────────────

export interface AdGroupMapping {
  id: number;
  directoryId: number;
  adGroupDn: string;
  adGroupName: string | null;
  permissionGroupId: number;
  createdAt: string;
}

// ── Device Links ─────────────────────────────────────────────────────────────

export interface DeviceLink {
  id: number;
  deviceUuid: string;
  appId: number;
  appPath: string;
  updatedAt: string;
}

// ── Token Exchange Response ──────────────────────────────────────────────────

export interface TokenExchangeResponse {
  obligateUserId: number;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
  tenants: Array<{ slug: string; role: string }>;
  teams: string[];
  authSource: 'local' | 'ldap';
  linkedLocalUserId: number | null;
}

// ── SSO Config (exposed to connected apps' clients) ──────────────────────────

export interface ObligateConfig {
  url: string | null;
  apiKeySet: boolean;
  enabled: boolean;
}
