import { Badge } from '@/components/ui';
import { SEO } from '@/components/SEO';
import { SHOP_INFO } from '@/lib/supabase';
import { Shield } from 'lucide-react';

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Privacy Policy | Madina Cotton Shop"
        description="How Madina Cotton Shop collects, uses, and protects your personal information including name, phone, address, and order details."
        canonicalPath="/privacy-policy"
      />
      <Badge color="primary"><Shield size={12} className="mr-1" /> Privacy Policy</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p><strong>Madina Cotton Shop</strong> respects your privacy. This policy explains how we collect, use, and protect your information.</p>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Information We Collect</h3>
          <ul className="list-inside list-disc space-y-1">
            <li>Name, phone number, and email address</li>
            <li>Delivery address and order details</li>
            <li>Payment information (for manual verification)</li>
            <li>Custom order specifications and reference images</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">How We Use Your Information</h3>
          <ul className="list-inside list-disc space-y-1">
            <li>To process and deliver your orders</li>
            <li>To communicate about your orders and custom quotes</li>
            <li>To provide customer support</li>
            <li>To improve our products and services</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Data Protection</h3>
          <p>We do not share your personal information with third parties except as necessary for order delivery (courier services). Your payment details are handled securely and never shared.</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Contact</h3>
          <p>For privacy questions, contact us at {SHOP_INFO.phone} or visit our shop at {SHOP_INFO.address}.</p>
        </div>
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Terms & Conditions | Madina Cotton Shop"
        description="Terms for ordering handmade bedding from Madina Cotton Shop. Payments, custom orders, handmade product variations, and contact information."
        canonicalPath="/terms"
      />
      <Badge color="primary">Terms & Conditions</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Terms & Conditions</h1>
      <div className="mt-6 space-y-4 text-sm text-neutral-600 dark:text-neutral-300">
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Orders</h3>
          <p>All orders are subject to product availability. Made-to-order and custom products require production time. We will communicate estimated delivery dates with your order confirmation.</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Payments</h3>
          <p>We accept Cash on Delivery (COD), EasyPaisa, Bank Transfer, and Hand-to-Hand payment. Manual payments require verification before order processing. We never mark a payment as verified without actual confirmation.</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Custom Orders</h3>
          <p>Custom orders are made to your specifications. Once production begins, custom orders cannot be cancelled. Quotes are valid for the period specified in the quote.</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Handmade Products</h3>
          <p>Our products are handmade. Minor variations in size, color, and stitching may occur. These are natural characteristics of handmade products and not defects.</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold text-neutral-800 dark:text-neutral-200">Contact</h3>
          <p>For any questions about these terms, contact us at {SHOP_INFO.phone}.</p>
        </div>
      </div>
    </div>
  );
}
