import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  canonicalPath?: string;
  jsonLd?: Record<string, unknown>;
}

const SITE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://madinacotton.shop';
const DEFAULT_TITLE = 'Madina Cotton Shop — Handmade Bedding & Home Textiles';
const DEFAULT_DESC = 'Handmade cotton lahaf, razai, gadda, cushions, pillows & custom bedding. Crafted with care in Hyderabad, Sindh, Pakistan.';
const DEFAULT_IMAGE = '/icon-512.png';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.head.querySelector(`script[data-jsonld="${id}"]`) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-jsonld', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  const el = document.head.querySelector(`script[data-jsonld="${id}"]`);
  if (el) el.remove();
}

export function SEO({ title, description, image, canonicalPath, jsonLd }: SEOProps) {
  useEffect(() => {
    const fullTitle = title ?? DEFAULT_TITLE;
    const desc = description ?? DEFAULT_DESC;
    const img = image ?? DEFAULT_IMAGE;
    const canonical = canonicalPath ? `${SITE_URL}${canonicalPath}` : SITE_URL;

    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:image', img.startsWith('http') ? img : `${SITE_URL}${img}`);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', img.startsWith('http') ? img : `${SITE_URL}${img}`);
    setLink('canonical', canonical);

    if (jsonLd) {
      setJsonLd('page', jsonLd);
    } else {
      removeJsonLd('page');
    }

    return () => {
      removeJsonLd('page');
    };
  }, [title, description, image, canonicalPath, jsonLd]);

  return null;
}

export function buildProductJsonLd(product: {
  name: string;
  short_desc?: string | null;
  full_desc?: string | null;
  price: number;
  sale_price?: number | null;
  currency?: string;
  sku?: string | null;
  status?: string;
  avg_rating?: number | null;
  review_count?: number | null;
  product_images?: { url: string }[];
  category?: { name?: string } | null;
}, siteUrl: string) {
  const effectivePrice = product.sale_price && product.sale_price > 0 ? product.sale_price : product.price;
  const image = product.product_images?.[0]?.url;
  const description = product.short_desc ?? product.full_desc ?? '';
  const availability = product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image: image ? (image.startsWith('http') ? image : `${siteUrl}${image}`) : undefined,
    sku: product.sku ?? undefined,
    brand: { '@type': 'Brand', name: 'Madina Cotton Shop' },
    offers: {
      '@type': 'Offer',
      price: effectivePrice,
      priceCurrency: product.currency ?? 'PKR',
      availability,
      url: `${siteUrl}/#/product/${product.name.toLowerCase().replace(/\s+/g, '-')}`,
    },
  };

  if (product.avg_rating && product.avg_rating > 0 && product.review_count && product.review_count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.avg_rating,
      reviewCount: product.review_count,
    };
  }

  return jsonLd;
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}
