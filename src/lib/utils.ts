export function formatPrice(amount: number, currency = 'PKR'): string {
  const symbol = currency === 'PKR' ? 'Rs.' : currency;
  return `${symbol} ${Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MCS-${y}${m}${d}-${rand}`;
}

export function generateSku(name: string): string {
  const prefix = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${rand}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getEffectivePrice(price: number, salePrice: number | null): number {
  const p = Number(price);
  const s = salePrice != null ? Number(salePrice) : null;
  return s && s > 0 && s < p ? s : p;
}

export function getStockStatus(stock: number, threshold: number, madeToOrder: boolean): { label: string; color: string } {
  if (madeToOrder) return { label: 'Made to Order', color: 'text-accent-600' };
  if (stock === 0) return { label: 'Out of Stock', color: 'text-red-600' };
  const t = threshold > 0 ? threshold : 5;
  if (stock <= t) return { label: `Only ${stock} left!`, color: 'text-amber-600' };
  return { label: 'In Stock', color: 'text-accent-600' };
}

export function sanitizeSearchQuery(q: string): string {
  return q.replace(/[%_\\,.()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
