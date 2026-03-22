import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-secondary">{label}</label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full rounded-md border bg-bg-tertiary px-3 py-2 text-sm text-text-primary',
          'placeholder:text-text-muted',
          'focus:ring-2 focus:ring-accent focus:border-transparent outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-status-down focus:ring-status-down' : 'border-border',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-status-down">{error}</p>}
    </div>
  ),
);
