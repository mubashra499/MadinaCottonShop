import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import { getEffectivePrice, formatPrice } from '@/lib/utils';

export interface AIResponse {
  text: string;
  products?: Product[];
  suggestions?: string[];
}

export interface ParsedIntent {
  productType?: string;
  maxSize?: number;
  priceMax?: number;
  priceMin?: number;
  filling?: string;
  fabric?: string;
  color?: string;
  weight?: string;
  design?: string;
  inStockOnly?: boolean;
  sort?: 'price-low' | 'price-high' | 'rating' | 'newest';
}

const PRODUCT_TYPE_KEYWORDS: Record<string, string[]> = {
  gadda: ['gadda', 'mattress', 'mattresses', 'bed cushion'],
  takiya: ['takiya', 'pillow', 'pillows', 'takiye'],
  razai: ['razai', 'quilt', 'quilts', 'blanket quilt'],
  lahaf: ['lahaf', 'comforter', 'duvet'],
  bedsheet: ['bedsheet', 'bed sheet', 'bedsheets', 'sheets', 'fitted sheet'],
  blanket: ['blanket', 'blankets', 'kambal'],
  bedding: ['bedding', 'bed set', 'bed set'],
};

const FILLING_KEYWORDS: Record<string, string[]> = {
  cotton: ['cotton', 'kapas', 'naram cotton'],
  foam: ['foam', 'sponge'],
  feather: ['feather', 'pakh', 'down'],
  polyester: ['polyester', 'fiber', 'fiberfill', 'hollow fiber'],
  wool: ['wool', 'oon'],
  silk: ['silk', 'resham'],
};

const FABRIC_KEYWORDS: Record<string, string[]> = {
  cotton: ['cotton', 'kapas'],
  silk: ['silk', 'resham'],
  velvet: ['velvet', 'makhmal'],
  flannel: ['flannel', 'warm'],
  polyester: ['polyester'],
  jacquard: ['jacquard'],
};

const COLOR_KEYWORDS: Record<string, string[]> = {
  white: ['white', 'safed', 'safaid'],
  black: ['black', 'kaala', 'kala'],
  blue: ['blue', 'neela', 'neela'],
  red: ['red', 'laal'],
  green: ['green', 'hara', 'sabz'],
  brown: ['brown', 'bhura', 'bhoora'],
  grey: ['grey', 'gray', 'surmai'],
  maroon: ['maroon', 'maaroon', 'dark red'],
  pink: ['pink', 'gulabi'],
  beige: ['beige', 'cream', 'off white'],
  navy: ['navy', 'dark blue', 'nehru blue'],
  yellow: ['yellow', 'peela', 'zardi'],
  orange: ['orange', 'narangi'],
  purple: ['purple', 'jamuni'],
};

const WEIGHT_KEYWORDS: Record<string, string[]> = {
  light: ['light', 'halka', 'halki', 'lightweight', 'thin'],
  medium: ['medium', 'mamooli'],
  heavy: ['heavy', 'bhari', 'bhari', 'thick', 'gaarha'],
  extra_heavy: ['extra heavy', 'bohot bhari', 'extra thick'],
};

const SIZE_PATTERNS: RegExp[] = [
  /(\d+)\s*[x×*]\s*(\d+)/i,
  /(\d+)\s*(?:ft|feet|foot)\s*[x×*]\s*(\d+)\s*(?:ft|feet|foot)?/i,
  /(\d+)\s*(?:by|x)\s*(\d+)/i,
];

const SIZE_LABEL_MAP: Record<string, string[]> = {
  '4x6': ['4 × 6', '4x6', '4x6 ft', 'small'],
  '5x6': ['5 × 6', '5x6', '5x6 ft'],
  '6x6': ['6 × 6', '6x6', '6x6 ft', 'king'],
  '6x7': ['6 × 7', '6x7', '6x7 ft', 'queen'],
  'single': ['single', 'solo'],
  'double': ['double', 'double bed'],
  'king': ['king', 'king size', 'large'],
  'queen': ['queen', 'queen size'],
};

export function parseIntent(query: string): ParsedIntent {
  const q = query.toLowerCase().trim();
  const intent: ParsedIntent = {};

  // Product type
  for (const [type, keywords] of Object.entries(PRODUCT_TYPE_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      intent.productType = type;
      break;
    }
  }

  // Price range
  const underMatch = q.match(/(?:under|below|se kam|max|tak)\s*(?:rs\.?\s*|pkr\s*)?(\d[\d,]*)/);
  if (underMatch) intent.priceMax = parseInt(underMatch[1].replace(/,/g, ''));

  const overMatch = q.match(/(?:over|above|se zyada|min|se)\s*(?:rs\.?\s*|pkr\s*)?(\d[\d,]*)/);
  if (overMatch) intent.priceMin = parseInt(overMatch[1].replace(/,/g, ''));

  // Also match standalone budget like "15000 ke andar"
  const andarMatch = q.match(/(\d[\d,]*)\s*(?:ke andar|tak|se kam)/);
  if (andarMatch && !intent.priceMax) intent.priceMax = parseInt(andarMatch[1].replace(/,/g, ''));

  // Size from numeric patterns
  for (const pattern of SIZE_PATTERNS) {
    const m = q.match(pattern);
    if (m) {
      intent.maxSize = Math.max(parseInt(m[1]), parseInt(m[2]));
      break;
    }
  }

  // Size from label keywords
  if (!intent.maxSize) {
    for (const [label, keywords] of Object.entries(SIZE_LABEL_MAP)) {
      if (keywords.some((kw) => q.includes(kw))) {
        if (label === 'king' || label === '6x6') intent.maxSize = 6;
        else if (label === 'queen' || label === '6x7') intent.maxSize = 7;
        else if (label === '5x6') intent.maxSize = 6;
        else if (label === '4x6') intent.maxSize = 6;
        break;
      }
    }
  }

  // Filling
  for (const [filling, keywords] of Object.entries(FILLING_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      intent.filling = filling.charAt(0).toUpperCase() + filling.slice(1);
      break;
    }
  }

  // Fabric
  for (const [fabric, keywords] of Object.entries(FABRIC_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      intent.fabric = fabric.charAt(0).toUpperCase() + fabric.slice(1);
      break;
    }
  }

  // Color
  for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      intent.color = color.charAt(0).toUpperCase() + color.slice(1);
      break;
    }
  }

  // Weight
  for (const [weight, keywords] of Object.entries(WEIGHT_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      intent.weight = weight.charAt(0).toUpperCase() + weight.slice(1);
      break;
    }
  }

  // In stock
  if (q.includes('stock') || q.includes('available') || q.includes('mujhe') || q.includes('chahiye')) {
    intent.inStockOnly = true;
  }

  // Sort
  if (q.includes('cheapest') || q.includes('sasta') || q.includes('lowest price')) intent.sort = 'price-low';
  else if (q.includes('expensive') || q.includes('premium') || q.includes('best quality')) intent.sort = 'price-high';
  else if (q.includes('best rated') || q.includes('top rated') || q.includes('review')) intent.sort = 'rating';
  else if (q.includes('new') || q.includes('latest')) intent.sort = 'newest';

  return intent;
}

export async function searchProductsByIntent(intent: ParsedIntent): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*, category:categories(*), product_images(*), product_variants(*)')
    .eq('status', 'active');

  const { data, error } = await query.order('featured', { ascending: false }).order('created_at', { ascending: false }).limit(50);

  if (error || !data) return [];

  let results = data as Product[];

  // Product type filter (match by category or name)
  if (intent.productType) {
    const typeKeywords = PRODUCT_TYPE_KEYWORDS[intent.productType] ?? [intent.productType];
    results = results.filter((p) => {
      const nameLower = p.name.toLowerCase();
      const catName = (p.category as { name?: string } | null)?.name?.toLowerCase() ?? '';
      return typeKeywords.some((kw) => nameLower.includes(kw) || catName.includes(kw));
    });
  }

  // Price filter
  results = results.filter((p) => {
    const price = getEffectivePrice(p.price, p.sale_price);
    if (intent.priceMin && price < intent.priceMin) return false;
    if (intent.priceMax && price > intent.priceMax) return false;
    return true;
  });

  // Variant-based filters
  if (intent.filling || intent.fabric || intent.color || intent.weight) {
    results = results.filter((p) => {
      const variants = p.product_variants ?? [];
      return variants.some((v) => {
        if (intent.filling && v.filling?.toLowerCase() !== intent.filling.toLowerCase()) return false;
        if (intent.fabric && v.fabric?.toLowerCase() !== intent.fabric.toLowerCase()) return false;
        if (intent.color && v.color?.toLowerCase() !== intent.color.toLowerCase()) return false;
        if (intent.weight && v.weight?.toLowerCase() !== intent.weight.toLowerCase()) return false;
        return true;
      });
    });
  }

  // Size filter
  if (intent.maxSize) {
    results = results.filter((p) => {
      const variants = p.product_variants ?? [];
      const hasMatchingSize = variants.some((v) => {
        const w = Number(v.width) || 0;
        const l = Number(v.length) || 0;
        if (w === intent.maxSize && l === intent.maxSize) return true;
        if (w === intent.maxSize) return true;
        if (l === intent.maxSize) return true;
        const label = (v.size_label ?? '').toLowerCase();
        if (label.includes(`${intent.maxSize}x${intent.maxSize}`) || label.includes(`${intent.maxSize} × ${intent.maxSize}`)) return true;
        return false;
      });
      return hasMatchingSize || variants.length === 0;
    });
  }

  // In stock filter
  if (intent.inStockOnly) {
    results = results.filter((p) => p.stock > 0 || p.made_to_order);
  }

  // Sort
  if (intent.sort === 'price-low') {
    results.sort((a, b) => getEffectivePrice(a.price, a.sale_price) - getEffectivePrice(b.price, b.sale_price));
  } else if (intent.sort === 'price-high') {
    results.sort((a, b) => getEffectivePrice(b.price, b.sale_price) - getEffectivePrice(a.price, a.sale_price));
  } else if (intent.sort === 'rating') {
    results.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
  } else if (intent.sort === 'newest') {
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return results.slice(0, 6);
}

function formatProductLine(p: Product): string {
  const price = getEffectivePrice(p.price, p.sale_price);
  const hasSale = p.sale_price && p.sale_price < p.price;
  const stock = p.stock > 0 ? `Stock: ${p.stock}` : p.made_to_order ? 'Made to order' : 'Out of stock';
  return `• ${p.name} — ${formatPrice(price)}${hasSale ? ' (on sale!)' : ''} — ${stock}`;
}

export async function handleCustomerQuery(query: string): Promise<AIResponse> {
  const q = query.toLowerCase().trim();

  if (!q || q.length < 2) {
    return { text: 'Please tell me what you\'re looking for. For example: "I need a 6x6 cotton gadda under 15000."', suggestions: ['Show me all products', 'What\'s on sale?', 'I need a soft takiya'] };
  }

  const intent = parseIntent(q);
  const products = await searchProductsByIntent(intent);

  if (products.length === 0) {
    return {
      text: `I couldn't find products matching your request. Try adjusting your requirements — for example, remove the price limit or try a different size. You can also browse all products or ask for a custom order.`,
      suggestions: ['Browse all products', 'Custom order', 'What sizes are available?'],
    };
  }

  let text = `I found ${products.length} product${products.length > 1 ? 's' : ''} for you:\n\n`;
  text += products.map(formatProductLine).join('\n');

  const hasFilters = intent.productType || intent.priceMax || intent.filling || intent.fabric || intent.color || intent.maxSize;
  if (hasFilters) {
    text += '\n\nWould you like more details on any of these?';
  }

  return { text, products, suggestions: ['Show details', 'Find something cheaper', 'Show more options'] };
}

export async function getSmartSearchFilters(query: string): Promise<{ intent: ParsedIntent; text: string }> {
  const intent = parseIntent(query);
  const parts: string[] = [];
  if (intent.productType) parts.push(intent.productType);
  if (intent.color) parts.push(intent.color);
  if (intent.filling) parts.push(`${intent.filling} filling`);
  if (intent.fabric) parts.push(`${intent.fabric} fabric`);
  if (intent.weight) parts.push(`${intent.weight} weight`);
  if (intent.priceMax) parts.push(`under ${formatPrice(intent.priceMax)}`);
  if (intent.maxSize) parts.push(`~${intent.maxSize}ft`);
  const text = parts.length > 0 ? `AI filtered: ${parts.join(' · ')}` : 'AI could not parse specific filters — showing all results';
  return { intent, text };
}

export function recommendSimilarProducts(currentProduct: Product, allProducts: Product[], limit = 4): Product[] {
  return allProducts
    .filter((p) => p.id !== currentProduct.id && p.status === 'active')
    .map((p) => {
      let score = 0;
      if (p.category_id === currentProduct.category_id) score += 3;
      const currentVariants = currentProduct.product_variants ?? [];
      const pVariants = p.product_variants ?? [];
      const sharedFilling = currentVariants.some((v) => pVariants.some((pv) => pv.filling === v.filling));
      if (sharedFilling) score += 2;
      const sharedFabric = currentVariants.some((v) => pVariants.some((pv) => pv.fabric === v.fabric));
      if (sharedFabric) score += 2;
      const sharedSize = currentVariants.some((v) => pVariants.some((pv) => pv.size_label === v.size_label));
      if (sharedSize) score += 1;
      const priceDiff = Math.abs(getEffectivePrice(p.price, p.sale_price) - getEffectivePrice(currentProduct.price, currentProduct.sale_price));
      if (priceDiff < 500) score += 2;
      else if (priceDiff < 2000) score += 1;
      if (p.handmade && currentProduct.handmade) score += 1;
      return { product: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.product);
}

export function recommendBudgetAlternative(currentProduct: Product, allProducts: Product[]): Product | null {
  const currentPrice = getEffectivePrice(currentProduct.price, currentProduct.sale_price);
  const candidates = allProducts
    .filter((p) => p.id !== currentProduct.id && p.status === 'active')
    .filter((p) => p.category_id === currentProduct.category_id)
    .filter((p) => getEffectivePrice(p.price, p.sale_price) < currentPrice)
    .sort((a, b) => getEffectivePrice(b.price, b.sale_price) - getEffectivePrice(a.price, a.sale_price));
  return candidates[0] ?? null;
}

export function recommendPremiumAlternative(currentProduct: Product, allProducts: Product[]): Product | null {
  const currentPrice = getEffectivePrice(currentProduct.price, currentProduct.sale_price);
  const candidates = allProducts
    .filter((p) => p.id !== currentProduct.id && p.status === 'active')
    .filter((p) => p.category_id === currentProduct.category_id)
    .filter((p) => getEffectivePrice(p.price, p.sale_price) > currentPrice)
    .sort((a, b) => getEffectivePrice(a.price, a.sale_price) - getEffectivePrice(b.price, b.sale_price));
  return candidates[0] ?? null;
}

export function recommendMatchingBedding(currentProduct: Product, allProducts: Product[]): Product[] {
  const currentCat = (currentProduct.category as { name?: string } | null)?.name?.toLowerCase() ?? '';
  const complementaryTypes: Record<string, string[]> = {
    gadda: ['takiya', 'bedsheet', 'lahaf', 'razai'],
    mattress: ['takiya', 'bedsheet', 'lahaf', 'razai'],
    takiya: ['gadda', 'bedsheet', 'lahaf'],
    lahaf: ['gadda', 'takiya', 'bedsheet'],
    razai: ['gadda', 'takiya', 'bedsheet'],
    bedsheet: ['gadda', 'takiya', 'lahaf'],
  };

  const targetType = PRODUCT_TYPE_KEYWORDS[currentProduct.category_id ? '' : ''] ?? [];
  void targetType;

  const currentTypeName = Object.entries(PRODUCT_TYPE_KEYWORDS).find(([, kws]) =>
    kws.some((kw) => currentCat.includes(kw) || currentProduct.name.toLowerCase().includes(kw))
  )?.[0];

  const complementary = currentTypeName ? complementaryTypes[currentTypeName] ?? [] : [];
  if (complementary.length === 0) return [];

  return allProducts
    .filter((p) => p.id !== currentProduct.id && p.status === 'active')
    .filter((p) => {
      const pCat = (p.category as { name?: string } | null)?.name?.toLowerCase() ?? '';
      return complementary.some((ct) => {
        const kws = PRODUCT_TYPE_KEYWORDS[ct] ?? [ct];
        return kws.some((kw) => pCat.includes(kw) || p.name.toLowerCase().includes(kw));
      });
    })
    .slice(0, 4);
}

export async function findClosestSize(bedWidth: number, bedLength: number, unit: string = 'ft', productId?: string): Promise<{
  exactMatch: boolean;
  matchedVariant: { size_label: string; width: number | null; length: number | null; price: number; stock: number } | null;
  message: string;
  suggestCustom: boolean;
}> {
  let query = supabase.from('product_variants').select(`
    id, size_label, width, length, unit, price, sale_price, stock,
    product:products(id, name, slug, customizable, made_to_order, status)
  `).eq('active', true);

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data, error } = await query;
  if (error || !data) return { exactMatch: false, matchedVariant: null, message: 'Could not search sizes. Please try again.', suggestCustom: false };

  const variants = data.filter((v) => {
    const p = v.product as unknown as { status?: string };
    return p?.status === 'active';
  });

  const w = bedWidth;
  const l = bedLength;

  let exact = variants.find((v) => Number(v.width) === w && Number(v.length) === l);
  if (!exact) exact = variants.find((v) => Number(v.width) === w || Number(v.length) === l);

  if (exact) {
    const p = exact.product as unknown as { name?: string };
    return {
      exactMatch: Number(exact.width) === w && Number(exact.length) === l,
      matchedVariant: {
        size_label: exact.size_label ?? `${exact.width} × ${exact.length}`,
        width: Number(exact.width) || null,
        length: Number(exact.length) || null,
        price: exact.sale_price ? Number(exact.sale_price) : Number(exact.price),
        stock: exact.stock,
      },
      message: `${Number(exact.width) === w && Number(exact.length) === l ? 'Exact match found' : 'Close match found'}: ${p?.name ?? 'Product'} — ${exact.size_label ?? `${exact.width} × ${exact.length}`}.`,
      suggestCustom: false,
    };
  }

  const customizableProducts = variants.filter((v) => {
    const p = v.product as unknown as { customizable?: boolean; made_to_order?: boolean };
    return p?.customizable || p?.made_to_order;
  });

  if (customizableProducts.length > 0) {
    const p = customizableProducts[0].product as unknown as { name?: string; slug?: string };
    return {
      exactMatch: false,
      matchedVariant: null,
      message: `No exact match for ${w} × ${l} ${unit}. However, we offer custom-sized products! "${p?.name ?? 'This product'}" can be made to your specifications.`,
      suggestCustom: true,
    };
  }

  return {
    exactMatch: false,
    matchedVariant: null,
    message: `No exact match found for ${w} × ${l} ${unit}. Please contact us for a custom order — we may be able to make it for you.`,
    suggestCustom: true,
  };
}

export async function getOwnerBusinessInsight(query: string, orders: import('@/lib/types').Order[], products: Product[], expenses: import('@/lib/types').Expense[]): Promise<string> {
  const q = query.toLowerCase().trim();

  if (q.includes('sale') || q.includes('revenue') || q.includes('income')) {
    const now = new Date();
    const thisMonth = orders.filter((o) => o.created_at.slice(0, 7) === now.toISOString().slice(0, 7) && o.status !== 'cancelled');
    const lastMonth = orders.filter((o) => {
      const d = new Date(o.created_at);
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.toISOString().slice(0, 7) === lm.toISOString().slice(0, 7) && o.status !== 'cancelled';
    });
    const monthRev = thisMonth.reduce((s, o) => s + o.total, 0);
    const lastRev = lastMonth.reduce((s, o) => s + o.total, 0);
    const change = lastRev > 0 ? ((monthRev - lastRev) / lastRev * 100).toFixed(1) : 'N/A';
    return `Sales this month: ${formatPrice(monthRev)} from ${thisMonth.length} orders.\nLast month: ${formatPrice(lastRev)} from ${lastMonth.length} orders.\nChange: ${change}%`;
  }

  if (q.includes('best') && (q.includes('sell') || q.includes('product'))) {
    const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const o of orders.filter((o) => o.status !== 'cancelled')) {
      for (const item of o.order_items ?? []) {
        const key = item.product_name;
        if (!productSales[key]) productSales[key] = { name: item.product_name, qty: 0, revenue: 0 };
        productSales[key].qty += item.quantity;
        productSales[key].revenue += Number(item.unit_price) * item.quantity;
      }
    }
    const top = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);
    if (top.length === 0) return 'No sales data available yet.';
    return `Best-selling products:\n` + top.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} sold, ${formatPrice(p.revenue)} revenue`).join('\n');
  }

  if (q.includes('low stock') || q.includes('restock') || q.includes('lowStock')) {
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold);
    const outOfStock = products.filter((p) => p.stock === 0 && !p.made_to_order);
    if (lowStock.length === 0 && outOfStock.length === 0) return 'All products are well-stocked.';
    let msg = '';
    if (lowStock.length > 0) msg += `Low stock (${lowStock.length}):\n` + lowStock.map((p) => `• ${p.name} — ${p.stock} left (threshold: ${p.low_stock_threshold})`).join('\n') + '\n\n';
    if (outOfStock.length > 0) msg += `Out of stock (${outOfStock.length}):\n` + outOfStock.map((p) => `• ${p.name}`).join('\n') + '\n\n';
    msg += 'Recommendation: Restock the items above, especially best-sellers.';
    return msg;
  }

  if (q.includes('not selling') || q.includes('slow') || q.includes('dead stock')) {
    const productSales: Record<string, number> = {};
    for (const o of orders.filter((o) => o.status !== 'cancelled')) {
      for (const item of o.order_items ?? []) {
        productSales[item.product_name] = (productSales[item.product_name] ?? 0) + item.quantity;
      }
    }
    const slow = products.filter((p) => (productSales[p.name] ?? 0) === 0 && p.status === 'active');
    if (slow.length === 0) return 'All active products have had sales.';
    return `Products with no sales (${slow.length}):\n` + slow.slice(0, 10).map((p) => `• ${p.name} — Stock: ${p.stock}, Price: ${formatPrice(p.price)}`).join('\n') + `\n\nSuggestion: Consider promoting these, reducing prices, or archiving if they remain unsold.`;
  }

  if (q.includes('profit') || q.includes('margin')) {
    const withCost = products.filter((p) => p.cost_price && Number(p.cost_price) > 0);
    if (withCost.length === 0) return 'No cost price data available. Add cost prices to products to see profit analysis.';
    const productSales: Record<string, { revenue: number; cost: number; qty: number }> = {};
    for (const o of orders.filter((o) => o.status !== 'cancelled')) {
      for (const item of o.order_items ?? []) {
        const prod = products.find((p) => p.id === item.product_id);
        if (!prod?.cost_price) continue;
        if (!productSales[prod.name]) productSales[prod.name] = { revenue: 0, cost: 0, qty: 0 };
        productSales[prod.name].revenue += Number(item.unit_price) * item.quantity;
        productSales[prod.name].cost += Number(prod.cost_price) * item.quantity;
        productSales[prod.name].qty += item.quantity;
      }
    }
    const profitable = Object.entries(productSales).map(([name, d]) => ({ name, profit: d.revenue - d.cost, margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue * 100).toFixed(1) : '0', ...d })).sort((a, b) => b.profit - a.profit).slice(0, 5);
    if (profitable.length === 0) return 'No sales with cost data available for profit analysis.';
    return `Top profit products:\n` + profitable.map((p, i) => `${i + 1}. ${p.name} — Profit: ${formatPrice(p.profit)}, Margin: ${p.margin}%`).join('\n');
  }

  if (q.includes('cancel')) {
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    return `Cancelled orders: ${cancelled.length} out of ${orders.length} total (${orders.length > 0 ? (cancelled.length / orders.length * 100).toFixed(1) : 0}%)`;
  }

  if (q.includes('delay') || q.includes('late')) {
    const delayed = orders.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status) && new Date(o.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    if (delayed.length === 0) return 'No delayed orders. All active orders are within 7 days.';
    return `Potentially delayed orders (${delayed.length} — older than 7 days, not delivered):\n` + delayed.slice(0, 5).map((o) => `• ${o.order_number} — ${o.customer_name} — ${o.status} — ${formatPrice(o.total)}`).join('\n');
  }

  if (q.includes('size') && (q.includes('popular') || q.includes('common'))) {
    const sizeCount: Record<string, number> = {};
    for (const o of orders.filter((o) => o.status !== 'cancelled')) {
      for (const item of o.order_items ?? []) {
        if (item.size_label) sizeCount[item.size_label] = (sizeCount[item.size_label] ?? 0) + item.quantity;
      }
    }
    const top = Object.entries(sizeCount).sort(([, a], [, b]) => b - a).slice(0, 5);
    if (top.length === 0) return 'No size data from orders yet.';
    return `Most popular sizes:\n` + top.map(([size, qty], i) => `${i + 1}. ${size} — ${qty} sold`).join('\n');
  }

  if (q.includes('color') || q.includes('design')) {
    const colorCount: Record<string, number> = {};
    const designCount: Record<string, number> = {};
    for (const o of orders.filter((o) => o.status !== 'cancelled')) {
      for (const item of o.order_items ?? []) {
        if (item.color) colorCount[item.color] = (colorCount[item.color] ?? 0) + item.quantity;
        if (item.design) designCount[item.design] = (designCount[item.design] ?? 0) + item.quantity;
      }
    }
    const topColors = Object.entries(colorCount).sort(([, a], [, b]) => b - a).slice(0, 3);
    const topDesigns = Object.entries(designCount).sort(([, a], [, b]) => b - a).slice(0, 3);
    let msg = '';
    if (topColors.length > 0) msg += `Popular colors:\n` + topColors.map(([c, q]) => `• ${c} — ${q} sold`).join('\n') + '\n\n';
    if (topDesigns.length > 0) msg += `Popular designs:\n` + topDesigns.map(([d, q]) => `• ${d} — ${q} sold`).join('\n');
    return msg || 'No color/design data from orders yet.';
  }

  if (q.includes('promote') || q.includes('marketing')) {
    const productSales: Record<string, number> = {};
    for (const o of orders.filter((o) => o.status !== 'cancelled')) {
      for (const item of o.order_items ?? []) {
        productSales[item.product_name] = (productSales[item.product_name] ?? 0) + item.quantity;
      }
    }
    const highStock = products.filter((p) => p.stock > 10 && (productSales[p.name] ?? 0) < 2 && p.status === 'active');
    if (highStock.length === 0) return 'No specific promotion recommendations. Best-sellers are selling well.';
    return `Products to promote (high stock, low sales):\n` + highStock.slice(0, 5).map((p) => `• ${p.name} — Stock: ${p.stock}, Price: ${formatPrice(p.price)}`).join('\n') + `\n\nThese have good inventory but slow sales. Consider a discount or social media promotion.`;
  }

  return `I can help with: sales, best sellers, low stock, slow movers, profit, cancellations, delayed orders, popular sizes/colors, restock suggestions, and promotion ideas. Ask me any of these!`;
}

export function analyzeReviews(reviews: import('@/lib/types').Review[]): { positive: string[]; negative: string[]; themes: string[]; alert?: string } {
  const positive: string[] = [];
  const negative: string[] = [];
  const themes: string[] = [];

  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'comfortable', 'soft', 'quality', 'beautiful', 'perfect', 'happy', 'best', 'nice', 'durable'];
  const negativeWords = ['bad', 'poor', 'broken', 'damaged', 'rough', 'hard', 'uncomfortable', 'cheap', 'thin', 'torn', 'stitching', 'smell', 'color faded', 'disappointed'];

  const complaintKeywords: Record<string, string[]> = {
    'Stitching quality': ['stitching', 'stitch', 'seam', 'thread', 'sewn'],
    'Fabric quality': ['fabric', 'material', 'cloth', 'rough'],
    'Color mismatch': ['color', 'colour', 'faded', 'different color'],
    'Size issue': ['size', 'small', 'large', 'big', 'short', 'narrow'],
    'Durability': ['durability', 'tore', 'ripped', 'damaged', 'fell apart'],
  };

  const complaintCount: Record<string, number> = {};

  for (const r of reviews) {
    const text = (r.body ?? '').toLowerCase();
    if (positiveWords.some((w) => text.includes(w))) positive.push(r.body ?? '');
    if (negativeWords.some((w) => text.includes(w))) negative.push(r.body ?? '');

    for (const [theme, keywords] of Object.entries(complaintKeywords)) {
      if (keywords.some((kw) => text.includes(kw))) {
        complaintCount[theme] = (complaintCount[theme] ?? 0) + 1;
      }
    }
  }

  for (const [theme, count] of Object.entries(complaintCount)) {
    themes.push(`${theme}: ${count} mention${count > 1 ? 's' : ''}`);
  }

  const topComplaint = Object.entries(complaintCount).sort(([, a], [, b]) => b - a)[0];
  const alert = topComplaint && topComplaint[1] >= 3 ? `Several customers mentioned ${topComplaint[0]}. Consider reviewing this aspect of your products.` : undefined;

  return { positive, negative, themes, alert };
}

export function generateProductDescription(productSpec: {
  name: string;
  fabric?: string;
  filling?: string;
  weight?: string;
  color?: string;
  size?: string;
  handmade?: boolean;
  premium?: boolean;
}): { shortDesc: string; fullDesc: string; highlights: string[]; seoTitle: string; metaDesc: string; keywords: string[] } {
  const features: string[] = [];
  if (productSpec.handmade) features.push('handmade');
  if (productSpec.premium) features.push('premium');
  if (productSpec.fabric) features.push(productSpec.fabric + ' fabric');
  if (productSpec.filling) features.push(productSpec.filling + ' filling');
  if (productSpec.weight) features.push(productSpec.weight + ' weight');
  if (productSpec.color) features.push(productSpec.color);

  const highlights: string[] = [];
  if (productSpec.handmade) highlights.push('Handcrafted by skilled artisans');
  if (productSpec.fabric) highlights.push(`Made with ${productSpec.fabric} fabric`);
  if (productSpec.filling) highlights.push(`Filled with ${productSpec.filling} for comfort`);
  if (productSpec.premium) highlights.push('Premium quality materials');
  if (productSpec.weight) highlights.push(`${productSpec.weight} weight for year-round comfort`);
  if (productSpec.color) highlights.push(`Available in ${productSpec.color}`);

  const shortDesc = `${productSpec.name} — ${features.slice(0, 3).join(', ')}. ${productSpec.handmade ? 'Handmade with care.' : 'Quality you can trust.'}`;
  const fullDesc = `${productSpec.name} is ${features.length > 0 ? features.join(', ') : 'a quality bedding product'}${productSpec.size ? ` in ${productSpec.size} size` : ''}. ${productSpec.handmade ? 'Each piece is carefully handmade by our skilled artisans, ensuring attention to every detail. ' : ''}${productSpec.filling ? `The ${productSpec.filling} filling provides excellent comfort and support. ` : ''}${productSpec.fabric ? `The ${productSpec.fabric} fabric is soft, durable, and easy to maintain. ` : ''}Perfect for a good night's sleep.`;

  const seoTitle = `${productSpec.name} - ${features.slice(0, 2).join(' & ')} | Buy Online in Pakistan`;
  const metaDesc = `Buy ${productSpec.name} online. ${features.join(', ')}. ${productSpec.handmade ? 'Handmade ' : ''}quality bedding at the best price in Pakistan. Free delivery available.`;
  const keywords = [productSpec.name.toLowerCase(), 'bedding', 'pakistan', ...(productSpec.fabric ? [productSpec.fabric.toLowerCase()] : []), ...(productSpec.filling ? [productSpec.filling.toLowerCase()] : []), ...(productSpec.handmade ? ['handmade'] : []), ...(productSpec.color ? [productSpec.color.toLowerCase()] : [])];

  return { shortDesc, fullDesc, highlights, seoTitle, metaDesc, keywords };
}

export function generateMarketingContent(product: Product, platform: 'whatsapp' | 'facebook' | 'instagram'): string {
  const price = getEffectivePrice(product.price, product.sale_price);
  const hasSale = product.sale_price && product.sale_price < product.price;
  const features: string[] = [];
  if (product.handmade) features.push('Handmade');
  if (product.premium) features.push('Premium Quality');
  if (product.best_seller) features.push('Best Seller');
  const variants = product.product_variants ?? [];
  const fillings = [...new Set(variants.map((v) => v.filling).filter(Boolean))].slice(0, 2);
  if (fillings.length > 0) features.push(`${fillings.join('/')} Filling`);

  switch (platform) {
    case 'whatsapp':
      return `🛏️ ${product.name}\n\n${features.join(' | ')}\n\n${hasSale ? `Was: Rs. ${product.price}\nNow: Rs. ${price}\nSave ${Math.round((1 - Number(product.sale_price) / product.price) * 100)}%!` : `Price: Rs. ${price}`}\n\nOrder now: ${typeof window !== 'undefined' ? window.location.origin : ''}/product/${product.slug}\n\nDelivery available across Pakistan!`;
    case 'facebook':
      return `Looking for quality bedding? Check out our ${product.name}!\n\n${features.join(' • ')}\n\n${hasSale ? `🔥 SALE: Rs. ${price} (was Rs. ${product.price})` : `Price: Rs. ${price}`}\n\nVisit our store to order. Delivery available nationwide.\n\n#Bedding #Pakistan #${product.handmade ? 'Handmade' : 'Quality'} #HomeDecor`;
    case 'instagram':
      return `✨ ${product.name} ✨\n\n${features.join(' | ')}\n${hasSale ? `💰 SALE: Rs. ${price}` : `Price: Rs. ${price}`}\n\nLink in bio to shop! 🛍️\n\n#${product.handmade ? 'Handmade' : 'Bedding'} #Pakistan #HomeDecor #BeddingSet #QualitySleep`;
  }
}
