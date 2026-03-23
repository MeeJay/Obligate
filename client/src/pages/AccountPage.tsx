import { useEffect, useState } from 'react';
import { ExternalLink, Key, User, Palette, Bell, Shield } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ThemePicker } from '../components/ThemePicker';
import { useAuthStore } from '../store/authStore';
import { cn } from '../utils/cn';
import { applyTheme } from '../utils/theme';

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

const TOAST_POSITIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'top-center', label: 'Top Center' },
];

function AlertPreviewSvg({ position }: { position: 'bottom-right' | 'top-center' }) {
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-xs mx-auto rounded-lg border border-border bg-bg-primary">
      <rect x="4" y="4" width="192" height="112" rx="6" fill="currentColor" className="text-bg-secondary" stroke="currentColor" strokeWidth="1" />
      <rect x="4" y="4" width="192" height="16" rx="6" fill="currentColor" className="text-bg-hover" />
      <rect x="8" y="8" width="40" height="8" rx="3" fill="currentColor" className="text-border" />
      <rect x="160" y="8" width="30" height="8" rx="3" fill="currentColor" className="text-border" />
      {[28, 38, 48, 58].map((y) => (
        <rect key={y} x="12" y={y} width={30 + (y % 20) * 2} height="5" rx="2" fill="currentColor" className="text-border opacity-50" />
      ))}
      {position === 'bottom-right' ? (
        <>
          <rect x="110" y="82" width="80" height="22" rx="4" fill="currentColor" className="text-accent" opacity="0.9" />
          <rect x="115" y="87" width="50" height="4" rx="2" fill="white" opacity="0.9" />
          <rect x="115" y="94" width="35" height="3" rx="2" fill="white" opacity="0.6" />
        </>
      ) : (
        <>
          <rect x="60" y="24" width="80" height="22" rx="4" fill="currentColor" className="text-accent" opacity="0.9" />
          <rect x="65" y="29" width="50" height="4" rx="2" fill="white" opacity="0.9" />
          <rect x="65" y="36" width="35" height="3" rx="2" fill="white" opacity="0.6" />
        </>
      )}
    </svg>
  );
}

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
      if (data.success) {
        setCommon(data.data);
        if (patch.preferredTheme) applyTheme(patch.preferredTheme as 'modern' | 'neon');
      }
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

      {/* ── Two-Factor Authentication ──────────────────────────── */}
      <TotpSection />

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
              <ThemePicker
                value={common.preferredTheme}
                onChange={theme => saveCommon({ preferredTheme: theme })}
              />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TOAST_POSITIONS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => saveCommon({ toastPosition: p.value })}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        common.toastPosition === p.value
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-accent/50 hover:bg-bg-hover',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn('h-4 w-4 rounded-full border-2 flex items-center justify-center',
                          common.toastPosition === p.value ? 'border-accent' : 'border-border')}>
                          {common.toastPosition === p.value && <div className="h-2 w-2 rounded-full bg-accent" />}
                        </div>
                        <span className="text-sm font-medium text-text-primary">{p.label}</span>
                      </div>
                      <p className="text-xs text-text-muted mb-3">
                        {p.value === 'bottom-right'
                          ? 'Toasts stack in the bottom-right corner. Less intrusive, ideal for dashboards.'
                          : 'Toasts appear centered at the top. More visible, good for critical alerts.'}
                      </p>
                      <AlertPreviewSvg position={p.value as 'bottom-right' | 'top-center'} />
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

function TotpSection() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setupData, setSetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    apiClient.get('/profile/2fa/status').then(({ data }) => {
      if (data.success) {
        setTotpEnabled(data.data.totpEnabled);
        setChecked(true);
      }
    }).catch(() => setChecked(true));
  }, []);

  const startSetup = async () => {
    setError('');
    try {
      const { data } = await apiClient.post('/profile/2fa/totp/setup');
      if (data.success) setSetupData(data.data);
    } catch { setError('Failed to start setup'); }
  };

  const enableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/profile/2fa/totp/enable', { code });
      if (data.success) {
        setTotpEnabled(true);
        setSetupData(null);
        setCode('');
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch {
      setError('Invalid code');
    } finally { setLoading(false); }
  };

  const disableTotp = async () => {
    if (!confirm('Disable two-factor authentication? This will make your account less secure.')) return;
    try {
      await apiClient.delete('/profile/2fa/totp');
      setTotpEnabled(false);
    } catch { setError('Failed to disable'); }
  };

  if (!checked) return null;

  return (
    <section className="bg-bg-secondary border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-text-muted" />
        <h2 className="text-lg font-medium text-text-primary">Two-Factor Authentication</h2>
        {totpEnabled && (
          <span className="text-xs bg-status-up-bg text-status-up px-2 py-0.5 rounded border border-status-up/30">Enabled</span>
        )}
      </div>

      {totpEnabled ? (
        <div>
          <p className="text-sm text-text-muted mb-3">TOTP two-factor authentication is active. All Obli* apps are protected.</p>
          <Button size="sm" variant="danger" onClick={disableTotp}>Disable 2FA</Button>
        </div>
      ) : setupData ? (
        <form onSubmit={enableTotp} className="space-y-4">
          <p className="text-sm text-text-muted">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
          <div className="flex justify-center">
            <img src={setupData.qrDataUrl} alt="TOTP QR Code" className="rounded-lg" width={200} height={200} />
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">Or enter this secret manually:</p>
            <code className="block bg-bg-tertiary px-3 py-2 rounded text-sm font-mono text-text-primary break-all select-all">{setupData.secret}</code>
          </div>
          <Input
            label="Verification Code"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            required
          />
          {error && <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">{error}</div>}
          <div className="flex gap-2">
            <Button type="submit" loading={loading} size="sm">Enable 2FA</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSetupData(null)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <p className="text-sm text-text-muted mb-3">Add an extra layer of security. Once enabled, you'll need your authenticator app to sign in to all Obli* applications.</p>
          <Button size="sm" onClick={startSetup}>Setup 2FA</Button>
        </div>
      )}
    </section>
  );
}
