import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Category } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { useRouter, navigate } from '@/lib/router';
import { EmptyState, Modal } from '@/components/ui';
import { SlidersHorizontal, X, Search, GitCompare, Check, Sparkles } from 'lucide-react';
import { SIZES, WEIGHTS, FILLINGS, FABRICS, COLORS } from '@/lib/types';
import { sanitizeSearchQuery, cn, formatPrice, getEffectivePrice } from '@/lib/utils';
import { parseIntent } from '@/lib/aiAssistant';
import { SEO } from '@/components/SEO';

export function ShopPage() {
  const route = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const q = route.query.get('q') ?? '';
  const categorySlug = route.query.get('category') ?? '';
  const sort = route.query.get('sort') ?? 'popular';

  const [filters, setFilters] = useState({
    priceMin: '',
    priceMax: '',
    size: '',
    weight: '',
    filling: '',
    fabric: '',
    color: '',
    handmade: false,
    madeToOrder: false,
    inStock: false,
  });
  const [compareList, setCompareList] = useState<string[]>([]);
  const [compareModal, setCompareModal] = useState(false);

  // Load compare list from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('compare_list') ?? '[]') as string[];
      setCompareList(Array.isArray(saved) ? saved : []);
    } catch {
      setCompareList([]);
    }
  }, []);

  const toggleCompare = (productId: string) => {
    setCompareList((prev) => {
      const updated = prev.includes(productId) ? prev.filter((id) => id !== productId) : prev.length < 4 ? [...prev, productId] : prev;
      localStorage.setItem('compare_list', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    supabase.from('categories').select('*').is('parent_id', null).eq('active', true).order('sort_order')
      .then(({ data, error }) => {
        if (error) { console.error('Categories load error:', error.message); return; }
        setCategories((data as Category[]) ?? []);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    let query = supabase.from('products').select('*, category:categories(*), product_images(*), product_variants(*)').eq('status', 'active');

    if (q) {
      const sq = sanitizeSearchQuery(q);
      if (sq) query = query.or(`name.ilike.%${sq}%,short_desc.ilike.%${sq}%,sku.ilike.%${sq}%`);
    }
    if (categorySlug) {
      query = query.eq('category.slug', categorySlug);
    }

    switch (sort) {
      case 'newest': query = query.order('created_at', { ascending: false }); break;
      case 'price-low': query = query.order('price', { ascending: true }); break;
      case 'price-high': query = query.order('price', { ascending: false }); break;
      case 'best-selling': query = query.order('best_seller', { ascending: false }); break;
      case 'rating': query = query.order('avg_rating', { ascending: false }); break;
      default: query = query.order('featured', { ascending: false }).order('created_at', { ascending: false });
    }

    query.then(({ data, error }) => {
      if (error) {
        console.error('Products load error:', error.message);
        setProducts([]);
        setLoadError(true);
        setLoading(false);
        return;
      }
      setLoadError(false);
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    });
  }, [q, categorySlug, sort]);

  const aiIntent = useMemo(() => q ? parseIntent(q) : null, [q]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const effectivePrice = getEffectivePrice(p.price, p.sale_price);
      const minPrice = parseFloat(filters.priceMin) || (aiIntent?.priceMin ?? 0);
      const maxPrice = parseFloat(filters.priceMax) || (aiIntent?.priceMax ?? Infinity);
      if (minPrice && effectivePrice < minPrice) return false;
      if (maxPrice !== Infinity && effectivePrice > maxPrice) return false;
      if (filters.handmade && !p.handmade) return false;
      if (filters.madeToOrder && !p.made_to_order) return false;
      if (filters.inStock && p.stock <= 0 && !p.made_to_order) return false;
      const checkSize = filters.size || (aiIntent?.maxSize ? String(aiIntent.maxSize) : '');
      const checkFilling = filters.filling || aiIntent?.filling || '';
      const checkFabric = filters.fabric || aiIntent?.fabric || '';
      const checkColor = filters.color || aiIntent?.color || '';
      const checkWeight = filters.weight || aiIntent?.weight || '';
      if (checkSize || checkFilling || checkFabric || checkColor || checkWeight) {
        const variants = p.product_variants ?? [];
        const match = variants.some((v) => {
          if (checkSize && v.size_label !== checkSize && !v.size_label?.includes(checkSize)) return false;
          if (checkFilling && v.filling?.toLowerCase() !== checkFilling.toLowerCase()) return false;
          if (checkFabric && v.fabric?.toLowerCase() !== checkFabric.toLowerCase()) return false;
          if (checkColor && v.color?.toLowerCase() !== checkColor.toLowerCase()) return false;
          if (checkWeight && v.weight?.toLowerCase() !== checkWeight.toLowerCase()) return false;
          return true;
        });
        if (!match) return false;
      }
      return true;
    });
  }, [products, filters, aiIntent]);

  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [q, categorySlug, sort, filters]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedProducts = useMemo(() => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filtered, currentPage]);

  const updateFilter = (key: string, value: string | boolean) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ priceMin: '', priceMax: '', size: '', weight: '', filling: '', fabric: '', color: '', handmade: false, madeToOrder: false, inStock: false });
  };

  const activeFilterCount = Object.values(filters).filter((v) => v !== '' && v !== false).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SEO
        title={q ? `Search: ${q} | Madina Cotton Shop` : categorySlug ? `${categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)} | Madina Cotton Shop` : 'Shop All Products | Madina Cotton Shop'}
        description="Shop handmade cotton lahaf, razai, gadda, cushions, pillows & custom bedding. Various sizes, colors, and designs available."
        canonicalPath="/shop"
      />
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">
          {q ? `Search: "${q}"` : categorySlug ? `${categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)}` : 'All Products'}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{filtered.length} products found</p>
        {aiIntent && (aiIntent.priceMax || aiIntent.filling || aiIntent.fabric || aiIntent.color || aiIntent.maxSize) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
            <Sparkles size={12} />
            <span>AI detected:</span>
            {aiIntent.priceMax && <span className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/40">Under {formatPrice(aiIntent.priceMax)}</span>}
            {aiIntent.filling && <span className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/40">{aiIntent.filling} filling</span>}
            {aiIntent.fabric && <span className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/40">{aiIntent.fabric} fabric</span>}
            {aiIntent.color && <span className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/40">{aiIntent.color}</span>}
            {aiIntent.maxSize && <span className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/40">~{aiIntent.maxSize}ft</span>}
          </div>
        )}
      </div>

      {/* Category pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/shop')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!categorySlug ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/shop?category=${c.slug}`)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${categorySlug === c.slug ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className={`${showFilters ? 'fixed inset-0 z-40 overflow-y-auto bg-white p-4 dark:bg-neutral-950' : 'hidden'} lg:relative lg:inset-auto lg:block lg:w-64 lg:flex-shrink-0`}>
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <h2 className="text-lg font-semibold">Filters</h2>
            <button onClick={() => setShowFilters(false)}><X size={20} /></button>
          </div>

          <div className="space-y-5">
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Clear all ({activeFilterCount})
              </button>
            )}

            <FilterGroup title="Price (Rs.)">
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={filters.priceMin} onChange={(e) => updateFilter('priceMin', e.target.value)} className="input py-1.5 text-sm" />
                <input type="number" placeholder="Max" value={filters.priceMax} onChange={(e) => updateFilter('priceMax', e.target.value)} className="input py-1.5 text-sm" />
              </div>
            </FilterGroup>

            <FilterGroup title="Size">
              <select value={filters.size} onChange={(e) => updateFilter('size', e.target.value)} className="input py-1.5 text-sm">
                <option value="">All sizes</option>
                {SIZES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </FilterGroup>

            <FilterGroup title="Weight">
              <select value={filters.weight} onChange={(e) => updateFilter('weight', e.target.value)} className="input py-1.5 text-sm">
                <option value="">All weights</option>
                {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </FilterGroup>

            <FilterGroup title="Filling">
              <select value={filters.filling} onChange={(e) => updateFilter('filling', e.target.value)} className="input py-1.5 text-sm">
                <option value="">All fillings</option>
                {FILLINGS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </FilterGroup>

            <FilterGroup title="Fabric">
              <select value={filters.fabric} onChange={(e) => updateFilter('fabric', e.target.value)} className="input py-1.5 text-sm">
                <option value="">All fabrics</option>
                {FABRICS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </FilterGroup>

            <FilterGroup title="Color">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => updateFilter('color', filters.color === c.name ? '' : c.name)}
                    title={c.name}
                    className={`h-7 w-7 rounded-full border-2 transition ${filters.color === c.name ? 'border-primary-600 ring-2 ring-primary-500/30' : 'border-neutral-200 dark:border-neutral-700'}`}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </FilterGroup>

            <FilterGroup title="Other">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={filters.handmade} onChange={(e) => updateFilter('handmade', e.target.checked)} className="rounded" />
                  Handmade only
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={filters.madeToOrder} onChange={(e) => updateFilter('madeToOrder', e.target.checked)} className="rounded" />
                  Made to order
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={filters.inStock} onChange={(e) => updateFilter('inStock', e.target.checked)} className="rounded" />
                  In stock only
                </label>
              </div>
            </FilterGroup>
          </div>
        </aside>

        {/* Products grid */}
        <div className="flex-1">
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setShowFilters(true)} className="btn-outline lg:hidden">
              <SlidersHorizontal size={16} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
            <div className="hidden lg:block" />
            <select
              value={sort}
              onChange={(e) => navigate(`/shop?${categorySlug ? `category=${categorySlug}&` : ''}${q ? `q=${q}&` : ''}sort=${e.target.value}`)}
              className="input w-auto py-1.5 text-sm"
            >
              <option value="popular">Popular</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Best Rated</option>
              <option value="best-selling">Best Selling</option>
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {[...Array(6)].map((_, i) => <div key={i} className="card aspect-[3/4] skeleton" />)}
            </div>
          ) : loadError ? (
            <EmptyState icon={<Search size={48} />} title="Could not load products" message="Something went wrong. Please try refreshing the page." action={<button onClick={() => window.location.reload()} className="btn-primary">Refresh</button>} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Search size={48} />} title="No products found" message="Try adjusting your filters or search terms." />
          ) : (
            <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {pagedProducts.map((p) => (
                <div key={p.id} className="relative">
                  <ProductCard product={p} />
                  <button
                    onClick={() => toggleCompare(p.id)}
                    className={cn(
                      'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition',
                      compareList.includes(p.id) ? 'bg-primary-600 text-white' : 'bg-white/90 text-neutral-500 hover:bg-white dark:bg-neutral-900/90'
                    )}
                    title="Compare"
                  >
                    {compareList.includes(p.id) ? <Check size={16} /> : <GitCompare size={16} />}
                  </button>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => { setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === 1}
                  className="btn-outline px-3 py-1.5 text-sm disabled:opacity-30"
                >First</button>
                <button
                  onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === 1}
                  className="btn-outline px-3 py-1.5 text-sm disabled:opacity-30"
                >Prev</button>
                <span className="px-3 text-sm text-neutral-500">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === totalPages}
                  className="btn-outline px-3 py-1.5 text-sm disabled:opacity-30"
                >Next</button>
                <button
                  onClick={() => { setCurrentPage(totalPages); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={currentPage === totalPages}
                  className="btn-outline px-3 py-1.5 text-sm disabled:opacity-30"
                >Last</button>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Compare bar */}
      {compareList.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-card dark:border-neutral-700 dark:bg-neutral-900">
          <span className="text-sm font-medium">{compareList.length} selected to compare</span>
          <button onClick={() => setCompareModal(true)} className="btn-primary text-sm" disabled={compareList.length < 2}>Compare Now</button>
          <button onClick={() => { setCompareList([]); localStorage.setItem('compare_list', '[]'); }} className="btn-ghost text-sm">Clear</button>
        </div>
      )}

      {/* Compare modal */}
      {compareModal && (
        <CompareModal productIds={compareList} products={products} onClose={() => setCompareModal(false)} />
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">{title}</h3>
      {children}
    </div>
  );
}

function CompareModal({ productIds, products, onClose }: { productIds: string[]; products: Product[]; onClose: () => void }) {
  const compareProducts = products.filter((p) => productIds.includes(p.id));
  const specs = [
    { key: 'price', label: 'Price', get: (p: Product) => formatPrice(getEffectivePrice(p.price, p.sale_price), p.currency) },
    { key: 'sale_price', label: 'Sale Price', get: (p: Product) => p.sale_price ? formatPrice(p.sale_price, p.currency) : '—' },
    { key: 'stock', label: 'Stock', get: (p: Product) => p.made_to_order ? 'Made to Order' : String(p.stock) },
    { key: 'category', label: 'Category', get: (p: Product) => p.category?.name ?? '—' },
    { key: 'handmade', label: 'Handmade', get: (p: Product) => p.handmade ? 'Yes' : 'No' },
    { key: 'made_to_order', label: 'Made to Order', get: (p: Product) => p.made_to_order ? 'Yes' : 'No' },
    { key: 'customizable', label: 'Customizable', get: (p: Product) => p.customizable ? 'Yes' : 'No' },
    { key: 'premium', label: 'Premium', get: (p: Product) => p.premium ? 'Yes' : 'No' },
    { key: 'production_time', label: 'Production Time', get: (p: Product) => p.production_time ?? '—' },
    { key: 'variants', label: 'Variants', get: (p: Product) => String(p.product_variants?.length ?? 0) },
    { key: 'rating', label: 'Rating', get: (p: Product) => p.avg_rating > 0 ? `${p.avg_rating} (${p.review_count})` : 'No reviews' },
    { key: 'sku', label: 'SKU', get: (p: Product) => p.sku ?? '—' },
  ];

  return (
    <Modal open={true} onClose={onClose} title="Product Comparison" maxWidth="max-w-4xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left font-semibold text-neutral-500">Specification</th>
              {compareProducts.map((p) => (
                <th key={p.id} className="p-3 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-16 w-16 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      {p.product_images?.[0] && <img src={p.product_images[0].url} alt={p.name} className="h-full w-full object-cover" />}
                    </div>
                    <span className="line-clamp-1 max-w-[120px] text-xs font-semibold">{p.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specs.map((spec, i) => (
              <tr key={spec.key} className={cn(i % 2 === 0 ? 'bg-neutral-50 dark:bg-neutral-900' : '')}>
                <td className="p-3 font-medium text-neutral-600 dark:text-neutral-400">{spec.label}</td>
                {compareProducts.map((p) => (
                  <td key={p.id} className="p-3 text-center">{spec.get(p)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-3"></td>
              {compareProducts.map((p) => (
                <td key={p.id} className="p-3 text-center">
                  <button onClick={() => { navigate(`/product/${p.slug}`); onClose(); }} className="btn-primary text-xs">View Product</button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
