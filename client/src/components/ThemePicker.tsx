import { Check } from 'lucide-react';
import { cn } from '../utils/cn';

type AppTheme = 'modern' | 'neon';

interface ThemePickerProps {
  value: string;
  onChange: (theme: string) => void;
}

function ModernPreviewSvg() {
  return (
    <svg viewBox="0 0 280 170" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-md">
      <rect width="280" height="170" fill="#0d1117" rx="6" />
      <rect x="0" y="0" width="60" height="170" fill="#161b22" rx="6" />
      <rect x="60" y="0" width="1" height="170" fill="#30363d" />
      <rect x="10" y="12" width="16" height="16" rx="3" fill="#58a6ff" opacity="0.9" />
      <rect x="31" y="15" width="22" height="5" rx="2" fill="#8b949e" />
      {[40, 62, 84, 106].map((y, i) => (
        <g key={y}>
          <rect x="7" y={y} width="46" height="16" rx="3" fill={i === 0 ? '#1c2333' : 'transparent'} />
          <rect x="13" y={y + 4} width="8" height="8" rx="2" fill={i === 0 ? '#58a6ff' : '#6e7681'} />
          <rect x="25" y={y + 6} width={i === 0 ? 22 : 18} height="4" rx="2" fill={i === 0 ? '#e6edf3' : '#6e7681'} />
        </g>
      ))}
      <rect x="61" y="0" width="219" height="28" fill="#161b22" />
      <rect x="61" y="28" width="219" height="1" fill="#30363d" />
      {[0, 1, 2].map((i) => {
        const colors = ['#3b82f6', '#f85149', '#3b82f6'];
        const x = 70 + i * 69;
        return (
          <g key={i}>
            <rect x={x} y="68" width="62" height="50" rx="4" fill="#161b22" stroke="#30363d" strokeWidth="0.5" />
            <rect x={x} y="68" width="2.5" height="50" rx="2" fill={colors[i]} />
            <rect x={x + 7} y="76" width="6" height="6" rx="3" fill={colors[i]} />
            <rect x={x + 17} y="77" width={35} height="4" rx="2" fill="#e6edf3" />
            <rect x={x + 17} y="84" width="25" height="3" rx="2" fill="#6e7681" />
          </g>
        );
      })}
      <rect x="70" y="126" width="200" height="36" rx="4" fill="#161b22" stroke="#30363d" strokeWidth="0.5" />
      <rect x="78" y="143" width="90" height="3" rx="2" fill="#1c2333" />
      <rect x="78" y="143" width="55" height="3" rx="2" fill="#58a6ff" opacity="0.85" />
      <rect x="175" y="143" width="88" height="3" rx="2" fill="#1c2333" />
      <rect x="175" y="143" width="40" height="3" rx="2" fill="#a371f7" opacity="0.85" />
    </svg>
  );
}

function NeonPreviewSvg() {
  return (
    <svg viewBox="0 0 280 170" xmlns="http://www.w3.org/2000/svg" className="w-full rounded-md">
      <defs>
        <filter id="glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="280" height="170" fill="#070a0f" rx="6" />
      <rect x="0" y="0" width="60" height="170" fill="#0d1117" rx="6" />
      <rect x="60" y="0" width="1" height="170" fill="#1c2a3f" />
      <rect x="10" y="12" width="16" height="16" rx="3" fill="#00c8ff" opacity="0.85" filter="url(#glow-cyan)" />
      <rect x="31" y="15" width="22" height="5" rx="2" fill="#7899b8" />
      {[40, 62, 84, 106].map((y, i) => (
        <g key={y}>
          <rect x="7" y={y} width="46" height="16" rx="3" fill={i === 0 ? '#1a1f2e' : 'transparent'} />
          <rect x="13" y={y + 4} width="8" height="8" rx="2" fill={i === 0 ? '#00c8ff' : '#4a6a88'} filter={i === 0 ? 'url(#glow-cyan)' : undefined} />
          <rect x="25" y={y + 6} width={i === 0 ? 22 : 18} height="4" rx="2" fill={i === 0 ? '#e0f0ff' : '#4a6a88'} />
        </g>
      ))}
      <rect x="61" y="0" width="219" height="28" fill="#0d1117" />
      <rect x="61" y="28" width="219" height="1" fill="#1c2a3f" />
      {[0, 1, 2].map((i) => {
        const colors = ['#00a0ff', '#ff3860', '#00a0ff'];
        const filters = ['url(#glow-blue)', 'url(#glow-red)', 'url(#glow-blue)'];
        const x = 70 + i * 69;
        return (
          <g key={i}>
            <rect x={x} y="68" width="62" height="50" rx="4" fill="#0d1117" stroke="#1c2a3f" strokeWidth="0.5" />
            <rect x={x} y="68" width="2.5" height="50" rx="2" fill={colors[i]} filter={filters[i]} />
            <rect x={x + 7} y="76" width="6" height="6" rx="3" fill={colors[i]} filter={filters[i]} />
            <rect x={x + 17} y="77" width={35} height="4" rx="2" fill="#e0f0ff" />
            <rect x={x + 17} y="84" width="25" height="3" rx="2" fill="#4a6a88" />
          </g>
        );
      })}
      <rect x="70" y="126" width="200" height="36" rx="4" fill="#0d1117" stroke="#1c2a3f" strokeWidth="0.5" />
      <rect x="78" y="143" width="90" height="3" rx="2" fill="#111827" />
      <rect x="78" y="143" width="55" height="3" rx="2" fill="#00c8ff" opacity="0.9" filter="url(#glow-cyan)" />
      <rect x="175" y="143" width="88" height="3" rx="2" fill="#111827" />
      <rect x="175" y="143" width="40" height="3" rx="2" fill="#b06aff" opacity="0.9" />
    </svg>
  );
}

const THEMES: { id: AppTheme; label: string; Preview: () => JSX.Element }[] = [
  { id: 'modern', label: 'Modern UI', Preview: ModernPreviewSvg },
  { id: 'neon',   label: 'Neon UI',   Preview: NeonPreviewSvg },
];

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {THEMES.map(({ id, label, Preview }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'group relative rounded-xl border-2 p-2 text-left transition-all',
              selected
                ? 'border-accent shadow-[0_0_0_1px_rgb(var(--c-accent)/0.3)]'
                : 'border-border hover:border-accent/40 hover:bg-bg-hover',
            )}
          >
            <div className={cn(
              'overflow-hidden rounded-lg ring-0 transition-all',
              selected ? 'ring-2 ring-accent/30' : 'group-hover:ring-1 group-hover:ring-accent/20',
            )}>
              <Preview />
            </div>
            <div className="mt-2.5 flex items-center justify-between px-1 pb-0.5">
              <span className={cn('text-sm font-semibold', selected ? 'text-accent' : 'text-text-secondary')}>
                {label}
              </span>
              {selected && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                  <Check size={11} className="text-bg-primary" strokeWidth={3} />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
