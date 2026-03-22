import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, AppWindow, Users, ShieldCheck, FolderTree, UserCircle, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../store/authStore';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { path: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/apps',          icon: AppWindow,       label: 'Connected Apps',     admin: true },
  { path: '/users',         icon: Users,           label: 'Users',              admin: true },
  { path: '/groups',        icon: ShieldCheck,      label: 'Permission Groups', admin: true },
  { path: '/directories',   icon: FolderTree,      label: 'Directories',        admin: true },
];

const bottomItems = [
  { path: '/account',       icon: UserCircle,      label: 'My Account' },
  { path: '/settings',      icon: Settings,        label: 'Settings',           admin: true },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-14 left-0 bottom-0 z-50 w-56 bg-bg-secondary border-r border-border',
        'flex flex-col transition-transform duration-200',
        'lg:static lg:translate-x-0 lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            if (item.admin && !isAdmin) return null;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-bg-active text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border py-3 px-2 space-y-0.5">
          {bottomItems.map(item => {
            if (item.admin && !isAdmin) return null;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-bg-active text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
