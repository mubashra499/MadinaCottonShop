import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/context/AuthContext';
import { Badge, Spinner } from '@/components/ui';
import { Phone, MapPin, Mail, MessageCircle, Send, Check } from 'lucide-react';
import { SHOP_INFO } from '@/lib/supabase';
import { navigate } from '@/lib/router';

export function ContactPage() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', message: '' });

  const send = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!form.message.trim()) return;
    setSending(true);
    setError(null);
    const { error: insertError } = await supabase.from('messages').insert({
      user_id: user.id,
      sender: 'customer',
      body: form.name.trim() ? `${form.name.trim()}: ${form.message.trim()}` : form.message.trim(),
    });
    setSending(false);
    if (insertError) {
      setError('Could not send your message. Please try again or contact us directly.');
      return;
    }
    setSent(true);
    setForm({ name: '', message: '' });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Contact Us | Madina Cotton Shop — Hyderabad, Pakistan"
        description="Contact Madina Cotton Shop for handmade bedding orders, custom quotes, and delivery queries. Call 0313 3344068 or WhatsApp. Latifabad, Hyderabad, Sindh."
        canonicalPath="/contact"
      />
      <Badge color="primary"><MessageCircle size={12} className="mr-1" /> Contact</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Get in Touch</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="card p-5 text-center">
          <Phone className="mx-auto mb-2 text-primary-600" size={24} />
          <p className="text-sm font-semibold">Call Us</p>
          <p className="text-sm text-neutral-500">{SHOP_INFO.phone}</p>
        </div>
        <div className="card p-5 text-center">
          <MapPin className="mx-auto mb-2 text-primary-600" size={24} />
          <p className="text-sm font-semibold">Visit Us</p>
          <p className="text-sm text-neutral-500">{SHOP_INFO.address}</p>
        </div>
        <div className="card p-5 text-center">
          <Mail className="mx-auto mb-2 text-primary-600" size={24} />
          <p className="text-sm font-semibold">Email</p>
          <p className="text-sm text-neutral-500">{SHOP_INFO.email}</p>
        </div>
      </div>

      <div className="mt-6 card p-6">
        <h3 className="mb-4 text-lg font-semibold">Send a Message</h3>
        {sent ? (
          <div className="text-center py-4">
            <Check className="mx-auto mb-2 text-accent-600" size={32} />
            <p className="font-medium">Message sent! We will get back to you soon.</p>
            <button onClick={() => setSent(false)} className="btn-outline mt-4">Send Another</button>
          </div>
        ) : (
          <>
            {!user && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20">Please sign in to send a message. You can also call or WhatsApp us directly.</p>}
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                placeholder="Your name (optional)"
              />
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={4}
                className="input"
                placeholder="Your message..."
              />
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</p>}
              <button onClick={send} disabled={sending || !form.message.trim()} className="btn-primary w-full">
                {sending ? <><Spinner size={16} /> Sending...</> : <><Send size={16} /> Send Message</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
