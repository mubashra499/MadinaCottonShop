import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={cn(i <= Math.round(rating) ? 'text-amber-400' : 'text-neutral-300 dark:text-neutral-600')}
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export function Badge({ children, color = 'neutral' }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
    accent: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    green: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  };
  return <span className={cn('badge', colors[color] ?? colors.neutral)}>{children}</span>;
}

export function Modal({ open, onClose, children, title, maxWidth = 'max-w-lg' }: { open: boolean; onClose: () => void; children: ReactNode; title?: string; maxWidth?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative w-full rounded-2xl bg-white p-6 shadow-card dark:bg-neutral-900 animate-fade-in-up', maxWidth)}>
        {title && <h3 className="mb-4 text-lg font-semibold">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-neutral-300 dark:text-neutral-600">{icon}</div>}
      <h3 className="mb-1 text-lg font-semibold text-neutral-800 dark:text-neutral-200">{title}</h3>
      {message && <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toast({ message, type = 'success' }: { message: string; type?: 'success' | 'error' }) {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-card animate-fade-in-up',
        type === 'success' ? 'bg-accent-600 text-white' : 'bg-red-600 text-white'
      )}
      onClick={() => setShow(false)}
    >
      {message}
    </div>
  );
}
