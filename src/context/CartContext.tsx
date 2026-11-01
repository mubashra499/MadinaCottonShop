import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { CartItem } from '@/lib/types';
import { getEffectivePrice } from '@/lib/utils';

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  count: number;
  subtotal: number;
  addItem: (productId: string, variantId: string | null, quantity: number, note?: string, customization?: Record<string, unknown>) => Promise<{ error?: string }>;
  updateQuantity: (itemId: string, quantity: number) => Promise<{ error?: string }>;
  removeItem: (itemId: string) => Promise<{ error?: string }>;
  clearCart: () => Promise<{ error?: string }>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);

  const loadCart = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    const { data: cart, error: cartErr } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (cartErr) {
      console.error('Failed to load cart:', cartErr.message);
      setError('Could not load your cart. Please refresh the page.');
      setLoading(false);
      return;
    }

    if (!cart) {
      const { data: newCart, error: insertErr } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      if (insertErr) {
        console.error('Failed to create cart:', insertErr.message);
        setError('Could not initialize your cart. Please try again.');
        setLoading(false);
        return;
      }
      setCartId(newCart?.id ?? null);
      setItems([]);
    } else {
      setCartId(cart.id);
      const { data: cartItems, error: itemsErr } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(*),
          variant:product_variants(*)
        `)
        .eq('cart_id', cart.id)
        .order('created_at', { ascending: false });
      if (itemsErr) {
        console.error('Failed to load cart items:', itemsErr.message);
        setError('Could not load your cart items. Please refresh the page.');
        setItems([]);
      } else {
        setItems((cartItems as CartItem[]) ?? []);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      loadCart(user.id);
    } else {
      setItems([]);
      setCartId(null);
      setLoading(false);
      setError(null);
    }
  }, [user, loadCart]);

  const addItem: CartContextValue['addItem'] = async (productId, variantId, quantity, note, customization) => {
    setError(null);
    if (!cartId) {
      if (user) {
        await loadCart(user.id);
      }
      return { error: 'Cart is still loading. Please try again in a moment.' };
    }

    let unitPrice: number;
    let availableStock: number;
    let madeToOrder: boolean;
    if (variantId) {
      const { data: variant, error } = await supabase
        .from('product_variants')
        .select('price, sale_price, stock, product:products(made_to_order)')
        .eq('id', variantId)
        .single();
      if (error || !variant) return { error: 'Could not find this product variant.' };
      unitPrice = getEffectivePrice(variant.price, variant.sale_price);
      availableStock = variant.stock;
      madeToOrder = (variant.product as unknown as { made_to_order?: boolean })?.made_to_order ?? false;
    } else {
      const { data: product, error } = await supabase
        .from('products')
        .select('price, sale_price, stock, made_to_order')
        .eq('id', productId)
        .single();
      if (error || !product) return { error: 'Could not find this product.' };
      unitPrice = getEffectivePrice(product.price, product.sale_price);
      availableStock = product.stock;
      madeToOrder = product.made_to_order;
    }

    if (!madeToOrder) {
      const existingQty = items.find((i) => i.product_id === productId && i.variant_id === variantId)?.quantity ?? 0;
      if (existingQty + quantity > availableStock) {
        return { error: `Only ${availableStock} in stock${existingQty > 0 ? ` (you already have ${existingQty} in your cart)` : ''}.` };
      }
    }

    const existing = items.find((i) => i.product_id === productId && i.variant_id === variantId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: newQty })
        .eq('id', existing.id);
      if (error) return { error: 'Could not update cart.' };
      setItems((prev) => prev.map((i) => (i.id === existing.id ? { ...i, quantity: newQty } : i)));
      return {};
    }

    const { data, error } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cartId,
        product_id: productId,
        variant_id: variantId,
        quantity,
        unit_price: unitPrice,
        note: note ?? null,
        customization: customization ?? null,
      })
      .select(`
        *,
        product:products(*),
        variant:product_variants(*)
      `)
      .single();
    if (error) return { error: 'Could not add item to cart.' };
    if (data) {
      setItems((prev) => [data as CartItem, ...prev]);
    }
    return {};
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return {};
    const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
    if (error) return { error: 'Could not update quantity. Please try again.' };
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)));
    return {};
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) {
      console.error('Failed to remove item:', error.message);
      return { error: 'Could not remove this item. Please try again.' };
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    return {};
  };

  const clearCart = async () => {
    if (!cartId) return {};
    const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartId);
    if (error) {
      console.error('Failed to clear cart:', error.message);
      return { error: 'Could not clear your cart.' };
    }
    setItems([]);
    return {};
  };

  const refresh = async () => {
    if (user) await loadCart(user.id);
  };

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

  return (
    <CartContext.Provider value={{ items, loading, error, count, subtotal, addItem, updateQuantity, removeItem, clearCart, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
