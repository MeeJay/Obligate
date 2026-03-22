import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import type { PermissionGroup, PermissionGroupAppMapping, ConnectedApp } from '@obligate/shared';

interface RemoteAppInfo {
  roles: string[];
  teams: Array<{ id: number; name: string; tenantSlug: string; tenantName: string }>;
  tenants: Array<{ slug: string; name: string }>;
}

export function PermissionGroupsPage() {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [mappings, setMappings] = useState<PermissionGroupAppMapping[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Mapping form with remote info
  const [mappingForm, setMappingForm] = useState({ appId: 0, appRole: 'user', tenantSlug: '', teamName: '' });
  const [remoteInfo, setRemoteInfo] = useState<RemoteAppInfo | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const load = async () => {
    const [g, a] = await Promise.all([
      apiClient.get('/admin/permission-groups'),
      apiClient.get('/admin/apps'),
    ]);
    if (g.data.success) setGroups(g.data.data);
    if (a.data.success) setApps(a.data.data);
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    const { data } = await apiClient.get(`/admin/permission-groups/${id}/mappings`);
    if (data.success) setMappings(data.data);
    setExpanded(id);
    setRemoteInfo(null);
    if (apps.length > 0) {
      const firstApp = apps[0];
      setMappingForm({ appId: firstApp.id, appRole: 'user', tenantSlug: '', teamName: '' });
      fetchRemoteInfo(firstApp.id);
    }
  };

  const fetchRemoteInfo = async (appId: number) => {
    setRemoteLoading(true);
    setRemoteInfo(null);
    try {
      const { data } = await apiClient.get(`/admin/apps/${appId}/remote-info`);
      if (data.success && data.data) setRemoteInfo(data.data);
    } catch { /* ignore */ }
    finally { setRemoteLoading(false); }
  };

  const onAppChange = (appId: number) => {
    setMappingForm(f => ({ ...f, appId, tenantSlug: '', teamName: '' }));
    fetchRemoteInfo(appId);
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
    if (!confirm('Delete this permission group?')) return;
    await apiClient.delete(`/admin/permission-groups/${id}`);
    if (expanded === id) setExpanded(null);
    load();
  };

  const handleAddMapping = async (groupId: number) => {
    if (!mappingForm.appId) return;
    await apiClient.post(`/admin/permission-groups/${groupId}/mappings`, {
      appId: mappingForm.appId,
      appRole: mappingForm.appRole,
      tenantSlug: mappingForm.tenantSlug || null,
      teamName: mappingForm.teamName || null,
    });
    const { data } = await apiClient.get(`/admin/permission-groups/${groupId}/mappings`);
    if (data.success) setMappings(data.data);
  };

  const handleDeleteMapping = async (groupId: number, mappingId: number) => {
    await apiClient.delete(`/admin/permission-groups/${groupId}/mappings/${mappingId}`);
    const { data } = await apiClient.get(`/admin/permission-groups/${groupId}/mappings`);
    if (data.success) setMappings(data.data);
  };

  const getAppName = (appId: number) => apps.find(a => a.id === appId)?.name ?? `App #${appId}`;

  // Filter teams by selected tenant
  const filteredTeams = remoteInfo?.teams.filter(t =>
    !mappingForm.tenantSlug || t.tenantSlug === mappingForm.tenantSlug
  ) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Permission Groups</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1.5" /> Add Group
        </Button>
      </div>

      {showForm && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Create Permission Group</h2>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="IT Admins" required />
            <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Full admin access on all apps" />
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
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
                <p className="text-xs text-text-secondary font-medium mb-3">App Mappings</p>

                {/* Existing mappings */}
                {mappings.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {mappings.map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-bg-tertiary rounded px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-primary font-medium">{getAppName(m.appId)}</span>
                          <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">{m.appRole}</span>
                          {m.tenantSlug && <span className="text-xs text-text-muted bg-bg-hover px-1.5 py-0.5 rounded">tenant: {m.tenantSlug}</span>}
                          {m.teamName && <span className="text-xs text-text-muted bg-bg-hover px-1.5 py-0.5 rounded">team: {m.teamName}</span>}
                        </div>
                        <button onClick={() => handleDeleteMapping(group.id, m.id)} className="text-text-muted hover:text-status-down">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {mappings.length === 0 && <p className="text-xs text-text-muted mb-4">No mappings yet.</p>}

                {/* Add mapping form with dynamic dropdowns */}
                <div className="bg-bg-tertiary rounded-lg p-3 space-y-3">
                  <p className="text-xs text-text-secondary font-medium">Add mapping</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {/* App selector */}
                    <div className="space-y-1">
                      <label className="text-xs text-text-muted">App</label>
                      <select value={mappingForm.appId} onChange={e => onAppChange(parseInt(e.target.value))}
                        className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent">
                        {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>

                    {/* Role selector */}
                    <div className="space-y-1">
                      <label className="text-xs text-text-muted">Role</label>
                      <select value={mappingForm.appRole} onChange={e => setMappingForm(f => ({ ...f, appRole: e.target.value }))}
                        className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent">
                        <option value="admin">admin (global)</option>
                        <option value="user">user</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </div>

                    {/* Tenant selector (dynamic from remote app) */}
                    <div className="space-y-1">
                      <label className="text-xs text-text-muted">Tenant</label>
                      {remoteLoading ? (
                        <div className="text-xs text-text-muted py-2">Loading...</div>
                      ) : (
                        <select value={mappingForm.tenantSlug} onChange={e => setMappingForm(f => ({ ...f, tenantSlug: e.target.value, teamName: '' }))}
                          className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent">
                          <option value="">(all tenants)</option>
                          {remoteInfo?.tenants.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                        </select>
                      )}
                    </div>

                    {/* Team selector (dynamic from remote app, filtered by tenant) */}
                    <div className="space-y-1">
                      <label className="text-xs text-text-muted">Team</label>
                      {remoteLoading ? (
                        <div className="text-xs text-text-muted py-2">Loading...</div>
                      ) : (
                        <select value={mappingForm.teamName} onChange={e => setMappingForm(f => ({ ...f, teamName: e.target.value }))}
                          className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent">
                          <option value="">(no team)</option>
                          {filteredTeams.map(t => (
                            <option key={`${t.tenantSlug}-${t.name}`} value={t.name}>
                              {t.name}{mappingForm.tenantSlug ? '' : ` (${t.tenantName})`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {!remoteInfo && !remoteLoading && (
                    <p className="text-xs text-status-down">Could not connect to the app. Check that it is running and the API key is configured.</p>
                  )}

                  <Button size="sm" onClick={() => handleAddMapping(group.id)} disabled={!mappingForm.appId}>
                    Add Mapping
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-center text-text-muted py-12 text-sm">No permission groups yet.</p>
        )}
      </div>
    </div>
  );
}
