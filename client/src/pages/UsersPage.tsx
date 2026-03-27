import { useEffect, useMemo, useState } from 'react';
import { Plus, Shield, User, Pencil, Trash2, X, Check, Key, ShieldCheck, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import type { ObligateUser, PermissionGroup } from '@obligate/shared';
import { cn } from '../utils/cn';

export function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ObligateUser[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [userGroupMap, setUserGroupMap] = useState<Record<number, PermissionGroup[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '', role: 'user' as 'admin' | 'user' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Search & filter
  const [search, setSearch] = useState('');
  const [filterGroupId, setFilterGroupId] = useState<number | ''>('');

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ email: '', displayName: '', role: 'user' as 'admin' | 'user' });

  // Password change
  const [pwUserId, setPwUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Group assignment
  const [groupUserId, setGroupUserId] = useState<number | null>(null);
  const [userGroups, setUserGroups] = useState<PermissionGroup[]>([]);

  const load = async () => {
    const [u, g] = await Promise.all([
      apiClient.get('/admin/users'),
      apiClient.get('/admin/permission-groups'),
    ]);
    if (u.data.success) {
      setUsers(u.data.data);
      if (u.data.userGroups) setUserGroupMap(u.data.userGroups);
    }
    if (g.data.success) setGroups(g.data.data);
  };

  useEffect(() => { load(); }, []);

  // Filtered users
  const filteredUsers = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName?.toLowerCase().includes(q)) ||
        (u.email?.toLowerCase().includes(q))
      );
    }
    if (filterGroupId !== '') {
      list = list.filter(u => userGroupMap[u.id]?.some(g => g.id === filterGroupId));
    }
    return list;
  }, [users, search, filterGroupId, userGroupMap]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await apiClient.post('/admin/users', form);
      if (data.success) {
        setShowForm(false);
        setForm({ username: '', email: '', displayName: '', password: '', role: 'user' });
        load();
      } else setError(data.error || 'Failed');
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  };

  const startEdit = (u: ObligateUser) => {
    setEditingId(u.id);
    setEditForm({ email: u.email || '', displayName: u.displayName || '', role: u.role });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await apiClient.put(`/admin/users/${editingId}`, editForm);
    setEditingId(null);
    load();
  };

  const toggleActive = async (u: ObligateUser) => {
    await apiClient.put(`/admin/users/${u.id}`, { isActive: !u.isActive });
    load();
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Delete this user permanently?')) return;
    await apiClient.delete(`/admin/users/${id}`);
    load();
  };

  const changePassword = async () => {
    if (!pwUserId || !newPassword) return;
    await apiClient.put(`/admin/users/${pwUserId}/password`, { password: newPassword });
    setPwUserId(null);
    setNewPassword('');
  };

  const openGroups = async (userId: number) => {
    setGroupUserId(userId);
    const { data } = await apiClient.get(`/admin/users/${userId}/groups`);
    if (data.success) setUserGroups(data.data);
  };

  const toggleGroup = async (groupId: number, assigned: boolean) => {
    if (!groupUserId) return;
    if (assigned) {
      await apiClient.delete(`/admin/users/${groupUserId}/groups/${groupId}`);
    } else {
      await apiClient.post(`/admin/users/${groupUserId}/groups/${groupId}`);
    }
    const { data } = await apiClient.get(`/admin/users/${groupUserId}/groups`);
    if (data.success) setUserGroups(data.data);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('users.title')}</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1.5" /> {t('users.addUser')}
        </Button>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder={t('users.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-bg-tertiary text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent placeholder:text-text-muted"
          />
        </div>
        <select
          value={filterGroupId}
          onChange={e => setFilterGroupId(e.target.value ? parseInt(e.target.value, 10) : '')}
          className="rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">{t('users.allGroups')}</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {(search || filterGroupId !== '') && (
          <span className="self-center text-xs text-text-muted">
            {t('users.filterCount', { filtered: filteredUsers.length, total: users.length })}
          </span>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">{t('users.createUser')}</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('users.username')} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
              <Input label={t('users.email')} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input label={t('users.displayName')} value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
              <Input label={t('users.password')} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-secondary">{t('users.role')}</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent">
                <option value="user">{t('common.user')}</option>
                <option value="admin">{t('common.admin')}</option>
              </select>
            </div>
            {error && <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">{error}</div>}
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>{t('common.create')}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Password change modal */}
      {pwUserId && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">{t('users.changePasswordFor', { name: users.find(u => u.id === pwUserId)?.username })}</h2>
          <div className="flex gap-2 items-end">
            <Input label={t('users.newPassword')} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <Button size="md" onClick={changePassword} disabled={!newPassword}>{t('common.save')}</Button>
            <Button size="md" variant="ghost" onClick={() => { setPwUserId(null); setNewPassword(''); }}>{t('common.cancel')}</Button>
          </div>
        </div>
      )}

      {/* Group assignment panel */}
      {groupUserId && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">
              {t('users.permissionGroupsFor', { name: users.find(u => u.id === groupUserId)?.username })}
            </h2>
            <button onClick={() => setGroupUserId(null)} className="text-text-muted hover:text-text-primary"><X size={18} /></button>
          </div>
          <div className="space-y-1.5">
            {groups.map(g => {
              const assigned = userGroups.some(ug => ug.id === g.id);
              return (
                <button
                  key={g.id}
                  onClick={() => toggleGroup(g.id, assigned)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                    assigned ? 'bg-accent/10 text-accent border border-accent/30' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                  )}
                >
                  <span>{g.name}</span>
                  {assigned && <Check size={14} />}
                </button>
              );
            })}
            {groups.length === 0 && <p className="text-xs text-text-muted">{t('users.noGroupsCreated')}</p>}
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-2">
        {filteredUsers.map(u => {
          const assignedGroups = userGroupMap[u.id] ?? [];
          return (
            <div key={u.id} className="bg-bg-secondary border border-border rounded-lg px-5 py-4">
              {editingId === u.id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input label={t('users.displayName')} value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} />
                    <Input label={t('users.email')} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-text-secondary">{t('users.role')}</label>
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none">
                        <option value="user">{t('common.user')}</option>
                        <option value="admin">{t('common.admin')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}><Check size={14} className="mr-1" />{t('common.save')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t('common.cancel')}</Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {u.role === 'admin' ? <Shield size={18} className="text-accent shrink-0" /> : <User size={18} className="text-text-muted shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-text-primary font-medium">{u.displayName || u.username}</span>
                        {u.displayName && <span className="text-xs text-text-muted">@{u.username}</span>}
                        {u.role === 'admin' && <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">admin</span>}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {u.authSource === 'ldap' ? t('users.ldap') : t('users.local')}
                        {u.email && <span className="ml-2">{u.email}</span>}
                      </p>
                      {assignedGroups.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {assignedGroups.map(g => (
                            <span
                              key={g.id}
                              className="inline-flex items-center gap-1 text-[11px] bg-bg-tertiary text-text-secondary border border-border px-1.5 py-0.5 rounded"
                            >
                              <ShieldCheck size={10} className="text-text-muted" />
                              {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleActive(u)}
                      className={cn('text-xs px-2 py-1 rounded', u.isActive ? 'text-status-up bg-status-up-bg' : 'text-status-down bg-status-down-bg')}>
                      {u.isActive ? t('users.active') : t('common.disabled')}
                    </button>
                    <Button size="sm" variant="ghost" onClick={() => openGroups(u.id)} title={t('users.groups')}><ShieldCheck size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setPwUserId(u.id)} title={t('users.changePassword')}><Key size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(u)} title={t('common.edit')}><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteUser(u.id)} title={t('common.delete')}><Trash2 size={14} className="text-status-down" /></Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filteredUsers.length === 0 && users.length > 0 && (
          <p className="text-center text-text-muted py-12 text-sm">{t('users.noMatch')}</p>
        )}
        {users.length === 0 && <p className="text-center text-text-muted py-12 text-sm">{t('users.noUsers')}</p>}
      </div>
    </div>
  );
}
