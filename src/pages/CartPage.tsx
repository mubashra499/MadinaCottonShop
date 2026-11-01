import { Link, navigate } from '@/lib/router';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/lib/utils';
import { EmptyState } from '@/components/ui';
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function CartPage() {
  const { items, loading, error: cartCtxError, subtotal, updateQuantity, removeItem } = useCart();
  const { user } = useAuth();
  const [cartError, setCartError] = useState<string | null>(null);

  if (!user) {
    return <EmptyState title="Sign in to view your cart" action={<Link to="/auth" className="btn-primary">Sign In</Link>} />;
  }

  if (loading) {
    return <div className="py-20 text-center text-neutral-400">Loading cart...</div>;
  }

  if (cartCtxError && items.length === 0) {
    return <EmptyState icon={<AlertCircle size={48} />} title="Could not load your cart" message={cartCtxError} action={<button onClick={() => window.location.reload()} className="btn-primary">Try Again</button>} />;
  }

  if (items.length === 0) {
    return <EmptyState icon={<ShoppingBag size={48} />} title="Your cart is empty" message="Browse our handmade products and add items to your cart." action={<Link to="/shop" className="btn-primary">Shop Now</Link>} />;
  }

  const handleDecrease = async (itemId: string, currentQty: number) => {
    setCartError(null);
    if (currentQty <= 1) return;
    const result = await updateQuantity(itemId, currentQty - 1);
    if (result.error) setCartError(result.error);
  };

  const handleIncrease = async (itemId: string, currentQty: number) => {
    setCartError(null);
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const product = item.product;
    const variant = item.variant;
    const madeToOrder = product?.made_to_order ?? false;
    if (!madeToOrder) {
      const availableStock = variant ? variant.stock : product?.stock ?? 0;
      if (currentQty + 1 > availableStock) {
        setCartError(`Only ${availableStock} in stock for ${product?.name ?? 'this item'}.`);
        return;
      }
    }
    const result = await updateQuantity(itemId, currentQty + 1);
    if (result.error) setCartError(result.error);
  };

  const handleRemove = async (itemId: string) => {
    setCartError(null);
    const result = await removeItem(itemId);
    if (result?.error) setCartError(result.error);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold">Shopping Cart</h1>
      {cartError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertCircle size={16} className="flex-shrink-0" />
          {cartError}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const product = item.product;
            const variant = item.variant;
            const image = product?.product_images?.find((i) => i.is_primary) ?? product?.product_images?.[0];
            const availableStock = variant ? variant.stock : product?.stock ?? 0;
            const madeToOrder = product?.made_to_order ?? false;
            const lowStock = !madeToOrder && availableStock > 0 && availableStock <= 5;
            const outOfStock = !madeToOrder && availableStock === 0;
            return (
              <div key={item.id} className="card flex gap-4 p-4">
                <Link to={product ? `/product/${product.slug}` : '#'} className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  {image ? <img src={image.url} alt={product?.name ?? ''} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-neutral-300"><ShoppingBag size={24} /></div>}
                </Link>
                <div className="flex-1">
                  <h3 className="font-semibold">{product?.name ?? 'Product'}</h3>
                  {variant && (
                    <p className="text-sm text-neutral-500">
                      {[variant.size_label, variant.weight, variant.color, variant.filling].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {item.note && <p className="text-xs text-neutral-400">Note: {item.note}</p>}
                  {lowStock && <p className="mt-1 text-xs text-amber-600">Only {availableStock} left in stock</p>}
                  {outOfStock && <p className="mt-1 text-xs text-red-600">Out of stock — please remove from cart</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border border-neutral-300 dark:border-neutral-700">
                      <button onClick={() => handleDecrease(item.id, item.quantity)} disabled={item.quantity <= 1} className="px-2 py-1 text-neutral-500 hover:text-neutral-700 disabled:opacity-30"><Minus size={14} /></button>
                      <span className="w-10 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => handleIncrease(item.id, item.quantity)} disabled={!madeToOrder && item.quantity >= availableStock} className="px-2 py-1 text-neutral-500 hover:text-neutral-700 disabled:opacity-30"><Plus size={14} /></button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary-700 dark:text-primary-400">{formatPrice(item.unit_price * item.quantity)}</span>
                      <button onClick={() => handleRemove(item.id)} className="text-neutral-400 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="card h-fit p-5">
          <h3 className="mb-4 text-lg font-semibold">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span className="font-medium">{formatPrice(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Shipping</span><span className="text-neutral-400">Calculated at checkout</span></div>
            <div className="border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <div className="flex justify-between text-base font-bold"><span>Total</span><span className="text-primary-700 dark:text-primary-400">{formatPrice(subtotal)}</span></div>
            </div>
          </div>
          <button onClick={() => navigate('/checkout')} className="btn-primary mt-4 w-full">
            Proceed to Checkout <ArrowRight size={16} />
          </button>
          <Link to="/shop" className="btn-ghost mt-2 w-full">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
