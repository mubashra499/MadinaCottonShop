import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Link, navigate } from '@/lib/router';
import type { Order, CustomOrder, WishlistItem, Notification, MeasurementProfile, OrderChangeRequest, ReturnRequest, Address, Payment } from '@/lib/types';
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
import { Spinner, EmptyState, Badge, Modal } from '@/components/ui';
import { Package, Heart, Scissors, Bell, User, LogOut, Settings, RotateCcw, MessageCircle, Ruler, ChevronDown, ChevronUp, Plus, Trash2, Send, Edit2, MapPin, Star, Check } from 'lucide-react';
import { orderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

type Tab = 'orders' | 'custom' | 'wishlist' | 'notifications' | 'measurements' | 'returns' | 'messages' | 'addresses' | 'profile';

export function AccountPage() {
  const { user, profile, signOut, isOwner, refreshProfile } = useAuth();
  const { addItem } = useCart();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementProfile[]>([]);
  const [changeRequests, setChangeRequests] = useState<OrderChangeRequest[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [ownerMessages, setOwnerMessages] = useState<{ id: string; body: string; sender: string; created_at: string }[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderPayments, setOrderPayments] = useState<Record<string, Payment[]>>({});
  const [changeRequestModal, setChangeRequestModal] = useState<Order | null>(null);
  const [returnModal, setReturnModal] = useState<Order | null>(null);
  const [measurementModal, setMeasurementModal] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<MeasurementProfile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressModal, setAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    (async () => {
      setLoading(true);
      const [o, co, w, n, mp, cr, rr, msgs, addrData] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('custom_orders').select('*, custom_order_images(*), custom_quotes(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('wishlists').select('*, product:products(*, product_images(*))').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('measurement_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('order_change_requests').select('*, order:orders(order_number)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('returns').select('*, order:orders(order_number)').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('messages').select('id, body, sender, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      ]);
      if (o.error) console.error('Orders load error:', o.error.message);
      if (co.error) console.error('Custom orders load error:', co.error.message);
      if (w.error) console.error('Wishlist load error:', w.error.message);
      if (n.error) console.error('Notifications load error:', n.error.message);
      if (mp.error) console.error('Measurements load error:', mp.error.message);
      if (cr.error) console.error('Change requests load error:', cr.error.message);
      if (rr.error) console.error('Returns load error:', rr.error.message);
      if (msgs.error) console.error('Messages load error:', msgs.error.message);
      if (addrData.error) console.error('Addresses load error:', addrData.error.message);
      setOrders((o.data as Order[]) ?? []);
      setCustomOrders((co.data as CustomOrder[]) ?? []);
      setWishlist((w.data as WishlistItem[]) ?? []);
      setNotifications((n.data as Notification[]) ?? []);
      setMeasurements((mp.data as MeasurementProfile[]) ?? []);
      setChangeRequests((cr.data as OrderChangeRequest[]) ?? []);
      setReturns((rr.data as ReturnRequest[]) ?? []);
      const msgData = (msgs.data as { id: string; body: string; sender: string; created_at: string }[]) ?? [];
      setOwnerMessages(msgData.reverse());
      setAddresses((addrData.data as Address[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setProfileName(profile.full_name ?? '');
      setProfilePhone(profile.phone ?? '');
    }
  }, [profile]);

  if (!user) return null;

  const tabs: { key: Tab; label: string; icon: typeof Package; count?: number }[] = [
    { key: 'orders', label: 'My Orders', icon: Package, count: orders.length },
    { key: 'custom', label: 'Custom Requests', icon: Scissors, count: customOrders.length },
    { key: 'wishlist', label: 'Wishlist', icon: Heart, count: wishlist.length },
    { key: 'addresses', label: 'Addresses', icon: MapPin, count: addresses.length },
    { key: 'measurements', label: 'Measurements', icon: Ruler, count: measurements.length },
    { key: 'returns', label: 'Returns & Changes', icon: RotateCcw, count: changeRequests.length + returns.length },
    { key: 'messages', label: 'Messages', icon: MessageCircle, count: ownerMessages.filter((m) => m.sender === 'owner').length },
    { key: 'notifications', label: 'Notifications', icon: Bell, count: notifications.filter((n) => !n.read).length },
    { key: 'profile', label: 'Profile', icon: User },
  ];

  const canRequestChange = (status: string) => ['new', 'confirmed', 'production'].includes(status);
  const canRequestReturn = (status: string) => ['delivered'].includes(status);

  const sendReply = async () => {
    if (!replyText.trim() || !user) return;
    const { error: sendErr } = await supabase.from('messages').insert({ user_id: user.id, sender: 'customer', body: replyText.trim() });
    if (sendErr) { alert('Could not send message. Please try again.'); return; }
    setReplyText('');
    const { data, error: loadErr } = await supabase.from('messages').select('id, body, sender, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (loadErr) console.error('Message reload error:', loadErr.message);
    setOwnerMessages(((data as { id: string; body: string; sender: string; created_at: string }[]) ?? []).reverse());
  };

  const saveMeasurement = async (form: { name: string; profile_type: string; length: string; width: string; unit: string; chest: string; waist: string; shoulder: string; sleeve: string; trouser_length: string; notes: string }) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: form.name || 'My Measurements',
      profile_type: form.profile_type,
      length: form.length ? parseFloat(form.length) : null,
      width: form.width ? parseFloat(form.width) : null,
      unit: form.unit,
      chest: form.chest ? parseFloat(form.chest) : null,
      waist: form.waist ? parseFloat(form.waist) : null,
      shoulder: form.shoulder ? parseFloat(form.shoulder) : null,
      sleeve: form.sleeve ? parseFloat(form.sleeve) : null,
      trouser_length: form.trouser_length ? parseFloat(form.trouser_length) : null,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };
    if (editingMeasurement) {
      const { error: updErr } = await supabase.from('measurement_profiles').update(payload).eq('id', editingMeasurement.id);
      if (updErr) { alert('Could not save measurement: ' + updErr.message); return; }
    } else {
      const { error: insErr } = await supabase.from('measurement_profiles').insert(payload);
      if (insErr) { alert('Could not save measurement: ' + insErr.message); return; }
    }
    setMeasurementModal(false);
    setEditingMeasurement(null);
    const { data, error: loadErr } = await supabase.from('measurement_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (loadErr) console.error('Measurement reload error:', loadErr.message);
    setMeasurements((data as MeasurementProfile[]) ?? []);
  };

  const deleteMeasurement = async (id: string) => {
    if (!confirm('Delete this measurement profile?')) return;
    const { error } = await supabase.from('measurement_profiles').delete().eq('id', id);
    if (error) { alert('Could not delete measurement.'); return; }
    setMeasurements(measurements.filter((m) => m.id !== id));
  };

  const saveAddress = async (form: { label: string; type: string; country: string; province: string; city: string; area: string; street: string; house_number: string; postal_code: string; landmark: string; phone: string; delivery_instructions: string; is_default: boolean }) => {
    if (!user) return;
    const payload = {
      user_id: user.id,
      label: form.label || 'Home',
      type: form.type,
      country: form.country || 'Pakistan',
      province: form.province || null,
      city: form.city || null,
      area: form.area || null,
      street: form.street || null,
      house_number: form.house_number || null,
      postal_code: form.postal_code || null,
      landmark: form.landmark || null,
      phone: form.phone || null,
      delivery_instructions: form.delivery_instructions || null,
      is_default: form.is_default,
    };
    if (form.is_default) {
      const { error: clearErr } = await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id).neq('id', editingAddress?.id ?? '00000000-0000-0000-0000-000000000000');
      if (clearErr) { alert('Could not update default address.'); return; }
    }
    if (editingAddress) {
      const { error: updErr } = await supabase.from('addresses').update(payload).eq('id', editingAddress.id);
      if (updErr) { alert('Could not save address: ' + updErr.message); return; }
    } else {
      const { error: insErr } = await supabase.from('addresses').insert(payload);
      if (insErr) { alert('Could not save address: ' + insErr.message); return; }
    }
    setAddressModal(false);
    setEditingAddress(null);
    const { data, error: loadErr } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false });
    if (loadErr) console.error('Address reload error:', loadErr.message);
    setAddresses((data as Address[]) ?? []);
  };

  const deleteAddress = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    const { error } = await supabase.from('addresses').delete().eq('id', id);
    if (error) { alert('Could not delete address.'); return; }
    setAddresses(addresses.filter((a) => a.id !== id));
  };

  const setDefaultAddress = async (id: string) => {
    if (!user) return;
    const { error: clearErr } = await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id).neq('id', id);
    if (clearErr) { alert('Could not update default address.'); return; }
    const { error: setErr } = await supabase.from('addresses').update({ is_default: true }).eq('id', id);
    if (setErr) { alert('Could not set default address.'); return; }
    const { data, error: loadErr } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false });
    if (loadErr) console.error('Address reload error:', loadErr.message);
    setAddresses((data as Address[]) ?? []);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">My Account</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <div className="flex gap-2">
          {isOwner && <Link to="/owner" className="btn-outline">Owner Command Center</Link>}
          <button onClick={async () => { await signOut(); navigate('/'); }} className="btn-ghost text-red-600">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        {/* Sidebar */}
        <aside className="flex gap-1 overflow-x-auto md:flex-col">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex flex-shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                tab === t.key ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              )}
            >
              <t.icon size={16} /> {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={cn('ml-auto rounded-full px-1.5 text-xs', tab === t.key ? 'bg-white/20' : 'bg-neutral-200 dark:bg-neutral-700')}>{t.count}</span>
              )}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size={32} /></div>
          ) : (
            <>
              {tab === 'orders' && (
                <div className="space-y-3">
                  {orders.length === 0 ? (
                    <EmptyState icon={<Package size={48} />} title="No orders yet" action={<Link to="/shop" className="btn-primary">Shop Now</Link>} />
                  ) : (
                    orders.map((o) => (
                      <div key={o.id} className="card p-4">
                        <div className="flex items-center justify-between" onClick={async () => {
                          const newId = expandedOrder === o.id ? null : o.id;
                          setExpandedOrder(newId);
                          if (newId && !orderPayments[newId]) {
                            const { data: pays } = await supabase.from('payments').select('*').eq('order_id', newId).order('created_at', { ascending: false });
                            setOrderPayments((prev) => ({ ...prev, [newId]: (pays as Payment[]) ?? [] }));
                          }
                        }} role="button">
                          <div>
                            <p className="font-semibold">{o.order_number}</p>
                            <p className="text-xs text-neutral-400">{formatDateTime(o.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge color="primary">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                            <Badge color={o.payment_status === 'paid' || o.payment_status === 'verified' ? 'green' : o.payment_status === 'failed' ? 'red' : 'amber'}>{PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status}</Badge>
                            {expandedOrder === o.id ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
                          </div>
                        </div>

                        {expandedOrder === o.id && (
                          <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                            {(orderPayments[o.id] ?? []).length > 0 && (
                              <div className="mb-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                                <p className="mb-1 text-xs font-semibold text-neutral-600 dark:text-neutral-400">Payment Details</p>
                                {orderPayments[o.id].map((p) => (
                                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="text-neutral-500">{PAYMENT_METHOD_LABELS[p.method] ?? p.method} · {formatPrice(p.amount)}</span>
                                    <Badge color={p.status === 'paid' ? 'green' : p.status === 'failed' ? 'red' : 'amber'}>{PAYMENT_STATUS_LABELS[p.status] ?? p.status}</Badge>
                                    {p.transaction_ref && <span className="text-neutral-400">Ref: {p.transaction_ref}</span>}
                                    {p.rejection_reason && <span className="text-red-500">Rejected: {p.rejection_reason}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Mini order timeline */}
                            {(() => {
                              const stepIdx = ORDER_TRACKING_STEPS.indexOf(o.status as typeof ORDER_TRACKING_STEPS[number]);
                              if (o.status === 'cancelled') return (
                                <div className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20">This order was cancelled.</div>
                              );
                              if (stepIdx < 0) return null;
                              return (
                                <div className="mb-3 flex flex-wrap gap-1">
                                  {ORDER_TRACKING_STEPS.map((step, i) => (
                                    <div key={step} className={cn(
                                      'flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium',
                                      i <= stepIdx ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'
                                    )}>
                                      {i <= stepIdx && <Check size={10} />}
                                      {ORDER_STATUS_LABELS[step] ?? step}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            <div className="space-y-1 text-sm">
                              {o.order_items?.map((item) => (
                                <div key={item.id} className="flex justify-between text-neutral-500">
                                  <span>{item.product_name} × {item.quantity}</span>
                                  <span>{formatPrice(item.unit_price * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="font-bold">{formatPrice(o.total)}</span>
                              <div className="flex flex-wrap gap-2">
                                <a href={buildWhatsAppUrl(orderWhatsAppMessage(o.order_number))} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm" style={{ color: '#25D366' }}><MessageCircle size={14} /></a>
                                <button onClick={async () => {
                                  for (const item of o.order_items ?? []) {
                                    if (item.product_id) {
                                      await addItem(item.product_id, item.variant_id, item.quantity);
                                    }
                                  }
                                  navigate('/cart');
                                }} className="btn-ghost text-sm"><RotateCcw size={14} /> Order Again</button>
                                <Link to={`/track-order?order=${o.order_number}`} className="btn-ghost text-sm">Track</Link>
                                {o.status === 'delivered' && o.order_items?.some((item) => item.product_id) && (
                                  <Link to={`/product/${o.order_items!.find((item) => item.product_id)?.product_id ?? ''}#review`} className="btn-ghost text-sm text-amber-600"><Star size={14} /> Review</Link>
                                )}
                                {canRequestChange(o.status) && (
                                  <button onClick={() => setChangeRequestModal(o)} className="btn-ghost text-sm text-amber-600"><Edit2 size={14} /> Request Change</button>
                                )}
                                {canRequestReturn(o.status) && (
                                  <button onClick={() => setReturnModal(o)} className="btn-ghost text-sm text-red-600"><RotateCcw size={14} /> Request Return</button>
                                )}
                              </div>
                            </div>
                            {o.tracking_number && (
                              <p className="mt-2 text-xs text-neutral-500">Tracking: {o.tracking_number} ({o.courier ?? 'Courier'})</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'custom' && (
                <div className="space-y-3">
                  {customOrders.length === 0 ? (
                    <EmptyState icon={<Scissors size={48} />} title="No custom requests" action={<Link to="/custom-order" className="btn-primary">Create Custom Order</Link>} />
                  ) : (
                    customOrders.map((co) => (
                      <div key={co.id} className="card p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{co.product_type}</p>
                          <Badge color={co.status === 'quoted' ? 'accent' : co.status === 'accepted' ? 'green' : co.status === 'rejected' ? 'red' : 'neutral'}>{co.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-neutral-500">
                          {[co.size_label, co.weight, co.color, co.filling].filter(Boolean).join(' · ')}
                        </p>
                        {co.instructions && <p className="mt-2 text-sm text-neutral-400">{co.instructions}</p>}
                        {co.custom_quotes && co.custom_quotes.length > 0 && (
                          <div className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
                            <p className="text-sm font-medium">Quote: {formatPrice(co.custom_quotes[0].price)}</p>
                            {co.custom_quotes[0].production_time && <p className="text-xs text-neutral-500">Production: {co.custom_quotes[0].production_time}</p>}
                            <p className="text-xs text-neutral-500">Status: {co.custom_quotes[0].status}</p>
                            {co.custom_quotes[0].notes && <p className="text-xs text-neutral-400 mt-1">{co.custom_quotes[0].notes}</p>}
                            {co.status === 'quoted' && (
                              <div className="mt-2 flex gap-2">
                                <button onClick={async () => {
                                  const { error } = await supabase.rpc('respond_to_quote', { p_custom_order_id: co.id, p_accept: true });
                                  if (error) { alert('Could not accept quote: ' + error.message); return; }
                                  alert('Quote accepted! The shop will process your order.');
                                  window.location.reload();
                                }} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">Accept Quote</button>
                                <button onClick={async () => {
                                  const { error } = await supabase.rpc('respond_to_quote', { p_custom_order_id: co.id, p_accept: false });
                                  if (error) { alert('Could not reject quote: ' + error.message); return; }
                                  window.location.reload();
                                }} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">Reject</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'wishlist' && (
                <div>
                  {wishlist.length === 0 ? (
                    <EmptyState icon={<Heart size={48} />} title="Wishlist is empty" action={<Link to="/shop" className="btn-primary">Browse Products</Link>} />
                  ) : (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {wishlist.map((w) => (
                        <div key={w.id} className="card overflow-hidden">
                          <Link to={w.product ? `/product/${w.product.slug}` : '#'}>
                            <div className="aspect-square bg-neutral-100 dark:bg-neutral-800">
                              {w.product?.product_images?.[0] && <img src={w.product.product_images[0].url} alt={w.product.name} className="h-full w-full object-cover" />}
                            </div>
                            <div className="p-3">
                              <p className="line-clamp-1 text-sm font-semibold">{w.product?.name}</p>
                              <p className="text-sm font-bold text-primary-600">{formatPrice(w.product?.price ?? 0)}</p>
                            </div>
                          </Link>
                          <div className="flex gap-1 px-3 pb-3">
                            <button onClick={async () => {
                              if (!w.product) return;
                              const result = await addItem(w.product.id, null, 1);
                              if (result.error) { alert(result.error); return; }
                              const { error: delErr } = await supabase.from('wishlists').delete().eq('id', w.id);
                              if (delErr) { alert('Added to cart but could not remove from wishlist.'); return; }
                              setWishlist(wishlist.filter((item) => item.id !== w.id)); navigate('/cart');
                            }} className="btn-primary flex-1 text-xs py-2">Move to Cart</button>
                            <button onClick={async () => {
                              const { error: delErr } = await supabase.from('wishlists').delete().eq('id', w.id);
                              if (delErr) { alert('Could not remove from wishlist.'); return; }
                              setWishlist(wishlist.filter((item) => item.id !== w.id));
                            }} className="btn-ghost p-2 text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'measurements' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Saved Measurements</h3>
                    <button onClick={() => { setEditingMeasurement(null); setMeasurementModal(true); }} className="btn-primary"><Plus size={16} /> Add Measurement</button>
                  </div>
                  <div className="space-y-3">
                    {measurements.length === 0 ? (
                      <EmptyState icon={<Ruler size={48} />} title="No measurements saved" message="Save your bed or body measurements for faster custom orders." action={<button onClick={() => { setEditingMeasurement(null); setMeasurementModal(true); }} className="btn-primary">Add Measurement</button>} />
                    ) : (
                      measurements.map((m) => (
                        <div key={m.id} className="card p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{m.name}</p>
                              <p className="text-xs text-neutral-400">{m.profile_type === 'bed' ? 'Bed Measurements' : 'Body Measurements'} · {m.unit}</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingMeasurement(m); setMeasurementModal(true); }} className="btn-ghost p-1.5"><Edit2 size={14} /></button>
                              <button onClick={() => deleteMeasurement(m.id)} className="btn-ghost p-1.5 text-red-500"><Trash2 size={14} /></button>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                            {m.length != null && <span className="text-neutral-500">Length: <span className="font-medium text-neutral-700 dark:text-neutral-300">{m.length} {m.unit}</span></span>}
                            {m.width != null && <span className="text-neutral-500">Width: <span className="font-medium text-neutral-700 dark:text-neutral-300">{m.width} {m.unit}</span></span>}
                            {m.chest != null && <span className="text-neutral-500">Chest: <span className="font-medium text-neutral-700 dark:text-neutral-300">{m.chest} {m.unit}</span></span>}
                            {m.waist != null && <span className="text-neutral-500">Waist: <span className="font-medium text-neutral-700 dark:text-neutral-300">{m.waist} {m.unit}</span></span>}
                            {m.shoulder != null && <span className="text-neutral-500">Shoulder: <span className="font-medium text-neutral-700 dark:text-neutral-300">{m.shoulder} {m.unit}</span></span>}
                            {m.sleeve != null && <span className="text-neutral-500">Sleeve: <span className="font-medium text-neutral-700 dark:text-neutral-300">{m.sleeve} {m.unit}</span></span>}
                            {m.trouser_length != null && <span className="text-neutral-500">Trouser: <span className="font-medium text-neutral-700 dark:text-neutral-300">{m.trouser_length} {m.unit}</span></span>}
                          </div>
                          {m.notes && <p className="mt-2 text-xs text-neutral-400">{m.notes}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === 'returns' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 text-lg font-semibold">Order Change Requests</h3>
                    <div className="space-y-2">
                      {changeRequests.length === 0 ? (
                        <p className="py-4 text-center text-sm text-neutral-400">No change requests submitted</p>
                      ) : (
                        changeRequests.map((r) => (
                          <div key={r.id} className="card p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">{(r as unknown as { order?: { order_number?: string } }).order?.order_number ?? 'Order'}</p>
                                <p className="text-xs text-neutral-400">{r.change_type}: {r.current_value} → {r.requested_value}</p>
                                {r.reason && <p className="text-xs text-neutral-500 mt-1">{r.reason}</p>}
                              </div>
                              <Badge color={r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'green' : 'red'}>{r.status}</Badge>
                            </div>
                            {r.owner_note && <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-xs text-neutral-500 dark:bg-neutral-900">Owner note: {r.owner_note}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 text-lg font-semibold">Return / Refund Requests</h3>
                    <div className="space-y-2">
                      {returns.length === 0 ? (
                        <p className="py-4 text-center text-sm text-neutral-400">No return requests submitted</p>
                      ) : (
                        returns.map((r) => (
                          <div key={r.id} className="card p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold">{(r as unknown as { order?: { order_number?: string } }).order?.order_number ?? 'Order'}</p>
                                <p className="text-xs text-neutral-400">{r.reason} · {formatDateTime(r.created_at)}</p>
                              </div>
                              <Badge color={r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'green' : 'red'}>{r.status}</Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'messages' && (
                <div className="card flex flex-col" style={{ height: '60vh' }}>
                  <div className="flex-1 overflow-y-auto p-4">
                    {ownerMessages.length === 0 ? (
                      <EmptyState icon={<MessageCircle size={48} />} title="No messages" message="Messages from the shop will appear here." />
                    ) : (
                      ownerMessages.map((m) => (
                        <div key={m.id} className={cn('mb-3 flex', m.sender === 'customer' ? 'justify-end' : 'justify-start')}>
                          <div className={cn('max-w-[75%] rounded-xl px-4 py-2 text-sm', m.sender === 'customer' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>
                            <p>{m.body}</p>
                            <p className="mt-1 text-[10px] opacity-60">{formatDateTime(m.created_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
                    <div className="flex gap-2">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} placeholder="Type a message to the shop..." className="input flex-1" />
                      <button onClick={sendReply} className="btn-primary"><Send size={16} /></button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'notifications' && (
                <div className="space-y-2">
                  {notifications.length === 0 ? (
                    <EmptyState icon={<Bell size={48} />} title="No notifications" />
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={cn('card p-4 cursor-pointer', !n.read && 'border-primary-200 dark:border-primary-800')} onClick={async () => {
                        if (!n.read) {
                          await supabase.from('notifications').update({ read: true }).eq('id', n.id);
                          setNotifications(notifications.map((nn) => nn.id === n.id ? { ...nn, read: true } : nn));
                        }
                      }}>
                        <p className="text-sm font-semibold">{n.title}</p>
                        {n.body && <p className="text-sm text-neutral-500">{n.body}</p>}
                        <p className="mt-1 text-xs text-neutral-400">{formatDateTime(n.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'addresses' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Saved Addresses</h3>
                    <button onClick={() => { setEditingAddress(null); setAddressModal(true); }} className="btn-primary"><Plus size={16} /> Add Address</button>
                  </div>
                  <div className="space-y-3">
                    {addresses.length === 0 ? (
                      <EmptyState icon={<MapPin size={48} />} title="No saved addresses" message="Save addresses for faster checkout." action={<button onClick={() => { setEditingAddress(null); setAddressModal(true); }} className="btn-primary">Add Address</button>} />
                    ) : (
                      addresses.map((a) => (
                        <div key={a.id} className="card p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5">
                                {a.is_default
                                  ? <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-900/30 dark:text-accent-300"><Star size={10} /> Default</span>
                                  : <MapPin size={16} className="text-neutral-400" />}
                              </div>
                              <div>
                                <p className="font-semibold">{a.label}</p>
                                <p className="text-sm text-neutral-500">
                                  {a.house_number && `${a.house_number}, `}{a.street && `${a.street}, `}{a.area && `${a.area}, `}{a.city && `${a.city}, `}{a.country}
                                </p>
                                {a.phone && <p className="text-xs text-neutral-400">Phone: {a.phone}</p>}
                                {a.delivery_instructions && <p className="text-xs text-neutral-400">Instructions: {a.delivery_instructions}</p>}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {!a.is_default && <button onClick={() => setDefaultAddress(a.id)} className="btn-ghost p-1.5 text-xs" title="Set as default">Set Default</button>}
                              <button onClick={() => { setEditingAddress(a); setAddressModal(true); }} className="btn-ghost p-1.5"><Edit2 size={14} /></button>
                              <button onClick={() => deleteAddress(a.id)} className="btn-ghost p-1.5 text-red-500"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === 'profile' && (
                <div className="card p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Settings size={20} /> Profile Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="label">Full Name</label>
                      <input value={profileName} onChange={(e) => setProfileName(e.target.value)} className="input" placeholder="Your name" />
                    </div>
                    <div>
                      <label className="label">Phone</label>
                      <input value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} className="input" placeholder="03xx-xxxxxxx" />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input defaultValue={user.email ?? ''} disabled className="input opacity-60" />
                    </div>
                    <button onClick={async () => {
                      if (!user) return;
                      setSavingProfile(true);
                      const { error } = await supabase.from('profiles').update({ full_name: profileName, phone: profilePhone, updated_at: new Date().toISOString() }).eq('id', user.id);
                      setSavingProfile(false);
                      if (error) { alert('Could not save profile. Please try again.'); return; }
                      refreshProfile();
                      alert('Profile updated!');
                    }} disabled={savingProfile} className="btn-primary">{savingProfile ? 'Saving...' : 'Save Changes'}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Change request modal */}
      {changeRequestModal && (
        <ChangeRequestModal order={changeRequestModal} userId={user.id} onClose={() => setChangeRequestModal(null)} onSubmitted={() => {
          setChangeRequestModal(null);
          supabase.from('order_change_requests').select('*, order:orders(order_number)').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
            setChangeRequests((data as OrderChangeRequest[]) ?? []);
          });
        }} />
      )}

      {/* Return request modal */}
      {returnModal && (
        <ReturnRequestModal order={returnModal} userId={user.id} onClose={() => setReturnModal(null)} onSubmitted={() => {
          setReturnModal(null);
          supabase.from('returns').select('*, order:orders(order_number)').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
            setReturns((data as ReturnRequest[]) ?? []);
          });
        }} />
      )}

      {/* Measurement modal */}
      {measurementModal && (
        <MeasurementModal measurement={editingMeasurement} onClose={() => { setMeasurementModal(false); setEditingMeasurement(null); }} onSave={saveMeasurement} />
      )}

      {/* Address modal */}
      {addressModal && (
        <AddressModal address={editingAddress} onClose={() => { setAddressModal(false); setEditingAddress(null); }} onSave={saveAddress} />
      )}
    </div>
  );
}

function AddressModal({ address, onClose, onSave }: { address: Address | null; onClose: () => void; onSave: (form: { label: string; type: string; country: string; province: string; city: string; area: string; street: string; house_number: string; postal_code: string; landmark: string; phone: string; delivery_instructions: string; is_default: boolean }) => void }) {
  const [form, setForm] = useState({
    label: address?.label ?? 'Home',
    type: address?.type ?? 'home',
    country: address?.country ?? 'Pakistan',
    province: address?.province ?? '',
    city: address?.city ?? '',
    area: address?.area ?? '',
    street: address?.street ?? '',
    house_number: address?.house_number ?? '',
    postal_code: address?.postal_code ?? '',
    landmark: address?.landmark ?? '',
    phone: address?.phone ?? '',
    delivery_instructions: address?.delivery_instructions ?? '',
    is_default: address?.is_default ?? false,
  });
  return (
    <Modal open={true} onClose={onClose} title={address ? 'Edit Address' : 'Add Address'} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Label</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input" placeholder="e.g. Home, Office" /></div>
          <div><label className="label">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input"><option value="home">Home</option><option value="office">Office</option><option value="other">Other</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Country</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input" /></div>
          <div><label className="label">Province</label><input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="input" placeholder="e.g. Sindh" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" placeholder="e.g. Hyderabad" /></div>
          <div><label className="label">Area</label><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input" placeholder="e.g. Latifabad" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Street / Block</label><input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} className="input" /></div>
          <div><label className="label">House #</label><input value={form.house_number} onChange={(e) => setForm({ ...form, house_number: e.target.value })} className="input" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Postal Code</label><input value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className="input" /></div>
          <div><label className="label">Landmark</label><input value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} className="input" /></div>
        </div>
        <div><label className="label">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="03xx-xxxxxxx" /></div>
        <div><label className="label">Delivery Instructions</label><textarea value={form.delivery_instructions} onChange={(e) => setForm({ ...form, delivery_instructions: e.target.value })} rows={2} className="input" placeholder="e.g. Call before delivery" /></div>
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="rounded" /><span className="text-sm font-medium">Set as default address</span></label>
        <button onClick={() => onSave(form)} className="btn-primary w-full">Save Address</button>
      </div>
    </Modal>
  );
}

function ChangeRequestModal({ order, userId, onClose, onSubmitted }: { order: Order; userId: string; onClose: () => void; onSubmitted: () => void }) {
  const [form, setForm] = useState({ change_type: 'quantity', current_value: '', requested_value: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.requested_value.trim()) { alert('Please specify what you want to change to.'); return; }
    setSaving(true);
    const { error } = await supabase.from('order_change_requests').insert({
      order_id: order.id,
      user_id: userId,
      change_type: form.change_type,
      current_value: form.current_value || null,
      requested_value: form.requested_value,
      reason: form.reason || null,
      status: 'pending',
    });
    setSaving(false);
    if (error) { alert('Could not submit request: ' + error.message); return; }
    onSubmitted();
  };

  return (
    <Modal open={true} onClose={onClose} title={`Request Change — ${order.order_number}`}>
      <div className="space-y-4">
        <div>
          <label className="label">What to change</label>
          <select value={form.change_type} onChange={(e) => setForm({ ...form, change_type: e.target.value })} className="input">
            <option value="quantity">Quantity</option>
            <option value="size">Size</option>
            <option value="color">Color</option>
            <option value="variant">Variant</option>
            <option value="address">Delivery Address</option>
            <option value="customization">Customization</option>
          </select>
        </div>
        <div>
          <label className="label">Current value</label>
          <input value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} className="input" placeholder="What it currently is" />
        </div>
        <div>
          <label className="label">Requested value *</label>
          <input value={form.requested_value} onChange={(e) => setForm({ ...form, requested_value: e.target.value })} className="input" placeholder="What you want it to be" />
        </div>
        <div>
          <label className="label">Reason</label>
          <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} className="input" placeholder="Why do you need this change?" />
        </div>
        <button onClick={submit} disabled={saving} className="btn-primary w-full">{saving ? 'Submitting...' : 'Submit Request'}</button>
      </div>
    </Modal>
  );
}

function ReturnRequestModal({ order, userId, onClose, onSubmitted }: { order: Order; userId: string; onClose: () => void; onSubmitted: () => void }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { alert('Please provide a reason for the return.'); return; }
    setSaving(true);
    const { error } = await supabase.from('returns').insert({
      order_id: order.id,
      user_id: userId,
      reason: reason.trim(),
      status: 'pending',
    });
    setSaving(false);
    if (error) { alert('Could not submit return request: ' + error.message); return; }
    onSubmitted();
  };

  return (
    <Modal open={true} onClose={onClose} title={`Request Return — ${order.order_number}`}>
      <div className="space-y-4">
        <div className="rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
          <p className="font-medium">{order.order_number}</p>
          <p className="text-neutral-500">Total: {formatPrice(order.total)}</p>
        </div>
        <div>
          <label className="label">Reason for return *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input" placeholder="Explain why you want to return this order..." />
        </div>
        <button onClick={submit} disabled={saving} className="btn-primary w-full">{saving ? 'Submitting...' : 'Submit Return Request'}</button>
      </div>
    </Modal>
  );
}

function MeasurementModal({ measurement, onClose, onSave }: { measurement: MeasurementProfile | null; onClose: () => void; onSave: (form: { name: string; profile_type: string; length: string; width: string; unit: string; chest: string; waist: string; shoulder: string; sleeve: string; trouser_length: string; notes: string }) => void }) {
  const [form, setForm] = useState({
    name: measurement?.name ?? 'My Measurements',
    profile_type: measurement?.profile_type ?? 'bed',
    length: measurement?.length?.toString() ?? '',
    width: measurement?.width?.toString() ?? '',
    unit: measurement?.unit ?? 'inches',
    chest: measurement?.chest?.toString() ?? '',
    waist: measurement?.waist?.toString() ?? '',
    shoulder: measurement?.shoulder?.toString() ?? '',
    sleeve: measurement?.sleeve?.toString() ?? '',
    trouser_length: measurement?.trouser_length?.toString() ?? '',
    notes: measurement?.notes ?? '',
  });

  return (
    <Modal open={true} onClose={onClose} title={measurement ? 'Edit Measurement' : 'Add Measurement'} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Profile Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. My Bed, Master Bedroom" />
          </div>
          <div>
            <label className="label">Type</label>
            <select value={form.profile_type} onChange={(e) => setForm({ ...form, profile_type: e.target.value })} className="input">
              <option value="bed">Bed Measurements</option>
              <option value="body">Body Measurements</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Unit</label>
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input w-auto">
            <option value="inches">Inches</option>
            <option value="cm">Centimeters</option>
            <option value="feet">Feet</option>
          </select>
        </div>
        {form.profile_type === 'bed' ? (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Length</label><input type="number" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className="input" placeholder="e.g. 80" /></div>
            <div><label className="label">Width</label><input type="number" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} className="input" placeholder="e.g. 60" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Chest</label><input type="number" value={form.chest} onChange={(e) => setForm({ ...form, chest: e.target.value })} className="input" /></div>
            <div><label className="label">Waist</label><input type="number" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} className="input" /></div>
            <div><label className="label">Shoulder</label><input type="number" value={form.shoulder} onChange={(e) => setForm({ ...form, shoulder: e.target.value })} className="input" /></div>
            <div><label className="label">Sleeve</label><input type="number" value={form.sleeve} onChange={(e) => setForm({ ...form, sleeve: e.target.value })} className="input" /></div>
            <div><label className="label">Trouser Length</label><input type="number" value={form.trouser_length} onChange={(e) => setForm({ ...form, trouser_length: e.target.value })} className="input" /></div>
          </div>
        )}
        <div>
          <label className="label">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input" placeholder="Any additional details..." />
        </div>
        <button onClick={() => onSave(form)} className="btn-primary w-full">Save Measurement</button>
      </div>
    </Modal>
  );
}
