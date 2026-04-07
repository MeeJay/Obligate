import { useEffect, useState } from 'react';
import { AppWindow, Users, ShieldCheck, ExternalLink, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';

interface AppInfo {
  appId: number;
  appType: string;
  name: string;
  baseUrl: string;
  icon: string | null;
  color: string | null;
  linked: boolean;
  enabled: boolean;
  lastLoginAt: string | null;
}

interface DashboardStats {
  [appId: number]: {
    stats: Array<{ label: string; value: string | number; color?: string }>;
  };
}

const APP_COLORS: Record<string, string> = {
  obliview: '#19E2FF',
  obliguard: '#FFA515',
  oblimap: '#8DC63F',
  obliance: '#C2001B',
  oblihub: '#8B949E',
  oblifield: '#AEEA00',
};

const APP_ORDER: string[] = ['obliview', 'obliguard', 'oblimap', 'obliance', 'oblifield', 'oblihub'];

export function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [stats, setStats] = useState<DashboardStats>({});
  const [adminStats, setAdminStats] = useState({ apps: 0, users: 0, groups: 0 });

  useEffect(() => {
    apiClient.get('/account/apps').then(({ data }) => {
      if (data.success) {
        const enabledApps = (data.data as AppInfo[]).filter(a => a.enabled);
        enabledApps.sort((a, b) => {
          const ai = APP_ORDER.indexOf(a.appType);
          const bi = APP_ORDER.indexOf(b.appType);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setApps(enabledApps);

        for (const app of enabledApps) {
          apiClient.get(`/admin/apps/${app.appId}/dashboard-stats`).then(({ data: sd }) => {
            if (sd.success && sd.data) {
              setStats(prev => ({ ...prev, [app.appId]: { stats: sd.data.stats } }));
            }
          }).catch(() => {});
        }
      }
    });

    if (isAdmin) {
      Promise.all([
        apiClient.get('/admin/apps').catch(() => ({ data: { data: [] } })),
        apiClient.get('/admin/users').catch(() => ({ data: { data: [] } })),
        apiClient.get('/admin/permission-groups').catch(() => ({ data: { data: [] } })),
      ]).then(([a, u, g]) => {
        setAdminStats({
          apps: a.data.data?.length ?? 0,
          users: u.data.data?.length ?? 0,
          groups: g.data.data?.length ?? 0,
        });
      });
    }
  }, [isAdmin]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary mb-6">
        {isAdmin ? t('dashboard.adminTitle') : t('dashboard.title')}
      </h1>

      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: AppWindow, label: t('dashboard.connectedApps'), value: adminStats.apps, path: '/apps', color: 'text-blue-400' },
            { icon: Users, label: t('dashboard.users'), value: adminStats.users, path: '/users', color: 'text-green-400' },
            { icon: ShieldCheck, label: t('dashboard.permissionGroups'), value: adminStats.groups, path: '/groups', color: 'text-purple-400' },
          ].map(card => (
            <button
              key={card.path}
              onClick={() => navigate(card.path)}
              className="bg-bg-secondary border border-border rounded-lg p-5 text-left hover:border-border-light transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <card.icon size={22} className={card.color} />
                <span className="text-2xl font-bold text-text-primary">{card.value}</span>
              </div>
              <p className="text-sm text-text-secondary">{card.label}</p>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map(app => {
          const color = app.color || APP_COLORS[app.appType] || '#19E2FF';
          const appStats = stats[app.appId]?.stats;

          return (
            <a
              key={app.appId}
              href={`${app.baseUrl}/auth/sso-redirect`}
              className="group bg-bg-secondary border border-border rounded-xl p-5 hover:border-border-light transition-all hover:shadow-lg cursor-pointer"
              style={{ borderTopColor: color, borderTopWidth: '3px' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors">
                    {app.name}
                  </h3>
                  <p className="text-xs text-text-muted">{app.appType}</p>
                </div>
                <ExternalLink size={16} className="text-text-muted group-hover:text-accent transition-colors" />
              </div>

              {appStats && appStats.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {appStats.map((s, i) => (
                    <div key={i} className="bg-bg-tertiary rounded-md px-3 py-2">
                      <div className="text-lg font-bold" style={{ color: s.color || color }}>{s.value}</div>
                      <div className="text-xs text-text-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-3 text-xs text-text-muted">
                  <Activity size={12} />
                  <span>
                    {app.lastLoginAt
                      ? t('dashboard.lastLogin', { date: new Date(app.lastLoginAt).toLocaleDateString() })
                      : t('dashboard.notConnected')}
                  </span>
                </div>
              )}
            </a>
          );
        })}

        {apps.length === 0 && (
          <div className="col-span-full text-center py-16">
            <AppWindow size={40} className="text-text-muted mx-auto mb-3" />
            <p className="text-text-muted">{t('dashboard.noApps')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
