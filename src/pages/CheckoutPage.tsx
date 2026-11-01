import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { navigate, Link } from '@/lib/router';
import { formatPrice } from '@/lib/utils';
import { SHOP_INFO } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { Spinner, EmptyState, Badge } from '@/components/ui';
import { ShoppingBag, Check, Truck, Store, MapPin, Gift, Tag, Upload, X, Sparkles, AlertCircle } from 'lucide-react';
import type { DeliveryZone, Coupon, Address } from '@/lib/types';

export function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const [placing, setPlacing] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<string>('home_delivery');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [form, setForm] = useState({
    name: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    email: user?.email ?? '',
    country: 'Pakistan',
    city: '',
    area: '',
    address: '',
    postalCode: '',
    landmark: '',
    deliveryInstructions: '',
    notes: '',
    paymentMethod: 'cod',
  });
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [autoPromo, setAutoPromo] = useState<Coupon | null>(null);
  const [autoPromoReason, setAutoPromoReason] = useState('');
  const [autoPromoSavings, setAutoPromoSavings] = useState(0);
  const [autoPromoDismissed, setAutoPromoDismissed] = useState(false);
  const idempotencyRef = useRef<string | null>(null);

  const { settings: siteSettings } = useSettings();
  const [zonesError, setZonesError] = useState(false);

  useEffect(() => {
    supabase.from('delivery_zones').select('*').eq('active', true).order('delivery_fee').then(({ data, error }) => {
      if (error) { setZonesError(true); return; }
      setDeliveryZones((data as DeliveryZone[]) ?? []);
      if (data && data.length > 0) setSelectedZoneId(data[0].id);
    });
    if (user) {
      supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }).then(({ data, error }) => {
        if (error) { console.error('Failed to load saved addresses:', error.message); return; }
        const addrs = (data as Address[]) ?? [];
        setSavedAddresses(addrs);
        const def = addrs.find((a) => a.is_default) ?? addrs[0];
        if (def) applyAddress(def);
      });
      checkAutoPromotions();
    }
  }, [user]);

  useEffect(() => {
    if (user && !appliedCoupon && !autoPromoDismissed) checkAutoPromotions();
  }, [subtotal, user, appliedCoupon, autoPromoDismissed]);

  const checkAutoPromotions = async () => {
    if (!user) return;
    const { data: autoCoupons, error: promoErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('active', true)
      .eq('auto_apply', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (promoErr) { console.error('Auto-promo query failed:', promoErr.message); return; }
    if (!autoCoupons || autoCoupons.length === 0) return;

    const now = new Date();
    const { count: priorOrders, error: ordersErr } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (ordersErr) { console.error('Prior orders query failed:', ordersErr.message); return; }

    for (const c of autoCoupons as Coupon[]) {
      if (c.start_date && new Date(c.start_date) > now) continue;
      if (c.end_date && new Date(c.end_date) < now) continue;
      if (c.usage_limit && c.usage_count >= c.usage_limit) continue;
      if (subtotal < c.min_order) continue;
      if (c.target_type === 'first_order' && (priorOrders ?? 0) > 0) continue;

      const { data: usage, error: usageErr } = await supabase
        .from('coupon_usage')
        .select('id')
        .eq('coupon_id', c.id)
        .eq('user_id', user.id);
      if (usageErr) { console.error('Coupon usage query failed:', usageErr.message); continue; }
      if (usage && usage.length >= c.max_usage_per_customer) continue;

      const savings = c.discount_type === 'percentage'
        ? Math.min((subtotal * c.value) / 100, c.max_discount ?? Infinity)
        : c.value;
      setAutoPromo(c);
      setAutoPromoSavings(savings);
      const reasons: string[] = [];
      if (c.target_type === 'first_order') reasons.push('first order');
      else reasons.push(`orders over ${formatPrice(c.min_order)}`);
      setAutoPromoReason(`You qualify for this ${reasons.join(' and ')}!`);
      return;
    }
    setAutoPromo(null);
    setAutoPromoReason('');
    setAutoPromoSavings(0);
  };

  const applyAddress = (a: Address) => {
    setSelectedAddressId(a.id);
    setForm((prev) => ({
      ...prev,
      name: profile?.full_name ?? '',
      phone: a.phone ?? prev.phone,
      country: a.country,
      city: a.city ?? '',
      area: a.area ?? '',
      address: [a.house_number, a.street].filter(Boolean).join(', '),
      postalCode: a.postal_code ?? '',
      landmark: a.landmark ?? '',
      deliveryInstructions: a.delivery_instructions ?? '',
    }));
  };

  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId);
  const isPickup = deliveryMethod === 'store_pickup';
  const baseShipping = isPickup ? 0 : (selectedZone?.delivery_fee ?? 0);
  const shippingFee = selectedZone?.free_delivery_threshold && subtotal >= selectedZone.free_delivery_threshold ? 0 : baseShipping;
  const effectiveCoupon = appliedCoupon ?? autoPromo;
  const couponDiscount = effectiveCoupon
    ? effectiveCoupon.discount_type === 'percentage'
      ? Math.min((subtotal * effectiveCoupon.value) / 100, effectiveCoupon.max_discount ?? Infinity)
      : effectiveCoupon.value
    : 0;
  const freeDeliveryFromPromo = effectiveCoupon?.free_delivery ?? false;
  const effectiveShipping = freeDeliveryFromPromo ? 0 : shippingFee;
  const total = Math.max(0, subtotal - couponDiscount) + effectiveShipping;

  const isOnlinePayment = form.paymentMethod === 'bank' || form.paymentMethod === 'easypaisa' || form.paymentMethod === 'jazzcash';

  if (!user) {
    return <EmptyState title="Sign in to checkout" action={<Link to="/auth" className="btn-primary">Sign In</Link>} />;
  }

  if (items.length === 0) {
    return <EmptyState icon={<ShoppingBag size={48} />} title="Your cart is empty" action={<Link to="/shop" className="btn-primary">Shop Now</Link>} />;
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('active', true)
      .maybeSingle();

    if (error || !data) {
      setCouponError('Invalid coupon code');
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }

    const coupon = data as Coupon;
    const now = new Date();
    if (coupon.start_date && new Date(coupon.start_date) > now) {
      setCouponError('Coupon not yet active');
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    if (coupon.end_date && new Date(coupon.end_date) < now) {
      setCouponError('Coupon expired');
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      setCouponError('Coupon usage limit reached');
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }
    if (subtotal < coupon.min_order) {
      setCouponError(`Minimum order is ${formatPrice(coupon.min_order)}`);
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }

    // Check first-order restriction
    if (coupon.target_type === 'first_order') {
      const { count: priorOrders } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if ((priorOrders ?? 0) > 0) {
        setCouponError('This coupon is only valid for your first order');
        setAppliedCoupon(null);
        setCouponLoading(false);
        return;
      }
    }

    // Check per-customer usage
    const { data: usage } = await supabase
      .from('coupon_usage')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', user.id);

    if (usage && usage.length >= coupon.per_customer_limit) {
      setCouponError('You have already used this coupon');
      setAppliedCoupon(null);
      setCouponLoading(false);
      return;
    }

    setAppliedCoupon(coupon);
    setCouponLoading(false);
  };

  const uploadProof = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum 5MB.');
      return;
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and PDF files are allowed.');
      return;
    }
    setUploading(true);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(filePath, file);
    if (uploadError) {
      alert('Upload failed. Please try again.');
      setUploading(false);
      return;
    }
    setProofUrl(filePath);
    setUploading(false);
  };

  const placeOrder = async () => {
    if (!form.name || !form.phone || !form.city || !form.address) {
      alert('Please fill in all required fields (Name, Phone, City, Address).');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      alert('Please enter a valid email address.');
      return;
    }
    if (!isPickup && !selectedZoneId) {
      alert('Please select a delivery zone.');
      return;
    }
    if (isOnlinePayment && !transactionRef) {
      alert('Please enter your transaction/reference number');
      return;
    }
    setPlacing(true);

    if (!idempotencyRef.current) {
      idempotencyRef.current = `order-${user.id}-${Date.now()}`;
    }
    const idempotencyKey = idempotencyRef.current;
    const rpcItems = items.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      quantity: item.quantity,
    }));

    const { data: result, error } = await supabase.rpc('place_order', {
      p_items: rpcItems,
      p_delivery_name: form.name,
      p_delivery_phone: form.phone,
      p_delivery_email: form.email || null,
      p_country: form.country,
      p_city: form.city,
      p_address: form.address,
      p_area: form.area || null,
      p_postal_code: form.postalCode || null,
      p_landmark: form.landmark || null,
      p_delivery_instructions: form.deliveryInstructions || null,
      p_notes: form.notes || null,
      p_payment_method: form.paymentMethod,
      p_payment_reference: transactionRef || null,
      p_payment_proof_url: proofUrl || null,
      p_delivery_zone_id: selectedZoneId || null,
      p_shipping_fee: effectiveShipping,
      p_coupon_code: effectiveCoupon?.code ?? null,
      p_coupon_discount: couponDiscount,
      p_is_gift: isGift,
      p_gift_recipient_name: isGift ? giftRecipientName : null,
      p_gift_message: isGift ? giftMessage : null,
      p_idempotency_key: idempotencyKey,
    });

    if (error || !result || !result.order_number) {
      console.error('Order placement failed:', error);
      const msg = error?.message?.includes('Insufficient stock') ? 'Some items are out of stock. Please review your cart.'
        : error?.message?.includes('Coupon') ? 'Coupon could not be applied: ' + error.message
        : error?.message?.includes('idempotency') || error?.message?.includes('already') ? 'This order may have already been placed. Check your orders.'
        : 'Could not place your order. Please try again.';
      alert(msg);
      setPlacing(false);
      return;
    }

    // Create notification for customer
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'order_placed',
      title: 'Order Placed',
      body: `Your order ${result?.order_number} has been placed successfully.`,
    });
    if (notifError) console.error('Failed to create notification:', notifError.message);

    // Send email notification to owner (with user's JWT for auth)
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-email`;
      const emailRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: result?.order_id }),
      });
      if (!emailRes.ok) console.error('Owner email notification returned non-OK status:', emailRes.status);
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr);
    }

    const clearResult = await clearCart();
    if (clearResult?.error) console.error('Cart clear failed after order placement:', clearResult.error);
    setPlacing(false);
    idempotencyRef.current = null;
    navigate(`/order-confirmation?order=${result.order_number}&token=${result.tracking_token}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 font-display text-3xl font-bold">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Delivery info */}
          <div className="card p-5">
            <h3 className="mb-4 text-lg font-semibold">Delivery Information</h3>
            {savedAddresses.length > 0 && (
              <div className="mb-4">
                <label className="label">Saved Addresses</label>
                <div className="space-y-2">
                  {savedAddresses.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => applyAddress(a)}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left transition ${selectedAddressId === a.id ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'}`}
                    >
                      <MapPin size={16} className="mt-0.5 flex-shrink-0 text-neutral-400" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.label}{a.is_default && <span className="ml-2 text-xs text-accent-600">Default</span>}</p>
                        <p className="text-xs text-neutral-500">{[a.house_number, a.street, a.area, a.city, a.country].filter(Boolean).join(', ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="City *" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <Field label="Address *" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <Field label="Area" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
              <Field label="Postal Code" value={form.postalCode} onChange={(v) => setForm({ ...form, postalCode: v })} />
              <Field label="Landmark" value={form.landmark} onChange={(v) => setForm({ ...form, landmark: v })} />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
            </div>
            <div className="mt-4">
              <label className="label">Delivery Instructions</label>
              <textarea value={form.deliveryInstructions} onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value })} rows={2} className="input" placeholder="e.g. Call before delivery" />
            </div>
            <div className="mt-4">
              <label className="label">Order Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input" placeholder="Any special requirements..." />
            </div>
          </div>

          {/* Gift option */}
          <div className="card p-5">
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} className="rounded" />
              <Gift size={18} className="text-primary-600" />
              <span className="text-sm font-medium">Send as a gift</span>
            </label>
            {isGift && (
              <div className="mt-4 space-y-3">
                <Field label="Recipient Name" value={giftRecipientName} onChange={setGiftRecipientName} />
                <div>
                  <label className="label">Gift Message</label>
                  <textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={2} className="input" placeholder="A personal message for the recipient..." />
                </div>
              </div>
            )}
          </div>

          {/* Delivery method */}
          <div className="card p-5">
            <h3 className="mb-4 text-lg font-semibold">Delivery Method</h3>
            <div className="space-y-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${deliveryMethod === 'home_delivery' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}>
                <input type="radio" name="delivery" checked={deliveryMethod === 'home_delivery'} onChange={() => setDeliveryMethod('home_delivery')} className="rounded" />
                <Truck size={18} />
                <span className="text-sm font-medium">Home Delivery</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${deliveryMethod === 'store_pickup' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}>
                <input type="radio" name="delivery" checked={deliveryMethod === 'store_pickup'} onChange={() => setDeliveryMethod('store_pickup')} className="rounded" />
                <Store size={18} />
                <span className="text-sm font-medium">Store Pickup</span>
              </label>
              {isPickup && (
                <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-500 dark:bg-neutral-900">
                  <MapPin size={14} className="mb-1 inline" /> Pick up from: {SHOP_INFO.address}
                </div>
              )}
            </div>
          </div>

          {/* Delivery zone */}
          {!isPickup && deliveryZones.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-4 text-lg font-semibold">Delivery Zone</h3>
              <select value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className="input">
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name} — Rs. {z.delivery_fee} ({z.estimated_delivery_days} days)</option>
                ))}
              </select>
              {selectedZone && (
                <p className="mt-2 text-xs text-neutral-500">
                  Estimated delivery: {selectedZone.estimated_delivery_days} day(s)
                  {selectedZone.free_delivery_threshold && ` · Free delivery over Rs. ${selectedZone.free_delivery_threshold}`}
                </p>
              )}
            </div>
          )}

          {/* Payment method */}
          <div className="card p-5">
            <h3 className="mb-4 text-lg font-semibold">Payment Method</h3>
            <div className="space-y-2">
              {zonesError && !isPickup && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  Could not load delivery zones. Please try again or select Store Pickup.
                </div>
              )}
              {(() => {
                const methods: { label: string; value: string }[] = [];
                if (siteSettings.cod_enabled) methods.push({ label: 'Cash on Delivery', value: 'cod' });
                if (siteSettings.bank_transfer_enabled) methods.push({ label: 'Bank Transfer', value: 'bank' });
                if (siteSettings.easypaisa_enabled) methods.push({ label: 'EasyPaisa', value: 'easypaisa' });
                if (siteSettings.jazzcash_enabled) methods.push({ label: 'JazzCash', value: 'jazzcash' });
                if (siteSettings.hand_to_hand_enabled) methods.push({ label: 'Hand-to-Hand (Local Pickup)', value: 'hand-to-hand' });
                if (methods.length === 0) {
                  return <p className="text-sm text-amber-600">No payment methods are currently enabled. Please contact us to complete your order.</p>;
                }
                return methods.map((method) => {
                  const isSelected = form.paymentMethod === method.value;
                  return (
                    <label key={method.label} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${isSelected ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}>
                      <input
                        type="radio"
                        name="payment"
                        checked={isSelected}
                        onChange={() => { setForm({ ...form, paymentMethod: method.value }); setTransactionRef(''); setProofUrl(''); }}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">{method.label}</span>
                    </label>
                  );
                });
              })()}
            </div>

            {/* Payment proof for online methods */}
            {isOnlinePayment && (
              <div className="mt-4 space-y-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <p className="text-sm font-medium">Submit your payment details</p>
                <p className="text-xs text-neutral-500">After transferring, enter your transaction reference number and upload a screenshot/receipt for verification.</p>
                <div>
                  <label className="label">Transaction / Reference Number</label>
                  <input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} className="input" placeholder="e.g. TRX123456789" />
                </div>
                <div>
                  <label className="label">Payment Proof (Screenshot/Receipt)</label>
                  {proofUrl ? (
                    <div className="flex items-center gap-2">
                      <Badge color="accent">Uploaded</Badge>
                      <button onClick={() => setProofUrl('')} className="text-xs text-red-500"><X size={14} /> Remove</button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 p-3 text-sm text-neutral-500 hover:border-primary-400 dark:border-neutral-700">
                      <Upload size={16} />
                      {uploading ? 'Uploading...' : 'Click to upload (JPG, PNG, PDF, max 5MB)'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProof(f); }} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="card h-fit p-5">
          <h3 className="mb-4 text-lg font-semibold">Order Summary</h3>
          <div className="mb-4 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-neutral-500">{item.product?.name} × {item.quantity}</span>
                <span className="font-medium">{formatPrice(item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Auto-applied promotion */}
          {autoPromo && !appliedCoupon && (
            <div className="mb-4 rounded-xl border border-accent-200 bg-accent-50 p-3 dark:border-accent-800 dark:bg-accent-900/20">
              <div className="flex items-start gap-2">
                <Sparkles size={16} className="mt-0.5 flex-shrink-0 text-accent-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-accent-700 dark:text-accent-300">{autoPromo.name ?? autoPromo.code} — You saved {formatPrice(autoPromoSavings)}!</p>
                  <p className="text-xs text-accent-600 dark:text-accent-400">{autoPromoReason}</p>
                  {autoPromo.free_delivery && <p className="text-xs text-accent-600 dark:text-accent-400">Includes free delivery</p>}
                </div>
                <button onClick={() => { setAutoPromo(null); setAutoPromoReason(''); setAutoPromoSavings(0); setAutoPromoDismissed(true); }} className="text-xs text-neutral-400 hover:text-red-500">Dismiss</button>
              </div>
            </div>
          )}

          {/* Coupon */}
          <div className="mb-4 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Coupon code" className="input py-1.5 text-sm pl-8" />
              </div>
              <button onClick={applyCoupon} disabled={couponLoading} className="btn-outline px-3 py-1.5 text-sm">
                {couponLoading ? <Spinner size={14} /> : 'Apply'}
              </button>
            </div>
            {couponError && <p className="mt-1.5 text-xs text-red-500">{couponError}</p>}
            {appliedCoupon && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-medium text-accent-600">Coupon "{appliedCoupon.code}" applied</span>
                <button onClick={() => { setAppliedCoupon(null); setCouponCode(''); }} className="text-xs text-red-500">Remove</button>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
            <div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {couponDiscount > 0 && <div className="flex justify-between text-accent-600"><span>Discount {(effectiveCoupon?.name || effectiveCoupon?.code) && `(${effectiveCoupon.name ?? effectiveCoupon.code})`}</span><span>-{formatPrice(couponDiscount)}</span></div>}
            <div className="flex justify-between"><span className="text-neutral-500">Shipping</span><span>{effectiveShipping === 0 ? 'Free' : formatPrice(effectiveShipping)}</span></div>
            <div className="border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <div className="flex justify-between text-base font-bold"><span>Total</span><span className="text-primary-700 dark:text-primary-400">{formatPrice(total)}</span></div>
            </div>
          </div>
          <button onClick={placeOrder} disabled={placing || uploading} className="btn-primary mt-4 w-full">
            {placing ? <><Spinner size={16} /> Placing Order...</> : <><Check size={18} /> Place Order</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
