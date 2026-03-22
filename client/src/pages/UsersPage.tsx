import { useEffect, useState } from 'react';
import { Plus, Shield, User, Pencil, Trash2, X, Check, Key, ShieldCheck } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import type { ObligateUser, PermissionGroup } from '@obligate/shared';
import { cn } from '../utils/cn';

export function UsersPage() {
  const [users, setUsers] = useState<ObligateUser[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '', role: 'user' as 'admin' | 'user' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    if (u.data.success) setUsers(u.data.data);
    if (g.data.success) setGroups(g.data.data);
  };

  useEffect(() => { load(); }, []);

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
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Users</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1.5" /> Add User
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Create User</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
              <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input label="Display Name" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
              <Input label="Password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-secondary">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">{error}</div>}
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>Create</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* Password change modal */}
      {pwUserId && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">Change Password — {users.find(u => u.id === pwUserId)?.username}</h2>
          <div className="flex gap-2 items-end">
            <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <Button size="md" onClick={changePassword} disabled={!newPassword}>Save</Button>
            <Button size="md" variant="ghost" onClick={() => { setPwUserId(null); setNewPassword(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Group assignment panel */}
      {groupUserId && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">
              Permission Groups — {users.find(u => u.id === groupUserId)?.username}
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
            {groups.length === 0 && <p className="text-xs text-text-muted">No permission groups created yet.</p>}
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-bg-secondary border border-border rounded-lg px-5 py-4">
            {editingId === u.id ? (
              /* Edit mode */
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Display Name" value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} />
                  <Input label="Email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-text-secondary">Role</label>
                    <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                      className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit}><Check size={14} className="mr-1" />Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {u.role === 'admin' ? <Shield size={18} className="text-accent" /> : <User size={18} className="text-text-muted" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium">{u.displayName || u.username}</span>
                      {u.displayName && <span className="text-xs text-text-muted">@{u.username}</span>}
                      {u.role === 'admin' && <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded">admin</span>}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {u.authSource === 'ldap' ? 'LDAP' : 'Local'}
                      {u.email && <span className="ml-2">{u.email}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggleActive(u)}
                    className={cn('text-xs px-2 py-1 rounded', u.isActive ? 'text-status-up bg-status-up-bg' : 'text-status-down bg-status-down-bg')}>
                    {u.isActive ? 'Active' : 'Disabled'}
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => openGroups(u.id)} title="Permission groups"><ShieldCheck size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setPwUserId(u.id)} title="Change password"><Key size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(u)} title="Edit"><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteUser(u.id)} title="Delete"><Trash2 size={14} className="text-status-down" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && <p className="text-center text-text-muted py-12 text-sm">No users yet.</p>}
      </div>
    </div>
  );
}
