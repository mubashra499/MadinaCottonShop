import { SHOP_INFO } from '@/lib/supabase';

export function buildWhatsAppUrl(message: string): string {
  const phone = SHOP_INFO.phone.replace(/\D/g, '');
  const internationalPhone = phone.startsWith('0') ? '92' + phone.slice(1) : phone;
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}

export function productWhatsAppMessage(productName: string, variantInfo: string, price: string, productUrl: string): string {
  return `Assalamualaikum! I'm interested in this product from Madina Cotton Shop:

*Product:* ${productName}
*Variant:* ${variantInfo}
*Price:* ${price}

Product link: ${productUrl}

I have a question about this product.`;
}

export function customOrderWhatsAppMessage(productType: string, dimensions: string, weight: string, fabric: string, color: string, instructions: string): string {
  return `Assalamualaikum! I'd like to order a custom ${productType} from Madina Cotton Shop.

*Product:* ${productType}
*Dimensions:* ${dimensions}
*Weight:* ${weight}
*Fabric:* ${fabric}
*Color:* ${color}
*Instructions:* ${instructions}

Please provide a quote.`;
}

export function orderWhatsAppMessage(orderNumber: string): string {
  return `Assalamualaikum! I have a question about my order:

*Order:* ${orderNumber}

Please help me with this order.`;
}

export function convertLength(value: number, fromUnit: string, toUnit: string): number {
  // Convert to inches first
  let inches: number;
  switch (fromUnit) {
    case 'feet': inches = value * 12; break;
    case 'cm': inches = value / 2.54; break;
    case 'meters': inches = value * 39.3701; break;
    default: inches = value; // inches
  }
  // Convert from inches to target
  switch (toUnit) {
    case 'feet': return inches / 12;
    case 'cm': return inches * 2.54;
    case 'meters': return inches / 39.3701;
    default: return inches;
  }
}

export function recommendBedSize(bedWidthInches: number, bedLengthInches: number): { lahaf: string; gadda: string; takiya: string } {
  let lahafSize: string;
  if (bedWidthInches <= 48) lahafSize = '48 × 80';
  else if (bedWidthInches <= 52) lahafSize = '52 × 85';
  else if (bedWidthInches <= 60) lahafSize = '60 × 94';
  else lahafSize = '60 × 96';

  const gaddaSize = `${Math.round(bedWidthInches)} × ${Math.round(bedLengthInches)}`;
  const takiyaSize = '18 × 28';

  return { lahaf: lahafSize, gadda: gaddaSize, takiya: takiyaSize };
}
