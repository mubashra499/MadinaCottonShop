import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, Link } from '@/lib/router';
import type { Order } from '@/lib/types';
import { formatPrice, formatDateTime } from '@/lib/utils';
import { ORDER_STATUS_LABELS } from '@/lib/types';
import { Spinner, EmptyState } from '@/components/ui';
import { Printer } from 'lucide-react';
import { SHOP_INFO } from '@/lib/supabase';

export function InvoicePage() {
  const route = useRouter();
  const orderNumber = route.query.get('order') ?? '';
  const token = route.query.get('token') ?? '';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!token) {
        setError('Tracking token required. Use the link from your order confirmation or tracking page.');
        setLoading(false);
        return;
      }
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('order_number', orderNumber)
        .eq('tracking_token', token)
        .maybeSingle();
      if (queryError) {
        setError('Could not load invoice. Please try again later.');
      } else {
        setOrder(data as Order | null);
      }
      setLoading(false);
    })();
  }, [orderNumber, token]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (error || !order) return <EmptyState title="Invoice not found" message={error || 'Check your order number and tracking token.'} action={<Link to="/shop" className="btn-primary">Back to Shop</Link>} />;

  const isGift = order.is_gift;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl font-bold">Invoice</h1>
        <button onClick={() => window.print()} className="btn-primary"><Printer size={16} /> Print / Save PDF</button>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-neutral-200 pb-6 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-2xl font-bold text-primary-700 dark:text-primary-400">{SHOP_INFO.name}</h2>
            <p className="mt-1 text-sm text-neutral-500">{SHOP_INFO.address}</p>
            <p className="text-sm text-neutral-500">Phone/WhatsApp: {SHOP_INFO.phone}</p>
            <p className="text-sm text-neutral-500">Email: {SHOP_INFO.email}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">INVOICE</p>
            <p className="text-sm text-neutral-500">#{order.order_number}</p>
            <p className="text-sm text-neutral-500">{formatDateTime(order.created_at)}</p>
          </div>
        </div>

        {/* Customer info */}
        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">Bill To</p>
            <p className="text-sm font-medium">{order.customer_name}</p>
            <p className="text-sm text-neutral-500">{order.customer_phone}</p>
            {order.customer_email && <p className="text-sm text-neutral-500">{order.customer_email}</p>}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">Ship To</p>
            <p className="text-sm font-medium">{order.customer_name}</p>
            <p className="text-sm text-neutral-500">{order.address}, {order.city}</p>
            <p className="text-sm text-neutral-500">{order.country}</p>
            {order.landmark && <p className="text-sm text-neutral-500">Landmark: {order.landmark}</p>}
          </div>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-200 dark:border-neutral-700">
              <th className="py-3 text-left font-semibold">Product</th>
              <th className="py-3 text-center font-semibold">Qty</th>
              <th className="py-3 text-right font-semibold">Unit Price</th>
              <th className="py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items?.map((item) => (
              <tr key={item.id} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="py-3">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-xs text-neutral-400">
                    {[item.size_label, item.weight, item.color, item.filling, item.fabric].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="py-3 text-center">{item.quantity}</td>
                <td className="py-3 text-right">
                  {isGift ? '—' : formatPrice(item.unit_price)}
                </td>
                <td className="py-3 text-right">
                  {isGift ? '—' : formatPrice(item.unit_price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Subtotal</span>
              <span>{isGift ? '—' : formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-accent-600">
                <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
                <span>-{isGift ? '—' : formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-neutral-500">Delivery Fee</span>
              <span>{order.shipping_fee === 0 ? 'Free' : formatPrice(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold dark:border-neutral-700">
              <span>Total</span>
              <span className="text-primary-700 dark:text-primary-400">{isGift ? '—' : formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment info */}
        <div className="mt-6 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-400">Payment</p>
              <p className="font-medium">{order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method}</p>
              <p className="text-neutral-500">Status: {order.payment_status}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-neutral-400">Order Status</p>
              <p className="font-medium">{ORDER_STATUS_LABELS[order.status] ?? order.status}</p>
            </div>
          </div>
        </div>

        {isGift && order.gift_message && (
          <div className="mt-4 rounded-xl bg-primary-50 p-4 text-sm dark:bg-primary-900/20">
            <p className="font-medium text-primary-700 dark:text-primary-400">Gift Message for {order.gift_recipient_name}</p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-300">{order.gift_message}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-neutral-200 pt-4 text-center text-xs text-neutral-400 dark:border-neutral-800">
          <p>Thank you for your business!</p>
          <p>{SHOP_INFO.name} · {SHOP_INFO.phone} · {SHOP_INFO.businessHours}</p>
        </div>
      </div>
    </div>
  );
}
