import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Shield } from 'lucide-react';
import apiClient from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ThemePicker } from '../components/ThemePicker';
import { cn } from '../utils/cn';

type Step = 'language' | 'profile' | 'appearance' | 'notifications';
const STEPS: Step[] = ['language', 'profile', 'appearance', 'notifications'];

const LANG_FLAGS: Record<string, string> = {
  en: '\u{1F1EC}\u{1F1E7}', fr: '\u{1F1EB}\u{1F1F7}', es: '\u{1F1EA}\u{1F1F8}', de: '\u{1F1E9}\u{1F1EA}', 'pt-BR': '\u{1F1E7}\u{1F1F7}',
  'zh-CN': '\u{1F1E8}\u{1F1F3}', ja: '\u{1F1EF}\u{1F1F5}', ko: '\u{1F1F0}\u{1F1F7}', ru: '\u{1F1F7}\u{1F1FA}', ar: '\u{1F1F8}\u{1F1E6}',
  it: '\u{1F1EE}\u{1F1F9}', nl: '\u{1F1F3}\u{1F1F1}', pl: '\u{1F1F5}\u{1F1F1}', tr: '\u{1F1F9}\u{1F1F7}', sv: '\u{1F1F8}\u{1F1EA}',
  da: '\u{1F1E9}\u{1F1F0}', cs: '\u{1F1E8}\u{1F1FF}', uk: '\u{1F1FA}\u{1F1E6}',
};

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'fr', name: 'Francais' },
  { code: 'es', name: 'Espanol' }, { code: 'de', name: 'Deutsch' },
  { code: 'pt-BR', name: 'Portugues (BR)' }, { code: 'zh-CN', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' }, { code: 'ru', name: 'Russian' },
  { code: 'ko', name: 'Korean' }, { code: 'ar', name: 'Arabic' },
  { code: 'it', name: 'Italiano' }, { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' }, { code: 'tr', name: 'Turkce' },
  { code: 'sv', name: 'Svenska' }, { code: 'da', name: 'Dansk' },
  { code: 'cs', name: 'Cestina' }, { code: 'uk', name: 'Ukrainian' },
];

const TOAST_POSITIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'top-center', label: 'Top Center' },
];

export function EnrollmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, checkSession } = useAuthStore();
  const returnTo = searchParams.get('returnTo');

  const [step, setStep] = useState<Step>('language');
  const [data, setData] = useState({
    preferredLanguage: user?.preferredLanguage ?? 'en',
    displayName: user?.displayName ?? '',
    email: user?.email ?? '',
    preferredTheme: 'modern',
    toastEnabled: true,
    toastPosition: 'bottom-right',
  });
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');

  const currentIdx = STEPS.indexOf(step);
  const isLastStep = step === STEPS[STEPS.length - 1];

  const completeEnrollment = async () => {
    setCompleting(true);
    setError('');
    try {
      await apiClient.post('/auth/enrollment', data);
      await checkSession();
      if (returnTo) {
        window.location.href = returnTo;
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      setError('Failed to complete enrollment');
    } finally {
      setCompleting(false);
    }
  };

  const handleNext = async (e?: FormEvent) => {
    e?.preventDefault();
    if (step === 'language') { setStep('profile'); return; }
    if (step === 'profile') {
      if (!data.email) { setError('Email is required'); return; }
      setError('');
      setStep('appearance');
      return;
    }
    if (step === 'appearance') { setStep('notifications'); return; }
    if (step === 'notifications') { await completeEnrollment(); }
  };

  const handleBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <Shield size={48} className="text-accent mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-text-primary">Welcome to Obligate</h1>
          <p className="text-sm text-text-secondary mt-1">Let's set up your profile</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, idx) => (
            <div key={s} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors ${
                  idx < currentIdx ? 'bg-accent border-accent text-white'
                    : idx === currentIdx ? 'border-accent text-accent bg-transparent'
                    : 'border-border text-text-muted bg-transparent'
                }`}>
                  {idx < currentIdx ? <Check size={14} /> : idx + 1}
                </div>
                <span className={`text-xs hidden sm:block ${idx === currentIdx ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-10 sm:w-16 h-0.5 mx-1 mb-5 transition-colors ${idx < currentIdx ? 'bg-accent' : 'bg-border'}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleNext} className="rounded-xl border border-border bg-bg-secondary p-6 space-y-6">
          {/* Language step */}
          {step === 'language' && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Language</h2>
              <p className="text-sm text-text-muted mb-4">Choose your preferred language.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setData(d => ({ ...d, preferredLanguage: lang.code }))}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left',
                      data.preferredLanguage === lang.code
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    <span>{LANG_FLAGS[lang.code] ?? ''}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Profile step */}
          {step === 'profile' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-text-primary mb-2">Profile</h2>
              <p className="text-sm text-text-muted mb-4">Tell us about yourself.</p>
              <Input
                label="Display Name"
                value={data.displayName}
                onChange={e => setData(d => ({ ...d, displayName: e.target.value }))}
                placeholder="John Smith"
              />
              <Input
                label="Email"
                type="email"
                value={data.email}
                onChange={e => setData(d => ({ ...d, email: e.target.value }))}
                placeholder="john@example.com"
                required
              />
            </div>
          )}

          {/* Appearance step */}
          {step === 'appearance' && (
            <div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Appearance</h2>
              <p className="text-sm text-text-muted mb-4">Choose your visual theme.</p>
              <ThemePicker
                value={data.preferredTheme}
                onChange={theme => setData(d => ({ ...d, preferredTheme: theme }))}
              />
            </div>
          )}

          {/* Notifications step */}
          {step === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-text-primary mb-2">Notifications</h2>
              <p className="text-sm text-text-muted mb-4">Configure toast notifications across all apps.</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Toast Notifications</p>
                  <p className="text-xs text-text-muted">Show popup notifications for status changes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setData(d => ({ ...d, toastEnabled: !d.toastEnabled }))}
                  className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    data.toastEnabled ? 'bg-accent' : 'bg-bg-hover')}
                >
                  <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    data.toastEnabled ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>
              {data.toastEnabled && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Position</label>
                  <div className="flex flex-wrap gap-2">
                    {TOAST_POSITIONS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setData(d => ({ ...d, toastPosition: p.value }))}
                        className={cn(
                          'px-3 py-1.5 rounded-md border text-sm transition-colors',
                          data.toastPosition === p.value
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-status-down-bg border border-status-down/30 rounded-md p-3 text-sm text-status-down">{error}</div>
          )}

          <div className="flex items-center justify-between pt-2">
            {currentIdx > 0 ? (
              <Button type="button" variant="ghost" onClick={handleBack}>Back</Button>
            ) : <div />}
            <Button type="submit" loading={completing}>
              {isLastStep ? 'Complete' : 'Next'}
            </Button>
          </div>
        </form>

        <p className="text-center text-xs text-text-muted mt-4">
          Step {currentIdx + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
