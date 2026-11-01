# Madina Cotton Shop — Handmade Bedding E-Commerce

A production-ready e-commerce website for Madina Cotton Shop, a traditional handmade cotton bedding and home textile shop in Hyderabad, Sindh, Pakistan. Specializing in lahaf, razai, gadda, takiya, cushions, pillows, and custom bedding.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Backend:** Supabase (PostgreSQL database, authentication, edge functions, storage)
- **Payments:** Cash on Delivery (COD), Bank Transfer, EasyPaisa, JazzCash, Hand-to-Hand

## Features

- **Product Catalog:** Browse products by category with filtering and sorting
- **Product Pages:** Detailed product pages with image galleries, variants, delivery checker, and reviews
- **Shopping Cart:** Add to cart with size/variant selection, quantity adjustment
- **Checkout:** Customer name, phone, city, full address, payment method selection (COD, bank, EasyPaisa, JazzCash)
- **Order Tracking:** Track orders by order number + tracking token
- **Custom Orders:** Design your own bedding with size, weight, filling, fabric, color, stitching, decoration
- **WhatsApp Ordering:** Direct WhatsApp integration with business number +92-313-3344068
- **Admin/Owner Dashboard:** Manage orders, products, inventory, reviews, coupons
- **Customer Accounts:** Order history, custom order tracking, support tickets
- **Wholesale Registration:** B2B bulk order registration
- **SEO:** Per-page titles, meta descriptions, canonical URLs, Open Graph, Product structured data (JSON-LD), Organization structured data, XML sitemap, robots.txt
- **Support Tickets:** In-app customer support messaging
- **Newsletter:** Email subscription
- **Dark Mode:** Full dark mode support

## Prerequisites

- Node.js 18+ and npm
- A Supabase project (free tier works)

## Installation

1. **Clone or extract the project:**
   ```bash
   cd madina-cotton-shop
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your Supabase project URL and anon key:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   VITE_APP_URL=http://localhost:5173
   ```

4. **Apply database migrations:**
   The SQL migration files are in `supabase/migrations/`. Apply them in order (001 through 042) using the Supabase Dashboard SQL Editor or Supabase MCP tools. Each file is numbered sequentially.

5. **Deploy the edge function:**
   The `send-order-email` function in `supabase/functions/send-order-email/` sends email notifications to the shop owner for new orders, custom orders, wholesale registrations, and support tickets. Deploy it via Supabase Dashboard → Edge Functions, or via the Supabase MCP `deploy_edge_functions` tool.

## Running Locally

```bash
npm run dev
```
The site will be available at `http://localhost:5173`.

## Building for Production

```bash
npm run build
```
This generates a `dist/` folder with static files ready to deploy.

To preview the production build:
```bash
npm run preview
```

## Deployment

### Option 1: Bolt.new
The project is built on Bolt.new. Deploy directly from the Bolt interface using the Deploy button.

### Option 2: Netlify / Vercel / Cloudflare Pages
1. Run `npm run build`
2. Deploy the `dist/` folder
3. Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL) in your hosting dashboard
4. The `public/_redirects` file handles SPA routing (all routes serve index.html)

### Option 3: Any static host
Upload the contents of `dist/` to any static hosting provider. Ensure SPA fallback routing is configured (all paths serve index.html).

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |
| `VITE_APP_URL` | Your site URL (for auth redirects) | Recommended |

**Never commit your real `.env` file.** Only `.env.example` with placeholder values is included.

## SEO Setup

### Sitemap
The sitemap is at `public/sitemap.xml` and will be available at `/sitemap.xml` after deployment. Update the domain URLs in this file to match your actual production domain.

### Robots.txt
Located at `public/robots.txt`. Allows crawling of all public pages, disallows owner/admin/account/cart/checkout routes. Update the sitemap URL to your production domain.

### Google Search Console
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your property (your domain URL)
3. Verify ownership via DNS TXT record or HTML file upload
4. Submit your sitemap: `https://your-domain.com/sitemap.xml`
5. Use "Inspect URL" to check your homepage and click "Request Indexing"

## Database Schema

The database includes tables for:
- `profiles` — Customer accounts
- `categories` — Product categories
- `products` — Product catalog with variants, images
- `orders` / `order_items` — Customer orders
- `custom_orders` / `custom_order_images` — Custom bedding requests
- `wholesale_accounts` — B2B registrations
- `support_tickets` / `support_messages` — Customer support
- `reviews` — Product reviews
- `coupons` — Discount codes
- `notifications` — User notifications
- `newsletter_subscribers` — Email list
- `homepage_sections` / `feature_switches` — Content management

All tables have Row Level Security (RLS) enabled with per-user ownership policies.

## Business Information

- **Shop:** Madina Cotton Shop
- **Address:** Latifabad Unit 11, near Tameer Bank, Hyderabad, Sindh, Pakistan
- **Phone/WhatsApp:** +92-313-3344068
- **Hours:** 9 AM – 9 PM (Mon–Sat)

## License

This is a proprietary project for Madina Cotton Shop. All rights reserved.
