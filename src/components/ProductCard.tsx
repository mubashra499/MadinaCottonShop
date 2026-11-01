import { Link, navigate } from '@/lib/router';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import { formatPrice, getEffectivePrice, getStockStatus, cn } from '@/lib/utils';
import { Badge, StarRating } from '@/components/ui';
import { ShoppingBag, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const [wished, setWished] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) { setWished(false); return; }
    supabase.from('wishlists').select('id').eq('user_id', user.id).eq('product_id', product.id).maybeSingle().then(({ data }) => {
      setWished(!!data);
    });
  }, [user, product.id]);

  const image = product.product_images?.find((i) => i.is_primary) ?? product.product_images?.[0];
  const price = getEffectivePrice(product.price, product.sale_price);
  const hasDiscount = product.sale_price && product.sale_price > 0 && product.sale_price < product.price;
  const stockStatus = getStockStatus(product.stock, product.low_stock_threshold, product.made_to_order);

  const quickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/auth');
      return;
    }
    const variant = product.product_variants?.[0];
    setAdding(true);
    const result = await addItem(product.id, variant?.id ?? null, 1);
    setAdding(false);
    if (result.error) alert(result.error);
  };

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate('/auth');
      return;
    }
    if (wished) {
      await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', product.id);
      setWished(false);
    } else {
      await supabase.from('wishlists').insert({ user_id: user.id, product_id: product.id });
      setWished(true);
    }
  };

  return (
    <Link to={`/product/${product.slug}`} className="group card overflow-hidden transition-all duration-300 hover:shadow-card hover:-translate-y-0.5">
      <div className="relative aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        {image ? (
          <img
            src={image.url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <ShoppingBag size={48} />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.handmade && <Badge color="primary">Handmade</Badge>}
          {product.is_new && <Badge color="accent">New</Badge>}
          {hasDiscount && <Badge color="red">Sale</Badge>}
          {product.made_to_order && <Badge color="amber">Made to Order</Badge>}
        </div>

        {/* Actions */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button
            onClick={toggleWishlist}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:bg-white dark:bg-neutral-900/90',
              wished ? 'text-red-500' : 'text-neutral-500'
            )}
          >
            <Heart size={16} fill={wished ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Quick add */}
        <div className="absolute inset-x-2 bottom-2 translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={quickAdd}
            disabled={adding || (product.stock === 0 && !product.made_to_order)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-soft hover:bg-primary-700"
          >
            {adding ? 'Adding...' : (product.stock === 0 && !product.made_to_order) ? 'Out of Stock' : <><ShoppingBag size={14} /> Quick Add</>}
          </button>
        </div>
      </div>

      <div className="p-3">
        <h3 className="mb-1 line-clamp-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{product.name}</h3>
        <p className="mb-2 line-clamp-1 text-xs text-neutral-500 dark:text-neutral-400">{product.short_desc}</p>

        {product.avg_rating > 0 && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <StarRating rating={product.avg_rating} size={12} />
            <span className="text-xs text-neutral-400">({product.review_count})</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{formatPrice(price, product.currency)}</span>
            {hasDiscount && (
              <span className="text-xs text-neutral-400 line-through">{formatPrice(product.price, product.currency)}</span>
            )}
          </div>
          <span className={cn('text-xs font-medium', stockStatus.color)}>{stockStatus.label}</span>
        </div>
      </div>
    </Link>
  );
}
