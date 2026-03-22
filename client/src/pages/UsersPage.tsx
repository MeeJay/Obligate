import { useEffect, useState } from 'react';
import { Plus, Shield, User } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import type { ObligateUser } from '@obligate/shared';

export function UsersPage() {
  const [users, setUsers] = useState<ObligateUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '', role: 'user' as 'admin' | 'user' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await apiClient.get('/admin/users');
    if (data.success) setUsers(data.data);
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
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch { setError('Connection error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Users</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1.5" /> Add User
        </Button>
      </div>

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
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              >
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

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="bg-bg-secondary border border-border rounded-lg px-5 py-4 flex items-center justify-between">
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
            <span className={`text-xs ${u.isActive ? 'text-status-up' : 'text-status-down'}`}>
              {u.isActive ? 'Active' : 'Disabled'}
            </span>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-center text-text-muted py-12 text-sm">No users yet.</p>
        )}
      </div>
    </div>
  );
}
