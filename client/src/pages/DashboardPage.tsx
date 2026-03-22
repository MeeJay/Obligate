import { useEffect, useState } from 'react';
import { AppWindow, Users, ShieldCheck, FolderTree } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

interface Stats {
  apps: number;
  users: number;
  groups: number;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ apps: 0, users: 0, groups: 0 });

  useEffect(() => {
    Promise.all([
      apiClient.get('/admin/apps').catch(() => ({ data: { data: [] } })),
      apiClient.get('/admin/users').catch(() => ({ data: { data: [] } })),
      apiClient.get('/admin/permission-groups').catch(() => ({ data: { data: [] } })),
    ]).then(([apps, users, groups]) => {
      setStats({
        apps: apps.data.data?.length ?? 0,
        users: users.data.data?.length ?? 0,
        groups: groups.data.data?.length ?? 0,
      });
    });
  }, []);

  const cards = [
    { icon: AppWindow,  label: 'Connected Apps',    value: stats.apps,   path: '/apps',        color: 'text-blue-400' },
    { icon: Users,      label: 'Users',             value: stats.users,  path: '/users',       color: 'text-green-400' },
    { icon: ShieldCheck, label: 'Permission Groups', value: stats.groups, path: '/groups',      color: 'text-purple-400' },
    { icon: FolderTree, label: 'Directories',       value: 0,            path: '/directories', color: 'text-orange-400' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="bg-bg-secondary border border-border rounded-lg p-5 text-left hover:border-border-light transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <card.icon size={22} className={card.color} />
              <span className="text-2xl font-bold text-text-primary">{card.value}</span>
            </div>
            <p className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{card.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
