import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/context/AuthContext';
import { navigate, Link } from '@/lib/router';
import { PRODUCT_TYPES, SIZES, WEIGHTS, FILLINGS, FABRICS, COLORS, DESIGNS, STITCHINGS, DECORATIONS } from '@/lib/types';
import { Spinner, Badge } from '@/components/ui';
import { Scissors, Check, MessageCircle, Shirt } from 'lucide-react';
import { customOrderWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

export function CustomOrderPage() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    productType: 'Lahaf',
    sizeLabel: '',
    width: '',
    length: '',
    unit: 'inches',
    weight: '',
    filling: '',
    fabric: '',
    fabricSource: 'shop',
    fabricDetails: '',
    color: '',
    frontDesign: '',
    backDesign: '',
    stitching: '',
    decoration: 'None',
    quantity: 1,
    instructions: '',
  });
  const [imageUrls, setImageUrls] = useState('');

  const update = (key: string, value: string | number) => setForm((p) => ({ ...p, [key]: value }));

  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitError(null);
    if (!user) { navigate('/auth'); return; }
    if (!form.productType) { setSubmitError('Please select a product type'); return; }
    if (!form.sizeLabel && (!form.width || !form.length)) { setSubmitError('Please select a preset size or enter both width and length'); return; }
    if (form.width && parseFloat(form.width) <= 0) { setSubmitError('Width must be greater than 0'); return; }
    if (form.length && parseFloat(form.length) <= 0) { setSubmitError('Length must be greater than 0'); return; }
    if (form.quantity < 1) { setSubmitError('Quantity must be at least 1'); return; }
    setSubmitting(true);

    const { data, error } = await supabase.from('custom_orders').insert({
      user_id: user.id,
      product_type: form.productType,
      size_label: form.sizeLabel || null,
      width: form.width ? parseFloat(form.width) : null,
      length: form.length ? parseFloat(form.length) : null,
      unit: form.unit,
      weight: form.weight || null,
      filling: form.filling || null,
      fabric: form.fabricSource === 'shop' ? (form.fabric || null) : null,
      fabric_source: form.fabricSource,
      fabric_details: form.fabricSource === 'customer' ? (form.fabricDetails || null) : null,
      color: form.color || null,
      front_design: form.frontDesign || null,
      back_design: form.backDesign || null,
      stitching: form.stitching || null,
      decoration: form.decoration || null,
      quantity: form.quantity,
      instructions: form.instructions || null,
      status: 'requested',
    }).select('id').single();

    if (error) { setSubmitError('Could not submit your request. Please try again.'); setSubmitting(false); return; }

    // Insert reference image URLs
    const parsed = imageUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (parsed.length > 0) {
      const { error: imgError } = await supabase.from('custom_order_images').insert(
        parsed.map((url) => ({ custom_order_id: data.id, url, image_type: 'reference' }))
      );
      if (imgError) console.error('Failed to save reference images:', imgError.message);
    }

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'custom_order',
      title: 'Custom Order Submitted',
      body: `Your custom ${form.productType} request has been submitted. We will review and send a quote.`,
    });
    if (notifError) console.error('Failed to create notification:', notifError.message);

    // Send email notification to owner
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'custom_order', customOrderId: data.id }),
      });
      if (!response.ok) console.error('Owner email notification failed with status:', response.status);
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr);
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <SEO title="Custom Order Submitted | Madina Cotton Shop" description="Your custom bedding request has been submitted." canonicalPath="/custom-order" />
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-600">
          <Check size={32} />
        </div>
        <h1 className="font-display text-3xl font-bold">Request Submitted!</h1>
        <p className="mt-2 text-neutral-500">We will review your custom order and send you a quote shortly. You can track it in your account.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/account" className="btn-primary">View My Requests</Link>
          <Link to="/shop" className="btn-outline">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Custom Bedding Order | Madina Cotton Shop — Design Your Own"
        description="Order custom handmade lahaf, razai, gadda, takiya online in Pakistan. Choose size, weight, filling, fabric, color, stitching & design. Handcrafted in Hyderabad. COD available."
        canonicalPath="/custom-order"
      />
      <div className="mb-6">
        <Badge color="primary"><Scissors size={12} className="mr-1" /> Custom Order</Badge>
        <h1 className="mt-3 font-display text-3xl font-bold">Design Your Own Bedding</h1>
        <p className="mt-2 text-neutral-500">Choose your specifications and we will craft it by hand. Upload reference images for custom designs.</p>
      </div>

      <div className="space-y-6">
        <Section title="Product Type">
          <select value={form.productType} onChange={(e) => update('productType', e.target.value)} className="input">
            {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Section>

        <Section title="Size">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Preset Size</label>
              <select value={form.sizeLabel} onChange={(e) => update('sizeLabel', e.target.value)} className="input">
                <option value="">Custom size</option>
                {SIZES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>
            {!form.sizeLabel && (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Width</label>
                  <input type="number" value={form.width} onChange={(e) => update('width', e.target.value)} className="input" placeholder="60" />
                </div>
                <div>
                  <label className="label">Length</label>
                  <input type="number" value={form.length} onChange={(e) => update('length', e.target.value)} className="input" placeholder="94" />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select value={form.unit} onChange={(e) => update('unit', e.target.value)} className="input">
                    <option value="inches">Inches</option>
                    <option value="feet">Feet</option>
                    <option value="cm">cm</option>
                    <option value="meters">Meters</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Weight">
            <select value={form.weight} onChange={(e) => update('weight', e.target.value)} className="input">
              <option value="">Select</option>
              {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </Section>
          <Section title="Quantity">
            <input type="number" min="1" value={form.quantity} onChange={(e) => update('quantity', parseInt(e.target.value) || 1)} className="input" />
          </Section>
        </div>

        <Section title="Filling">
          <select value={form.filling} onChange={(e) => update('filling', e.target.value)} className="input">
            <option value="">Select</option>
            {FILLINGS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Section>

        <Section title="Fabric Source">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => update('fabricSource', 'shop')}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${form.fabricSource === 'shop' ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${form.fabricSource === 'shop' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                  <Scissors size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Shop Fabric</p>
                  <p className="text-xs text-neutral-500">We provide the fabric</p>
                </div>
              </button>
              <button
                onClick={() => update('fabricSource', 'customer')}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${form.fabricSource === 'customer' ? 'border-accent-600 bg-accent-50 dark:bg-accent-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${form.fabricSource === 'customer' ? 'bg-accent-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                  <Shirt size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Bring Your Own Fabric</p>
                  <p className="text-xs text-neutral-500">You provide the fabric</p>
                </div>
              </button>
            </div>
            {form.fabricSource === 'shop' ? (
              <div>
                <label className="label">Fabric</label>
                <select value={form.fabric} onChange={(e) => update('fabric', e.target.value)} className="input">
                  <option value="">Select</option>
                  {FABRICS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ) : (
              <div className="rounded-xl bg-accent-50 p-4 dark:bg-accent-900/20">
                <label className="label">Describe Your Fabric</label>
                <textarea
                  value={form.fabricDetails}
                  onChange={(e) => update('fabricDetails', e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="e.g. 2 meters white cotton, 3 meters navy blue silk, etc. Include fabric type, color, and quantity you will bring."
                />
                <p className="mt-2 text-xs text-neutral-500">Please bring your fabric to the shop or arrange delivery before production begins. We will confirm fabric suitability and quantity when reviewing your request.</p>
              </div>
            )}
          </div>
        </Section>

        <Section title="Color">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => update('color', form.color === c.name ? '' : c.name)}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition ${form.color === c.name ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-neutral-200 dark:border-neutral-700'}`}
              >
                <span className="h-4 w-4 rounded-full border border-neutral-300" style={{ background: c.hex }} />
                {c.name}
              </button>
            ))}
          </div>
        </Section>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Front Design">
            <select value={form.frontDesign} onChange={(e) => update('frontDesign', e.target.value)} className="input">
              <option value="">Select</option>
              {DESIGNS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Section>
          <Section title="Back Design">
            <select value={form.backDesign} onChange={(e) => update('backDesign', e.target.value)} className="input">
              <option value="">Select</option>
              {DESIGNS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Section>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Stitching">
            <select value={form.stitching} onChange={(e) => update('stitching', e.target.value)} className="input">
              <option value="">Select</option>
              {STITCHINGS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Section>
          <Section title="Decoration">
            <select value={form.decoration} onChange={(e) => update('decoration', e.target.value)} className="input">
              {DECORATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Section>
        </div>

        <Section title="Reference Images">
          <p className="mb-2 text-sm text-neutral-500">Paste image URLs (one per line) for color, design, or stitching references.</p>
          <textarea
            value={imageUrls}
            onChange={(e) => setImageUrls(e.target.value)}
            rows={3}
            className="input"
            placeholder="https://example.com/reference-image.jpg"
          />
        </Section>

        <Section title="Instructions">
          <textarea
            value={form.instructions}
            onChange={(e) => update('instructions', e.target.value)}
            rows={4}
            className="input"
            placeholder="Any special requirements, custom details..."
          />
        </Section>

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">
            {submitError}
          </div>
        )}
        <button onClick={submit} disabled={submitting} className="btn-primary w-full">
          {submitting ? <><Spinner size={16} /> Submitting...</> : <>Request Custom Quote</>}
        </button>
        <a
          href={buildWhatsAppUrl(customOrderWhatsAppMessage(
            form.productType,
            form.sizeLabel || (form.width && form.length ? `${form.width}×${form.length} ${form.unit}` : 'Custom size'),
            form.weight || 'Not specified',
            form.fabricSource === 'shop' ? (form.fabric || 'Not specified') : 'Customer-provided fabric',
            form.color || 'Not specified',
            form.instructions || 'No special instructions'
          ))}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline w-full"
          style={{ borderColor: '#25D366', color: '#25D366' }}
        >
          <MessageCircle size={18} /> Send Details on WhatsApp
        </a>
        {!user && <p className="text-center text-sm text-neutral-500">You need to <Link to="/auth" className="text-primary-600">sign in</Link> to submit a custom order.</p>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">{title}</h3>
      {children}
    </div>
  );
}
