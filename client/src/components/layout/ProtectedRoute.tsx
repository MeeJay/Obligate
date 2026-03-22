import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, loading, checkSession } = useAuthStore();

  useEffect(() => {
    if (!user && !loading) {
      checkSession().then(ok => {
        if (!ok) navigate('/login');
      });
    }
  }, [user, loading, checkSession, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary text-sm">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
