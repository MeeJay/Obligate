import { useEffect, useState } from 'react';
import { ExternalLink, Key, User, Palette, Bell, Shield } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuthStore } from '../store/authStore';
import { cn } from '../utils/cn';

interface CommonPreferences {
  preferredTheme: string;
  toastEnabled: boolean;
  toastPosition: string;
  profilePhotoUrl: string | null;
  preferredLanguage: string;
}

interface PreferenceSchema {
  key: string;
  label: string;
  fieldType: 'text' | 'select' | 'boolean' | 'number';
  options: string[] | null;
  defaultValue: string | null;
}

interface AppSection {
  appId: number;
  appName: string;
  appType: string;
  schemas: PreferenceSchema[];
  values: Record<string, string>;
}

interface AppStatus {
  appId: number;
  appType: string;
  name: string;
  baseUrl: string;
  linked: boolean;
  enabled: boolean;
  lastLoginAt: string | null;
}

const THEMES = [
  { value: 'modern', label: 'Modern', desc: 'Cool blues with dark grays' },
  { value: 'neon', label: 'Neon', desc: 'Cyan cyberpunk aesthetic' },
];

const TOAST_POSITIONS = [
  { value: 'top-right', label: 'Top Right' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-center', label: 'Bottom Center' },
];

export function AccountPage() {
  const { user } = useAuthStore();
  const [apps, setApps] = useState<AppStatus[]>([]);
  const [common, setCommon] = useState<CommonPreferences | null>(null);
  const [appSections, setAppSections] = useState<AppSection[]>([]);
  useEffect(() => {
    apiClient.get('/account/apps').then(({ data }) => {
      if (data.success) setApps(data.data);
    });
    apiClient.get('/account/preferences').then(({ data }) => {
      if (data.success) {
        setCommon(data.data.common);
        setAppSections(data.data.appSections);
      }
    });
  }, []);

  const saveCommon = async (patch: Partial<CommonPreferences>) => {
    try {
      const { data } = await apiClient.put('/account/preferences/common', patch);
      if (data.success) setCommon(data.data);
    } catch { /* ignore */ }
  };

  const saveAppPref = async (appId: number, key: string, value: string) => {
    await apiClient.put(`/account/preferences/app/${appId}`, { [key]: value });
    setAppSections(prev => prev.map(s =>
      s.appId === appId ? { ...s, values: { ...s.values, [key]: value } } : s
    ));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold text-text-primary">My Account</h1>

      {/* ── Profile ────────────────────────────────────────────── */}
      <section className="bg-bg-secondary border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-text-muted" />
          <h2 className="text-lg font-medium text-text-primary">Profile</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-muted">Username</span>
            <p className="text-text-primary font-medium">{user?.username}</p>
          </div>
          <div>
            <span className="text-text-muted">Display Name</span>
            <p className="text-text-primary font-medium">{user?.displayName || '—'}</p>
          </div>
          <div>
            <span className="text-text-muted">Email</span>
            <p className="text-text-primary font-medium">{user?.email || '—'}</p>
          </div>
          <div>
            <span className="text-text-muted">Auth Source</span>
            <p className="text-text-primary font-medium">{user?.authSource === 'ldap' ? 'LDAP' : 'Local'}</p>
          </div>
        </div>
      </section>

      {/* ── Password ───────────────────────────────────────────── */}
      <ChangePasswordSection />

      {/* ── Appearance ─────────────────────────────────────────── */}
      {common && (
        <section className="bg-bg-secondary border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={18} className="text-text-muted" />
            <h2 className="text-lg font-medium text-text-primary">Appearance</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Theme</label>
              <div className="flex gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => saveCommon({ preferredTheme: t.value })}
                    className={cn(
                      'px-4 py-2 rounded-lg border text-sm transition-colors',
                      common.preferredTheme === t.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-text-muted mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Language</label>
              <select
                value={common.preferredLanguage}
                onChange={e => saveCommon({ preferredLanguage: e.target.value })}
                className="rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="en">English</option>
                <option value="fr">Francais</option>
                <option value="es">Espanol</option>
                <option value="de">Deutsch</option>
                <option value="pt-BR">Portugues (BR)</option>
                <option value="zh-CN">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ru">Russian</option>
                <option value="ko">Korean</option>
                <option value="ar">Arabic</option>
                <option value="it">Italiano</option>
                <option value="nl">Nederlands</option>
                <option value="pl">Polski</option>
                <option value="tr">Turkce</option>
                <option value="sv">Svenska</option>
                <option value="da">Dansk</option>
                <option value="cs">Cestina</option>
                <option value="uk">Ukrainian</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* ── Notifications ──────────────────────────────────────── */}
      {common && (
        <section className="bg-bg-secondary border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-text-muted" />
            <h2 className="text-lg font-medium text-text-primary">Notifications</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Toast Notifications</p>
                <p className="text-xs text-text-muted">Show popup notifications for status changes</p>
              </div>
              <button
                onClick={() => saveCommon({ toastEnabled: !common.toastEnabled })}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  common.toastEnabled ? 'bg-accent' : 'bg-bg-hover')}
              >
                <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  common.toastEnabled ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>

            {common.toastEnabled && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Position</label>
                <div className="flex flex-wrap gap-2">
                  {TOAST_POSITIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => saveCommon({ toastPosition: p.value })}
                      className={cn(
                        'px-3 py-1.5 rounded-md border text-sm transition-colors',
                        common.toastPosition === p.value
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── App-Specific Preferences ───────────────────────────── */}
      {appSections.map(section => (
        <section key={section.appId} className="bg-bg-secondary border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-text-muted" />
            <h2 className="text-lg font-medium text-text-primary">{section.appName} Preferences</h2>
            <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded">{section.appType}</span>
          </div>

          <div className="space-y-3">
            {section.schemas.map(schema => (
              <AppPreferenceField
                key={schema.key}
                schema={schema}
                value={section.values[schema.key] ?? schema.defaultValue ?? ''}
                onChange={value => saveAppPref(section.appId, schema.key, value)}
              />
            ))}
            {section.schemas.length === 0 && (
              <p className="text-xs text-text-muted">No specific preferences for this app.</p>
            )}
          </div>
        </section>
      ))}

      {/* ── Connected Apps ─────────────────────────────────────── */}
      <section className="bg-bg-secondary border border-border rounded-lg p-5">
        <h2 className="text-lg font-medium text-text-primary mb-4">Connected Apps</h2>
        <div className="space-y-2">
          {apps.map(app => (
            <div key={app.appId} className="flex items-center justify-between bg-bg-tertiary rounded-lg px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium">{app.name}</span>
                  <span className="text-xs text-text-muted">{app.appType}</span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {app.linked ? 'Account linked' : 'Not linked'}
                  {app.lastLoginAt && <span className="ml-2">Last login: {new Date(app.lastLoginAt).toLocaleDateString()}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${app.enabled ? 'text-status-up' : 'text-status-down'}`}>
                  {app.enabled ? 'Enabled' : 'Disabled'}
                </span>
                <a href={app.baseUrl} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text-primary">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ))}
          {apps.length === 0 && (
            <p className="text-center text-text-muted py-8 text-sm">No connected apps configured.</p>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

function AppPreferenceField({ schema, value, onChange }: {
  schema: PreferenceSchema; value: string; onChange: (v: string) => void;
}) {
  if (schema.fieldType === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        <label className="text-sm text-text-primary">{schema.label}</label>
        <button
          onClick={() => onChange(value === 'true' ? 'false' : 'true')}
          className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            value === 'true' ? 'bg-accent' : 'bg-bg-hover')}
        >
          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            value === 'true' ? 'translate-x-6' : 'translate-x-1')} />
        </button>
      </div>
    );
  }

  if (schema.fieldType === 'select' && schema.options) {
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-text-secondary">{schema.label}</label>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">— Select —</option>
          {schema.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text-secondary">{schema.label}</label>
      <input
        type={schema.fieldType === 'number' ? 'number' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (newPassword.length < 4) { setError('Password too short (min 4 chars)'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      const { data } = await apiClient.put('/account/password', { currentPassword, newPassword });
      if (data.success) { setSuccess(true); setCurrentPassword(''); setNewPassword(''); setConfirm(''); }
      else setError(data.error || 'Failed');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <section className="bg-bg-secondary border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Key size={18} className="text-text-muted" />
        <h2 className="text-lg font-medium text-text-primary">Change Password</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <Input label="Current Password" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
        <Input label="Confirm New Password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
        {error && <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">{error}</div>}
        {success && <div className="bg-status-up-bg border border-status-up/30 rounded-md p-3 text-sm text-status-up">Password changed successfully</div>}
        <Button type="submit" loading={saving} size="sm">Update Password</Button>
      </form>
    </section>
  );
}
