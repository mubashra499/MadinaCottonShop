import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, ProductVariant, ProductImage, Review, Question } from '@/lib/types';
import { useRouter, navigate, Link } from '@/lib/router';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice, getEffectivePrice, getStockStatus, cn, formatDate } from '@/lib/utils';
import { Badge, StarRating, Modal, EmptyState, Spinner } from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { ImageGallery } from '@/components/product/ImageGallery';
import { DeliveryChecker } from '@/components/product/DeliveryChecker';
import { StickyAddToBag } from '@/components/product/StickyAddToBag';
import {
  ShoppingBag, Heart, Scissors, ChevronLeft, ChevronRight, MessageCircle,
  Minus, Plus, Truck, Shield, Package, Check, Share2, Bell, ThumbsUp, Flag,
  Star, ChevronDown, Ruler, Layers, Sparkles, BookOpen, ClipboardList,
} from 'lucide-react';
import { productWhatsAppMessage, buildWhatsAppUrl } from '@/lib/whatsapp';
import { recommendSimilarProducts, recommendBudgetAlternative, recommendPremiumAlternative, recommendMatchingBedding } from '@/lib/aiAssistant';
import { SEO, buildProductJsonLd, buildBreadcrumbJsonLd } from '@/components/SEO';

type Tab = 'description' | 'specifications' | 'reviews' | 'questions' | 'shipping';

export function ProductPage() {
  const route = useRouter();
  const slug = useMemo(() => {
    const raw = route.path.split('/product/')[1] ?? '';
    return raw.split('?')[0].split('#')[0];
  }, [route.path]);
  const { addItem } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>('description');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [adding, setAdding] = useState(false);
  const [addedToast, setAddedToast] = useState(false);
  const [wished, setWished] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [reviewForm, setReviewForm] = useState({ rating: 5, body: '' });
  const [related, setRelated] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [backInStockAlert, setBackInStockAlert] = useState(false);
  const [alertSubmitted, setAlertSubmitted] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 5 | 4 | 3 | 2 | 1 | 'photos'>('all');
  const [reviewSort, setReviewSort] = useState<'newest' | 'highest' | 'lowest' | 'helpful'>('newest');

  // ---- Data loading ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setProduct(null);
      setSelectedVariant(null);
      setSelectedDesign(null);
      setSelectedImage('');
      setReviews([]);
      setQuestions([]);
      setRelated([]);
      setRecentlyViewed([]);
      setWished(false);
      setBackInStockAlert(false);
      setAlertSubmitted(false);
      setQuantity(1);
      setActiveTab('description');
      setAddedToast(false);
      try {
        const { data, error: queryError } = await supabase
          .from('products')
          .select('*, category:categories(*), product_images(*), product_variants(*), product_videos(*)')
          .eq('slug', slug)
          .maybeSingle();
        if (queryError) throw new Error(queryError.message);
        const p = data as Product | null;
        if (cancelled) return;
        setProduct(p);

        if (p) {
          // Recently viewed
          try {
            const viewed = JSON.parse(localStorage.getItem('recently_viewed') ?? '[]') as string[];
            const updated = [p.slug, ...viewed.filter((s) => s !== p.slug)].slice(0, 8);
            localStorage.setItem('recently_viewed', JSON.stringify(updated));

            if (updated.length > 1) {
              const { data: rv } = await supabase
                .from('products')
                .select('*, category:categories(*), product_images(*), product_variants(*), product_videos(*)')
                .eq('status', 'active')
                .in('slug', updated.slice(1))
                .limit(4);
              if (!cancelled) setRecentlyViewed((rv as Product[]) ?? []);
            }
          } catch { /* localStorage may be unavailable */ }

          // Back-in-stock alert check
          if (user && p.stock === 0 && !p.made_to_order) {
            const { data: existing } = await supabase
              .from('back_in_stock_alerts')
              .select('id')
              .eq('product_id', p.id)
              .eq('user_id', user.id)
              .eq('notified', false)
              .maybeSingle();
            if (!cancelled) setBackInStockAlert(!!existing);
          }

          // Auto-select first variant
          const variants = (p.product_variants ?? []).filter((v) => v.active);
          if (variants.length > 0) {
            setSelectedVariant(variants[0]);
            if (variants[0].design) setSelectedDesign(variants[0].design);
          }

          // Reviews + questions
          const [revRes, qRes] = await Promise.all([
            supabase
              .from('reviews')
              .select('*, profiles(full_name), review_images(image_url)')
              .eq('product_id', p.id)
              .eq('approved', true)
              .order('created_at', { ascending: false }),
            supabase
              .from('questions')
              .select('*')
              .eq('product_id', p.id)
              .eq('approved', true)
              .order('created_at', { ascending: false }),
          ]);
          if (!cancelled) {
            setReviews((revRes.data as Review[]) ?? []);
            setQuestions((qRes.data as Question[]) ?? []);
          }

          // Wishlist
          if (user) {
            const { data: w } = await supabase
              .from('wishlists')
              .select('id')
              .eq('user_id', user.id)
              .eq('product_id', p.id)
              .maybeSingle();
            if (!cancelled) setWished(!!w);
          }

          // Related products
          const relQuery = supabase
            .from('products')
            .select('*, category:categories(*), product_images(*), product_variants(*), product_videos(*)')
            .eq('status', 'active')
            .neq('id', p.id)
            .limit(20);
          if (p.category_id) relQuery.eq('category_id', p.category_id);
          const { data: rel } = await relQuery;
          const relProducts = (rel as Product[]) ?? [];
          if (!cancelled) {
            const similar = recommendSimilarProducts(p, relProducts, 4);
            setRelated(similar.length > 0 ? similar : relProducts.slice(0, 4));
          }
        }
      } catch (err) {
        console.error('ProductPage load error:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, user]);

  // ---- Derived data ----
  const variants = useMemo(
    () => (product?.product_variants ?? []).filter((v) => v.active),
    [product]
  );

  const designs = useMemo(() => {
    const d = [...new Set(variants.map((v) => v.design).filter(Boolean))] as string[];
    return d;
  }, [variants]);

  const designVariants = useMemo(
    () => (selectedDesign ? variants.filter((v) => v.design === selectedDesign) : variants),
    [variants, selectedDesign]
  );

  const colors = useMemo(
    () => [...new Set(designVariants.map((v) => v.color).filter(Boolean))] as string[],
    [designVariants]
  );

  const galleryImages = useMemo(() => {
    if (!product?.product_images) return [];
    const imgs = [...product.product_images].sort((a, b) => a.sort_order - b.sort_order);
    return imgs;
  }, [product]);

  const effectivePrice = selectedVariant
    ? getEffectivePrice(selectedVariant.price, selectedVariant.sale_price)
    : getEffectivePrice(product?.price ?? 0, product?.sale_price ?? null);

  const currentStock = selectedVariant?.stock ?? product?.stock ?? 0;
  const stockStatus = getStockStatus(
    currentStock,
    product?.low_stock_threshold ?? 0,
    product?.made_to_order ?? false
  );

  const isOutOfStock = currentStock === 0 && !product?.made_to_order;
  const maxQty = product?.made_to_order ? 99 : Math.max(1, currentStock);

  const filteredReviews = useMemo(() => {
    let r = [...reviews];
    if (reviewFilter === 'photos') {
      r = r.filter((rv) => rv.review_images && rv.review_images.length > 0);
    } else if (reviewFilter !== 'all') {
      r = r.filter((rv) => rv.rating === reviewFilter);
    }
    r.sort((a, b) => {
      if (reviewSort === 'highest') return b.rating - a.rating;
      if (reviewSort === 'lowest') return a.rating - b.rating;
      if (reviewSort === 'helpful') return (b.helpful_count ?? 0) - (a.helpful_count ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return r;
  }, [reviews, reviewFilter, reviewSort]);

  // ---- Handlers ----
  const handleAddToCart = async () => {
    if (!user) { navigate('/auth'); return; }
    setAdding(true);
    const result = await addItem(product!.id, selectedVariant?.id ?? null, quantity);
    setAdding(false);
    if (result.error) { alert(result.error); return; }
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  };

  const handleBuyNow = async () => {
    if (!user) { navigate('/auth'); return; }
    setAdding(true);
    const result = await addItem(product!.id, selectedVariant?.id ?? null, quantity);
    setAdding(false);
    if (result.error) { alert(result.error); return; }
    navigate('/checkout');
  };

  const toggleWishlist = async () => {
    if (!user) { navigate('/auth'); return; }
    if (wished) {
      await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', product!.id);
      setWished(false);
    } else {
      await supabase.from('wishlists').insert({ user_id: user.id, product_id: product!.id });
      setWished(true);
    }
  };

  const selectDesign = (design: string) => {
    setSelectedDesign(design);
    const dVariants = variants.filter((v) => v.design === design);
    if (dVariants.length > 0) setSelectedVariant(dVariants[0]);
  };

  const selectColor = (color: string) => {
    const variant = designVariants.find((v) => v.color === color);
    if (variant) setSelectedVariant(variant);
  };

  const selectVariant = (v: ProductVariant) => {
    setSelectedVariant(v);
    if (v.design && v.design !== selectedDesign) setSelectedDesign(v.design);
    if (v.color) {
      // color already handled
    }
  };

  const submitReview = async () => {
    if (!user || !reviewForm.body.trim()) return;
    setSubmittingReview(true);
    const { error } = await supabase.from('reviews').insert({
      product_id: product!.id,
      user_id: user.id,
      rating: reviewForm.rating,
      body: reviewForm.body.trim(),
    });
    setSubmittingReview(false);
    if (error) { alert('Could not submit review: ' + error.message); return; }
    setReviewModal(false);
    setReviewForm({ rating: 5, body: '' });
    alert('Review submitted successfully!');
  };

  const submitQuestion = async () => {
    if (!user || !questionText.trim()) return;
    const { error } = await supabase.from('questions').insert({
      product_id: product!.id,
      user_id: user.id,
      question: questionText,
    });
    if (error) { alert('Could not submit question: ' + error.message); return; }
    setQuestionText('');
    alert('Question submitted! It will appear after it is answered.');
  };

  const markHelpful = async (reviewId: string) => {
    if (!user) return;
    await supabase.from('review_helpful_votes').insert({ review_id: reviewId, user_id: user.id });
  };

  const reportReview = async (reviewId: string) => {
    if (!user) return;
    const reason = window.prompt('Reason for report:');
    if (!reason) return;
    const { error } = await supabase.from('review_reports').insert({ review_id: reviewId, reporter_id: user.id, reason });
    if (error) { alert('Could not submit report. Please try again.'); return; }
    alert('Report submitted. Thank you.');
  };

  // ---- Render: Loading skeleton ----
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 h-4 w-48 skeleton rounded" />
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <div className="aspect-square skeleton rounded-2xl" />
            <div className="mt-3 flex gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 w-20 skeleton rounded-xl" />)}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-8 w-3/4 skeleton rounded" />
            <div className="h-4 w-1/2 skeleton rounded" />
            <div className="h-8 w-1/3 skeleton rounded" />
            <div className="h-4 w-full skeleton rounded" />
            <div className="h-4 w-full skeleton rounded" />
            <div className="h-12 w-full skeleton rounded-xl" />
            <div className="h-12 w-full skeleton rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Error ----
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="card p-8 text-center">
          <h2 className="mb-2 text-xl font-bold text-neutral-900 dark:text-white">Could not load product</h2>
          <p className="mb-4 text-sm text-neutral-500">{error}</p>
          <div className="flex justify-center gap-3">
            <Link to="/shop" className="btn-primary">Back to Shop</Link>
            <button onClick={() => window.location.reload()} className="btn-outline">Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Not found ----
  if (!product) {
    return (
      <EmptyState
        title="Product not found"
        message="This product may have been removed."
        action={<Link to="/shop" className="btn-primary">Back to Shop</Link>}
      />
    );
  }

  // ---- At a Glance features ----
  const atAGlance: string[] = [];
  if (product.handmade) atAGlance.push('100% Handmade');
  if (product.premium) atAGlance.push('Premium Quality');
  if (selectedVariant?.filling) atAGlance.push(`${selectedVariant.filling} filling`);
  if (selectedVariant?.fabric) atAGlance.push(`${selectedVariant.fabric} cover`);
  if (product.made_to_order) atAGlance.push('Made to order');
  if (atAGlance.length === 0 && product.short_desc) atAGlance.push('Quality checked');
  if (atAGlance.length < 5) atAGlance.push('Made in Pakistan');

  // ---- Specifications ----
  const specs: { label: string; value: string }[] = [];
  if (selectedVariant?.size_label) specs.push({ label: 'Size', value: selectedVariant.size_label });
  if (selectedVariant?.width && selectedVariant?.length) {
    specs.push({ label: 'Dimensions', value: `${selectedVariant.width} × ${selectedVariant.length} ${selectedVariant.unit ?? 'inches'}` });
  }
  if (selectedVariant?.weight) specs.push({ label: 'Weight', value: selectedVariant.weight });
  if (selectedVariant?.filling) specs.push({ label: 'Fill Type', value: selectedVariant.filling });
  if (selectedVariant?.fabric) specs.push({ label: 'Cover Material', value: selectedVariant.fabric });
  if (selectedVariant?.color) specs.push({ label: 'Color', value: selectedVariant.color });
  if (selectedVariant?.design) specs.push({ label: 'Design', value: selectedVariant.design });
  if (selectedVariant?.stitching) specs.push({ label: 'Stitching', value: selectedVariant.stitching });
  if (selectedVariant?.decoration && selectedVariant.decoration !== 'None') {
    specs.push({ label: 'Decoration', value: selectedVariant.decoration });
  }
  if (product.production_time) specs.push({ label: 'Production Time', value: product.production_time });
  if (product.sku) specs.push({ label: 'SKU', value: product.sku });

  const hasDiscount = product.sale_price && product.sale_price > 0 && product.sale_price < product.price;
  const discountPct = hasDiscount ? Math.round((1 - (Number(product.sale_price) / Number(product.price))) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:pb-8">
      <SEO
        title={product ? `${product.name} | Madina Cotton Shop` : undefined}
        description={product?.short_desc ?? product?.full_desc?.slice(0, 160) ?? undefined}
        image={product?.product_images?.[0]?.url}
        canonicalPath={`/product/${slug}`}
        jsonLd={product ? buildProductJsonLd(product, typeof window !== 'undefined' ? window.location.origin : 'https://madinacotton.shop') : undefined}
      />
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-neutral-500">
        <Link to="/" className="hover:text-primary-600">Home</Link>
        <ChevronRight size={14} />
        <Link to="/shop" className="hover:text-primary-600">Shop</Link>
        {product.category && (
          <>
            <ChevronRight size={14} />
            <Link to={`/shop?category=${product.category.slug}`} className="hover:text-primary-600">{product.category.name}</Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="truncate text-neutral-700 dark:text-neutral-300">{product.name}</span>
      </nav>

      {/* Main grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Image Gallery */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ImageGallery images={galleryImages} productName={product.name} videos={product.product_videos ?? []} />
        </div>

        {/* Right: Product Info */}
        <div className="space-y-5">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {product.handmade && <Badge color="primary">Handmade</Badge>}
            {product.made_to_order && <Badge color="amber">Made to Order</Badge>}
            {product.customizable && <Badge color="accent">Customizable</Badge>}
            {product.premium && <Badge color="primary">Premium</Badge>}
            {product.is_new && <Badge color="accent">New</Badge>}
            {hasDiscount && <Badge color="red">{discountPct}% OFF</Badge>}
          </div>

          {/* Title + actions */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl font-bold leading-tight md:text-3xl">{product.name}</h1>
              <div className="flex flex-shrink-0 gap-2">
                <button
                  onClick={toggleWishlist}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border transition',
                    wished ? 'border-red-300 text-red-600' : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700'
                  )}
                  aria-label="Toggle wishlist"
                >
                  <Heart size={20} fill={wished ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) navigator.share({ title: product.name, url: window.location.href });
                    else { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition hover:border-neutral-300 dark:border-neutral-700"
                  aria-label="Share product"
                >
                  <Share2 size={20} />
                </button>
              </div>
            </div>

            {/* Rating */}
            <div className="mt-2 flex items-center gap-3">
              {product.avg_rating > 0 ? (
                <>
                  <StarRating rating={product.avg_rating} />
                  <span className="text-sm text-neutral-500">{Number(product.avg_rating).toFixed(1)} ({product.review_count} reviews)</span>
                </>
              ) : (
                <span className="text-sm text-neutral-400">No reviews yet</span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary-700 dark:text-primary-400">
              {formatPrice(effectivePrice, product.currency)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-lg text-neutral-400 line-through">{formatPrice(product.price, product.currency)}</span>
                <span className="text-sm font-semibold text-green-600">Save {discountPct}%</span>
              </>
            )}
          </div>

          {/* Short description */}
          {product.short_desc && (
            <p className="text-neutral-600 dark:text-neutral-300">{product.short_desc}</p>
          )}

          {/* Design selector */}
          {designs.length > 1 && (
            <div>
              <label className="label">Design: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{selectedDesign ?? 'Select'}</span></label>
              <div className="flex flex-wrap gap-2">
                {designs.map((d) => (
                  <button
                    key={d}
                    onClick={() => selectDesign(d)}
                    className={cn(
                      'rounded-xl border-2 px-4 py-2 text-sm font-medium transition',
                      selectedDesign === d
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color selector */}
          {colors.length > 0 && (
            <div>
              <label className="label">Color: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{selectedVariant?.color ?? 'Select'}</span></label>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => {
                  const variant = designVariants.find((v) => v.color === color);
                  return (
                    <button
                      key={color}
                      onClick={() => selectColor(color)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition',
                        selectedVariant?.color === color
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'
                      )}
                    >
                      {variant?.color_hex && (
                        <span className="h-4 w-4 rounded-full border border-neutral-300" style={{ background: variant.color_hex }} />
                      )}
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size/variant selector */}
          {designVariants.length > 0 && (
            <div>
              <label className="label">Size & Weight:</label>
              <div className="flex flex-wrap gap-2">
                {designVariants.map((v) => {
                  const vStock = getStockStatus(v.stock, product.low_stock_threshold, product.made_to_order);
                  const vOutOfStock = v.stock === 0 && !product.made_to_order;
                  return (
                    <button
                      key={v.id}
                      onClick={() => selectVariant(v)}
                      disabled={vOutOfStock}
                      className={cn(
                        'rounded-xl border-2 px-4 py-2.5 text-sm transition',
                        selectedVariant?.id === v.id
                          ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700',
                        vOutOfStock && 'cursor-not-allowed opacity-40'
                      )}
                    >
                      <span className="font-medium">{v.size_label ?? 'Standard'}</span>
                      {v.width && v.length && (
                        <span className="block text-xs text-neutral-500">{v.width} × {v.length} {v.unit}</span>
                      )}
                      {v.weight && <span className="block text-xs text-neutral-500">{v.weight}</span>}
                      <span className="block text-xs font-medium text-primary-600">
                        {formatPrice(getEffectivePrice(v.price, v.sale_price), product.currency)}
                      </span>
                      {vOutOfStock && <span className="block text-xs text-red-500">Out of stock</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Variant details */}
          {selectedVariant && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
              {selectedVariant.filling && <Detail label="Filling" value={selectedVariant.filling} />}
              {selectedVariant.fabric && <Detail label="Fabric" value={selectedVariant.fabric} />}
              {selectedVariant.design && <Detail label="Design" value={selectedVariant.design} />}
              {selectedVariant.stitching && <Detail label="Stitching" value={selectedVariant.stitching} />}
              {selectedVariant.decoration && selectedVariant.decoration !== 'None' && (
                <Detail label="Decoration" value={selectedVariant.decoration} />
              )}
              {selectedVariant.weight && <Detail label="Weight" value={selectedVariant.weight} />}
            </div>
          )}

          {/* Stock + production */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={cn('flex items-center gap-1.5 font-medium', stockStatus.color)}>
              <Check size={16} /> {stockStatus.label}
            </span>
            {product.production_time && (
              <span className="flex items-center gap-1.5 text-neutral-500">
                <Package size={16} /> Production: {product.production_time}
              </span>
            )}
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <div className="flex items-center rounded-xl border border-neutral-300 dark:border-neutral-700">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2.5 text-neutral-500 hover:text-neutral-700"
                aria-label="Decrease quantity"
              >
                <Minus size={16} />
              </button>
              <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                disabled={quantity >= maxQty}
                className="px-3 py-2.5 text-neutral-500 hover:text-neutral-700 disabled:opacity-30"
                aria-label="Increase quantity"
              >
                <Plus size={16} />
              </button>
            </div>
            {currentStock > 0 && currentStock <= 5 && !product.made_to_order && (
              <span className="text-sm font-medium text-amber-600">Only {currentStock} left!</span>
            )}
          </div>

          {/* Desktop Add to Bag / Buy Now */}
          <div className="hidden gap-3 lg:flex">
            <button
              onClick={handleAddToCart}
              disabled={adding || isOutOfStock}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition',
                isOutOfStock ? 'cursor-not-allowed bg-neutral-300 text-neutral-500' : 'bg-primary-600 text-white hover:bg-primary-700'
              )}
            >
              {adding ? 'Adding...' : isOutOfStock ? 'Out of Stock' : <><ShoppingBag size={18} /> Add to Bag</>}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={adding || isOutOfStock}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3.5 text-sm font-bold transition',
                isOutOfStock ? 'cursor-not-allowed border-neutral-200 text-neutral-400' : 'border-primary-600 text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20'
              )}
            >
              Buy Now
            </button>
          </div>

          {/* Toast */}
          {addedToast && (
            <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-lg">
              Added to Bag ✓
            </div>
          )}

          {/* Customize link */}
          {product.customizable && (
            <Link
              to="/custom-order"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-300 py-3 text-sm font-medium text-primary-700 hover:bg-primary-50 dark:border-primary-800 dark:text-primary-400 dark:hover:bg-primary-900/20"
            >
              <Scissors size={18} /> Customize This Product
            </Link>
          )}

          {/* WhatsApp */}
          <a
            href={buildWhatsAppUrl(productWhatsAppMessage(
              product.name,
              [selectedVariant?.size_label, selectedVariant?.weight, selectedVariant?.color, selectedVariant?.filling].filter(Boolean).join(' · ') || 'Standard',
              formatPrice(effectivePrice, product.currency),
              window.location.href
            ))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition hover:bg-green-50 dark:hover:bg-green-900/20"
            style={{ borderColor: '#25D366', color: '#25D366' }}
          >
            <MessageCircle size={18} /> Ask on WhatsApp
          </a>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-neutral-50 p-4 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Truck size={22} className="text-primary-600" />
              COD & Delivery
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Shield size={22} className="text-primary-600" />
              Quality Checked
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <MessageCircle size={22} className="text-primary-600" />
              Chat with Shop
            </div>
          </div>

          {/* Delivery checker */}
          <DeliveryChecker />
        </div>
      </div>

      {/* ---- Below sections ---- */}
      <div className="mt-12 space-y-6">
        {/* At a Glance */}
        {atAGlance.length > 0 && (
          <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <Sparkles size={20} className="text-primary-600" /> At a Glance
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {atAGlance.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <Check size={16} className="flex-shrink-0 text-green-600" />
                  {f}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Collapsible sections */}
        <div className="space-y-3">
          {/* Description */}
          <AccordionSection
            title="Description"
            icon={<BookOpen size={20} className="text-primary-600" />}
            defaultOpen={true}
          >
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <p>{product.full_desc ?? product.short_desc}</p>
              {product.handmade_info && (
                <div className="rounded-xl bg-primary-50 p-4 text-sm dark:bg-primary-900/20">
                  <p className="font-medium text-primary-700 dark:text-primary-400">Handmade Information</p>
                  <p className="mt-1">{product.handmade_info}</p>
                </div>
              )}
              {product.care_instructions && (
                <div>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">Care Instructions</p>
                  <p className="mt-1">{product.care_instructions}</p>
                </div>
              )}
            </div>
          </AccordionSection>

          {/* Specifications */}
          {specs.length > 0 && (
            <AccordionSection
              title="Specifications"
              icon={<ClipboardList size={20} className="text-primary-600" />}
              defaultOpen={true}
            >
              <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
                <table className="w-full text-sm">
                  <tbody>
                    {specs.map((s, i) => (
                      <tr key={i} className={cn(i % 2 === 0 && 'bg-neutral-50 dark:bg-neutral-800/50')}>
                        <td className="w-1/3 p-3 font-medium text-neutral-600 dark:text-neutral-400">{s.label}</td>
                        <td className="p-3 text-neutral-800 dark:text-neutral-200">{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AccordionSection>
          )}

          {/* Reviews */}
          <AccordionSection
            title={`Reviews & Ratings (${reviews.length})`}
            icon={<Star size={20} className="text-primary-600" />}
            defaultOpen={false}
          >
            <ReviewsSection
              reviews={reviews}
              filteredReviews={filteredReviews}
              product={product}
              user={user}
              reviewFilter={reviewFilter}
              setReviewFilter={setReviewFilter}
              reviewSort={reviewSort}
              setReviewSort={setReviewSort}
              onReviewSubmit={() => setReviewModal(true)}
              markHelpful={markHelpful}
              reportReview={reportReview}
            />
          </AccordionSection>

          {/* Q&A */}
          <AccordionSection
            title={`Questions & Answers (${questions.length})`}
            icon={<MessageCircle size={20} className="text-primary-600" />}
            defaultOpen={false}
          >
            <div className="space-y-4">
              {user && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Ask a question..."
                    className="input flex-1"
                  />
                  <button onClick={submitQuestion} className="btn-primary">Ask</button>
                </div>
              )}
              {questions.length === 0 ? (
                <EmptyState title="No questions yet" message="Ask a question about this product." />
              ) : (
                <div className="space-y-3">
                  {questions.map((qq) => (
                    <div key={qq.id} className="card p-4">
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">Q: {qq.question}</p>
                      {qq.answer && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">A: {qq.answer}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AccordionSection>

          {/* Shipping */}
          <AccordionSection
            title="Shipping & Delivery"
            icon={<Truck size={20} className="text-primary-600" />}
            defaultOpen={false}
          >
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <p>Local delivery in Hyderabad, city delivery, nationwide shipping, and hand-to-hand pickup available. Cash on Delivery (COD) supported.</p>
              <p>Contact: 0313 3344068</p>
              {product.production_time && (
                <p>Estimated production time: {product.production_time}</p>
              )}
            </div>
          </AccordionSection>
        </div>

        {/* Back in stock notification */}
        {product.stock === 0 && !product.made_to_order && user && !backInStockAlert && !alertSubmitted && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Out of Stock</p>
                <p className="text-xs text-neutral-500">Get notified when this product is back in stock.</p>
              </div>
              <button
                onClick={async () => {
                  const { error: alertErr } = await supabase.from('back_in_stock_alerts').insert({ product_id: product.id, user_id: user.id, email: user.email ?? null });
                  if (alertErr) { alert('Could not set up alert. Please try again.'); return; }
                  setAlertSubmitted(true);
                }}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                Notify Me
              </button>
            </div>
          </div>
        )}
        {alertSubmitted && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
              <Check size={16} /> You will be notified when this product is back in stock.
            </p>
          </div>
        )}

        {/* AI Recommendations */}
        {related.length > 0 && (
          <section>
            <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold"><Sparkles size={20} className="text-primary-600" /> Similar Products You May Like</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
        {(() => {
          const allActive = [...related, ...recentlyViewed];
          const budget = recommendBudgetAlternative(product, allActive);
          const premium = recommendPremiumAlternative(product, allActive);
          const matching = recommendMatchingBedding(product, allActive);
          if (!budget && !premium && matching.length === 0) return null;
          return (
            <section>
              <h2 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold"><Sparkles size={20} className="text-primary-600" /> Smart Recommendations</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {budget && (
                  <div className="relative">
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">Budget Pick</span>
                    <ProductCard product={budget} />
                  </div>
                )}
                {premium && (
                  <div className="relative">
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Premium Option</span>
                    <ProductCard product={premium} />
                  </div>
                )}
                {matching.slice(0, 2).map((p) => (
                  <div key={p.id} className="relative">
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-700 dark:bg-accent-900/30 dark:text-accent-300">Matches Well</span>
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </section>
          );
        })()}

        {/* Recently viewed */}
        {recentlyViewed.length > 0 && (
          <section>
            <h2 className="mb-6 font-display text-xl font-bold text-neutral-600 dark:text-neutral-400">Recently Viewed</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {recentlyViewed.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky Add to Bag */}
      <StickyAddToBag
        price={effectivePrice}
        currency={product.currency}
        onAdd={handleAddToCart}
        adding={adding}
        disabled={isOutOfStock}
        label={selectedVariant?.size_label ?? product.name}
      />

      {/* Review modal */}
      <Modal open={reviewModal} onClose={() => setReviewModal(false)} title="Write a Review">
        <div className="space-y-4">
          <div>
            <label className="label">Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setReviewForm((p) => ({ ...p, rating: s }))}>
                  <StarRating rating={s} size={24} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Your Review</label>
            <textarea
              value={reviewForm.body}
              onChange={(e) => setReviewForm((p) => ({ ...p, body: e.target.value }))}
              rows={4}
              className="input"
              placeholder="Share your experience..."
            />
          </div>
          <button onClick={submitReview} disabled={submittingReview} className="btn-primary w-full">
            {submittingReview ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ---- Sub-components ----

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-neutral-400">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function AccordionSection({
  title, icon, children, defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <span className="flex items-center gap-2 text-lg font-bold">{icon} {title}</span>
        <ChevronDown
          size={20}
          className={cn('text-neutral-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="border-t border-neutral-200 p-5 dark:border-neutral-800">{children}</div>}
    </div>
  );
}

function ReviewsSection({
  reviews, filteredReviews, product, user, reviewFilter, setReviewFilter,
  reviewSort, setReviewSort, onReviewSubmit, markHelpful, reportReview,
}: {
  reviews: Review[];
  filteredReviews: Review[];
  product: Product;
  user: { id: string } | null;
  reviewFilter: 'all' | 5 | 4 | 3 | 2 | 1 | 'photos';
  setReviewFilter: (f: 'all' | 5 | 4 | 3 | 2 | 1 | 'photos') => void;
  reviewSort: 'newest' | 'highest' | 'lowest' | 'helpful';
  setReviewSort: (s: 'newest' | 'highest' | 'lowest' | 'helpful') => void;
  onReviewSubmit: () => void;
  markHelpful: (id: string) => void;
  reportReview: (id: string) => void;
}) {
  const ratingCounts = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: reviews.filter((r) => r.rating === s).length,
  }));

  return (
    <div className="space-y-5">
      {/* Summary */}
      {reviews.length > 0 && (
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="text-center">
            <p className="text-4xl font-bold text-neutral-900 dark:text-white">{Number(product.avg_rating).toFixed(1)}</p>
            <div className="my-1 flex justify-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  className={s <= Math.round(Number(product.avg_rating)) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}
                />
              ))}
            </div>
            <p className="text-xs text-neutral-400">{product.review_count} reviews</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {ratingCounts.map(({ star, count }) => {
              const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-neutral-500">{star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-neutral-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + sort + write */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', 5, 4, 3, 2, 1, 'photos'] as const).map((f) => (
            <button
              key={String(f)}
              onClick={() => setReviewFilter(f)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-medium transition',
                reviewFilter === f
                  ? 'bg-primary-600 text-white'
                  : 'border border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700'
              )}
            >
              {f === 'all' ? 'All' : f === 'photos' ? 'With Photos' : `${f}★`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={reviewSort}
            onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest</option>
            <option value="lowest">Lowest</option>
            <option value="helpful">Most Helpful</option>
          </select>
          {user && (
            <button onClick={onReviewSubmit} className="btn-outline text-sm">Write a Review</button>
          )}
        </div>
      </div>

      {/* Review list */}
      {filteredReviews.length === 0 ? (
        <EmptyState title="No reviews yet" message="Be the first to review this product." />
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((r) => {
            const reviewer = (r as unknown as { profiles?: { full_name: string | null } | null }).profiles;
            const images = (r as unknown as { review_images?: { image_url: string }[] }).review_images ?? [];
            return (
              <div key={r.id} className="card p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={13}
                            className={s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}
                          />
                        ))}
                      </div>
                      {r.verified_purchase && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <Check size={10} /> Verified Purchase
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {reviewer?.full_name ?? 'Customer'} · {formatDate(r.created_at)}
                    </p>
                  </div>
                </div>
                {r.body && <p className="text-sm text-neutral-600 dark:text-neutral-300">{r.body}</p>}
                {images.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {images.map((img, i) => (
                      <img key={i} src={img.image_url} alt="" className="h-20 w-20 flex-shrink-0 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                {r.owner_reply && (
                  <div className="mt-3 rounded-xl border-l-4 border-primary-300 bg-primary-50 p-3 dark:bg-primary-900/20">
                    <p className="mb-1 text-xs font-semibold text-primary-600 dark:text-primary-400">Shop Response</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{r.owner_reply}</p>
                    {r.owner_reply_at && <p className="mt-1 text-xs text-neutral-400">{formatDate(r.owner_reply_at)}</p>}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => markHelpful(r.id)}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary-600"
                  >
                    <ThumbsUp size={12} /> Helpful {r.helpful_count > 0 && `(${r.helpful_count})`}
                  </button>
                  {user && (
                    <button
                      onClick={() => reportReview(r.id)}
                      className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-500"
                    >
                      <Flag size={12} /> Report
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
