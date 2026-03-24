import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';

type Step = 'credentials' | '2fa';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, checkSession } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<Step>('credentials');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  const returnTo = searchParams.get('returnTo');

  const goToApp = () => {
    if (returnTo) {
      window.location.href = returnTo;
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Login failed');
      return;
    }

    if (result.requires2fa) {
      setStep('2fa');
      setMfaCode('');
      return;
    }

    goToApp();
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMfaLoading(true);
    try {
      const { data } = await apiClient.post('/profile/2fa/verify', { code: mfaCode });
      if (data.success) {
        await checkSession();
        goToApp();
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch {
      setError('Invalid code. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Obligate" className="mx-auto h-24 w-24 mb-3" />
        </div>

        <div className="bg-bg-secondary border border-border rounded-lg p-6">
          {step === 'credentials' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin, DOMAIN\user, or user@domain.com"
                autoFocus
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              {error && (
                <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full">
                Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">Two-Factor Authentication</p>
                <p className="text-xs text-text-muted">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <Input
                label="Authentication Code"
                type="text"
                inputMode="numeric"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                required
              />
              {error && (
                <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">
                  {error}
                </div>
              )}
              <Button type="submit" loading={mfaLoading} className="w-full">
                Verify
              </Button>
              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); }}
                className="w-full text-center text-xs text-text-muted hover:text-text-primary"
              >
                Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
