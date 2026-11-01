import { ShoppingBag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils';

interface StickyAddToBagProps {
  price: number;
  currency: string;
  onAdd: () => void;
  adding: boolean;
  disabled: boolean;
  label: string;
}

export function StickyAddToBag({ price, currency, onAdd, adding, disabled, label }: StickyAddToBagProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500">{label}</p>
          <p className="text-lg font-bold text-primary-700 dark:text-primary-400">
            {formatPrice(price, currency)}
          </p>
        </div>
        <button
          onClick={onAdd}
          disabled={adding || disabled}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition',
            disabled ? 'bg-neutral-400' : 'bg-primary-600 hover:bg-primary-700'
          )}
        >
          {adding ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
          {disabled ? 'Out of Stock' : 'Add to Bag'}
        </button>
      </div>
    </div>
  );
}
