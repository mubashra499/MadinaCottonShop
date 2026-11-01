import { useState, useRef, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import { handleCustomerQuery, findClosestSize } from '@/lib/aiAssistant';
import { getEffectivePrice, formatPrice, cn } from '@/lib/utils';
import { Sparkles, Send, X, Bot, User, ShoppingBag, Ruler } from 'lucide-react';
import { navigate } from '@/lib/router';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  products?: Product[];
  suggestions?: string[];
}

export function AIAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'size'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Assalam-o-Alaikum! I\'m your bedding assistant. Tell me what you need — e.g. "I need a 6x6 cotton gadda under 15000" or "soft takiya for double bed".',
      suggestions: ['Show me all products', 'What\'s on sale?', 'I need a soft takiya', '6x6 gadda under 15000'],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sizeInput, setSizeInput] = useState({ width: '', length: '', unit: 'ft' });
  const [sizeResult, setSizeResult] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await handleCustomerQuery(text);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.text, products: res.products, suggestions: res.suggestions }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, I had trouble processing that. Please try again.' }]);
    }
    setLoading(false);
  };

  const checkSize = async () => {
    const w = parseFloat(sizeInput.width);
    const l = parseFloat(sizeInput.length);
    if (!w || !l) return;
    setLoading(true);
    try {
      const res = await findClosestSize(w, l, sizeInput.unit);
      setSizeResult(res.message);
      if (res.suggestCustom) {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          text: res.message,
          suggestions: ['Create custom order', 'Browse all products'],
        }]);
      }
    } catch {
      setSizeResult('Could not search sizes. Please try again.');
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
        aria-label="Open AI Assistant"
      >
        <Sparkles size={20} />
        <span className="hidden text-sm font-semibold sm:inline">Ask AI</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-[calc(100vw-3rem)] max-w-sm flex-col rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
      <div className="flex items-center justify-between rounded-t-2xl bg-primary-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Sparkles size={20} />
          <div>
            <p className="text-sm font-semibold">Bedding Assistant</p>
            <p className="text-[10px] opacity-80">AI-powered · Real product data</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode(mode === 'chat' ? 'size' : 'chat')}
            className={cn('rounded-lg px-2 py-1 text-xs transition', mode === 'size' ? 'bg-white/20' : 'hover:bg-white/10')}
            title="Size assistant"
          >
            <Ruler size={14} />
          </button>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
      </div>

      {mode === 'chat' ? (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30"><Bot size={14} className="text-primary-600" /></div>}
                <div className={cn('max-w-[80%]', msg.role === 'user' ? '' : '')}>
                  <div className={cn('rounded-xl px-3 py-2 text-sm whitespace-pre-line', msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>
                    {msg.text}
                  </div>
                  {msg.products && msg.products.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.products.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { navigate(`/product/${p.slug}`); setOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-left transition hover:border-primary-300 hover:shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
                        >
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-700">
                            {p.product_images?.[0] ? <img src={p.product_images[0].url} alt="" className="h-full w-full object-cover" /> : <ShoppingBag size={14} className="m-auto mt-2.5 text-neutral-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="line-clamp-1 text-xs font-semibold">{p.name}</p>
                            <p className="text-xs font-bold text-primary-600">{formatPrice(getEffectivePrice(p.price, p.sale_price))}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.suggestions.map((s) => (
                        <button key={s} onClick={() => send(s)} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 transition hover:bg-primary-100 hover:text-primary-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700"><User size={14} className="text-neutral-500" /></div>}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30"><Bot size={14} className="text-primary-600" /></div>
                <div className="rounded-xl bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
                  <span className="inline-flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" />
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Ask about products, sizes, prices..."
                className="input flex-1 py-2 text-sm"
                disabled={loading}
              />
              <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn-primary p-2.5">
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Ruler size={18} />
            <p>Enter your bed dimensions and I&apos;ll find the closest matching product size.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Width</label>
              <input type="number" value={sizeInput.width} onChange={(e) => setSizeInput({ ...sizeInput, width: e.target.value })} className="input py-2 text-sm" placeholder="e.g. 6" />
            </div>
            <div>
              <label className="label">Length</label>
              <input type="number" value={sizeInput.length} onChange={(e) => setSizeInput({ ...sizeInput, length: e.target.value })} className="input py-2 text-sm" placeholder="e.g. 6" />
            </div>
          </div>
          <div>
            <label className="label">Unit</label>
            <select value={sizeInput.unit} onChange={(e) => setSizeInput({ ...sizeInput, unit: e.target.value })} className="input py-2 text-sm">
              <option value="ft">Feet (ft)</option>
              <option value="in">Inches (in)</option>
              <option value="cm">Centimeters (cm)</option>
            </select>
          </div>
          <button onClick={checkSize} disabled={loading || !sizeInput.width || !sizeInput.length} className="btn-primary w-full">
            {loading ? 'Searching...' : 'Find Matching Size'}
          </button>
          {sizeResult && (
            <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {sizeResult}
            </div>
          )}
          {messages.length > 1 && messages[messages.length - 1].suggestions && (
            <div className="flex flex-wrap gap-1">
              {messages[messages.length - 1].suggestions!.map((s) => (
                <button key={s} onClick={() => { setMode('chat'); send(s); }} className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800">
                  {s}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setMode('chat')} className="w-full text-center text-xs text-primary-600 hover:text-primary-700">Back to chat</button>
        </div>
      )}
    </div>
  );
}
