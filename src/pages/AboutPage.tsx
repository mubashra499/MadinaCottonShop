import { Link } from '@/lib/router';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui';
import { Scissors, Truck, Shield, Phone, MapPin, Package } from 'lucide-react';
import { SHOP_INFO } from '@/lib/supabase';

export function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SEO
        title="About Us | Madina Cotton Shop — Handmade Bedding in Pakistan"
        description="Learn about Madina Cotton Shop in Hyderabad, Sindh — handmade cotton lahaf, razai, gadda, cushions & pillows. Traditional craftsmanship, custom sizes, COD nationwide."
        canonicalPath="/about"
      />
      <Badge color="primary">About Us</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Madina Cotton Shop</h1>
      <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-300">
        A traditional handmade cotton bedding and home textile shop in Hyderabad, Sindh, Pakistan. We specialize in lahaf, razai, gadda, cushions, pillows, and custom bedding — all crafted by hand with pure cotton.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <Scissors className="mb-3 text-primary-600" size={28} />
          <h3 className="text-lg font-semibold">Handmade Craft</h3>
          <p className="mt-1 text-sm text-neutral-500">Every product is handcrafted with care. Minor variations in size, color, and stitching reflect the handmade nature.</p>
        </div>
        <div className="card p-6">
          <Package className="mb-3 text-primary-600" size={28} />
          <h3 className="text-lg font-semibold">Custom Orders</h3>
          <p className="mt-1 text-sm text-neutral-500">Choose your size, weight, filling, fabric, color, stitching, and decoration. We build it to your specifications.</p>
        </div>
        <div className="card p-6">
          <Truck className="mb-3 text-primary-600" size={28} />
          <h3 className="text-lg font-semibold">Delivery & Payment</h3>
          <p className="mt-1 text-sm text-neutral-500">Cash on Delivery, Bank Transfer, EasyPaisa, and hand-to-hand pickup. Local and nationwide delivery.</p>
        </div>
        <div className="card p-6">
          <Shield className="mb-3 text-primary-600" size={28} />
          <h3 className="text-lg font-semibold">Quality Checked</h3>
          <p className="mt-1 text-sm text-neutral-500">Every product passes quality control before packing and delivery.</p>
        </div>
      </div>

      <div className="mt-8 card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><MapPin size={20} /> Visit Our Shop</h3>
        <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
          <p>{SHOP_INFO.address}</p>
          <p className="flex items-center gap-2"><Phone size={16} /> {SHOP_INFO.phone}</p>
        </div>
        <Link to="/contact" className="btn-primary mt-4">Contact Us</Link>
      </div>
    </div>
  );
}
