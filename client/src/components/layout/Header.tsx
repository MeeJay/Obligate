import { LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-14 flex-shrink-0 bg-bg-secondary border-b border-border px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="lg:hidden rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 lg:hidden">
          <img src="/logo.svg" alt="Obligate" style={{ height: '36px', width: 'auto' }} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-text-secondary">
          {user?.displayName || user?.username}
          {user?.role === 'admin' && (
            <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">{t('common.admin')}</span>
          )}
        </span>
        <button onClick={handleLogout} className="rounded-md p-1.5 text-text-secondary hover:bg-bg-hover hover:text-text-primary" title={t('common.logout')}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
