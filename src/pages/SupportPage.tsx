import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SEO } from '@/components/SEO';
import { useAuth } from '@/context/AuthContext';
import { navigate } from '@/lib/router';
import type { SupportTicket, SupportMessage } from '@/lib/types';
import { Spinner, EmptyState, Badge } from '@/components/ui';
import { formatDateTime, cn } from '@/lib/utils';
import { MessageCircle, Plus, Send, Headphones } from 'lucide-react';

export function SupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('order');
  const [newBody, setNewBody] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    loadTickets();
  }, [user]);

  const loadTickets = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: queryErr } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (queryErr) {
      console.error('Failed to load tickets:', queryErr.message);
      setError('Could not load your support tickets. Please try again.');
      setTickets([]);
    } else {
      setTickets((data as SupportTicket[]) ?? []);
    }
    setLoading(false);
  };

  const loadMessages = async (ticketId: string) => {
    if (!user) return;
    setMessagesLoading(true);
    const { data: ticket, error: ticketErr } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (ticketErr) {
      console.error('Ticket ownership check failed:', ticketErr.message);
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    if (!ticket) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }
    const { data, error: msgErr } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (msgErr) {
      console.error('Failed to load messages:', msgErr.message);
      setMessages([]);
    } else {
      setMessages((data as SupportMessage[]) ?? []);
    }
    setMessagesLoading(false);
  };

  const createTicket = async () => {
    if (!user || !newSubject.trim() || !newBody.trim()) return;
    setSending(true);
    setError(null);
    const { data: ticket, error: ticketErr } = await supabase.from('support_tickets').insert({
      user_id: user.id, subject: newSubject, category: newCategory, status: 'open',
    }).select('id').single();
    if (ticketErr) {
      setError('Could not create ticket: ' + ticketErr.message);
      setSending(false);
      return;
    }
    if (ticket) {
      const { error: msgErr } = await supabase.from('support_messages').insert({
        ticket_id: ticket.id, user_id: user.id, sender: 'customer', body: newBody,
      });
      if (msgErr) console.error('Failed to add opening message:', msgErr.message);

      try {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-email`;
        await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'support', subject: newSubject, category: newCategory, body: newBody }),
        });
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr);
      }
    }
    setSending(false);
    setShowNew(false);
    setNewSubject(''); setNewBody('');
    setSuccess('Ticket created successfully.');
    loadTickets();
  };

  const sendReply = async () => {
    if (!activeTicket || !user || !reply.trim()) return;
    setSending(true);
    setError(null);
    const { error: replyErr } = await supabase.from('support_messages').insert({
      ticket_id: activeTicket.id, user_id: user.id, sender: 'customer', body: reply,
    });
    if (replyErr) {
      setError('Could not send reply. Please try again.');
      setSending(false);
      return;
    }
    setReply('');
    setSending(false);
    loadMessages(activeTicket.id);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Customer Support | Madina Cotton Shop"
        description="Get help with your order, payment, delivery, product, custom order, return, or refund. Open a support ticket and our team will respond."
        canonicalPath="/support"
      />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Badge color="primary"><Headphones size={12} className="mr-1" /> Support</Badge>
          <h1 className="mt-3 font-display text-3xl font-bold">Customer Support</h1>
        </div>
        <button onClick={() => { setShowNew(true); setError(null); setSuccess(null); }} className="btn-primary"><Plus size={16} /> New Ticket</button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/20">{success}</div>
      )}

      {showNew && (
        <div className="mb-6 card p-5">
          <h3 className="mb-4 text-lg font-semibold">Create New Ticket</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Subject</label>
              <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="input" placeholder="Brief description of your issue" />
            </div>
            <div>
              <label className="label">Category</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="input">
                <option value="order">Order</option>
                <option value="payment">Payment</option>
                <option value="delivery">Delivery</option>
                <option value="product">Product</option>
                <option value="custom_order">Custom Order</option>
                <option value="return">Return</option>
                <option value="refund">Refund</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Message</label>
              <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={4} className="input" placeholder="Describe your issue in detail..." />
            </div>
            <div className="flex gap-2">
              <button onClick={createTicket} disabled={sending} className="btn-primary">{sending ? <Spinner size={16} /> : 'Submit'}</button>
              <button onClick={() => setShowNew(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size={32} /></div>
      ) : activeTicket ? (
        <div>
          <button onClick={() => setActiveTicket(null)} className="btn-ghost mb-4 text-sm">← Back to tickets</button>
          <div className="card p-4 mb-4">
            <h3 className="font-semibold">{activeTicket.subject}</h3>
            <Badge color={activeTicket.status === 'open' ? 'amber' : activeTicket.status === 'resolved' ? 'accent' : 'neutral'}>{activeTicket.status}</Badge>
          </div>
          <div className="space-y-2 mb-4">
            {messagesLoading ? (
              <div className="flex justify-center py-6"><Spinner size={24} /></div>
            ) : messages.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-400">No messages yet</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn('rounded-xl p-3 text-sm', m.sender === 'customer' ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-neutral-100 dark:bg-neutral-800')}>
                  <p className="text-xs font-medium text-neutral-400">{m.sender === 'customer' ? 'You' : 'Support'} · {formatDateTime(m.created_at)}</p>
                  <p className="mt-1">{m.body}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} className="input flex-1" placeholder="Type your reply..." />
            <button onClick={sendReply} disabled={sending} className="btn-primary"><Send size={16} /></button>
          </div>
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState icon={<MessageCircle size={48} />} title="No support tickets" message="Create a ticket if you need help with an order, payment, or product." action={<button onClick={() => setShowNew(true)} className="btn-primary">New Ticket</button>} />
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => { setActiveTicket(t); loadMessages(t.id); }} className="card flex w-full items-center justify-between p-4 text-left hover:shadow-card">
              <div>
                <p className="font-semibold">{t.subject}</p>
                <p className="text-xs text-neutral-400">{t.category} · {formatDateTime(t.created_at)}</p>
              </div>
              <Badge color={t.status === 'open' ? 'amber' : t.status === 'resolved' ? 'accent' : 'neutral'}>{t.status}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
