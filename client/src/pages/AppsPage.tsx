import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, RotateCw, Trash2, Copy, Check } from 'lucide-react';
import apiClient from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import type { ConnectedApp, AppType } from '@obligate/shared';

const APP_TYPES: AppType[] = ['obliview', 'obliguard', 'oblimap', 'obliance', 'oblihub'];
const APP_COLORS: Record<AppType, string> = {
  obliview: 'text-blue-400',
  obliguard: 'text-cyan-400',
  oblimap: 'text-green-400',
  obliance: 'text-purple-400',
  oblihub: 'text-gray-400',
};

export function AppsPage() {
  const { t } = useTranslation();
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ appType: 'obliview' as AppType, name: '', baseUrl: '' });
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await apiClient.get('/admin/apps');
    if (data.success) setApps(data.data);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await apiClient.post('/admin/apps', form);
      if (data.success) {
        setNewApiKey(data.data.apiKey);
        setShowForm(false);
        setForm({ appType: 'obliview', name: '', baseUrl: '' });
        load();
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this app?')) return;
    await apiClient.delete(`/admin/apps/${id}`);
    load();
  };

  const handleRegenKey = async (id: number) => {
    if (!confirm('Regenerate API key? The old key will stop working immediately.')) return;
    const { data } = await apiClient.post(`/admin/apps/${id}/regenerate-key`);
    if (data.success) {
      setNewApiKey(data.data.apiKey);
    }
  };

  const copyKey = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{t('apps.title')}</h1>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1.5" /> {t('apps.addApp')}
        </Button>
      </div>

      {/* New API Key banner */}
      {newApiKey && (
        <div className="bg-status-up-bg border border-status-up/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-status-up font-medium mb-2">{t('apps.apiKeyShown')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-bg-tertiary px-3 py-2 rounded text-sm font-mono text-text-primary break-all">{newApiKey}</code>
            <Button size="sm" variant="secondary" onClick={copyKey}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewApiKey(null)}>{t('common.dismiss')}</Button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
          <h2 className="text-lg font-medium text-text-primary mb-4">{t('apps.registerNew')}</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-text-secondary">{t('apps.appType')}</label>
              <select
                value={form.appType}
                onChange={e => setForm(f => ({ ...f, appType: e.target.value as AppType }))}
                className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
              >
                {APP_TYPES.map(at => <option key={at} value={at}>{at}</option>)}
              </select>
            </div>
            <Input label={t('apps.displayName')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('apps.displayNamePlaceholder')} required />
            <Input label={t('apps.baseUrl')} value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} placeholder={t('apps.baseUrlPlaceholder')} required />
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>{t('common.create')}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </form>
        </div>
      )}

      {/* Apps list */}
      <div className="space-y-2">
        {apps.map(app => (
          <div key={app.id} className="bg-bg-secondary border border-border rounded-lg px-5 py-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${APP_COLORS[app.appType]}`}>{app.appType}</span>
                <span className="text-text-primary font-medium">{app.name}</span>
                {!app.isActive && <span className="text-xs bg-status-down-bg text-status-down px-1.5 py-0.5 rounded">{t('common.disabled')}</span>}
              </div>
              <p className="text-xs text-text-muted mt-0.5 font-mono">{app.baseUrl}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => handleRegenKey(app.id)} title={t('apps.regenerateKey')}>
                <RotateCw size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(app.id)} title={t('common.delete')}>
                <Trash2 size={14} className="text-status-down" />
              </Button>
            </div>
          </div>
        ))}
        {apps.length === 0 && (
          <p className="text-center text-text-muted py-12 text-sm">{t('apps.noApps')}</p>
        )}
      </div>
    </div>
  );
}
