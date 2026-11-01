import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SEO } from '@/components/SEO';
import { useRouter, Link, navigate } from '@/lib/router';
import type { Order, OrderStatusHistory } from '@/lib/types';
import { formatPrice, formatDateTime, cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_TRACKING_STEPS } from '@/lib/types';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Awaiting Verification',
  paid: 'Paid',
  verified: 'Verified',
  failed: 'Rejected',
  refunded: 'Refunded',
  partially_refunded: 'Partial Refund',
  cancelled: 'Cancelled',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  bank: 'Bank Transfer',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
  'hand-to-hand': 'Hand to Hand',
};
import { Spinner, EmptyState, Badge } from '@/components/ui';
import { Search, Check, Package, Truck, Clock, Printer, MessageCircle } from 'lucide-react';
import { orderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

export function TrackOrderPage() {
  const route = useRouter();
  const [orderNumber, setOrderNumber] = useState(route.query.get('order') ?? '');
  const [trackingToken] = useState(route.query.get('token') ?? '');
  const [tokenInput, setTokenInput] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (!orderNumber.trim()) return;
    setLoading(true);
    setSearched(true);
    setError('');

    const token = trackingToken || tokenInput;
    if (!token.trim()) {
      setError('Tracking token is required. Enter the token from your order confirmation page.');
      setOrder(null);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_number', orderNumber.trim())
      .eq('tracking_token', token.trim())
      .maybeSingle();

    if (queryError) {
      setError('Unable to search for order. Please try again.');
      setOrder(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setError('Order not found. Check your order number and tracking token.');
      setOrder(null);
      setLoading(false);
      return;
    }

    setOrder(data as Order);

    // Load status history
    const { data: histData, error: histErr } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', data.id)
      .order('created_at', { ascending: true });
    if (histErr) console.error('Status history load error:', histErr.message);
    setHistory((histData as OrderStatusHistory[]) ?? []);

    setLoading(false);
  };

  useEffect(() => {
    if (route.query.get('order') && route.query.get('token')) search();
  }, []);

  const currentStepIndex = order ? ORDER_TRACKING_STEPS.indexOf(order.status as typeof ORDER_TRACKING_STEPS[number]) : -1;

  const printInvoice = () => {
    navigate(`/invoice?order=${order?.order_number}&token=${order?.tracking_token}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Track Your Order | Madina Cotton Shop"
        description="Track your Madina Cotton Shop order by order number and tracking token. See live status from production to delivery."
        canonicalPath="/track-order"
      />
      <h1 className="mb-6 font-display text-3xl font-bold">Track Your Order</h1>

      <div className="card mb-6 p-5">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              placeholder="Enter your order number (e.g. MCS-20260818-ABCD)"
              className="input flex-1"
            />
          </div>
          {!trackingToken && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Tracking token (from your order confirmation)"
                className="input flex-1"
              />
            </div>
          )}
          <button onClick={search} disabled={loading} className="btn-primary w-full">
            {loading ? <><Spinner size={16} /> Tracking...</> : <><Search size={18} /> Track Order</>}
          </button>
          <p className="text-xs text-neutral-400">For security, enter both your order number and the tracking token from your order confirmation page.</p>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Spinner size={32} /></div>}

      {!loading && searched && error && (
        <EmptyState icon={<Package size={48} />} title="Order not found" message={error} />
      )}

      {!loading && order && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500">Order Number</p>
                <p className="text-lg font-bold">{order.order_number}</p>
              </div>
              <Badge color="primary">{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-400">Placed on {formatDateTime(order.created_at)}</p>
          </div>

          {/* Tracking timeline */}
          <div className="card p-6">
            <h3 className="mb-6 text-lg font-semibold">Order Progress</h3>
            <div className="space-y-0">
              {ORDER_TRACKING_STEPS.map((step, i) => {
                const isDone = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                const isCancelled = order.status === 'cancelled';
                const histEntry = history.find((h) => h.status === step);
                return (
                  <div key={step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full border-2 transition',
                        isDone && !isCancelled ? 'border-accent-500 bg-accent-500 text-white' : 'border-neutral-300 bg-white text-neutral-300 dark:border-neutral-700 dark:bg-neutral-900',
                        isCurrent && !isCancelled && 'ring-4 ring-accent-500/20'
                      )}>
                        {isDone && !isCancelled ? <Check size={16} /> : <Clock size={16} />}
                      </div>
                      {i < ORDER_TRACKING_STEPS.length - 1 && (
                        <div className={cn('h-10 w-0.5', i < currentStepIndex && !isCancelled ? 'bg-accent-500' : 'bg-neutral-200 dark:bg-neutral-800')} />
                      )}
                    </div>
                    <div className="pb-8">
                      <p className={cn('text-sm font-medium', isDone && !isCancelled ? 'text-neutral-900 dark:text-white' : 'text-neutral-400')}>
                        {ORDER_STATUS_LABELS[step] ?? step}
                      </p>
                      {isCurrent && !isCancelled && <p className="text-xs text-accent-600">In progress</p>}
                      {histEntry && <p className="text-xs text-neutral-400">{formatDateTime(histEntry.created_at)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            {order.status === 'cancelled' && (
              <div className="mt-2 rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20">
                This order was cancelled.
              </div>
            )}
            {order.tracking_number && (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <p className="flex items-center gap-2 text-sm"><Truck size={16} /> Tracking: <span className="font-medium">{order.tracking_number}</span></p>
                {order.courier && <p className="text-xs text-neutral-500">Courier: {order.courier}</p>}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="card p-5">
            <h3 className="mb-3 text-lg font-semibold">Items</h3>
            <div className="space-y-2">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-300">{item.product_name} × {item.quantity}</span>
                  <span className="font-medium">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-neutral-100 pt-3 text-sm dark:border-neutral-800">
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatPrice(order.total)}</span></div>
              <p className="mt-1 text-xs text-neutral-500">Payment: {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method} · {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={printInvoice} className="btn-outline"><Printer size={16} /> Print Invoice</button>
            <a href={buildWhatsAppUrl(orderWhatsAppMessage(order.order_number))} target="_blank" rel="noopener noreferrer" className="btn-outline" style={{ borderColor: '#25D366', color: '#25D366' }}>
              <MessageCircle size={16} /> WhatsApp
            </a>
            <Link to="/shop" className="btn-primary">Continue Shopping</Link>
          </div>
        </div>
      )}
    </div>
  );
}
