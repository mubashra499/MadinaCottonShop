import { useState } from 'react';
import { Link } from '@/lib/router';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui';
import { ChevronDown, MessageCircle, Truck, Shield } from 'lucide-react';

export function FAQPage() {
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [
    { q: 'What products does Madina Cotton Shop make?', a: 'We make handmade cotton bedding including Lahaf, Gadda, Takiya, Razai, Quilts, and Cushions. All products are handmade in our workshop in Hyderabad, Sindh, Pakistan.' },
    { q: 'How are your products made?', a: 'Cotton is cleaned and prepared using machinery, then our bedding is filled and finished by hand. Every product is hand-stitched with care.' },
    { q: 'What sizes are available?', a: 'We offer standard sizes (48×80, 52×85, 60×94, 60×96 inches) and custom sizes. You can specify any dimensions you need.' },
    { q: 'Can I order a custom size?', a: 'Yes! Use our Custom Order page to specify your exact dimensions, cotton weight, fabric, color, stitching, and design. We will provide a quote.' },
    { q: 'What payment methods do you accept?', a: 'We accept Cash on Delivery (COD), EasyPaisa, Bank Transfer, and Hand-to-Hand (local pickup). Online payment will be available in the future.' },
    { q: 'Do you deliver outside Hyderabad?', a: 'Yes, we deliver across Pakistan and can ship internationally. Delivery charges depend on your location.' },
    { q: 'How long does production take?', a: 'Made-to-order products typically take 3-7 days. Custom orders may take longer depending on specifications. We will inform you of the estimated time.' },
    { q: 'What is your return policy?', a: 'Due to the handmade and custom nature of our products, returns are handled case by case. Please contact us within 3 days of delivery if you have an issue.' },
    { q: 'How do I track my order?', a: 'You can track your order using the Track Order page with your order number. You will also receive notifications as your order progresses.' },
    { q: 'Do you offer wholesale pricing?', a: 'Yes, we offer wholesale and bulk pricing for businesses, hotels, and bulk orders. Register on our Wholesale page to get started.' },
    { q: 'Is the cotton organic or certified?', a: 'We do not make claims about organic certification or medical benefits. Our cotton is genuine and locally sourced, cleaned by machine and filled by hand.' },
    { q: 'How do I contact Madina Cotton Shop?', a: 'Call or WhatsApp us at 0313 3344068. You can also visit our shop at Latifabad Unit 11, near Tameer Bank, Hyderabad, Sindh, Pakistan.' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="FAQ | Madina Cotton Shop — Handmade Bedding Questions Answered"
        description="Answers about handmade lahaf, razai, gadda, takiya, custom sizes, COD payment, delivery across Pakistan, production time, returns, and wholesale. Madina Cotton Shop, Hyderabad."
        canonicalPath="/faq"
      />
      <Badge color="primary">Help Center</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Frequently Asked Questions</h1>
      <p className="mt-2 text-neutral-500">Find answers to common questions about our products, orders, and services.</p>

      <div className="mt-6 space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="card overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-semibold">{faq.q}</span>
              <ChevronDown size={18} className={`flex-shrink-0 text-neutral-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-neutral-600 dark:text-neutral-300">{faq.a}</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link to="/shipping-policy" className="card p-4 text-center hover:shadow-card">
          <Truck className="mx-auto mb-2 text-primary-600" size={24} />
          <p className="text-sm font-medium">Shipping Policy</p>
        </Link>
        <Link to="/return-policy" className="card p-4 text-center hover:shadow-card">
          <Shield className="mx-auto mb-2 text-primary-600" size={24} />
          <p className="text-sm font-medium">Return Policy</p>
        </Link>
        <a href="https://wa.me/923133344068" target="_blank" rel="noopener noreferrer" className="card p-4 text-center hover:shadow-card">
          <MessageCircle className="mx-auto mb-2 text-primary-600" size={24} />
          <p className="text-sm font-medium">WhatsApp Support</p>
        </a>
      </div>
    </div>
  );
}
