import { Link } from '@/lib/router';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui';
import { SHOP_INFO } from '@/lib/supabase';
import { Scissors, Sparkles, Package, Check, Truck, Phone, MessageCircle } from 'lucide-react';

export function HowWeMakeItPage() {
  const steps = [
    { icon: Package, title: 'Raw Cotton', desc: 'We source quality raw cotton for our bedding products.' },
    { icon: Sparkles, title: 'Cotton Cleaning & Processing', desc: 'Cotton is cleaned and prepared using machinery to remove impurities and fluff the fibers.' },
    { icon: Scissors, title: 'Cotton Preparation', desc: 'The cleaned cotton is weighed and prepared according to each product requirements.' },
    { icon: Package, title: 'Hand Filling', desc: 'Our craftsmen fill each bedding product by hand, ensuring even distribution of cotton.' },
    { icon: Scissors, title: 'Hand Stitching', desc: 'Every lahaf, gadda, and razai is stitched by hand with care and precision.' },
    { icon: Check, title: 'Hand Finishing', desc: 'Borders, designs, and decorative elements are finished by hand for a premium look.' },
    { icon: Check, title: 'Quality Check', desc: 'Each product passes a thorough quality inspection before packing.' },
    { icon: Package, title: 'Packing', desc: 'Products are carefully packed to maintain quality during delivery.' },
    { icon: Truck, title: 'Delivery', desc: 'We deliver locally in Hyderabad, across Pakistan, and ship worldwide.' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SEO
        title="How We Make Handmade Bedding | Madina Cotton Shop — Hyderabad"
        description="See how Madina Cotton Shop makes handmade lahaf, razai, gadda & takiya in Hyderabad. Cotton cleaned by machine, filled and stitched by hand. Quality checked before delivery."
        canonicalPath="/how-we-make-it"
      />
      <Badge color="primary"><Scissors size={12} className="mr-1" /> Our Workshop</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">How We Make Our Products</h1>
      <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-300">
        At Madina Cotton Shop, cotton is cleaned and prepared using machinery, while our bedding is filled and finished by hand. Every product is crafted with care in our workshop in Hyderabad, Sindh, Pakistan.
      </p>

      <div className="mt-8 rounded-2xl bg-primary-50 p-6 dark:bg-primary-900/20">
        <p className="text-sm font-medium text-primary-700 dark:text-primary-400">Our Promise</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          We do not make false claims about organic certification, medical benefits, or international certifications. Our products are genuinely handmade — cotton cleaned by machine, filled and stitched by hand.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {steps.map((step, i) => (
          <div key={i} className="card flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30">
              <step.icon size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{i + 1}</span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
              </div>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-6 text-center">
        <h3 className="text-lg font-semibold">Visit Our Workshop</h3>
        <p className="mt-2 text-sm text-neutral-500">{SHOP_INFO.address}</p>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm font-medium text-primary-600">
          <Phone size={16} /> {SHOP_INFO.phone}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link to="/custom-order" className="btn-primary"><Scissors size={16} /> Custom Order</Link>
          <a href={`https://wa.me/923133344068`} target="_blank" rel="noopener noreferrer" className="btn-outline">
            <MessageCircle size={16} /> WhatsApp Us
          </a>
        </div>
      </div>
    </div>
  );
}
