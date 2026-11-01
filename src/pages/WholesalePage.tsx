import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/context/AuthContext';
import { Link, navigate } from '@/lib/router';
import { Spinner, Badge } from '@/components/ui';
import { Check, Building2 } from 'lucide-react';

export function WholesalePage() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({ businessName: '', contact: '' });

  const submit = async () => {
    setSubmitError(null);
    if (!user) { navigate('/auth'); return; }
    if (!form.businessName) { setSubmitError('Please enter your business name'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('wholesale_accounts').insert({
      user_id: user.id,
      business_name: form.businessName,
      contact: form.contact,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) { setSubmitError('Could not submit registration: ' + error.message); return; }

    // Send email notification to owner about new wholesale registration
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'wholesale', businessName: form.businessName, contact: form.contact }),
      });
      if (!response.ok) console.error('Owner email notification failed with status:', response.status);
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr);
    }

    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Wholesale & Bulk Bedding Orders | Madina Cotton Shop — Pakistan"
        description="Wholesale and bulk pricing for lahaf, razai, gadda, takiya, cushions & pillows. Businesses, hotels, and bulk buyers welcome. Custom production from Hyderabad, Pakistan."
        canonicalPath="/wholesale"
      />
      <Badge color="primary"><Building2 size={12} className="mr-1" /> Wholesale / B2B</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Wholesale & Bulk Orders</h1>
      <p className="mt-2 text-neutral-500">Register your business for wholesale pricing, bulk quotes, and custom production.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { tier: '1-9 units', label: 'Retail', desc: 'Standard pricing' },
          { tier: '10-49 units', label: 'Tier 1', desc: 'Wholesale discount' },
          { tier: '50+ units', label: 'Tier 2', desc: 'Best bulk pricing' },
        ].map((t) => (
          <div key={t.tier} className="card p-5 text-center">
            <p className="text-sm text-neutral-400">{t.tier}</p>
            <p className="mt-1 text-lg font-bold text-primary-600">{t.label}</p>
            <p className="text-sm text-neutral-500">{t.desc}</p>
          </div>
        ))}
      </div>

      {submitted ? (
        <div className="mt-8 card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-accent-600"><Check size={28} /></div>
          <h3 className="text-xl font-semibold">Registration Submitted!</h3>
          <p className="mt-2 text-sm text-neutral-500">We will verify your business and contact you with wholesale pricing.</p>
          <Link to="/shop" className="btn-primary mt-4">Continue Shopping</Link>
        </div>
      ) : (
        <div className="mt-6 card p-6">
          <h3 className="mb-4 text-lg font-semibold">Register for Wholesale</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Business Name *</label>
              <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="input" placeholder="Your business name" />
            </div>
            <div>
              <label className="label">Contact (Phone / Email)</label>
              <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="input" placeholder="03xx-xxxxxxx" />
            </div>
            {submitError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">
                {submitError}
              </div>
            )}
            <button onClick={submit} disabled={submitting} className="btn-primary w-full">
              {submitting ? <><Spinner size={16} /> Submitting...</> : 'Register'}
            </button>
            {!user && <p className="text-center text-sm text-neutral-500">You need to <Link to="/auth" className="text-primary-600">sign in</Link> first.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
