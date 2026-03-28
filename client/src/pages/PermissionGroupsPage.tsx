import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronRight, Power, Check, Lock, Shield } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { cn } from '../utils/cn';
import type { PermissionGroup, PermissionGroupAppMapping, ConnectedApp, AppCapabilitySchema } from '@obligate/shared';

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
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  // Remote info + capability schemas cache per app
  const [remoteInfoMap, setRemoteInfoMap] = useState<Record<number, RemoteAppInfo | null>>({});
  const [capSchemasMap, setCapSchemasMap] = useState<Record<number, AppCapabilitySchema[]>>({});
  const [loadingApps, setLoadingApps] = useState<Set<number>>(new Set());
  const fetchedRef = useRef<Set<number>>(new Set());

  const load = async () => {
    const [g, a] = await Promise.all([
      apiClient.get('/admin/permission-groups'),
      apiClient.get('/admin/apps'),
    ]);
    if (g.data.success) setGroups(g.data.data);
    if (a.data.success) setApps(a.data.data);
  };

  useEffect(() => { load(); }, []);

  const fetchRemoteInfo = async (appId: number) => {
    if (fetchedRef.current.has(appId)) return;
    fetchedRef.current.add(appId);
    setLoadingApps(prev => new Set(prev).add(appId));
    try {
      const [ri, cs] = await Promise.all([
        apiClient.get(`/admin/apps/${appId}/remote-info`),
        apiClient.get(`/admin/apps/${appId}/capability-schemas`),
      ]);
      setRemoteInfoMap(prev => ({ ...prev, [appId]: ri.data.success ? ri.data.data : null }));
      setCapSchemasMap(prev => ({ ...prev, [appId]: cs.data.success ? cs.data.data : [] }));
    } catch {
      setRemoteInfoMap(prev => ({ ...prev, [appId]: null }));
      setCapSchemasMap(prev => ({ ...prev, [appId]: [] }));
    }
    setLoadingApps(prev => { const s = new Set(prev); s.delete(appId); return s; });
  };

  const toggleExpand = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    const { data } = await apiClient.get(`/admin/permission-groups/${id}/mappings`);
    if (data.success) setMappings(data.data);
    setExpanded(id);
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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getMappingsForApp = (appId: number) => mappings.filter(m => m.appId === appId);
  const isAppEnabled = (appId: number) => getMappingsForApp(appId).length > 0;
  const hasGlobalMapping = (appId: number) => getMappingsForApp(appId).some(m => !m.tenantSlug);

  const getEnabledTenants = (appId: number): Set<string> => {
    const slugs = new Set<string>();
    for (const m of getMappingsForApp(appId)) {
      if (m.tenantSlug) slugs.add(m.tenantSlug);
    }
    return slugs;
  };

  const getEnabledTeams = (appId: number): Set<string> => {
    const names = new Set<string>();
    for (const m of getMappingsForApp(appId)) {
      if (m.teamName) names.add(m.teamName);
    }
    return names;
  };

  // Get the base (non-team) mapping for a specific tenant
  const getTenantBaseMapping = (appId: number, tenantSlug: string) =>
    getMappingsForApp(appId).find(m => m.tenantSlug === tenantSlug && !m.teamName);

  // Get role for a specific tenant (from its base mapping)
  const getTenantRole = (appId: number, tenantSlug: string): string =>
    getTenantBaseMapping(appId, tenantSlug)?.appRole ?? 'user';

  // ── Actions ─────────────────────────────────────────────────────────────────

  const toggleApp = async (groupId: number, appId: number) => {
    if (isAppEnabled(appId)) {
      for (const m of getMappingsForApp(appId)) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
    } else {
      const info = remoteInfoMap[appId];
      if (info?.tenants.length) {
        for (const tn of info.tenants) {
          await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
            appId, appRole: 'user', tenantSlug: tn.slug, teamName: null, capabilities: [],
          });
        }
      } else {
        await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
          appId, appRole: 'user', tenantSlug: null, teamName: null, capabilities: [],
        });
      }
    }
    await reloadMappings(groupId);
  };

  const toggleTenant = async (groupId: number, appId: number, tenantSlug: string) => {
    const info = remoteInfoMap[appId];

    if (hasGlobalMapping(appId)) {
      // Switch from global to individual — deselect this tenant
      for (const m of getMappingsForApp(appId)) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
      if (info?.tenants.length) {
        for (const tn of info.tenants) {
          if (tn.slug !== tenantSlug) {
            await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
              appId, appRole: 'user', tenantSlug: tn.slug, teamName: null, capabilities: [],
            });
          }
        }
      }
      await reloadMappings(groupId);
      return;
    }

    const existing = getMappingsForApp(appId).filter(m => m.tenantSlug === tenantSlug);
    if (existing.length > 0) {
      for (const m of existing) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
    } else {
      await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
        appId, appRole: 'user', tenantSlug, teamName: null, capabilities: [],
      });
    }
    await reloadMappings(groupId);
  };

  const toggleAllTenants = async (groupId: number, appId: number) => {
    if (hasGlobalMapping(appId)) {
      const info = remoteInfoMap[appId];
      const globalMapping = getMappingsForApp(appId).find(m => !m.tenantSlug);
      const role = globalMapping?.appRole ?? 'user';
      const caps = globalMapping?.capabilities ?? [];
      for (const m of getMappingsForApp(appId)) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
      if (info?.tenants.length) {
        for (const tn of info.tenants) {
          await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
            appId, appRole: role, tenantSlug: tn.slug, teamName: null, capabilities: caps,
          });
        }
      }
    } else {
      const firstMapping = getMappingsForApp(appId)[0];
      const role = firstMapping?.appRole ?? 'user';
      const caps = firstMapping?.capabilities ?? [];
      for (const m of getMappingsForApp(appId)) {
        await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${m.id}`);
      }
      await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
        appId, appRole: role, tenantSlug: null, teamName: null, capabilities: caps,
      });
    }
    await reloadMappings(groupId);
  };

  const changeTenantRole = async (groupId: number, appId: number, tenantSlug: string | null, newRole: string) => {
    // Update all mappings for this tenant (base + team mappings)
    const targetMappings = getMappingsForApp(appId).filter(m =>
      tenantSlug === null ? !m.tenantSlug : m.tenantSlug === tenantSlug
    );
    for (const m of targetMappings) {
      await apiClient.put(`/admin/permission-groups/${groupId}/mappings/${m.id}`, { appRole: newRole });
    }
    await reloadMappings(groupId);
  };

  const toggleCapability = async (groupId: number, mappingId: number, cap: string, currentCaps: string[]) => {
    const newCaps = currentCaps.includes(cap)
      ? currentCaps.filter(c => c !== cap)
      : [...currentCaps, cap];
    await apiClient.put(`/admin/permission-groups/${groupId}/mappings/${mappingId}`, { capabilities: newCaps });
    await reloadMappings(groupId);
  };

  const toggleTeam = async (groupId: number, appId: number, teamName: string, tenantSlug: string) => {
    const existing = getMappingsForApp(appId).find(m => m.teamName === teamName && m.tenantSlug === tenantSlug);
    if (existing) {
      await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${existing.id}`);
    } else {
      const role = getTenantRole(appId, tenantSlug);
      await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
        appId, appRole: role, tenantSlug, teamName, capabilities: [],
      });
    }
    await reloadMappings(groupId);
  };

  const toggleTenantExpand = (appId: number, tenantSlug: string) => {
    setExpandedTenants(prev => {
      const key = `${appId}-${tenantSlug}`;
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderRoleSelector = (groupId: number, appId: number, tenantSlug: string | null, currentRole: string) => (
    <div className="flex items-center gap-1">
      {['admin', 'user', 'viewer'].map(r => (
        <button
          key={r}
          onClick={() => changeTenantRole(groupId, appId, tenantSlug, r)}
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
            currentRole === r
              ? 'bg-accent/20 text-accent border border-accent/40'
              : 'bg-bg-hover text-text-muted hover:text-text-primary border border-transparent',
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );

  const renderCapabilities = (groupId: number, mappingId: number | undefined, appId: number, currentCaps: string[]) => {
    const schemas = capSchemasMap[appId];
    if (!schemas?.length || !mappingId) return null;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {schemas.map(s => {
          const active = currentCaps.includes(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggleCapability(groupId, mappingId, s.key, currentCaps)}
              title={s.description ?? s.label}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors border',
                active
                  ? 'bg-status-up/15 text-status-up border-status-up/30'
                  : 'bg-bg-hover text-text-muted border-border hover:border-border-light',
              )}
            >
              {active ? <Check size={9} /> : <Lock size={9} className="opacity-40" />}
              {s.label}
            </button>
          );
        })}
      </div>
    );
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
                      const info = remoteInfoMap[app.id];
                      const isLoading = loadingApps.has(app.id);
                      const color = app.color || APP_COLORS[app.appType] || '#888';
                      const enabledTenants = getEnabledTenants(app.id);
                      const enabledTeams = getEnabledTeams(app.id);
                      const globalAccess = hasGlobalMapping(app.id);
                      const globalMapping = getMappingsForApp(app.id).find(m => !m.tenantSlug && !m.teamName);
                      const hasCaps = (capSchemasMap[app.id]?.length ?? 0) > 0;

                      return (
                        <div
                          key={app.id}
                          className={cn(
                            'rounded-lg border overflow-hidden transition-all',
                            enabled ? 'border-border-light bg-bg-secondary' : 'border-border bg-bg-tertiary/30 opacity-60',
                          )}
                        >
                          {/* App header — power toggle only (no global role) */}
                          <div className="px-4 py-3 flex items-center gap-3" style={{ borderLeft: `3px solid ${enabled ? color : 'transparent'}` }}>
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
                            {hasCaps && enabled && (
                              <span title="Capabilities available"><Shield size={14} className="text-text-muted" /></span>
                            )}
                          </div>

                          {/* Tenants + Capabilities + Teams */}
                          {enabled && (
                            <div className="border-t border-border px-4 py-3">
                              {isLoading ? (
                                <p className="text-xs text-text-muted">{t('common.loading')}</p>
                              ) : !info ? (
                                <p className="text-xs text-status-down">{t('groups.appConnectionError')}</p>
                              ) : (
                                <div className="space-y-2">
                                  {/* All tenants toggle (global mode) */}
                                  {info.tenants.length > 0 && (
                                    <div className="flex items-center gap-2 mb-1">
                                      <button
                                        onClick={() => toggleAllTenants(group.id, app.id)}
                                        className={cn(
                                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border',
                                          globalAccess
                                            ? 'bg-accent/15 text-accent border-accent/30'
                                            : 'bg-bg-hover text-text-muted border-border hover:border-border-light',
                                        )}
                                      >
                                        {globalAccess && <Check size={12} />}
                                        {t('groups.allTenants')}
                                      </button>
                                      {/* Global role + capabilities when in global mode */}
                                      {globalAccess && (
                                        <>
                                          {renderRoleSelector(group.id, app.id, null, globalMapping?.appRole ?? 'user')}
                                          {renderCapabilities(group.id, globalMapping?.id, app.id, globalMapping?.capabilities ?? [])}
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {/* No tenants — show role + caps on the single mapping */}
                                  {info.tenants.length === 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {renderRoleSelector(group.id, app.id, null, globalMapping?.appRole ?? 'user')}
                                      {renderCapabilities(group.id, globalMapping?.id, app.id, globalMapping?.capabilities ?? [])}
                                    </div>
                                  )}

                                  {/* Per-tenant accordion */}
                                  {info.tenants.map(tn => {
                                    const tenantActive = enabledTenants.has(tn.slug) || globalAccess;
                                    const tenantTeams = info.teams.filter(tm => tm.tenantSlug === tn.slug);
                                    const tenantKey = `${app.id}-${tn.slug}`;
                                    const isExpanded = expandedTenants.has(tenantKey);
                                    const baseMapping = getTenantBaseMapping(app.id, tn.slug);
                                    const tenantRole = baseMapping?.appRole ?? (globalAccess ? (globalMapping?.appRole ?? 'user') : 'user');
                                    const tenantCaps = baseMapping?.capabilities ?? (globalAccess ? (globalMapping?.capabilities ?? []) : []);
                                    const tenantEnabledTeams = tenantTeams.filter(tm => enabledTeams.has(tm.name));

                                    return (
                                      <div key={tn.slug} className={cn(
                                        'rounded-md border overflow-hidden',
                                        tenantActive ? 'border-border-light' : 'border-border opacity-50',
                                      )}>
                                        {/* Tenant header */}
                                        <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary/50 flex-wrap">
                                          {/* Checkbox */}
                                          <button
                                            onClick={() => toggleTenant(group.id, app.id, tn.slug)}
                                            className={cn(
                                              'w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                                              tenantActive
                                                ? 'bg-accent/20 border-accent/40 text-accent'
                                                : 'bg-bg-hover border-border text-transparent hover:border-border-light',
                                            )}
                                          >
                                            {tenantActive && <Check size={12} />}
                                          </button>

                                          {/* Name + expand toggle */}
                                          <button
                                            onClick={() => toggleTenantExpand(app.id, tn.slug)}
                                            className="flex items-center gap-1 min-w-0"
                                          >
                                            {tenantTeams.length > 0 && (
                                              isExpanded
                                                ? <ChevronDown size={12} className="text-text-muted flex-shrink-0" />
                                                : <ChevronRight size={12} className="text-text-muted flex-shrink-0" />
                                            )}
                                            <span className={cn('text-xs font-medium', tenantActive ? 'text-text-primary' : 'text-text-muted')}>
                                              {tn.name}
                                            </span>
                                          </button>

                                          {/* Per-tenant role selector (only when not global) */}
                                          {tenantActive && !globalAccess && (
                                            renderRoleSelector(group.id, app.id, tn.slug, tenantRole)
                                          )}

                                          {/* Per-tenant capabilities (only when not global) */}
                                          {tenantActive && !globalAccess && hasCaps && (
                                            renderCapabilities(group.id, baseMapping?.id, app.id, tenantCaps)
                                          )}

                                          {/* Team count */}
                                          {tenantTeams.length > 0 && (
                                            <span className={cn(
                                              'text-[10px] px-1.5 py-0.5 rounded ml-auto',
                                              tenantEnabledTeams.length > 0 ? 'bg-accent/15 text-accent' : 'bg-bg-hover text-text-muted',
                                            )}>
                                              {tenantEnabledTeams.length}/{tenantTeams.length} teams
                                            </span>
                                          )}
                                        </div>

                                        {/* Expanded: teams */}
                                        {isExpanded && tenantTeams.length > 0 && (
                                          <div className="px-3 py-2 space-y-1 border-t border-border bg-bg-primary/30">
                                            {tenantEnabledTeams.length === 0 && (
                                              <div className="flex items-center gap-1.5 text-[10px] text-text-muted/70 py-1">
                                                <Lock size={10} />
                                                {t('groups.noTeamAccess')}
                                              </div>
                                            )}
                                            {tenantTeams.map(tm => {
                                              const teamActive = enabledTeams.has(tm.name);
                                              return (
                                                <button
                                                  key={tm.name}
                                                  onClick={() => toggleTeam(group.id, app.id, tm.name, tn.slug)}
                                                  className={cn(
                                                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                                                    teamActive ? 'bg-accent/10 text-accent' : 'text-text-muted hover:bg-bg-hover hover:text-text-primary',
                                                  )}
                                                >
                                                  <span className={cn(
                                                    'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors',
                                                    teamActive ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-bg-hover border-border text-transparent',
                                                  )}>
                                                    {teamActive && <Check size={10} />}
                                                  </span>
                                                  <span className="flex-1 text-left">{tm.name}</span>
                                                  {!teamActive && <Lock size={10} className="text-text-muted/40" />}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {info.tenants.length === 0 && info.teams.length === 0 && !hasCaps && (
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
