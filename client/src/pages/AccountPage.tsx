import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

interface AppStatus {
  appId: number;
  appType: string;
  name: string;
  baseUrl: string;
  linked: boolean;
  enabled: boolean;
  lastLoginAt: string | null;
}

export function AccountPage() {
  const { user } = useAuthStore();
  const [apps, setApps] = useState<AppStatus[]>([]);

  useEffect(() => {
    apiClient.get('/account/apps').then(({ data }) => {
      if (data.success) setApps(data.data);
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary mb-6">My Account</h1>

      <div className="bg-bg-secondary border border-border rounded-lg p-5 mb-6">
        <h2 className="text-lg font-medium text-text-primary mb-4">Profile</h2>
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
      </div>

      <div className="bg-bg-secondary border border-border rounded-lg p-5">
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
      </div>
    </div>
  );
}
