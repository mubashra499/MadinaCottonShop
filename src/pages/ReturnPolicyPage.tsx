import { Badge } from '@/components/ui';
import { SEO } from '@/components/SEO';
import { SHOP_INFO } from '@/lib/supabase';
import { Shield, RotateCcw, MessageCircle, Phone } from 'lucide-react';

export function ReturnPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Return & Refund Policy | Madina Cotton Shop — Pakistan"
        description="Returns handled case by case within 3 days of delivery. Custom and handmade products explained. Refunds to original payment method; COD refunds via bank transfer or EasyPaisa."
        canonicalPath="/return-policy"
      />
      <Badge color="primary"><Shield size={12} className="mr-1" /> Return Policy</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Returns & Refunds</h1>

      <div className="mt-6 space-y-6 text-neutral-600 dark:text-neutral-300">
        <div className="card p-5">
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200"><RotateCcw size={20} /> Return Eligibility</h3>
          <ul className="space-y-1 text-sm">
            <li>• Due to the handmade and custom nature of our products, returns are handled case by case</li>
            <li>• Please contact us within <strong>3 days</strong> of delivery if you have an issue</li>
            <li>• Products must be unused and in original condition</li>
            <li>• Custom-made products cannot be returned unless there is a manufacturing defect</li>
            <li>• Refunds are processed after inspection of returned items</li>
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-neutral-800 dark:text-neutral-200">How to Request a Return</h3>
          <ol className="space-y-2 text-sm">
            <li>1. Sign in to your account and go to My Orders</li>
            <li>2. Select the order and click "Request Return"</li>
            <li>3. Provide the reason and description of the issue</li>
            <li>4. Our team will review and respond within 1-2 business days</li>
            <li>5. If approved, we will arrange pickup or ask you to return the product</li>
          </ol>
        </div>

        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-neutral-800 dark:text-neutral-200">Refund Process</h3>
          <ul className="space-y-1 text-sm">
            <li>• Refunds are processed after we receive and inspect the returned product</li>
            <li>• Refund is issued to the original payment method</li>
            <li>• For COD orders, refund is processed via bank transfer or EasyPaisa</li>
            <li>• Refund processing time: 5-7 business days</li>
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="mb-2 font-semibold text-neutral-800 dark:text-neutral-200">Contact Us</h3>
          <p className="text-sm">For any return or refund questions, please contact us:</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium"><Phone size={16} /> {SHOP_INFO.phone}</p>
          <a href="https://wa.me/923133344068" target="_blank" rel="noopener noreferrer" className="btn-outline mt-3">
            <MessageCircle size={16} /> WhatsApp Us
          </a>
        </div>
      </div>
    </div>
  );
}
