import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, Link, navigate } from '@/lib/router';
import type { Order } from '@/lib/types';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/lib/types';
import { Spinner, EmptyState, Badge } from '@/components/ui';
import { Check, Package, Truck, MapPin, Phone } from 'lucide-react';

export function OrderConfirmationPage() {
  const route = useRouter();
  const orderNumber = route.query.get('order') ?? '';
  const trackingToken = route.query.get('token') ?? '';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!trackingToken) {
        setError('Tracking token required. Use the link from your order confirmation.');
        setLoading(false);
        return;
      }
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('order_number', orderNumber)
        .eq('tracking_token', trackingToken)
        .maybeSingle();
      if (queryError) {
        setError('Could not load your order. Please try again later.');
      } else {
        setOrder(data as Order | null);
      }
      setLoading(false);
    })();
  }, [orderNumber, trackingToken]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (error || !order) return <EmptyState title="Order not found" message={error || 'Check your order number and tracking token.'} action={<Link to="/shop" className="btn-primary">Back to Shop</Link>} />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-600">
          <Check size={32} />
        </div>
        <h1 className="font-display text-3xl font-bold">Order Placed Successfully!</h1>
        <p className="mt-2 text-neutral-500">Your order number is <span className="font-bold text-primary-600">{order.order_number}</span></p>
      </div>

      <div className="mt-8 card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Order Details</h3>
          <Badge color="primary">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
        </div>

        <div className="space-y-3">
          {order.order_items?.map((item) => (
            <div key={item.id} className="flex justify-between border-b border-neutral-100 pb-3 text-sm dark:border-neutral-800">
              <div>
                <p className="font-medium">{item.product_name}</p>
                <p className="text-neutral-500">
                  {[item.size_label, item.weight, item.color, item.filling].filter(Boolean).join(' · ')} × {item.quantity}
                </p>
              </div>
              <span className="font-medium">{formatPrice(item.unit_price * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
          <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          {order.discount > 0 && (
            <div className="flex justify-between text-accent-600"><span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span><span>-{formatPrice(order.discount)}</span></div>
          )}
          <div className="flex justify-between"><span className="text-neutral-500">Shipping</span><span>{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Total</span><span className="text-primary-700 dark:text-primary-400">{formatPrice(order.total)}</span></div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h4 className="mb-2 flex items-center gap-2 font-semibold"><MapPin size={18} /> Delivery Address</h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {order.customer_name}<br />
            {order.address}, {order.city}<br />
            {order.country}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500"><Phone size={14} /> {order.customer_phone}</p>
        </div>
        <div className="card p-5">
          <h4 className="mb-2 flex items-center gap-2 font-semibold"><Truck size={18} /> Payment</h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Method: {order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method}<br />
            Status: {order.payment_status}
          </p>
          <p className="mt-2 text-xs text-neutral-400">Order placed on {formatDateTime(order.created_at)}</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={() => navigate(`/track-order?order=${order.order_number}&token=${order.tracking_token}`)} className="btn-outline flex-1">
          <Package size={18} /> Track Order
        </button>
        <Link to="/shop" className="btn-primary flex-1">Continue Shopping</Link>
      </div>
    </div>
  );
}
