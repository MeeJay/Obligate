import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, checkSession } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user && !checked) {
      checkSession().then(ok => {
        setChecked(true);
        if (!ok) navigate('/login');
      });
    }
  }, [user, checked, checkSession, navigate]);

  if (!user && !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null; // redirecting to /login

  return <>{children}</>;
}
