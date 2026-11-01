import { Link } from '@/lib/router';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui';
import { SHOP_INFO } from '@/lib/supabase';
import { Truck, MapPin, Phone, Package, Clock, MessageCircle } from 'lucide-react';

export function ShippingPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Shipping & Delivery Policy | Madina Cotton Shop — Pakistan"
        description="Delivery across Pakistan from Hyderabad. COD available, free delivery over Rs. 5,000. Local 1-2 days, nationwide 3-5 days, international 7-15 days. Track every order."
        canonicalPath="/shipping-policy"
      />
      <Badge color="primary"><Truck size={12} className="mr-1" /> Shipping Policy</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Delivery & Shipping</h1>

      <div className="mt-6 space-y-6 text-neutral-600 dark:text-neutral-300">
        <div className="card p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200"><MapPin size={20} /> Delivery Areas</h3>
          <ul className="space-y-1 text-sm">
            <li>• <strong>Local Delivery (Hyderabad):</strong> Latifabad, Qasimabad, and other Hyderabad areas — 1-2 days</li>
            <li>• <strong>Nationwide Pakistan:</strong> All cities across Pakistan — 3-5 days</li>
            <li>• <strong>International:</strong> Worldwide shipping available — 7-15 days</li>
            <li>• <strong>Store Pickup:</strong> Available at our workshop in Latifabad, Hyderabad</li>
            <li>• <strong>Hand-to-Hand:</strong> Available for local customers in Hyderabad</li>
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200"><Package size={20} /> Delivery Charges</h3>
          <p className="text-sm">Delivery charges depend on your location (city and area). The exact delivery fee is calculated at checkout based on your delivery address. Free delivery is available for orders above Rs. 5,000 within Pakistan.</p>
        </div>

        <div className="card p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200"><Clock size={20} /> Estimated Delivery Time</h3>
          <ul className="space-y-1 text-sm">
            <li>• In-stock products: 1-3 days (local), 3-5 days (nationwide)</li>
            <li>• Made-to-order products: 3-7 days production + delivery time</li>
            <li>• Custom orders: Production time will be communicated with your quote</li>
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200"><Truck size={20} /> Tracking Your Order</h3>
          <p className="text-sm">Once your order is dispatched, you will receive a tracking number. You can track your order on our <Link to="/track-order" className="text-primary-600">Track Order</Link> page.</p>
        </div>

        <div className="card p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200"><Phone size={20} /> Questions?</h3>
          <p className="text-sm">Call or WhatsApp us at <strong>{SHOP_INFO.phone}</strong> for any delivery questions.</p>
          <a href="https://wa.me/923133344068" target="_blank" rel="noopener noreferrer" className="btn-outline mt-3">
            <MessageCircle size={16} /> WhatsApp Us
          </a>
        </div>
      </div>
    </div>
  );
}
