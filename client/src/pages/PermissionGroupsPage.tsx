import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronRight, Power, Check } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { cn } from '../utils/cn';
import type { PermissionGroup, PermissionGroupAppMapping, ConnectedApp } from '@obligate/shared';

interface RemoteAppInfo {
  roles: string[];
  teams: Array<{ id: number; name: string; tenantSlug: string; tenantName: string }>;
  tenants: Array<{ slug: string; name: string }>;
}

const APP_COLORS: Record<string, string> = {
  obliview: '#19E2FF',
  obliguard: '#FFA515',
  oblimap: '#8DC63F',
  obliance: '#C2001B',
};

export function PermissionGroupsPage() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [mappings, setMappings] = useState<PermissionGroupAppMapping[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Remote info cache per app
  const [remoteInfoMap, setRemoteInfoMap] = useState<Record<number, RemoteAppInfo | null>>({});
  const [loadingApps, setLoadingApps] = useState<Set<number>>(new Set());

  const load = async () => {
    const [g, a] = await Promise.all([
      apiClient.get('/admin/permission-groups'),
      apiClient.get('/admin/apps'),
    ]);
    if (g.data.success) setGroups(g.data.data);
    if (a.data.success) setApps(a.data.data);
  };

  useEffect(() => { load(); }, []);

  const fetchRemoteInfo = useCallback(async (appId: number) => {
    if (remoteInfoMap[appId] !== undefined) return; // Already loaded or loading
    setLoadingApps(prev => new Set(prev).add(appId));
    try {
      const { data } = await apiClient.get(`/admin/apps/${appId}/remote-info`);
      setRemoteInfoMap(prev => ({ ...prev, [appId]: data.success ? data.data : null }));
    } catch {
      setRemoteInfoMap(prev => ({ ...prev, [appId]: null }));
    }
    setLoadingApps(prev => { const s = new Set(prev); s.delete(appId); return s; });
  }, [remoteInfoMap]);

  const toggleExpand = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    const { data } = await apiClient.get(`/admin/permission-groups/${id}/mappings`);
    if (data.success) setMappings(data.data);
    setExpanded(id);
    // Fetch remote info for all apps
    apps.forEach(a => fetchRemoteInfo(a.id));
  };

  const reloadMappings = async (groupId: number) => {
    const { data } = await apiClient.get(`/admin/permission-groups/${groupId}/mappings`);
    if (data.success) setMappings(data.data);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await apiClient.post('/admin/permission-groups', form);
      if (data.success) { setShowForm(false); setForm({ name: '', description: '' }); load(); }
    } finally { setSaving(false); }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm(t('groups.deleteConfirm'))) return;
    await apiClient.delete(`/admin/permission-groups/${id}`);
    if (expanded === id) setExpanded(null);
    load();
  };

  // ── App Matrix Helpers ──────────────────────────────────────────────────────

  // Get all mappings for a specific app in the current group
  const getMappingsForApp = (appId: number) => mappings.filter(m => m.appId === appId);

  // Check if an app is "enabled" for this group (has at least one mapping)
  const isAppEnabled = (appId: number) => getMappingsForApp(appId).length > 0;

  // Get the role for an app (all mappings for same app should have same role)
  const getAppRole = (appId: number) => getMappingsForApp(appId)[0]?.appRole ?? 'user';

  // Get tenants that have mappings for this app
  const getEnabledTenants = (appId: number): Set<string> => {
    const slugs = new Set<string>();
    for (const m of getMappingsForApp(appId)) {
      if (m.tenantSlug) slugs.add(m.tenantSlug);
    }
    return slugs;
  };

  // Get teams that have mappings for this app
  const getEnabledTeams = (appId: number): Set<string> => {
    const names = new Set<string>();
    for (const m of getMappingsForApp(appId)) {
      if (m.teamName) names.add(m.teamName);
    }
    return names;
  };

  // Has a "global" mapping (no tenant specified)?
  const hasGlobalMapping = (appId: number) => getMappingsForApp(appId).some(m => !m.tenantSlug);

  // Toggle an entire app on/off
  const toggleApp = async (groupId: number, appId: number) => {
    if (isAppEnabled(appId)) {
      // Remove all mappings for this app
      for (const m of getMappingsForApp(appId)) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
    } else {
      // Add a default mapping (user role, all tenants)
      await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
        appId, appRole: 'user', tenantSlug: null, teamName: null,
      });
    }
    await reloadMappings(groupId);
  };

  // Change role for an app — delete all existing mappings and recreate with new role
  const changeAppRole = async (groupId: number, appId: number, newRole: string) => {
    const existing = getMappingsForApp(appId);
    if (existing.length === 0) return;
    // Delete all, recreate with same tenant/team but new role
    for (const m of existing) {
      await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
    }
    for (const m of existing) {
      await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
        appId, appRole: newRole, tenantSlug: m.tenantSlug, teamName: m.teamName,
      });
    }
    await reloadMappings(groupId);
  };

  // Toggle a tenant for an app
  const toggleTenant = async (groupId: number, appId: number, tenantSlug: string) => {
    const role = getAppRole(appId);
    const existing = getMappingsForApp(appId).filter(m => m.tenantSlug === tenantSlug);
    if (existing.length > 0) {
      // Remove this tenant's mappings
      for (const m of existing) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
      // If we removed a global mapping and there was only one, we need to check if the app still has mappings
    } else {
      // Add mapping for this tenant
      await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
        appId, appRole: role, tenantSlug, teamName: null,
      });
      // If there was a global (null tenant) mapping, remove it since we're now specifying tenants
      const globalMappings = getMappingsForApp(appId).filter(m => !m.tenantSlug);
      for (const m of globalMappings) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
    }
    await reloadMappings(groupId);
  };

  // Toggle "all tenants" (global mapping)
  const toggleAllTenants = async (groupId: number, appId: number) => {
    const role = getAppRole(appId);
    if (hasGlobalMapping(appId)) {
      // Can't disable all — this would disable the app. Do nothing.
      return;
    }
    // Remove all tenant-specific mappings and replace with a global one
    for (const m of getMappingsForApp(appId)) {
      await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
    }
    await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
      appId, appRole: role, tenantSlug: null, teamName: null,
    });
    await reloadMappings(groupId);
  };

  // Toggle a team for an app
  const toggleTeam = async (groupId: number, appId: number, teamName: string) => {
    const role = getAppRole(appId);
    const enabledTenants = getEnabledTenants(appId);
    // Find existing mapping for this team
    const existing = getMappingsForApp(appId).find(m => m.teamName === teamName);
    if (existing) {
      await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${existing.id}`);
    } else {
      // Need a tenant slug — find it from the remote info
      const info = remoteInfoMap[appId];
      const teamInfo = info?.teams.find(tm => tm.name === teamName);
      const tenantSlug = teamInfo?.tenantSlug ?? (enabledTenants.size === 1 ? [...enabledTenants][0] : null);
      await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
        appId, appRole: role, tenantSlug, teamName,
      });
    }
    await reloadMappings(groupId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('groups.title')}</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1.5" /> {t('groups.addGroup')}
        </Button>
      </div>

      {showForm && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">{t('groups.createGroup')}</h2>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <Input label={t('groups.name')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('groups.namePlaceholder')} required />
            <Input label={t('groups.description')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('groups.descriptionPlaceholder')} />
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>{t('common.create')}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {groups.map(group => (
          <div key={group.id} className="bg-bg-secondary border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <button onClick={() => toggleExpand(group.id)} className="flex items-center gap-2 text-left flex-1">
                {expanded === group.id ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
                <div>
                  <span className="text-text-primary font-medium">{group.name}</span>
                  {group.description && <p className="text-xs text-text-muted mt-0.5">{group.description}</p>}
                </div>
                <span className="text-xs text-text-muted ml-2 bg-bg-tertiary px-2 py-0.5 rounded">{group.scope}</span>
              </button>
              <Button size="sm" variant="ghost" onClick={() => handleDeleteGroup(group.id)}>
                <Trash2 size={14} className="text-status-down" />
              </Button>
            </div>

            {expanded === group.id && (
              <div className="border-t border-border px-5 py-4 bg-bg-primary/50">
                <p className="text-xs text-text-secondary font-medium mb-4">{t('groups.appMappings')}</p>

                {apps.length === 0 ? (
                  <p className="text-xs text-text-muted">{t('groups.noMappings')}</p>
                ) : (
                  <div className="space-y-3">
                    {apps.map(app => {
                      const enabled = isAppEnabled(app.id);
                      const role = getAppRole(app.id);
                      const info = remoteInfoMap[app.id];
                      const isLoading = loadingApps.has(app.id);
                      const color = app.color || APP_COLORS[app.appType] || '#888';
                      const enabledTenants = getEnabledTenants(app.id);
                      const enabledTeams = getEnabledTeams(app.id);
                      const globalAccess = hasGlobalMapping(app.id);

                      return (
                        <div
                          key={app.id}
                          className={cn(
                            'rounded-lg border overflow-hidden transition-all',
                            enabled ? 'border-border-light bg-bg-secondary' : 'border-border bg-bg-tertiary/30 opacity-60',
                          )}
                        >
                          {/* App header with enable toggle + role */}
                          <div className="px-4 py-3 flex items-center gap-3" style={{ borderLeft: `3px solid ${enabled ? color : 'transparent'}` }}>
                            {/* Enable/disable toggle */}
                            <button
                              onClick={() => toggleApp(group.id, app.id)}
                              className={cn(
                                'w-8 h-8 rounded-md flex items-center justify-center transition-colors flex-shrink-0',
                                enabled ? 'bg-status-up/20 text-status-up' : 'bg-bg-hover text-text-muted hover:text-text-primary',
                              )}
                              title={enabled ? t('common.enabled') : t('common.disabled')}
                            >
                              <Power size={16} />
                            </button>

                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-text-primary">{app.name}</span>
                              <span className="text-xs text-text-muted ml-2">{app.appType}</span>
                            </div>

                            {/* Role selector (only when enabled) */}
                            {enabled && (
                              <div className="flex items-center gap-1.5">
                                {['admin', 'user', 'viewer'].map(r => (
                                  <button
                                    key={r}
                                    onClick={() => changeAppRole(group.id, app.id, r)}
                                    className={cn(
                                      'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                                      role === r
                                        ? 'bg-accent/20 text-accent border border-accent/40'
                                        : 'bg-bg-hover text-text-muted hover:text-text-primary border border-transparent',
                                    )}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Tenants + Teams (only when enabled and remote info loaded) */}
                          {enabled && (
                            <div className="border-t border-border px-4 py-3">
                              {isLoading ? (
                                <p className="text-xs text-text-muted">{t('common.loading')}</p>
                              ) : !info ? (
                                <p className="text-xs text-status-down">{t('groups.appConnectionError')}</p>
                              ) : (
                                <div className="space-y-3">
                                  {/* Tenants */}
                                  {info.tenants.length > 0 && (
                                    <div>
                                      <p className="text-xs text-text-muted mb-2">{t('groups.tenant')}</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {/* All tenants chip */}
                                        <button
                                          onClick={() => toggleAllTenants(group.id, app.id)}
                                          className={cn(
                                            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                                            globalAccess
                                              ? 'bg-accent/15 text-accent border-accent/30'
                                              : 'bg-bg-hover text-text-muted border-border hover:border-border-light',
                                          )}
                                        >
                                          {globalAccess && <Check size={12} />}
                                          {t('groups.allTenants')}
                                        </button>
                                        {/* Individual tenant chips */}
                                        {info.tenants.map(tn => {
                                          const active = enabledTenants.has(tn.slug) || globalAccess;
                                          return (
                                            <button
                                              key={tn.slug}
                                              onClick={() => !globalAccess && toggleTenant(group.id, app.id, tn.slug)}
                                              disabled={globalAccess}
                                              className={cn(
                                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                                                active
                                                  ? 'bg-accent/15 text-accent border-accent/30'
                                                  : 'bg-bg-hover text-text-muted border-border hover:border-border-light',
                                                globalAccess && 'cursor-default',
                                              )}
                                            >
                                              {active && <Check size={12} />}
                                              {tn.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Teams */}
                                  {info.teams.length > 0 && (
                                    <div>
                                      <p className="text-xs text-text-muted mb-2">{t('groups.team')}</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {info.teams.map(tm => {
                                          const active = enabledTeams.has(tm.name);
                                          return (
                                            <button
                                              key={`${tm.tenantSlug}-${tm.name}`}
                                              onClick={() => toggleTeam(group.id, app.id, tm.name)}
                                              className={cn(
                                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                                                active
                                                  ? 'bg-accent/15 text-accent border-accent/30'
                                                  : 'bg-bg-hover text-text-muted border-border hover:border-border-light',
                                              )}
                                            >
                                              {active && <Check size={12} />}
                                              {tm.name}
                                              <span className="text-text-muted/60 ml-0.5">({tm.tenantName})</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {info.tenants.length === 0 && info.teams.length === 0 && (
                                    <p className="text-xs text-text-muted italic">{t('groups.noMappings')}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-center text-text-muted py-12 text-sm">{t('groups.noGroups')}</p>
        )}
      </div>
    </div>
  );
}
