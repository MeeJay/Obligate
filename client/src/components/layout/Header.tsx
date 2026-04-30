import { LogOut, Menu, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../utils/cn';
import apiClient from '../../api/client';

interface HeaderProps {
  onToggleMobile: () => void;
}

// 5-app pill switcher — fixed order across the suite (spec §4.1).
type AppType = 'obliview' | 'obliguard' | 'oblimap' | 'obliance' | 'oblihub';

interface AppEntry {
  type: AppType;
  label: string;
  color: string;
}

const APP_ORDER: AppEntry[] = [
  { type: 'obliview',  label: 'Obliview',  color: '#2bc4bd' },
  { type: 'obliguard', label: 'Obliguard', color: '#f5a623' },
  { type: 'oblimap',   label: 'Oblimap',   color: '#1edd8a' },
  { type: 'obliance',  label: 'Obliance',  color: '#e03a3a' },
  { type: 'oblihub',   label: 'Oblihub',   color: '#2d4ec9' },
];

// Obligate is the SSO gateway, not one of the 5 apps in the switcher — no
// pill is "current" here. Oblihub follows the same reachability rule as any
// other app: greyed out unless the user has a connected/enabled link to it.

interface ConnectedApp {
  appId: number;
  appType: string;
  name: string;
  baseUrl: string;
  enabled?: boolean;
}

export function Header({ onToggleMobile }: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [apps, setApps] = useState<ConnectedApp[]>([]);

  useEffect(() => {
    apiClient.get('/account/apps').then(({ data }) => {
      if (data.success) {
        setApps((data.data as ConnectedApp[]).filter(a => a.enabled !== false));
      }
    }).catch(() => {});
  }, []);

  const reachable = new Set<string>();
  for (const a of apps) reachable.add(a.appType);

  const goApp = (app: AppEntry) => {
    const target = apps.find(c => c.appType === app.type);
    if (target) window.location.href = `${target.baseUrl}/auth/sso-redirect`;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const username = user?.username ?? '';
  const displayed = username.startsWith('og_') ? username.slice(3) : username;
  const display = user?.displayName || displayed;

  return (
    <header
      className="flex shrink-0 items-center gap-3 bg-bg-secondary px-4"
      style={{ height: 52 }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onToggleMobile}
        className="rounded-md p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary lg:hidden"
        aria-label="Toggle navigation"
      >
        <Menu size={18} />
      </button>

      {/* Logo */}
      <Link to="/" className="flex shrink-0 items-center gap-2">
        <img src="/logo.svg" alt="Obligate" className="h-8 w-auto max-w-[160px] object-contain" />
      </Link>

      {/* App switcher pills */}
      <nav className="ml-2 hidden items-center gap-1 md:flex">
        {APP_ORDER.map((app) => {
          const isReachable = reachable.has(app.type);
          return (
            <button
              key={app.type}
              type="button"
              onClick={() => goApp(app)}
              disabled={!isReachable}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                'text-text-muted hover:bg-bg-hover hover:text-text-primary',
                !isReachable && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-text-muted',
              )}
              title={app.label}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: app.color }}
              />
              {app.label}
            </button>
          );
        })}
      </nav>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-3">
        <button
          title={t('common.notifications', 'Notifications')}
          className="relative flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <Bell size={15} />
        </button>

        {user && (
          <>
            <Link
              to="/account"
              className="flex items-center gap-2 rounded-full bg-bg-hover py-1 pl-1.5 pr-3 transition-colors hover:bg-bg-active"
            >
              {user.profilePhotoUrl ? (
                <img
                  src={user.profilePhotoUrl}
                  alt={display}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, rgba(45,78,201,0.7), rgba(90,120,232,0.45))' }}
                >
                  {(display?.[0] ?? '?').toUpperCase()}
                </div>
              )}
              <span className="hidden text-[13px] font-medium text-text-primary sm:inline">{display}</span>
              {user.role === 'admin' && (
                <span className="hidden border-l border-border-light pl-2 font-mono text-[10px] uppercase tracking-wider text-accent sm:inline">
                  {t('common.admin')}
                </span>
              )}
            </Link>
            <button
              onClick={handleLogout}
              title={t('common.logout')}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
            >
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
