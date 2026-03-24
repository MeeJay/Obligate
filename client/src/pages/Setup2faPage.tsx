import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut } from 'lucide-react';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

export function Setup2faPage() {
  const navigate = useNavigate();
  const { logout, checkSession } = useAuthStore();
  const [setupData, setSetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  const startSetup = async () => {
    setError('');
    setStarting(true);
    try {
      const { data } = await apiClient.post('/profile/2fa/totp/setup');
      if (data.success) setSetupData(data.data);
      else setError('Failed to start setup');
    } catch { setError('Failed to start setup'); }
    finally { setStarting(false); }
  };

  const enableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/profile/2fa/totp/enable', { code });
      if (data.success) {
        await checkSession();
        navigate('/', { replace: true });
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch {
      setError('Invalid code');
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield size={32} className="text-accent" />
            <div>
              <h1 className="text-xl font-bold text-text-primary">Two-Factor Authentication Required</h1>
              <p className="text-xs text-text-secondary">Your administrator requires all users to enable 2FA</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        <div className="rounded-xl border border-border bg-bg-secondary p-6 space-y-5">
          {!setupData ? (
            <div className="text-center">
              <p className="text-sm text-text-muted mb-4">
                Set up an authenticator app (Google Authenticator, Authy, etc.) to secure your account and access all Obli* applications.
              </p>
              <Button onClick={startSetup} loading={starting}>Start Setup</Button>
            </div>
          ) : (
            <form onSubmit={enableTotp} className="space-y-4">
              <p className="text-sm text-text-muted">Scan this QR code with your authenticator app:</p>
              <div className="flex justify-center">
                <img src={setupData.qrDataUrl} alt="TOTP QR Code" className="rounded-lg" width={200} height={200} />
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">Or enter this secret manually:</p>
                <code className="block bg-bg-tertiary px-3 py-2 rounded text-sm font-mono text-text-primary break-all select-all">{setupData.secret}</code>
              </div>
              <Input
                label="Verification Code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
              />
              {error && <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">{error}</div>}
              <Button type="submit" loading={loading} className="w-full">Enable 2FA</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
