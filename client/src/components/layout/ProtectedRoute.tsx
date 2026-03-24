import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, requiresEnrollment, requires2faSetup, checkSession } = useAuthStore();
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

  if (!user) return null;

  // Redirect to enrollment if needed (skip if already on /enroll)
  if (requiresEnrollment && location.pathname !== '/enroll') {
    navigate('/enroll', { replace: true });
    return null;
  }

  // Redirect to 2FA setup if forced by admin (skip if on /setup-2fa or /enroll)
  if (requires2faSetup && location.pathname !== '/setup-2fa' && location.pathname !== '/enroll') {
    navigate('/setup-2fa', { replace: true });
    return null;
  }

  return <>{children}</>;
}
