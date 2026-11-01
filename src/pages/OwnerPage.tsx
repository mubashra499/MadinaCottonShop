import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Link, navigate } from '@/lib/router';
import type { Product, Order, CustomOrder, Category, Material, Supplier, Expense, ExpenseCategory, DeliveryZone, Setting, Payment, Notification, Coupon, Review, ProductionOrder, AuditLog, HomepageSection, FeatureSwitch, QuickReply, OrderChangeRequest, ReturnRequest, SupportTicket, WholesaleAccount, LoyaltyPoint, Referral } from '@/lib/types';
import { formatPrice, formatDateTime, formatDate, cn, slugify, generateSku } from '@/lib/utils';
import { ORDER_STATUS_LABELS, PRODUCT_STATUSES, PRODUCT_BADGES, SIZES, WEIGHTS, FILLINGS, FABRICS, COLORS } from '@/lib/types';
import { Spinner, EmptyState, Badge, Modal } from '@/components/ui';
import {
  LayoutDashboard, Package, ShoppingCart, Scissors, Boxes, BarChart3, Settings,
  Plus, Edit, Trash2, X, Check, TrendingUp, DollarSign, AlertTriangle, Eye,
  Calculator, MapPin, Shield, Lock, Key, Activity, LogOut, CreditCard,
  Users, MessageCircle, FileText, Factory, Bell, Globe, Tags, Megaphone,
  Star, Truck, RotateCcw, Crown, Menu, Search, Gift, UserCheck, Mail,
  ChevronRight, ClipboardList, Wallet, PieChart, Archive, Copy, EyeOff, Sparkles, Send,
} from 'lucide-react';
import { ImageUploader, type UploadedImage } from '@/components/ImageUploader';
import { getOwnerBusinessInsight, analyzeReviews, generateProductDescription, generateMarketingContent } from '@/lib/aiAssistant';
import { useSettings } from '@/hooks/useSettings';

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted - Awaiting Verification',
  paid: 'Paid / Verified',
  failed: 'Rejected / Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially Refunded',
  cancelled: 'Cancelled',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  bank: 'Bank Transfer',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
  'hand-to-hand': 'Hand to Hand',
};

async function getProofUrl(proofPath: string | null): Promise<string | null> {
  if (!proofPath) return null;
  if (proofPath.startsWith('http')) return proofPath;
  const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(proofPath, 3600);
  return data?.signedUrl ?? null;
}

function ProofLink({ proofPath, label }: { proofPath: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const signed = await getProofUrl(proofPath);
      if (!cancelled) { setUrl(signed); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [proofPath]);
  if (loading) return <span className="text-xs text-neutral-400">Loading proof...</span>;
  if (!url) return <span className="text-xs text-red-500">Could not load proof</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-600 underline text-sm">{label ?? 'View Payment Proof'}</a>;
}

type OwnerTab =
  | 'dashboard' | 'products' | 'categories' | 'orders' | 'customers'
  | 'messages' | 'custom' | 'quotations' | 'production' | 'inventory'
  | 'suppliers' | 'payments' | 'delivery' | 'returns' | 'coupons'
  | 'promotions' | 'reviews' | 'notifications' | 'website' | 'analytics'
  | 'finance' | 'reports' | 'settings' | 'security' | 'ai-copilot';

interface CustomerProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  order_count?: number;
  total_spent?: number;
  email?: string;
}

export function OwnerPage() {
  const { user, profile, isOwner, loading: authLoading, signOut } = useAuth();
  const [tab, setTab] = useState<OwnerTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<{ user_id: string; user_name: string; last_body: string; last_date: string; unread: number }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [homepageSections, setHomepageSections] = useState<HomepageSection[]>([]);
  const [featureSwitches, setFeatureSwitches] = useState<FeatureSwitch[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [orderChangeRequests, setOrderChangeRequests] = useState<OrderChangeRequest[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [wholesaleAccounts, setWholesaleAccounts] = useState<WholesaleAccount[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState<LoyaltyPoint[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [orderModal, setOrderModal] = useState<Order | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!isOwner) { navigate('/account'); return; }
    loadData();
  }, [user, isOwner, authLoading]);

  const loadData = async () => {
    setLoading(true);
    const [p, o, co, cats, mats, sups, exp, expCats, zones, sets, pays,
      custs, revs, coups, prods, notifs, msgs, audits, hpSections, features,
      qReplies, changeReqs, retReqs, tickets, wholesale, loyalty, refs] = await Promise.all([
      supabase.from('products').select('*, category:categories(*), product_images(*), product_variants(*), product_videos(*)').order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
      supabase.from('custom_orders').select('*, custom_order_images(*), custom_quotes(*)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('materials').select('*, supplier:suppliers(*)'),
      supabase.from('suppliers').select('*'),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('delivery_zones').select('*').order('delivery_fee'),
      supabase.from('settings').select('*'),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, phone, role, created_at').order('created_at', { ascending: false }),
      supabase.from('reviews').select('*, product:products(name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('production_orders').select('*, order:orders(order_number, customer_name)').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('messages').select('user_id, body, created_at, sender').order('created_at', { ascending: false }).limit(100),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('homepage_sections').select('*').order('sort_order'),
      supabase.from('feature_switches').select('*').order('label'),
      supabase.from('quick_replies').select('*').order('category'),
      supabase.from('order_change_requests').select('*, order:orders(order_number)').order('created_at', { ascending: false }),
      supabase.from('returns').select('*, order:orders(order_number, total)').order('created_at', { ascending: false }),
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
      supabase.from('wholesale_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('loyalty_points').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    setProducts((p.data as Product[]) ?? []);
    setOrders((o.data as Order[]) ?? []);
    setCustomOrders((co.data as CustomOrder[]) ?? []);
    setCategories((cats.data as Category[]) ?? []);
    setMaterials((mats.data as Material[]) ?? []);
    setSuppliers((sups.data as Supplier[]) ?? []);
    setExpenses((exp.data as Expense[]) ?? []);
    setExpenseCategories((expCats.data as ExpenseCategory[]) ?? []);
    setDeliveryZones((zones.data as DeliveryZone[]) ?? []);
    setSettings((sets.data as Setting[]) ?? []);
    setPayments((pays.data as Payment[]) ?? []);
    setCustomers((custs.data as CustomerProfile[]) ?? []);
    setReviews((revs.data as Review[]) ?? []);
    setCoupons((coups.data as Coupon[]) ?? []);
    setProductionOrders((prods.data as ProductionOrder[]) ?? []);
    setNotifications((notifs.data as Notification[]) ?? []);

    // Aggregate messages by user
    const msgData = (msgs.data as { user_id: string; body: string; created_at: string; sender: string }[]) ?? [];
    const msgMap: Record<string, { user_id: string; user_name: string; last_body: string; last_date: string; unread: number }> = {};
    for (const m of msgData) {
      if (!msgMap[m.user_id]) {
        msgMap[m.user_id] = { user_id: m.user_id, user_name: m.user_id, last_body: m.body, last_date: m.created_at, unread: 0 };
      }
      msgMap[m.user_id].last_body = m.body;
      msgMap[m.user_id].last_date = m.created_at;
      if (m.sender === 'customer' && m.body) msgMap[m.user_id].unread++;
    }
    setMessages(Object.values(msgMap));

    setAuditLogs((audits.data as AuditLog[]) ?? []);
    setHomepageSections((hpSections.data as HomepageSection[]) ?? []);
    setFeatureSwitches((features.data as FeatureSwitch[]) ?? []);
    setQuickReplies((qReplies.data as QuickReply[]) ?? []);
    setOrderChangeRequests((changeReqs.data as OrderChangeRequest[]) ?? []);
    setReturnRequests((retReqs.data as ReturnRequest[]) ?? []);
    setSupportTickets((tickets.data as SupportTicket[]) ?? []);
    setWholesaleAccounts((wholesale.data as WholesaleAccount[]) ?? []);
    setLoyaltyPoints((loyalty.data as LoyaltyPoint[]) ?? []);
    setReferrals((refs.data as Referral[]) ?? []);
    setLoading(false);
  };

  if (authLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950"><Spinner size={32} /></div>;
  }

  if (!isOwner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <Shield size={48} className="mx-auto mb-4 text-red-500" />
          <h1 className="text-xl font-bold">Access Denied</h1>
          <p className="mt-2 text-sm text-neutral-500">You do not have permission to access the Owner Command Center.</p>
          <Link to="/account" className="btn-primary mt-4 inline-block">Go to My Account</Link>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.created_at.slice(0, 10) === today);
  const stats = {
    todaySales: todayOrders.reduce((s, o) => s + o.total, 0),
    todayOrders: todayOrders.length,
    pendingOrders: orders.filter((o) => o.status === 'new' || o.status === 'confirmed').length,
    confirmedOrders: orders.filter((o) => o.status === 'confirmed').length,
    pendingPayments: orders.filter((o) => o.payment_status === 'pending').length,
    paidOrders: orders.filter((o) => o.payment_status === 'paid' || o.payment_status === 'verified').length,
    inProduction: orders.filter((o) => o.status === 'production' || o.status === 'stitching' || o.status === 'finishing').length,
    qualityCheck: orders.filter((o) => o.status === 'quality_check').length,
    readyToShip: orders.filter((o) => o.status === 'ready' || o.status === 'packed').length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    outForDelivery: orders.filter((o) => o.status === 'out_for_delivery').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    newCustomers: customers.filter((c) => c.created_at.slice(0, 10) === today).length,
    unreadMessages: messages.reduce((s, m) => s + m.unread, 0),
    pendingCustom: customOrders.filter((c) => c.status === 'requested').length,
    pendingQuotes: customOrders.filter((c) => c.status === 'quoted').length,
    changeRequests: orderChangeRequests.filter((r) => r.status === 'pending').length,
    returnRequests: returnRequests.filter((r) => r.status === 'pending').length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).length,
    totalProducts: products.length,
    activeProducts: products.filter((p) => p.status === 'active').length,
    outOfStock: products.filter((p) => p.stock === 0 && !p.made_to_order).length,
    revenue: orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded').reduce((s, o) => s + o.total, 0),
    grossSales: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.subtotal, 0),
    totalDiscounts: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.discount, 0),
    totalShipping: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.shipping_fee, 0),
    refundedAmount: orders.filter((o) => o.status === 'refunded' || o.payment_status === 'refunded').reduce((s, o) => s + o.total, 0),
    totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
    totalOrders: orders.length,
    totalCustomers: customers.length,
  };
  const netProfit = stats.revenue - stats.totalExpenses;

  const tabs: { key: OwnerTab; label: string; icon: typeof Package; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'orders', label: 'Orders', icon: ShoppingCart, badge: stats.pendingOrders },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'categories', label: 'Categories', icon: Settings },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'messages', label: 'Messages', icon: MessageCircle, badge: stats.unreadMessages },
    { key: 'custom', label: 'Custom Orders', icon: Scissors, badge: stats.pendingCustom },
    { key: 'quotations', label: 'Quotations', icon: FileText, badge: stats.pendingQuotes },
    { key: 'production', label: 'Production', icon: Factory, badge: stats.inProduction },
    { key: 'inventory', label: 'Inventory', icon: Boxes },
    { key: 'suppliers', label: 'Suppliers', icon: Truck },
    { key: 'payments', label: 'Payments', icon: CreditCard, badge: stats.pendingPayments },
    { key: 'delivery', label: 'Delivery', icon: MapPin },
    { key: 'returns', label: 'Returns & Refunds', icon: RotateCcw, badge: stats.returnRequests + stats.changeRequests },
    { key: 'coupons', label: 'Coupons', icon: Tags },
    { key: 'promotions', label: 'Promotions', icon: Megaphone },
    { key: 'reviews', label: 'Reviews', icon: Star },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'website', label: 'Website', icon: Globe },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'finance', label: 'Finance', icon: Wallet },
    { key: 'reports', label: 'Reports', icon: PieChart },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'ai-copilot', label: 'AI Assistant', icon: Sparkles },
  ];

  const handleSignOut = async () => {
    await supabase.rpc('log_owner_action', { p_action: 'owner_logout', p_entity: 'auth' });
    await signOut();
    navigate('/');
  };

  const quickActions = [
    { label: 'Add Product', icon: Plus, tab: 'products' as OwnerTab },
    { label: 'Create Order', icon: ShoppingCart, tab: 'orders' as OwnerTab },
    { label: 'Message Customer', icon: MessageCircle, tab: 'messages' as OwnerTab },
    { label: 'Verify Payment', icon: CreditCard, tab: 'payments' as OwnerTab },
    { label: 'Create Quote', icon: FileText, tab: 'quotations' as OwnerTab },
    { label: 'Update Inventory', icon: Boxes, tab: 'inventory' as OwnerTab },
    { label: 'Add Coupon', icon: Tags, tab: 'coupons' as OwnerTab },
    { label: 'Edit Website', icon: Globe, tab: 'website' as OwnerTab },
  ];

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform dark:border-neutral-800 dark:bg-neutral-900 lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Crown size={18} />
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight">Owner Center</p>
            <p className="text-[10px] text-neutral-400">Madina Cotton Shop</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden"><X size={18} /></button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSidebarOpen(false); }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                tab === t.key
                  ? 'bg-primary-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
              )}
            >
              <t.icon size={16} className="flex-shrink-0" />
              <span className="flex-1 text-left">{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 text-[10px] font-bold',
                  tab === t.key ? 'bg-white/20 text-white' : 'bg-red-500 text-white',
                )}>{t.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30">
              <Crown size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{profile?.full_name ?? user?.email}</p>
              <p className="text-[10px] text-neutral-400">Owner</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Link to="/" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
              <Globe size={14} /> Store
            </Link>
            <button onClick={handleSignOut} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-neutral-700 dark:hover:bg-red-900/20">
              <LogOut size={14} /> Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/90">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu size={20} /></button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && globalSearch.trim()) {
                  const q = globalSearch.trim().toLowerCase();
                  const orderMatch = orders.find((o) => (o.order_number ?? '').toLowerCase().includes(q) || (o.customer_name ?? '').toLowerCase().includes(q) || (o.customer_phone ?? '').includes(q));
                  if (orderMatch) { setTab('orders'); setOrderModal(orderMatch); setGlobalSearch(''); return; }
                  const productMatch = products.find((p) => p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q));
                  if (productMatch) { setTab('products'); setEditingProduct(productMatch); setProductModal(true); setGlobalSearch(''); return; }
                  const customerMatch = customers.find((c) => (c.full_name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q));
                  if (customerMatch) { setTab('customers'); setGlobalSearch(''); return; }
                  setTab('orders');
                  setGlobalSearch('');
                }
              }}
              placeholder="Search orders, products, customers..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>
          <button onClick={() => setTab('notifications')} className="relative rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
            <Bell size={20} />
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {notifications.filter((n) => !n.read).length}
              </span>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            {/* Dashboard */}
            {tab === 'dashboard' && (
              <DashboardTab stats={stats} orders={orders} products={products} quickActions={quickActions} onTabChange={setTab} />
            )}

            {/* Products */}
            {tab === 'products' && (
              <ProductsTab products={products} categories={categories} editingProduct={editingProduct} setEditingProduct={setEditingProduct} productModal={productModal} setProductModal={setProductModal} reload={loadData} />
            )}

            {/* Orders */}
            {tab === 'orders' && (
              <OrdersTab orders={orders} payments={payments} products={products} orderModal={orderModal} setOrderModal={setOrderModal} reload={loadData} />
            )}

            {/* Categories */}
            {tab === 'categories' && <CategoriesTab categories={categories} reload={loadData} />}

            {/* Customers */}
            {tab === 'customers' && <CustomersTab customers={customers} orders={orders} />}

            {/* Messages */}
            {tab === 'messages' && <MessagesTab messages={messages} quickReplies={quickReplies} reload={loadData} />}

            {/* Custom Orders */}
            {tab === 'custom' && <CustomTab customOrders={customOrders} reload={loadData} />}

            {/* Quotations */}
            {tab === 'quotations' && <QuotationsTab customOrders={customOrders} reload={loadData} />}

            {/* Production */}
            {tab === 'production' && <ProductionTab productionOrders={productionOrders} reload={loadData} />}

            {/* Inventory */}
            {tab === 'inventory' && <InventoryTab materials={materials} suppliers={suppliers} reload={loadData} />}

            {/* Suppliers */}
            {tab === 'suppliers' && <SuppliersTab suppliers={suppliers} reload={loadData} />}

            {/* Payments */}
            {tab === 'payments' && <PaymentsTab payments={payments} orders={orders} reload={loadData} />}

            {/* Delivery */}
            {tab === 'delivery' && <DeliveryTab deliveryZones={deliveryZones} reload={loadData} />}

            {/* Returns */}
            {tab === 'returns' && <ReturnsTab returnRequests={returnRequests} orderChangeRequests={orderChangeRequests} reload={loadData} />}

            {/* Coupons */}
            {tab === 'coupons' && <CouponsTab coupons={coupons} reload={loadData} />}

            {/* Promotions */}
            {tab === 'promotions' && <PromotionsTab coupons={coupons} reload={loadData} />}

            {/* Reviews */}
            {tab === 'reviews' && <ReviewsTab reviews={reviews} reload={loadData} />}

            {/* Notifications */}
            {tab === 'notifications' && <NotificationsTab notifications={notifications} reload={loadData} />}

            {/* Website */}
            {tab === 'website' && <WebsiteTab homepageSections={homepageSections} featureSwitches={featureSwitches} settings={settings} reload={loadData} />}

            {/* Analytics */}
            {tab === 'analytics' && <AnalyticsTab orders={orders} products={products} customers={customers} />}

            {/* Finance */}
            {tab === 'finance' && <FinanceTab orders={orders} expenses={expenses} expenseCategories={expenseCategories} reload={loadData} />}

            {/* Reports */}
            {tab === 'reports' && <ReportsTab orders={orders} products={products} expenses={expenses} customers={customers} />}

            {/* Settings */}
            {tab === 'settings' && <SettingsTab settings={settings} reload={loadData} />}

            {/* Security */}
            {tab === 'security' && <SecurityCenter auditLogs={auditLogs} onSignOut={handleSignOut} />}

            {/* AI Copilot */}
            {tab === 'ai-copilot' && <AICopilotTab orders={orders} products={products} expenses={expenses} reviews={reviews} />}
          </div>
        </main>
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD TAB
// ============================================================
function DashboardTab({ stats, orders, products, quickActions, onTabChange }: {
  stats: Record<string, number>;
  orders: Order[];
  products: Product[];
  quickActions: { label: string; icon: typeof Plus; tab: OwnerTab }[];
  onTabChange: (tab: OwnerTab) => void;
}) {
  const cards: { label: string; value: string; icon: typeof DollarSign; color: string; tab: OwnerTab }[] = [
    { label: "Today's Sales", value: formatPrice(stats.todaySales), icon: DollarSign, color: 'accent', tab: 'finance' },
    { label: "Today's Orders", value: String(stats.todayOrders), icon: ShoppingCart, color: 'primary', tab: 'orders' },
    { label: 'Pending Orders', value: String(stats.pendingOrders), icon: AlertTriangle, color: 'amber', tab: 'orders' },
    { label: 'Confirmed', value: String(stats.confirmedOrders), icon: Check, color: 'green', tab: 'orders' },
    { label: 'Pending Payments', value: String(stats.pendingPayments), icon: CreditCard, color: 'amber', tab: 'payments' },
    { label: 'Paid Orders', value: String(stats.paidOrders), icon: DollarSign, color: 'green', tab: 'payments' },
    { label: 'In Production', value: String(stats.inProduction), icon: Factory, color: 'primary', tab: 'production' },
    { label: 'Quality Check', value: String(stats.qualityCheck), icon: Check, color: 'amber', tab: 'production' },
    { label: 'Ready to Ship', value: String(stats.readyToShip), icon: Package, color: 'accent', tab: 'orders' },
    { label: 'Shipped', value: String(stats.shipped), icon: Truck, color: 'primary', tab: 'orders' },
    { label: 'Out for Delivery', value: String(stats.outForDelivery), icon: Truck, color: 'amber', tab: 'orders' },
    { label: 'Delivered', value: String(stats.delivered), icon: Check, color: 'green', tab: 'orders' },
    { label: 'New Customers', value: String(stats.newCustomers), icon: UserCheck, color: 'accent', tab: 'customers' },
    { label: 'Unread Messages', value: String(stats.unreadMessages), icon: MessageCircle, color: 'primary', tab: 'messages' },
    { label: 'Pending Custom', value: String(stats.pendingCustom), icon: Scissors, color: 'amber', tab: 'custom' },
    { label: 'Pending Quotes', value: String(stats.pendingQuotes), icon: FileText, color: 'primary', tab: 'quotations' },
    { label: 'Change Requests', value: String(stats.changeRequests), icon: RotateCcw, color: 'amber', tab: 'returns' },
    { label: 'Return Requests', value: String(stats.returnRequests), icon: RotateCcw, color: 'red', tab: 'returns' },
    { label: 'Low Stock', value: String(stats.lowStock), icon: AlertTriangle, color: 'red', tab: 'inventory' },
    { label: 'Revenue', value: formatPrice(stats.revenue), icon: TrendingUp, color: 'accent', tab: 'finance' },
  ];

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {cards.map((c) => (
          <button key={c.label} onClick={() => onTabChange(c.tab)} className="card p-4 text-left transition hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colorClasses(c.color))}>
                <c.icon size={18} />
              </div>
              <div>
                <p className="text-xs text-neutral-500">{c.label}</p>
                <p className="text-lg font-bold">{c.value}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-neutral-500">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <button key={a.label} onClick={() => onTabChange(a.tab)} className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium transition hover:border-primary-300 hover:bg-primary-50 dark:border-neutral-700 dark:hover:bg-primary-900/20">
              <a.icon size={16} /> {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent orders & alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-lg font-semibold">Recent Orders</h3>
          <div className="space-y-2">
            {orders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-neutral-100 p-3 dark:border-neutral-800">
                <div>
                  <p className="text-sm font-semibold">{o.order_number}</p>
                  <p className="text-xs text-neutral-400">{o.customer_name} · {formatDateTime(o.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold">{formatPrice(o.total)}</span>
                  <Badge color="neutral">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                </div>
              </div>
            ))}
            {orders.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No orders yet</p>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><AlertTriangle size={20} className="text-amber-500" /> Low Stock Alerts</h3>
          <div className="space-y-2">
            {products.filter((p) => p.stock <= p.low_stock_threshold).slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-neutral-100 p-3 dark:border-neutral-800">
                <p className="text-sm font-medium">{p.name}</p>
                <Badge color={p.stock === 0 ? 'red' : 'amber'}>{p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</Badge>
              </div>
            ))}
            {products.filter((p) => p.stock <= p.low_stock_threshold).length === 0 && <p className="py-4 text-center text-sm text-neutral-400">All products well stocked</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function colorClasses(color: string): string {
  const colors: Record<string, string> = {
    primary: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30',
    accent: 'bg-accent-100 text-accent-600 dark:bg-accent-900/30',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30',
    neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  };
  return colors[color] ?? colors.neutral;
}

// ============================================================
// PRODUCTS TAB
// ============================================================
function ProductsTab({ products, categories, editingProduct, setEditingProduct, productModal, setProductModal, reload }: {
  products: Product[]; categories: Category[]; editingProduct: Product | null; setEditingProduct: (p: Product | null) => void; productModal: boolean; setProductModal: (b: boolean) => void; reload: () => void;
}) {
  const [form, setForm] = useState({
    name: '', slug: '', sku: '', category_id: '', short_desc: '', full_desc: '',
    price: '', sale_price: '', status: 'active', stock: '0', low_stock_threshold: '3',
    production_time: '', care_instructions: '', handmade_info: '',
    featured: false, is_new: false, best_seller: false, handmade: false, premium: false, sale: false, limited_stock: false, made_to_order: false, customizable: false,
  });
  const [variants, setVariants] = useState<{ id?: string; sku: string; price: string; size_label: string; weight: string; filling: string; fabric: string; color: string; color_hex: string; stitching: string; decoration: string; stock: string }[]>([]);
  const [originalVariantIds, setOriginalVariantIds] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [videos, setVideos] = useState<{ id?: string; url: string; title: string; sort_order: number; is_primary: boolean; active: boolean }[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingProduct(null);
    setForm({ name: '', slug: '', sku: '', category_id: '', short_desc: '', full_desc: '', price: '', sale_price: '', status: 'active', stock: '0', low_stock_threshold: '3', production_time: '', care_instructions: '', handmade_info: '', featured: false, is_new: false, best_seller: false, handmade: false, premium: false, sale: false, limited_stock: false, made_to_order: false, customizable: false });
    setVariants([]);
    setOriginalVariantIds([]);
    setUploadedImages([]);
    setVideos([]);
    setNewVideoUrl('');
    setProductModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name, slug: p.slug, sku: p.sku ?? '', category_id: p.category_id ?? '', short_desc: p.short_desc ?? '', full_desc: p.full_desc ?? '',
      price: String(p.price), sale_price: p.sale_price ? String(p.sale_price) : '', status: p.status, stock: String(p.stock), low_stock_threshold: String(p.low_stock_threshold),
      production_time: p.production_time ?? '', care_instructions: p.care_instructions ?? '', handmade_info: p.handmade_info ?? '',
      featured: p.featured, is_new: p.is_new, best_seller: p.best_seller, handmade: p.handmade, premium: p.premium, sale: p.sale, limited_stock: p.limited_stock, made_to_order: p.made_to_order, customizable: p.customizable,
    });
    const variantRows = (p.product_variants ?? []).map((v) => ({ id: v.id, sku: v.sku ?? '', price: String(v.price), size_label: v.size_label ?? '', weight: v.weight ?? '', filling: v.filling ?? '', fabric: v.fabric ?? '', color: v.color ?? '', color_hex: v.color_hex ?? '', stitching: v.stitching ?? '', decoration: v.decoration ?? '', stock: String(v.stock) }));
    setVariants(variantRows);
    setOriginalVariantIds(variantRows.map((v) => v.id).filter((id): id is string => !!id));
    setUploadedImages((p.product_images ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((img) => ({ id: img.id, url: img.url, view_type: img.view_type, is_primary: img.is_primary, sort_order: img.sort_order, variant_id: img.variant_id, color: img.color })));
    setVideos((p.product_videos ?? []).sort((a, b) => a.sort_order - b.sort_order).map((v) => ({ id: v.id, url: v.url, title: v.title ?? '', sort_order: v.sort_order, is_primary: v.is_primary, active: v.active })));
    setNewVideoUrl('');
    setProductModal(true);
  };

  const save = async () => {
    if (!form.name) { alert('Name required'); return; }
    if (!form.price || parseFloat(form.price) <= 0) { alert('Price must be greater than 0'); return; }
    setSaving(true);
    const slug = form.slug || slugify(form.name) + '-' + Date.now().toString().slice(-4);
    const sku = form.sku || generateSku(form.name);

    const payload = {
      name: form.name, slug, sku, category_id: form.category_id || null,
      short_desc: form.short_desc || null, full_desc: form.full_desc || null,
      price: parseFloat(form.price) || 0, sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
      status: form.status, stock: parseInt(form.stock) || 0, low_stock_threshold: parseInt(form.low_stock_threshold) || 3,
      production_time: form.production_time || null, care_instructions: form.care_instructions || null, handmade_info: form.handmade_info || null,
      featured: form.featured, is_new: form.is_new, best_seller: form.best_seller, handmade: form.handmade, premium: form.premium, sale: form.sale, limited_stock: form.limited_stock, made_to_order: form.made_to_order, customizable: form.customizable,
      updated_at: new Date().toISOString(),
    };

    let productId = editingProduct?.id;
    if (editingProduct) {
      const { error: updateError } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
      if (updateError) { alert('Could not update product: ' + updateError.message); setSaving(false); return; }
      await supabase.rpc('log_owner_action', { p_action: 'product_updated', p_entity: 'product', p_entity_id: editingProduct.id, p_new_value: payload });
    } else {
      const { data, error: insertError } = await supabase.from('products').insert(payload).select('id').single();
      if (insertError || !data) { alert('Could not create product: ' + (insertError?.message ?? 'Unknown error')); setSaving(false); return; }
      productId = data.id;
      await supabase.rpc('log_owner_action', { p_action: 'product_created', p_entity: 'product', p_entity_id: productId, p_new_value: payload });
    }

    if (productId) {
      const currentVariantIds = variants.map((v) => v.id).filter((id): id is string => !!id);
      const deletedVariantIds = originalVariantIds.filter((id) => !currentVariantIds.includes(id));
      for (const delId of deletedVariantIds) {
        const { error } = await supabase.from('product_variants').delete().eq('id', delId);
        if (error) { console.error('Variant delete error:', error.message); }
      }
      for (const v of variants) {
        const vPayload = {
          product_id: productId, sku: v.sku, price: parseFloat(v.price) || 0,
          size_label: v.size_label || null, weight: v.weight || null, filling: v.filling || null, fabric: v.fabric || null,
          color: v.color || null, color_hex: v.color_hex || null, stitching: v.stitching || null, decoration: v.decoration || null,
          stock: parseInt(v.stock) || 0, active: true,
        };
        if (v.id) {
          const { error } = await supabase.from('product_variants').update(vPayload).eq('id', v.id);
          if (error) { console.error('Variant update error:', error.message); }
        } else {
          const { error } = await supabase.from('product_variants').insert(vPayload);
          if (error) { console.error('Variant insert error:', error.message); }
        }
      }

      if (uploadedImages.length > 0) {
        const existingIds = (editingProduct?.product_images ?? []).map((img) => img.id);
        const keptIds = uploadedImages.filter((img) => img.id).map((img) => img.id!);
        const deletedIds = existingIds.filter((id) => !keptIds.includes(id));

        for (const delId of deletedIds) {
          const { error } = await supabase.from('product_images').delete().eq('id', delId);
          if (error) { console.error('Image delete error:', error.message); }
        }

        for (const img of uploadedImages) {
          if (img.id) {
            const { error } = await supabase.from('product_images').update({
              view_type: img.view_type, is_primary: img.is_primary, sort_order: img.sort_order, color: img.color ?? null, variant_id: img.variant_id ?? null,
            }).eq('id', img.id);
            if (error) { console.error('Image update error:', error.message); }
          } else {
            const { error } = await supabase.from('product_images').insert({
              product_id: productId, url: img.url, view_type: img.view_type, is_primary: img.is_primary, sort_order: img.sort_order, color: img.color ?? null, variant_id: img.variant_id ?? null,
            });
            if (error) { console.error('Image insert error:', error.message); }
          }
        }
      }

      // Save videos
      const existingVideoIds = (editingProduct?.product_videos ?? []).map((v) => v.id);
      const keptVideoIds = videos.filter((v) => v.id).map((v) => v.id!);
      const deletedVideoIds = existingVideoIds.filter((id) => !keptVideoIds.includes(id));
      for (const delId of deletedVideoIds) {
        const { error } = await supabase.from('product_videos').delete().eq('id', delId);
        if (error) { console.error('Video delete error:', error.message); }
      }
      for (const v of videos) {
        if (v.id) {
          const { error } = await supabase.from('product_videos').update({ url: v.url, title: v.title || null, sort_order: v.sort_order, is_primary: v.is_primary, active: v.active }).eq('id', v.id);
          if (error) { console.error('Video update error:', error.message); }
        } else {
          const { error } = await supabase.from('product_videos').insert({ product_id: productId, url: v.url, title: v.title || null, sort_order: v.sort_order, is_primary: v.is_primary, active: v.active });
          if (error) { console.error('Video insert error:', error.message); }
        }
      }
    }

    setSaving(false);
    setProductModal(false);
    reload();
  };

  const del = async (p: Product) => {
    if (!confirm(`Permanently delete "${p.name}"? This cannot be undone. Consider archiving instead.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { alert('Could not delete product: ' + error.message); return; }
    await supabase.rpc('log_owner_action', { p_action: 'product_deleted', p_entity: 'product', p_entity_id: p.id, p_old_value: { name: p.name, price: p.price } as Record<string, unknown> });
    reload();
  };

  const archiveProduct = async (p: Product) => {
    const newStatus = p.status === 'discontinued' ? 'active' : 'discontinued';
    if (newStatus === 'discontinued' && !confirm(`Archive "${p.name}"? It will be hidden from the shop. You can restore it later.`)) return;
    const { error } = await supabase.from('products').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) { alert('Could not update product: ' + error.message); return; }
    await supabase.rpc('log_owner_action', { p_action: newStatus === 'discontinued' ? 'product_archived' : 'product_restored', p_entity: 'product', p_entity_id: p.id, p_old_value: { status: p.status } as Record<string, unknown>, p_new_value: { status: newStatus } as Record<string, unknown> });
    reload();
  };

  const duplicateProduct = async (p: Product) => {
    if (!confirm(`Duplicate "${p.name}"? A copy will be created as a draft.`)) return;
    const newSlug = slugify(p.name) + '-copy-' + Date.now().toString().slice(-4);
    const { data: newProd, error } = await supabase.from('products').insert({
      name: p.name + ' (Copy)', slug: newSlug, sku: p.sku ? p.sku + '-COPY' : null,
      category_id: p.category_id, short_desc: p.short_desc, full_desc: p.full_desc,
      price: p.price, sale_price: p.sale_price, cost_price: p.cost_price, currency: p.currency,
      status: 'draft', stock: 0, low_stock_threshold: p.low_stock_threshold,
      production_time: p.production_time, care_instructions: p.care_instructions, handmade_info: p.handmade_info,
      featured: false, is_new: false, best_seller: false, handmade: p.handmade, premium: p.premium,
      sale: false, limited_stock: false, made_to_order: p.made_to_order, customizable: p.customizable,
    }).select('id').single();
    if (error || !newProd) { alert('Could not duplicate product: ' + (error?.message ?? 'Unknown error')); return; }
    const newId = newProd.id;
    for (const v of p.product_variants ?? []) {
      await supabase.from('product_variants').insert({
        product_id: newId, sku: v.sku, price: v.price, sale_price: v.sale_price,
        size_label: v.size_label, width: v.width, length: v.length, unit: v.unit,
        weight: v.weight, filling: v.filling, fabric: v.fabric, color: v.color, color_hex: v.color_hex,
        design: v.design, stitching: v.stitching, decoration: v.decoration, stock: 0, active: true,
      });
    }
    for (const img of p.product_images ?? []) {
      await supabase.from('product_images').insert({
        product_id: newId, url: img.url, view_type: img.view_type, is_primary: img.is_primary,
        sort_order: img.sort_order, color: img.color, variant_id: null,
      });
    }
    await supabase.rpc('log_owner_action', { p_action: 'product_duplicated', p_entity: 'product', p_entity_id: newId, p_new_value: { name: p.name + ' (Copy)', source_id: p.id } as Record<string, unknown> });
    reload();
  };

  const toggleStatus = async (p: Product) => {
    const newStatus = p.status === 'active' ? 'draft' : 'active';
    const { error } = await supabase.from('products').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) { alert('Could not update status: ' + error.message); return; }
    await supabase.rpc('log_owner_action', { p_action: 'product_status_changed', p_entity: 'product', p_entity_id: p.id, p_old_value: { status: p.status } as Record<string, unknown>, p_new_value: { status: newStatus } as Record<string, unknown> });
    reload();
  };

  const addVariant = () => setVariants([...variants, { sku: '', price: form.price || '0', size_label: '', weight: '', filling: '', fabric: '', color: '', color_hex: '', stitching: '', decoration: 'None', stock: '0' }]);

  const [showArchivedProds, setShowArchivedProds] = useState(false);
  const visibleProducts = products.filter((p) => showArchivedProds ? p.status === 'discontinued' : p.status !== 'discontinued');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Products ({visibleProducts.length})</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowArchivedProds(!showArchivedProds)} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', showArchivedProds ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' : 'bg-neutral-100 dark:bg-neutral-800')}>
            <Archive size={14} /> {showArchivedProds ? 'Archived' : 'Show Archived'} ({products.filter((p) => p.status === 'discontinued').length})
          </button>
          <button onClick={openNew} className="btn-primary"><Plus size={16} /> Add Product</button>
        </div>
      </div>

      <div className="space-y-2">
        {visibleProducts.map((p) => (
          <div key={p.id} className="card flex items-center gap-3 p-3">
            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
              {p.product_images?.[0] ? <img src={p.product_images[0].url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Package size={16} /></div>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-neutral-400">{p.sku} · {formatPrice(p.price)} · {p.product_variants?.length ?? 0} variants · Stock: {p.stock}</p>
            </div>
            <Badge color={p.status === 'active' ? 'accent' : p.status === 'draft' ? 'neutral' : 'red'}>{p.status}</Badge>
            <button onClick={() => openEdit(p)} className="btn-ghost p-1.5" title="Edit"><Edit size={16} /></button>
            <button onClick={() => duplicateProduct(p)} className="btn-ghost p-1.5" title="Duplicate"><Copy size={16} /></button>
            <button onClick={() => toggleStatus(p)} className="btn-ghost p-1.5" title={p.status === 'active' ? 'Unpublish (set draft)' : 'Publish'}>{p.status === 'active' ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            <button onClick={() => archiveProduct(p)} className="btn-ghost p-1.5" title={p.status === 'discontinued' ? 'Restore' : 'Archive'}><Archive size={16} /></button>
            <button onClick={() => del(p)} className="btn-ghost p-1.5 text-red-500" title="Permanent delete"><Trash2 size={16} /></button>
          </div>
        ))}
        {visibleProducts.length === 0 && <EmptyState title={showArchivedProds ? "No archived products" : "No products yet"} action={!showArchivedProds && <button onClick={openNew} className="btn-primary">Add Product</button>} />}
      </div>

      {productModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setProductModal(false)} />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
              <button onClick={() => setProductModal(false)}><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div><label className="label">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} className="input" /></div>
                <div><label className="label">SKU</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" placeholder="Auto-generated" /></div>
                <div><label className="label">Category</label><select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input"><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="label">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">{PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <div><label className="label">Price (Rs.) *</label><input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" /></div>
                <div><label className="label">Sale Price</label><input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="input" /></div>
                <div><label className="label">Stock</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" /></div>
                <div><label className="label">Low Stock Threshold</label><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="input" /></div>
              </div>
              <div><label className="label">Short Description</label><input value={form.short_desc} onChange={(e) => setForm({ ...form, short_desc: e.target.value })} className="input" /></div>
              <div><label className="label">Full Description</label><textarea value={form.full_desc} onChange={(e) => setForm({ ...form, full_desc: e.target.value })} rows={3} className="input" /></div>
              <div><label className="label">Production Time</label><input value={form.production_time} onChange={(e) => setForm({ ...form, production_time: e.target.value })} className="input" placeholder="e.g. 3-7 days" /></div>

              <div><label className="label">Product Images</label><ImageUploader productId={editingProduct?.id} images={uploadedImages} onImagesChange={setUploadedImages} variantColors={variants.filter((v) => v.color).map((v) => ({ name: v.color, hex: v.color_hex }))} /></div>

              <div>
                <label className="label">Product Videos</label>
                <div className="space-y-2">
                  {videos.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2 dark:border-neutral-700">
                      <video src={v.url} className="h-12 w-16 flex-shrink-0 rounded bg-black object-contain" muted />
                      <input value={v.url} onChange={(e) => { const nv = [...videos]; nv[i].url = e.target.value; setVideos(nv); }} className="input flex-1 py-1 text-xs" placeholder="Video URL" />
                      <input value={v.title} onChange={(e) => { const nv = [...videos]; nv[i].title = e.target.value; setVideos(nv); }} className="input w-24 py-1 text-xs" placeholder="Title" />
                      <button onClick={() => { const nv = [...videos]; nv[i].is_primary = !nv[i].is_primary; setVideos(nv); }} className={cn('rounded p-1', v.is_primary ? 'bg-primary-100 text-primary-600' : 'text-neutral-400')} title="Primary"><Star size={14} /></button>
                      <button onClick={() => { const nv = [...videos]; nv[i].active = !nv[i].active; setVideos(nv); }} className={cn('rounded p-1 text-xs', v.active ? 'bg-green-100 text-green-600' : 'bg-neutral-100 text-neutral-400')} title={v.active ? 'Active' : 'Disabled'}>{v.active ? 'ON' : 'OFF'}</button>
                      <button onClick={() => setVideos(videos.filter((_, idx) => idx !== i))} className="text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} placeholder="Paste video URL (mp4/webm)" className="input flex-1 py-1.5 text-sm" />
                    <button onClick={() => { if (newVideoUrl.trim()) { setVideos([...videos, { url: newVideoUrl.trim(), title: '', sort_order: videos.length, is_primary: videos.length === 0, active: true }]); setNewVideoUrl(''); } }} className="btn-outline text-sm"><Plus size={14} /> Add</button>
                  </div>
                </div>
              </div>

              <div><label className="label">Badges</label><div className="flex flex-wrap gap-2">{PRODUCT_BADGES.map((b) => (<label key={b.key} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-700"><input type="checkbox" checked={form[b.key as keyof typeof form] as boolean} onChange={(e) => setForm({ ...form, [b.key]: e.target.checked })} className="rounded" />{b.label}</label>))}</div></div>

              <div>
                <div className="mb-2 flex items-center justify-between"><label className="label mb-0">Variants</label><button onClick={addVariant} className="btn-ghost text-sm"><Plus size={14} /> Add Variant</button></div>
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                      <div className="grid gap-2 md:grid-cols-3">
                        <input value={v.sku} onChange={(e) => { const nv = [...variants]; nv[i].sku = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm" placeholder="SKU" />
                        <input type="number" value={v.price} onChange={(e) => { const nv = [...variants]; nv[i].price = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm" placeholder="Price" />
                        <select value={v.size_label} onChange={(e) => { const nv = [...variants]; nv[i].size_label = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm"><option value="">Size</option>{SIZES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}</select>
                        <select value={v.weight} onChange={(e) => { const nv = [...variants]; nv[i].weight = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm"><option value="">Weight</option>{WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}</select>
                        <select value={v.filling} onChange={(e) => { const nv = [...variants]; nv[i].filling = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm"><option value="">Filling</option>{FILLINGS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                        <select value={v.fabric} onChange={(e) => { const nv = [...variants]; nv[i].fabric = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm"><option value="">Fabric</option>{FABRICS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                        <select value={v.color} onChange={(e) => { const nv = [...variants]; nv[i].color = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm"><option value="">Color</option>{COLORS.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select>
                        <input value={v.color_hex} onChange={(e) => { const nv = [...variants]; nv[i].color_hex = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm" placeholder="Hex" />
                        <input type="number" value={v.stock} onChange={(e) => { const nv = [...variants]; nv[i].stock = e.target.value; setVariants(nv); }} className="input py-1.5 text-sm" placeholder="Stock" />
                      </div>
                      <button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} className="mt-2 text-xs text-red-500">Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={save} disabled={saving} className="btn-primary w-full">{saving ? <Spinner size={16} /> : 'Save Product'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ORDERS TAB
// ============================================================
function OrdersTab({ orders, payments, products, orderModal, setOrderModal, reload }: {
  orders: Order[]; payments: Payment[]; products: Product[]; orderModal: Order | null; setOrderModal: (o: Order | null) => void; reload: () => void;
}) {
  const [filter, setFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [orderHistory, setOrderHistory] = useState<{ id: string; status: string; notes: string | null; changed_by: string | null; created_at: string }[]>([]);
  const [trackingInput, setTrackingInput] = useState('');
  const [courierInput, setCourierInput] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const statuses = Object.entries(ORDER_STATUS_LABELS);
  const visibleOrders = orders.filter((o) => !!o.is_archived === showArchived);
  const statusFiltered = filter === 'all' ? visibleOrders : visibleOrders.filter((o) => o.status === filter);
  const filtered = search
    ? statusFiltered.filter((o) => {
        const q = search.toLowerCase();
        return (o.order_number ?? '').toLowerCase().includes(q)
          || (o.customer_name ?? '').toLowerCase().includes(q)
          || (o.customer_phone ?? '').includes(q)
          || (o.city ?? '').toLowerCase().includes(q)
          || (o.area ?? '').toLowerCase().includes(q)
          || (o.payment_status ?? '').toLowerCase().includes(q)
          || (o.payment_method ?? '').toLowerCase().includes(q);
      })
    : statusFiltered;

  const toggleArchive = async (order: Order) => {
    const { error } = await supabase.from('orders').update({
      is_archived: !order.is_archived,
      archived_at: !order.is_archived ? new Date().toISOString() : null,
    }).eq('id', order.id);
    if (error) { alert('Could not update archive status: ' + error.message); return; }
    reload();
  };

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.rpc('update_order_status', { p_order_id: orderId, p_new_status: status, p_notes: null });
    if (error) { alert('Could not update order status: ' + error.message); return; }
    reload();
    if (orderModal?.id === orderId) {
      loadOrderHistory(orderId);
    }
  };

  const loadOrderHistory = async (orderId: string) => {
    const { data } = await supabase.from('order_status_history').select('id, status, notes, changed_by, created_at').eq('order_id', orderId).order('created_at', { ascending: true });
    setOrderHistory((data as { id: string; status: string; notes: string | null; changed_by: string | null; created_at: string }[]) ?? []);
  };

  const openOrderModal = (order: Order) => {
    setOrderModal(order);
    setTrackingInput(order.tracking_number ?? '');
    setCourierInput(order.courier ?? '');
    setInternalNote(order.internal_notes ?? '');
    loadOrderHistory(order.id);
  };

  const saveTracking = async () => {
    if (!orderModal) return;
    const { error } = await supabase.from('orders').update({
      tracking_number: trackingInput || null,
      courier: courierInput || null,
      updated_at: new Date().toISOString(),
    }).eq('id', orderModal.id);
    if (error) { alert('Could not save tracking: ' + error.message); return; }
    reload();
  };

  const saveInternalNote = async () => {
    if (!orderModal) return;
    const { error } = await supabase.from('orders').update({
      internal_notes: internalNote || null,
      updated_at: new Date().toISOString(),
    }).eq('id', orderModal.id);
    if (error) { alert('Could not save note: ' + error.message); return; }
    reload();
  };

  const printInvoice = () => {
    if (!orderModal) return;
    navigate(`/invoice?order=${orderModal.order_number}&token=${orderModal.tracking_token}`);
  };

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Orders ({filtered.length})</h3>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order number, customer name, phone, city, area, payment status..." className="input mb-4" />
      <div className="mb-4 flex gap-1 overflow-x-auto">
        <button onClick={() => setFilter('all')} className={cn('flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium', filter === 'all' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>All ({visibleOrders.length})</button>
        {statuses.slice(0, 8).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={cn('flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium', filter === key ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>{label} ({visibleOrders.filter((o) => o.status === key).length})</button>
        ))}
      </div>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setShowArchived(!showArchived)} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium', showArchived ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-neutral-100 dark:bg-neutral-800')}>
          <Archive size={14} /> {showArchived ? 'Showing Archived' : 'Show Archived'} ({orders.filter((o) => o.is_archived).length})
        </button>
      </div>
      <div className="space-y-2">
        {filtered.map((o) => (
          <div key={o.id} className="card flex flex-wrap items-center gap-3 p-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">{o.order_number}</p>
              <p className="text-xs text-neutral-400">{o.customer_name} · {o.customer_phone} · {formatDateTime(o.created_at)}</p>
            </div>
            <span className="text-sm font-bold">{formatPrice(o.total)}</span>
            <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="input w-auto py-1.5 text-sm">{statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <button onClick={() => openOrderModal(o)} className="btn-ghost p-1.5"><Eye size={16} /></button>
            <button onClick={() => toggleArchive(o)} className="btn-ghost p-1.5" title={o.is_archived ? 'Unarchive' : 'Archive'}><Archive size={16} /></button>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon={<ShoppingCart size={48} />} title="No orders found" />}
      </div>

      {orderModal && (
        <Modal open={!!orderModal} onClose={() => setOrderModal(null)} title={`Order ${orderModal.order_number}`} maxWidth="max-w-3xl">
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            {/* Customer + Delivery */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="mb-2 text-sm font-semibold">Customer</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{orderModal.customer_name}</p>
                <p className="text-sm text-neutral-500">{orderModal.customer_phone}</p>
                {orderModal.customer_email && <p className="text-sm text-neutral-500">{orderModal.customer_email}</p>}
                <p className="mt-1 text-xs text-neutral-400">{formatDateTime(orderModal.created_at)}</p>
              </div>
              <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="mb-2 text-sm font-semibold">Delivery Address</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{orderModal.address}</p>
                <p className="text-sm text-neutral-500">{orderModal.city}{orderModal.area ? `, ${orderModal.area}` : ''}</p>
                <p className="text-sm text-neutral-500">{orderModal.country}</p>
                {orderModal.landmark && <p className="text-xs text-neutral-400">Landmark: {orderModal.landmark}</p>}
                {orderModal.delivery_instructions && <p className="text-xs text-neutral-400">Instructions: {orderModal.delivery_instructions}</p>}
                <p className="mt-1 text-xs font-medium text-primary-600">Delivery Fee: {formatPrice(orderModal.shipping_fee)}</p>
              </div>
            </div>

            {/* Items with images */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="mb-2 text-sm font-semibold">Items</p>
              <div className="space-y-2">
                {orderModal.order_items?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg bg-neutral-50 p-2 dark:bg-neutral-900">
                    {item.product_id && (
                      <div className="flex-shrink-0">
                        {(() => {
                          const product = products.find((p) => p.id === item.product_id);
                          const img = product?.product_images?.[0];
                          return img ? <img src={img.url} alt={item.product_name} className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-200 dark:bg-neutral-800"><Package size={16} className="text-neutral-400" /></div>;
                        })()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-neutral-400">
                        {item.size_label && <span>{item.size_label} · </span>}
                        {item.color && <span>{item.color} · </span>}
                        {item.design && <span>{item.design} · </span>}
                        {item.filling && <span>{item.filling} · </span>}
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-medium">{formatPrice(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                {orderModal.discount > 0 && <div className="flex justify-between text-sm text-neutral-500"><span>Subtotal</span><span>{formatPrice(orderModal.subtotal)}</span></div>}
                {orderModal.discount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount {orderModal.coupon_code ? `(${orderModal.coupon_code})` : ''}</span><span>-{formatPrice(orderModal.discount)}</span></div>}
                <div className="flex justify-between text-sm text-neutral-500"><span>Delivery Fee</span><span>{formatPrice(orderModal.shipping_fee)}</span></div>
                <div className="mt-1 flex justify-between font-bold"><span>Total</span><span className="text-primary-600">{formatPrice(orderModal.total)}</span></div>
                <p className="mt-1 text-sm text-neutral-500">Payment: {PAYMENT_METHOD_LABELS[orderModal.payment_method] ?? orderModal.payment_method} · {PAYMENT_STATUS_LABELS[orderModal.payment_status] ?? orderModal.payment_status}</p>
              </div>
            </div>

            {/* Payment details */}
            {(() => {
              const orderPayments = payments.filter((p) => p.order_id === orderModal.id);
              const orderPayment = orderPayments[0];
              if (!orderPayment) {
                return (
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                    <div className="mb-2 flex items-center gap-2 font-semibold"><CreditCard size={18} /> Payment</div>
                    <p className="text-sm text-neutral-500">No payment record found for this order.</p>
                  </div>
                );
              }
              const isCOD = orderPayment.method === 'cod' || orderPayment.method === 'hand-to-hand';
              const isOnline = orderPayment.method === 'bank' || orderPayment.method === 'jazzcash' || orderPayment.method === 'easypaisa';
              const needsVerification = orderPayment.status === 'submitted' || (orderPayment.status === 'pending' && isOnline);
              const statusLabel = PAYMENT_STATUS_LABELS[orderPayment.status] ?? orderPayment.status;
              const methodLabel = PAYMENT_METHOD_LABELS[orderPayment.method] ?? orderPayment.method;
              const statusColor = orderPayment.status === 'paid' ? 'green' : orderPayment.status === 'failed' ? 'red' : orderPayment.status === 'refunded' || orderPayment.status === 'partially_refunded' ? 'neutral' : 'amber';
              return (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                  <div className="mb-3 flex items-center gap-2 font-semibold"><CreditCard size={18} /> Payment Details</div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-neutral-500">Method:</span> <span className="font-medium">{methodLabel}</span></div>
                    <div><span className="text-neutral-500">Amount:</span> <span className="font-medium">{formatPrice(orderPayment.amount)}</span></div>
                    <div><span className="text-neutral-500">Status:</span> <Badge color={statusColor as 'green' | 'red' | 'neutral' | 'amber'}>{statusLabel}</Badge></div>
                    <div><span className="text-neutral-500">Created:</span> <span className="text-neutral-600 dark:text-neutral-300">{formatDateTime(orderPayment.created_at)}</span></div>
                    {orderPayment.transaction_ref && <div><span className="text-neutral-500">Transaction Ref:</span> <span className="font-medium">{orderPayment.transaction_ref}</span></div>}
                    {orderPayment.verified_at && <div><span className="text-neutral-500">Verified At:</span> <span className="text-neutral-600 dark:text-neutral-300">{formatDateTime(orderPayment.verified_at)}</span></div>}
                    {orderPayment.rejection_reason && <div className="sm:col-span-2"><span className="text-neutral-500">Rejection Reason:</span> <span className="text-red-600">{orderPayment.rejection_reason}</span></div>}
                  </div>
                  {orderPayment.proof_url && <ProofLink proofPath={orderPayment.proof_url} />}
                  {isCOD && orderPayment.status === 'pending' && (
                    <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">COD payment will be collected on delivery. Use the order status to track delivery progress.</p>
                  )}
                  {needsVerification && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={async () => {
                        const { error } = await supabase.rpc('verify_payment', { p_payment_id: orderPayment.id, p_decision: 'paid', p_notes: null });
                        if (error) { alert('Could not verify payment: ' + error.message); return; }
                        reload(); setOrderModal(null);
                      }} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Approve Payment</button>
                      <button onClick={async () => {
                        const reason = prompt('Enter rejection reason:') || 'Payment could not be verified';
                        const { error } = await supabase.rpc('verify_payment', { p_payment_id: orderPayment.id, p_decision: 'failed', p_notes: reason });
                        if (error) { alert('Could not update payment: ' + error.message); return; }
                        await supabase.from('payments').update({ rejection_reason: reason }).eq('id', orderPayment.id);
                        reload(); setOrderModal(null);
                      }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Reject Payment</button>
                    </div>
                  )}
                  {isCOD && orderPayment.status === 'pending' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={async () => {
                        const { error } = await supabase.rpc('verify_payment', { p_payment_id: orderPayment.id, p_decision: 'paid', p_notes: 'COD payment collected' });
                        if (error) { alert('Could not update payment: ' + error.message); return; }
                        reload(); setOrderModal(null);
                      }} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">Mark COD Collected</button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Order timeline */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="mb-3 text-sm font-semibold">Order Timeline</p>
              {orderHistory.length === 0 ? (
                <p className="py-2 text-sm text-neutral-400">No status history yet</p>
              ) : (
                <div className="space-y-2">
                  {orderHistory.map((h, i) => (
                    <div key={h.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold', i === orderHistory.length - 1 ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700')}>
                          {i + 1}
                        </div>
                        {i < orderHistory.length - 1 && <div className="h-6 w-0.5 bg-neutral-200 dark:bg-neutral-700" />}
                      </div>
                      <div className="pb-2">
                        <p className="text-sm font-medium">{ORDER_STATUS_LABELS[h.status] ?? h.status}</p>
                        {h.notes && <p className="text-xs text-neutral-400">{h.notes}</p>}
                        <p className="text-xs text-neutral-400">{formatDateTime(h.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tracking + Courier */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="mb-3 text-sm font-semibold">Tracking Information</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><label className="label">Tracking Number</label><input value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} className="input" placeholder="e.g. TCS-12345" /></div>
                <div><label className="label">Courier</label><input value={courierInput} onChange={(e) => setCourierInput(e.target.value)} className="input" placeholder="e.g. TCS, Leopards" /></div>
              </div>
              {(trackingInput !== (orderModal.tracking_number ?? '') || courierInput !== (orderModal.courier ?? '')) && (
                <button onClick={saveTracking} className="btn-primary mt-2 text-sm"><Check size={14} /> Save Tracking</button>
              )}
            </div>

            {/* Customer notes */}
            {orderModal.notes && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
                <p className="font-medium text-amber-700 dark:text-amber-400">Customer Notes:</p>
                <p className="text-neutral-600 dark:text-neutral-300">{orderModal.notes}</p>
              </div>
            )}

            {/* Internal notes */}
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="mb-2 text-sm font-semibold">Internal Notes (not visible to customer)</p>
              <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} className="input" placeholder="Add internal notes about this order..." />
              {internalNote !== (orderModal.internal_notes ?? '') && (
                <button onClick={saveInternalNote} className="btn-primary mt-2 text-sm"><Check size={14} /> Save Note</button>
              )}
            </div>

            {/* Status + Actions */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex-1">
                <label className="label">Update Status</label>
                <select value={orderModal.status} onChange={(e) => updateStatus(orderModal.id, e.target.value)} className="input">{statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
              </div>
              <button onClick={printInvoice} className="btn-outline text-sm"><FileText size={14} /> Print Invoice</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// CATEGORIES TAB
// ============================================================
function CategoriesTab({ categories, reload }: { categories: Category[]; reload: () => void }) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');

  const add = async () => {
    if (!name) return;
    const { error } = await supabase.from('categories').insert({ name, slug: slugify(name) + '-' + Date.now().toString().slice(-4), parent_id: parentId || null, sort_order: 0 });
    if (error) { alert('Could not add category: ' + error.message); return; }
    setName(''); reload();
  };

  const del = async (id: string) => { if (!confirm('Delete category?')) return; const { error } = await supabase.from('categories').delete().eq('id', id); if (error) { alert('Could not delete category: ' + error.message); return; } reload(); };
  const parents = categories.filter((c) => !c.parent_id);

  return (
    <div>
      <div className="mb-4 card p-4">
        <h3 className="mb-3 text-sm font-semibold">Add Category</h3>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Category name" />
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input w-auto"><option value="">Top level</option>{parents.map((c) => <option key={c.id} value={c.id}>Under {c.name}</option>)}</select>
          <button onClick={add} className="btn-primary"><Plus size={16} /> Add</button>
        </div>
      </div>
      <div className="space-y-2">
        {parents.map((c) => (
          <div key={c.id}>
            <div className="card flex items-center justify-between p-3"><span className="font-semibold">{c.name}</span><button onClick={() => del(c.id)} className="text-red-500"><Trash2 size={16} /></button></div>
            <div className="ml-4 mt-1 space-y-1 border-l border-neutral-200 pl-4 dark:border-neutral-800">
              {categories.filter((sc) => sc.parent_id === c.id).map((sc) => (<div key={sc.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"><span>{sc.name}</span><button onClick={() => del(sc.id)} className="text-red-500"><Trash2 size={14} /></button></div>))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CUSTOMERS TAB (CRM)
// ============================================================
function CustomersTab({ customers, orders }: { customers: CustomerProfile[]; orders: Order[] }) {
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [search, setSearch] = useState('');

  const getCustomerOrders = (id: string) => orders.filter((o) => o.user_id === id);
  const filtered = customers.filter((c) => !search || (c.full_name ?? '').toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search));

  const segmented = (c: CustomerProfile) => {
    const cOrders = getCustomerOrders(c.id);
    const total = cOrders.reduce((s, o) => s + o.total, 0);
    if (total > 50000) return { label: 'VIP', color: 'accent' };
    if (cOrders.length > 3) return { label: 'Returning', color: 'primary' };
    if (cOrders.length === 0) return { label: 'New', color: 'amber' };
    return { label: 'Regular', color: 'neutral' };
  };

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Customers ({filtered.length})</h3>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="input mb-4" />
      <div className="space-y-2">
        {filtered.map((c) => {
          const cOrders = getCustomerOrders(c.id);
          const total = cOrders.reduce((s, o) => s + o.total, 0);
          const seg = segmented(c);
          return (
            <button key={c.id} onClick={() => setSelected(c)} className="card flex w-full items-center gap-3 p-3 text-left hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30"><UserCheck size={18} /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{c.full_name || 'Unknown'}</p>
                <p className="text-xs text-neutral-400">{c.phone ?? 'No phone'} · {cOrders.length} orders · {formatPrice(total)} spent</p>
              </div>
              <Badge color={seg.color}>{seg.label}</Badge>
            </button>
          );
        })}
        {filtered.length === 0 && <EmptyState icon={<Users size={48} />} title="No customers found" />}
      </div>

      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={selected.full_name || 'Customer'} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="text-sm font-semibold">Phone</p><p className="text-sm text-neutral-500">{selected.phone ?? 'N/A'}</p></div>
              <div><p className="text-sm font-semibold">Joined</p><p className="text-sm text-neutral-500">{formatDate(selected.created_at)}</p></div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Order History</p>
              <div className="space-y-2">
                {getCustomerOrders(selected.id).map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3 text-sm dark:border-neutral-800">
                    <div><p className="font-medium">{o.order_number}</p><p className="text-xs text-neutral-400">{formatDateTime(o.created_at)}</p></div>
                    <div className="flex items-center gap-2"><span className="font-bold">{formatPrice(o.total)}</span><Badge color="neutral">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge></div>
                  </div>
                ))}
                {getCustomerOrders(selected.id).length === 0 && <p className="py-3 text-center text-sm text-neutral-400">No orders yet</p>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// MESSAGES TAB
// ============================================================
function MessagesTab({ messages, quickReplies, reload }: { messages: { user_id: string; user_name: string; last_body: string; last_date: string; unread: number }[]; quickReplies: QuickReply[]; reload: () => void }) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [conversation, setConversation] = useState<{ id: string; body: string; sender: string; created_at: string }[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);

  const loadConversation = async (userId: string) => {
    setSelectedUser(userId);
    const { data } = await supabase.from('messages').select('id, body, sender, created_at').eq('user_id', userId).order('created_at', { ascending: true });
    setConversation((data as { id: string; body: string; sender: string; created_at: string }[]) ?? []);
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedUser) return;
    setLoading(true);
    const { error } = await supabase.rpc('send_owner_message', { p_customer_id: selectedUser, p_body: reply.trim() });
    if (error) { alert('Could not send message: ' + error.message); setLoading(false); return; }
    setReply('');
    await loadConversation(selectedUser);
    reload();
    setLoading(false);
  };

  const useQuickReply = (qr: QuickReply) => { setReply(qr.body); };

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* Conversation list */}
      <div className="card max-h-[70vh] overflow-y-auto p-2">
        {messages.length === 0 ? (
          <EmptyState icon={<MessageCircle size={36} />} title="No messages" />
        ) : (
          messages.map((m) => (
            <button key={m.user_id} onClick={() => loadConversation(m.user_id)} className={cn('flex w-full flex-col gap-1 rounded-lg p-3 text-left transition', selectedUser === m.user_id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800')}>
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{m.user_name.slice(0, 8)}...</span>
                {m.unread > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{m.unread}</span>}
              </div>
              <p className="truncate text-xs text-neutral-400">{m.last_body}</p>
            </button>
          ))
        )}
      </div>

      {/* Chat area */}
      <div className="card flex flex-col" style={{ height: '70vh' }}>
        {selectedUser ? (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {conversation.map((m) => (
                <div key={m.id} className={cn('mb-3 flex', m.sender === 'owner' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[75%] rounded-xl px-4 py-2 text-sm', m.sender === 'owner' ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>
                    <p>{m.body}</p>
                    <p className="mt-1 text-[10px] opacity-60">{formatDateTime(m.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
              <div className="mb-2 flex flex-wrap gap-1">
                {quickReplies.slice(0, 5).map((qr) => (
                  <button key={qr.id} onClick={() => useQuickReply(qr)} className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">{qr.title}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendReply()} placeholder="Type your reply..." className="input flex-1" />
                <button onClick={sendReply} disabled={loading} className="btn-primary"><Mail size={16} /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center"><EmptyState icon={<MessageCircle size={48} />} title="Select a conversation" /></div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CUSTOM ORDERS TAB
// ============================================================
function CustomTab({ customOrders, reload }: { customOrders: CustomOrder[]; reload: () => void }) {
  const [quoteModal, setQuoteModal] = useState<CustomOrder | null>(null);
  const [quote, setQuote] = useState({ price: '', production_time: '', delivery_charge: '', notes: '' });

  const sendQuote = async () => {
    if (!quoteModal) return;
    if (!quote.price || parseFloat(quote.price) <= 0) { alert('Valid price required'); return; }
    const { error: qError } = await supabase.from('custom_quotes').insert({ custom_order_id: quoteModal.id, price: parseFloat(quote.price) || 0, production_time: quote.production_time || null, delivery_charge: parseFloat(quote.delivery_charge) || 0, notes: quote.notes || null, status: 'sent' });
    if (qError) { alert('Could not send quote: ' + qError.message); return; }
    const { error: sError } = await supabase.rpc('update_custom_order_status', { p_custom_order_id: quoteModal.id, p_new_status: 'quoted' });
    if (sError) { alert('Could not update order status: ' + sError.message); return; }
    setQuoteModal(null); setQuote({ price: '', production_time: '', delivery_charge: '', notes: '' }); reload();
  };

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Custom Order Requests ({customOrders.length})</h3>
      <div className="space-y-3">
        {customOrders.map((co) => (
          <div key={co.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{co.product_type} × {co.quantity}</p>
              <Badge color={co.status === 'requested' ? 'amber' : co.status === 'quoted' ? 'accent' : 'neutral'}>{co.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-500">{[co.size_label || (co.width && co.length ? `${co.width}×${co.length} ${co.unit}` : ''), co.weight, co.color, co.filling, co.fabric_source === 'customer' ? 'Customer fabric' : co.fabric, co.stitching].filter(Boolean).join(' · ')}</p>
            {co.fabric_source === 'customer' && co.fabric_details && <p className="mt-1 text-xs text-accent-600">Customer fabric: {co.fabric_details}</p>}
            {co.instructions && <p className="mt-2 text-sm text-neutral-400">{co.instructions}</p>}
            {co.custom_order_images && co.custom_order_images.length > 0 && (<div className="mt-2 flex gap-2">{co.custom_order_images.map((img) => (<a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="h-16 w-16 overflow-hidden rounded-lg"><img src={img.url} alt="" className="h-full w-full object-cover" /></a>))}</div>)}
            {co.custom_quotes && co.custom_quotes.length > 0 && (<div className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900"><p className="text-sm font-medium">Quote: {formatPrice(co.custom_quotes[0].price)}</p><p className="text-xs text-neutral-500">Status: {co.custom_quotes[0].status}</p></div>)}
            {co.status === 'requested' && (<button onClick={() => { setQuoteModal(co); setQuote({ price: '', production_time: '', delivery_charge: '', notes: '' }); }} className="btn-primary mt-3 text-sm">Send Quote</button>)}
          </div>
        ))}
        {customOrders.length === 0 && <EmptyState icon={<Scissors size={48} />} title="No custom requests" />}
      </div>

      {quoteModal && (
        <Modal open={!!quoteModal} onClose={() => setQuoteModal(null)} title={`Quote for ${quoteModal.product_type}`}>
          <div className="space-y-4">
            <div><label className="label">Price (Rs.) *</label><input type="number" value={quote.price} onChange={(e) => setQuote({ ...quote, price: e.target.value })} className="input" /></div>
            <div><label className="label">Production Time</label><input value={quote.production_time} onChange={(e) => setQuote({ ...quote, production_time: e.target.value })} className="input" placeholder="e.g. 5-10 days" /></div>
            <div><label className="label">Delivery Charge</label><input type="number" value={quote.delivery_charge} onChange={(e) => setQuote({ ...quote, delivery_charge: e.target.value })} className="input" /></div>
            <div><label className="label">Notes</label><textarea value={quote.notes} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} rows={3} className="input" /></div>
            <button onClick={sendQuote} className="btn-primary w-full">Send Quote</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// QUOTATIONS TAB
// ============================================================
function QuotationsTab({ customOrders, reload }: { customOrders: CustomOrder[]; reload: () => void }) {
  const quoted = customOrders.filter((c) => c.status === 'quoted' || c.status === 'accepted');
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Quotations ({quoted.length})</h3>
      <div className="space-y-3">
        {quoted.map((co) => (
          <div key={co.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{co.product_type} × {co.quantity}</p>
              <Badge color={co.status === 'accepted' ? 'green' : 'accent'}>{co.status}</Badge>
            </div>
            {co.custom_quotes && co.custom_quotes.length > 0 && (
              <div className="mt-2 space-y-1 text-sm">
                <p><span className="text-neutral-500">Price:</span> <span className="font-bold">{formatPrice(co.custom_quotes[0].price)}</span></p>
                {co.custom_quotes[0].production_time && <p className="text-neutral-500">Production: {co.custom_quotes[0].production_time}</p>}
                <p className="text-neutral-500">Quote Status: {co.custom_quotes[0].status}</p>
                {co.custom_quotes[0].notes && <p className="text-neutral-400">Notes: {co.custom_quotes[0].notes}</p>}
              </div>
            )}
            {co.status === 'quoted' && (
              <div className="mt-3 flex gap-2">
                <button onClick={async () => { const { error } = await supabase.rpc('update_custom_order_status', { p_custom_order_id: co.id, p_new_status: 'accepted' }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">Mark Accepted</button>
                <button onClick={async () => { const { error } = await supabase.rpc('update_custom_order_status', { p_custom_order_id: co.id, p_new_status: 'rejected' }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Mark Rejected</button>
              </div>
            )}
          </div>
        ))}
        {quoted.length === 0 && <EmptyState icon={<FileText size={48} />} title="No quotations sent" />}
      </div>
    </div>
  );
}

// ============================================================
// PRODUCTION TAB
// ============================================================
function ProductionTab({ productionOrders, reload }: { productionOrders: ProductionOrder[]; reload: () => void }) {
  const PRODUCTION_STAGES: Record<string, string> = { pending: 'Pending', material_check: 'Material Check', cutting: 'Cutting', stitching: 'Stitching', finishing: 'Finishing', quality_check: 'Quality Check', packing: 'Packing', ready: 'Ready', completed: 'Completed' };

  const updateStage = async (id: string, status: string) => {
    const { error } = await supabase.rpc('update_production_status', { p_production_id: id, p_new_status: status });
    if (error) { alert(error.message); return; }
    reload();
  };

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Production Orders ({productionOrders.length})</h3>
      <div className="space-y-3">
        {productionOrders.map((po) => (
          <div key={po.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{(po as unknown as { order?: { order_number?: string; customer_name?: string } }).order?.order_number ?? 'Unknown'}</p>
                <p className="text-xs text-neutral-400">{(po as unknown as { order?: { customer_name?: string } }).order?.customer_name ?? ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {po.deadline && <Badge color={new Date(po.deadline) < new Date() ? 'red' : 'amber'}>Due: {formatDate(po.deadline)}</Badge>}
                <select value={po.status} onChange={(e) => updateStage(po.id, e.target.value)} className="input w-auto py-1.5 text-sm">
                  {Object.entries(PRODUCTION_STAGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
            </div>
            {po.stage_notes && <p className="mt-2 text-sm text-neutral-400">{po.stage_notes}</p>}
            {po.expected_completion && <p className="mt-1 text-xs text-neutral-500">Expected: {formatDate(po.expected_completion)}</p>}
          </div>
        ))}
        {productionOrders.length === 0 && <EmptyState icon={<Factory size={48} />} title="No production orders" />}
      </div>
    </div>
  );
}

// ============================================================
// INVENTORY TAB
// ============================================================
function InventoryTab({ materials, suppliers, reload }: { materials: Material[]; suppliers: Supplier[]; reload: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'kg', stock: '', cost: '', supplier_id: '', min_stock: '', reorder_level: '' });

  const save = async () => {
    if (!form.name) { alert('Material name required'); return; }
    const { error } = await supabase.from('materials').insert({ name: form.name, unit: form.unit, stock: parseFloat(form.stock) || 0, cost: parseFloat(form.cost) || 0, supplier_id: form.supplier_id || null, min_stock: parseFloat(form.min_stock) || 0, reorder_level: parseFloat(form.reorder_level) || 0 });
    if (error) { alert('Could not save material: ' + error.message); return; }
    setShowModal(false); setForm({ name: '', unit: 'kg', stock: '', cost: '', supplier_id: '', min_stock: '', reorder_level: '' }); reload();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Inventory ({materials.length})</h3>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Add Material</button>
      </div>
      <div className="space-y-2">
        {materials.map((m) => (
          <div key={m.id} className="card flex items-center justify-between p-3">
            <div><p className="text-sm font-semibold">{m.name}</p><p className="text-xs text-neutral-400">{m.supplier?.name ?? 'No supplier'} · {formatPrice(m.cost)}/{m.unit}</p></div>
            <div className="flex items-center gap-3"><span className="text-sm">{m.stock} {m.unit}</span>{m.stock <= m.reorder_level && <Badge color="red">Reorder</Badge>}{m.stock <= m.min_stock && <Badge color="amber">Low</Badge>}</div>
          </div>
        ))}
        {materials.length === 0 && <EmptyState icon={<Boxes size={48} />} title="No materials tracked" />}
      </div>
      {showModal && <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Material"><div className="space-y-3"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Material name" /><div className="grid grid-cols-2 gap-3"><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" placeholder="Stock" /><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input"><option value="kg">kg</option><option value="meter">meter</option><option value="piece">piece</option><option value="roll">roll</option></select><input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input" placeholder="Cost per unit" /><select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input"><option value="">No supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className="input" placeholder="Min stock" /><input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} className="input" placeholder="Reorder level" /></div><button onClick={save} className="btn-primary w-full">Save</button></div></Modal>}
    </div>
  );
}

// ============================================================
// SUPPLIERS TAB
// ============================================================
function SuppliersTab({ suppliers, reload }: { suppliers: Supplier[]; reload: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', material: '', notes: '' });
  const save = async () => { if (!form.name) { alert('Supplier name required'); return; } const { error } = await supabase.from('suppliers').insert({ name: form.name, contact: form.contact, material: form.material, notes: form.notes }); if (error) { alert('Could not save supplier: ' + error.message); return; } setShowModal(false); setForm({ name: '', contact: '', material: '', notes: '' }); reload(); };
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Suppliers ({suppliers.length})</h3><button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Add Supplier</button></div>
      <div className="space-y-2">
        {suppliers.map((s) => (<div key={s.id} className="card p-3"><p className="text-sm font-semibold">{s.name}</p><p className="text-xs text-neutral-400">{s.contact} · {s.material}</p></div>))}
        {suppliers.length === 0 && <EmptyState icon={<Truck size={48} />} title="No suppliers added" />}
      </div>
      {showModal && <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Supplier"><div className="space-y-3"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Supplier name" /><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="input" placeholder="Contact" /><input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} className="input" placeholder="Material" /><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Notes" /><button onClick={save} className="btn-primary w-full">Save</button></div></Modal>}
    </div>
  );
}

// ============================================================
// PAYMENTS TAB
// ============================================================
function PaymentsTab({ payments, orders, reload }: { payments: Payment[]; orders: Order[]; reload: () => void }) {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [events, setEvents] = useState<{ id: string; event_type: string; previous_status: string | null; new_status: string | null; description: string | null; created_at: string }[]>([]);

  const onlinePending = payments.filter((p) => p.status === 'submitted');
  const codPending = payments.filter((p) => p.status === 'pending' && p.method === 'cod');
  const verified = payments.filter((p) => p.status === 'paid');
  const failed = payments.filter((p) => p.status === 'failed');
  const refunded = payments.filter((p) => p.status === 'refunded' || p.status === 'partially_refunded');
  const getOrder = (id: string) => orders.find((o) => o.id === id);

  const methods = ['all', ...Array.from(new Set(payments.map((p) => p.method)))];
  const statuses = ['all', 'pending', 'submitted', 'paid', 'failed', 'refunded', 'partially_refunded'];

  const searched = payments.filter((p) => {
    const order = getOrder(p.order_id);
    const q = search.toLowerCase();
    const matchesSearch = !search
      || (order?.order_number ?? '').toLowerCase().includes(q)
      || (order?.customer_name ?? '').toLowerCase().includes(q)
      || (order?.customer_phone ?? '').includes(q)
      || (p.transaction_ref ?? '').toLowerCase().includes(q);
    const matchesMethod = methodFilter === 'all' || p.method === methodFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const openDetail = async (p: Payment) => {
    setDetailPayment(p);
    const { data } = await supabase.from('payment_events').select('id, event_type, previous_status, new_status, description, created_at').eq('payment_id', p.id).order('created_at', { ascending: true });
    setEvents((data as { id: string; event_type: string; previous_status: string | null; new_status: string | null; description: string | null; created_at: string }[]) ?? []);
  };

  const renderPaymentRow = (p: Payment, actions?: React.ReactNode, badge?: React.ReactNode) => {
    const order = getOrder(p.order_id);
    return (
      <div key={p.id} className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{order?.order_number ?? 'Unknown order'}</p>
            <p className="text-xs text-neutral-400">{order?.customer_name} · {formatPrice(p.amount)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}</p>
            {p.transaction_ref && <p className="text-xs text-neutral-500">Ref: {p.transaction_ref}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badge}
            {p.proof_url && <ProofLink proofPath={p.proof_url} label="View Proof" />}
            <button onClick={() => openDetail(p)} className="btn-ghost p-1.5"><Eye size={16} /></button>
            {actions}
          </div>
        </div>
      </div>
    );
  };

  const verifyActions = (p: Payment) => (
    <>
      <button onClick={async () => { const { error } = await supabase.rpc('verify_payment', { p_payment_id: p.id, p_decision: 'paid' }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">Verify</button>
      <button onClick={async () => { const reason = prompt('Enter rejection reason:') || 'Payment rejected'; const { error } = await supabase.rpc('verify_payment', { p_payment_id: p.id, p_decision: 'failed', p_notes: reason }); if (error) { alert(error.message); return; } await supabase.from('payments').update({ rejection_reason: reason }).eq('id', p.id); reload(); }} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Reject</button>
    </>
  );

  const detailOrder = detailPayment ? getOrder(detailPayment.order_id) : null;

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order number, transaction ID, customer name, phone..." className="input" />
          </div>
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="input">
            {methods.map((m) => <option key={m} value={m}>{m === 'all' ? 'All Methods' : m}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input">
            {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-neutral-500">Total Payments</p><p className="text-xl font-bold">{payments.length}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Paid</p><p className="text-xl font-bold text-green-600">{verified.length}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Pending Verification</p><p className="text-xl font-bold text-amber-600">{onlinePending.length}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Refunded</p><p className="text-xl font-bold text-red-600">{refunded.length}</p></div>
      </div>

      {search || methodFilter !== 'all' || statusFilter !== 'all' ? (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Search Results ({searched.length})</h3>
          <div className="space-y-2">
            {searched.map((p) => renderPaymentRow(p))}
            {searched.length === 0 && <EmptyState icon={<CreditCard size={48} />} title="No payments found" />}
          </div>
        </div>
      ) : (
        <>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Online Payments — Pending Verification ({onlinePending.length})</h3>
            <div className="space-y-2">
              {onlinePending.map((p) => renderPaymentRow(p, verifyActions(p)))}
              {onlinePending.length === 0 && <EmptyState icon={<CreditCard size={48} />} title="No online payments pending" />}
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">COD — Awaiting Delivery ({codPending.length})</h3>
            <div className="space-y-2">
              {codPending.map((p) => renderPaymentRow(p, undefined, <Badge color="amber">COD</Badge>))}
              {codPending.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No COD payments</p>}
            </div>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Verified Payments ({verified.length})</h3>
            <div className="space-y-2">
              {verified.map((p) => renderPaymentRow(p, undefined, <Badge color="green">Paid</Badge>))}
              {verified.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No verified payments</p>}
            </div>
          </div>
          {(failed.length > 0 || refunded.length > 0) && (
            <div>
              <h3 className="mb-4 text-lg font-semibold">Failed & Refunded ({failed.length + refunded.length})</h3>
              <div className="space-y-2">
                {failed.map((p) => renderPaymentRow(p, undefined, <Badge color="red">Failed</Badge>))}
                {refunded.map((p) => renderPaymentRow(p, undefined, <Badge color="neutral">{p.status === 'partially_refunded' ? 'Partial Refund' : 'Refunded'}</Badge>))}
              </div>
            </div>
          )}
        </>
      )}

      {detailPayment && (
        <Modal open={!!detailPayment} onClose={() => setDetailPayment(null)} title={`Payment Details`} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><p className="text-sm font-semibold">Order</p><p className="text-sm text-neutral-500">{detailOrder?.order_number ?? 'N/A'}</p></div>
              <div><p className="text-sm font-semibold">Customer</p><p className="text-sm text-neutral-500">{detailOrder?.customer_name ?? 'N/A'}</p></div>
              <div><p className="text-sm font-semibold">Method</p><p className="text-sm text-neutral-500">{PAYMENT_METHOD_LABELS[detailPayment.method] ?? detailPayment.method}</p></div>
              <div><p className="text-sm font-semibold">Amount</p><p className="text-sm text-neutral-500">{formatPrice(detailPayment.amount)}</p></div>
              <div><p className="text-sm font-semibold">Status</p><p className="text-sm text-neutral-500">{PAYMENT_STATUS_LABELS[detailPayment.status] ?? detailPayment.status}</p></div>
              <div><p className="text-sm font-semibold">Transaction Ref</p><p className="text-sm text-neutral-500">{detailPayment.transaction_ref ?? 'N/A'}</p></div>
              <div><p className="text-sm font-semibold">Created</p><p className="text-sm text-neutral-500">{formatDateTime(detailPayment.created_at)}</p></div>
              <div><p className="text-sm font-semibold">Verified At</p><p className="text-sm text-neutral-500">{detailPayment.verified_at ? formatDateTime(detailPayment.verified_at) : 'Not verified'}</p></div>
              {detailPayment.rejection_reason && <div className="md:col-span-2"><p className="text-sm font-semibold">Rejection Reason</p><p className="text-sm text-red-600">{detailPayment.rejection_reason}</p></div>}
            </div>
            {detailPayment.proof_url && <ProofLink proofPath={detailPayment.proof_url} />}
            <div>
              <p className="mb-2 text-sm font-semibold">Payment Event Timeline</p>
              {events.length === 0 ? (
                <p className="py-3 text-center text-sm text-neutral-400">No events recorded</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-start gap-3 rounded-lg border border-neutral-100 p-3 text-sm dark:border-neutral-800">
                      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                      <div className="flex-1">
                        <p className="font-medium">{e.event_type.replace(/_/g, ' ')}</p>
                        {e.previous_status && e.new_status && <p className="text-xs text-neutral-400">{e.previous_status} → {e.new_status}</p>}
                        {e.description && <p className="text-xs text-neutral-500">{e.description}</p>}
                        <p className="text-xs text-neutral-400">{formatDateTime(e.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// DELIVERY TAB
// ============================================================
function DeliveryTab({ deliveryZones, reload }: { deliveryZones: DeliveryZone[]; reload: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', area: '', delivery_fee: '', estimated_delivery_days: '3', free_delivery_threshold: '', min_order: '' });

  const save = async () => {
    if (!form.name || !form.delivery_fee) { alert('Name and fee required'); return; }
    const { error } = await supabase.from('delivery_zones').insert({ name: form.name, city: form.city || null, area: form.area || null, delivery_fee: parseFloat(form.delivery_fee), estimated_delivery_days: parseInt(form.estimated_delivery_days) || 3, free_delivery_threshold: form.free_delivery_threshold ? parseFloat(form.free_delivery_threshold) : null, min_order: form.min_order ? parseFloat(form.min_order) : 0, delivery_methods: ['home_delivery'], active: true });
    if (error) { alert('Could not save delivery zone: ' + error.message); return; }
    setShowModal(false); setForm({ name: '', city: '', area: '', delivery_fee: '', estimated_delivery_days: '3', free_delivery_threshold: '', min_order: '' }); reload();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Delivery Zones ({deliveryZones.length})</h3><button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Add Zone</button></div>
      <div className="space-y-2">
        {deliveryZones.map((z) => (
          <div key={z.id} className="card flex items-center justify-between p-4">
            <div><p className="text-sm font-semibold">{z.name}</p><p className="text-xs text-neutral-400">Fee: Rs. {z.delivery_fee} · {z.estimated_delivery_days} day(s){z.free_delivery_threshold ? ` · Free over Rs. ${z.free_delivery_threshold}` : ''}</p></div>
            <div className="flex items-center gap-2"><Badge color={z.active ? 'accent' : 'neutral'}>{z.active ? 'Active' : 'Inactive'}</Badge><button onClick={async () => { const { error } = await supabase.from('delivery_zones').update({ active: !z.active }).eq('id', z.id); if (error) { alert('Could not update zone: ' + error.message); return; } reload(); }} className="btn-ghost p-1.5 text-sm">{z.active ? 'Disable' : 'Enable'}</button></div>
          </div>
        ))}
        {deliveryZones.length === 0 && <EmptyState icon={<MapPin size={48} />} title="No delivery zones" />}
      </div>
      {showModal && <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Delivery Zone"><div className="space-y-3"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Zone name" /><div className="grid grid-cols-2 gap-3"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" placeholder="City" /><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input" placeholder="Area" /><input type="number" value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: e.target.value })} className="input" placeholder="Fee" /><input type="number" value={form.estimated_delivery_days} onChange={(e) => setForm({ ...form, estimated_delivery_days: e.target.value })} className="input" placeholder="Days" /><input type="number" value={form.free_delivery_threshold} onChange={(e) => setForm({ ...form, free_delivery_threshold: e.target.value })} className="input" placeholder="Free over" /><input type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} className="input" placeholder="Min order" /></div><button onClick={save} className="btn-primary w-full">Save</button></div></Modal>}
    </div>
  );
}

// ============================================================
// RETURNS TAB
// ============================================================
function ReturnsTab({ returnRequests, orderChangeRequests, reload }: { returnRequests: ReturnRequest[]; orderChangeRequests: OrderChangeRequest[]; reload: () => void }) {
  const [refundLoading, setRefundLoading] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Return/Refund Requests ({returnRequests.length})</h3>
        <div className="space-y-2">
          {returnRequests.map((r) => {
            const orderNum = (r as unknown as { order?: { order_number?: string; total?: number } }).order?.order_number ?? r.order_id.slice(0, 8);
            const orderTotal = (r as unknown as { order?: { total?: number } }).order?.total;
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{orderNum}</p>
                    <p className="text-xs text-neutral-400">{r.reason} · {formatDate(r.created_at)}</p>
                    {orderTotal != null && <p className="text-xs text-neutral-500">Order total: Rs. {orderTotal}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Badge color={r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'green' : 'red'}>{r.status}</Badge>
                    {r.status === 'pending' && (<>
                      <button
                        onClick={async () => {
                          const reason = prompt(`Enter refund reason for order ${orderNum}:`) || 'Return approved';
                          const amountStr = prompt(`Enter refund amount (leave blank for full refund):`);
                          const amount = amountStr ? parseFloat(amountStr) : null;
                          if (amountStr && (isNaN(amount ?? 0) || (amount !== null && amount <= 0))) { alert('Invalid amount'); return; }
                          setRefundLoading(r.order_id);
                          const { error: refundError } = await supabase.rpc('approve_return', { p_return_id: r.id, p_refund_amount: amount, p_reason: reason });
                          setRefundLoading(null);
                          if (refundError) { alert(refundError.message.includes('not eligible') ? 'This order is not in a refundable state.' : 'Refund failed: ' + refundError.message); return; }
                          reload();
                        }}
                        disabled={refundLoading === r.order_id}
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {refundLoading === r.order_id ? 'Processing...' : 'Approve & Refund'}
                      </button>
                      <button onClick={async () => { const { error } = await supabase.rpc('reject_return', { p_return_id: r.id }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white">Reject</button>
                    </>)}

                  </div>
                </div>
              </div>
            );
          })}
          {returnRequests.length === 0 && <EmptyState icon={<RotateCcw size={48} />} title="No return requests" />}
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-lg font-semibold">Order Change Requests ({orderChangeRequests.length})</h3>
        <div className="space-y-2">
          {orderChangeRequests.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-semibold">{(r as unknown as { order?: { order_number?: string } }).order?.order_number ?? r.order_id.slice(0, 8)}</p><p className="text-xs text-neutral-400">{r.change_type}: {r.current_value} → {r.requested_value}</p>{r.reason && <p className="text-xs text-neutral-500">{r.reason}</p>}</div>
                <div className="flex gap-2">
                  <Badge color={r.status === 'pending' ? 'amber' : r.status === 'approved' ? 'green' : 'red'}>{r.status}</Badge>
                  {r.status === 'pending' && (<>
                    <button onClick={async () => { const { error } = await supabase.rpc('resolve_order_change_request', { p_request_id: r.id, p_approve: true }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white">Approve</button>
                    <button onClick={async () => { const { error } = await supabase.rpc('resolve_order_change_request', { p_request_id: r.id, p_approve: false }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white">Reject</button>
                  </>)}
                </div>
              </div>
            </div>
          ))}
          {orderChangeRequests.length === 0 && <EmptyState title="No change requests" />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COUPONS TAB
// ============================================================
function CouponsTab({ coupons, reload }: { coupons: Coupon[]; reload: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', discount_type: 'percentage', value: '', min_order: '', max_discount: '', usage_limit: '', start_date: '', end_date: '', auto_apply: false, free_delivery: false, target_type: 'all', priority: '0', max_usage_per_customer: '1' });

  const save = async () => {
    if (!form.code || !form.value) { alert('Code and value required'); return; }
    const { error } = await supabase.from('coupons').insert({
      code: form.code.toUpperCase(),
      name: form.name || form.code.toUpperCase(),
      discount_type: form.discount_type,
      value: parseFloat(form.value),
      min_order: parseFloat(form.min_order) || 0,
      max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      per_customer_limit: parseInt(form.max_usage_per_customer) || 1,
      max_usage_per_customer: parseInt(form.max_usage_per_customer) || 1,
      active: true,
      auto_apply: form.auto_apply,
      free_delivery: form.free_delivery,
      target_type: form.target_type,
      priority: parseInt(form.priority) || 0,
    });
    if (error) { alert('Could not save coupon: ' + error.message); return; }
    setShowModal(false); setForm({ code: '', name: '', discount_type: 'percentage', value: '', min_order: '', max_discount: '', usage_limit: '', start_date: '', end_date: '', auto_apply: false, free_delivery: false, target_type: 'all', priority: '0', max_usage_per_customer: '1' }); reload();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Coupons ({coupons.length})</h3><button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Add Coupon</button></div>
      <div className="space-y-2">
        {coupons.map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{c.name ?? c.code}</p>
                {c.auto_apply && <Badge color="accent">Auto-Apply</Badge>}
                {c.free_delivery && <Badge color="green">Free Delivery</Badge>}
                {c.target_type === 'first_order' && <Badge color="primary">First Order</Badge>}
              </div>
              <p className="text-xs text-neutral-400">{c.discount_type === 'percentage' ? `${c.value}% off` : `${formatPrice(c.value)} off`} · Code: {c.code} · Used {c.usage_count}/{c.usage_limit ?? '∞'} · Min: {formatPrice(c.min_order)}{c.auto_apply && ` · Priority: ${c.priority}`}</p>
            </div>
            <div className="flex items-center gap-2"><Badge color={c.active ? 'accent' : 'neutral'}>{c.active ? 'Active' : 'Inactive'}</Badge><button onClick={async () => { const { error } = await supabase.from('coupons').update({ active: !c.active }).eq('id', c.id); if (error) { alert('Could not update coupon: ' + error.message); return; } reload(); }} className="btn-ghost p-1.5 text-sm">{c.active ? 'Disable' : 'Enable'}</button></div>
          </div>
        ))}
        {coupons.length === 0 && <EmptyState icon={<Tags size={48} />} title="No coupons created" />}
      </div>
      {showModal && <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Coupon" maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Coupon Code *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" placeholder="SAVE10" /></div>
            <div><label className="label">Promotion Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="10% Off Sale" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Discount Type</label><select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="input"><option value="percentage">Percentage</option><option value="fixed">Fixed Amount</option></select></div>
            <div><label className="label">Value *</label><input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input" placeholder="% or Rs." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Min Order Amount</label><input type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} className="input" placeholder="0" /></div>
            <div><label className="label">Max Discount (blank = none)</label><input type="number" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} className="input" placeholder="e.g. 500" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Usage Limit (blank = unlimited)</label><input type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} className="input" /></div>
            <div><label className="label">Per Customer Limit</label><input type="number" value={form.max_usage_per_customer} onChange={(e) => setForm({ ...form, max_usage_per_customer: e.target.value })} className="input" placeholder="1" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Start Date (blank = now)</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" /></div>
            <div><label className="label">End Date</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input" /></div>
          </div>
          <div><label className="label">Target</label><select value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value })} className="input"><option value="all">All Customers</option><option value="first_order">First Order Only</option></select></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2"><input type="checkbox" checked={form.auto_apply} onChange={(e) => setForm({ ...form, auto_apply: e.target.checked })} className="rounded" /><span className="text-sm font-medium">Auto-apply at checkout</span></label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2"><input type="checkbox" checked={form.free_delivery} onChange={(e) => setForm({ ...form, free_delivery: e.target.checked })} className="rounded" /><span className="text-sm font-medium">Free delivery</span></label>
          </div>
          {form.auto_apply && <div><label className="label">Priority (higher = evaluated first)</label><input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input" placeholder="0" /></div>}
          <button onClick={save} className="btn-primary w-full">Save Coupon</button>
        </div>
      </Modal>}
    </div>
  );
}

// ============================================================
// PROMOTIONS TAB
// ============================================================
function PromotionsTab({ coupons, reload }: { coupons: Coupon[]; reload: () => void }) {
  const active = coupons.filter((c) => c.active);
  const autoApply = active.filter((c) => c.auto_apply);
  const manual = active.filter((c) => !c.auto_apply);
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-lg font-semibold">Auto-Apply Promotions ({autoApply.length})</h3>
        <p className="mb-3 text-sm text-neutral-500">These promotions are automatically applied at checkout when the customer qualifies — no code needed.</p>
        <div className="space-y-3">
          {autoApply.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2"><p className="font-semibold text-primary-600">{c.name ?? c.code}</p>{c.target_type === 'first_order' && <Badge color="primary">First Order</Badge>}{c.free_delivery && <Badge color="green">Free Delivery</Badge>}</div>
                  <p className="text-sm text-neutral-500">{c.discount_type === 'percentage' ? `${c.value}% discount` : `${formatPrice(c.value)} off`} · Min order: {formatPrice(c.min_order)} · Priority: {c.priority}</p>
                </div>
                <Badge color="accent">Auto-Apply</Badge>
              </div>
              {c.end_date && <p className="mt-2 text-xs text-amber-600">Expires: {formatDate(c.end_date)}</p>}
            </div>
          ))}
          {autoApply.length === 0 && <EmptyState icon={<Megaphone size={48} />} title="No auto-apply promotions" message="Create a coupon with auto-apply enabled in the Coupons tab." />}
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-lg font-semibold">Manual Code Promotions ({manual.length})</h3>
        <div className="space-y-3">
          {manual.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-semibold text-primary-600">{c.name ?? c.code}</p><p className="text-sm text-neutral-500">{c.discount_type === 'percentage' ? `${c.value}% discount` : `${formatPrice(c.value)} off`} · Code: {c.code} · Min order: {formatPrice(c.min_order)}</p></div>
                <Badge color="neutral">Manual Code</Badge>
              </div>
              {c.end_date && <p className="mt-2 text-xs text-amber-600">Expires: {formatDate(c.end_date)}</p>}
            </div>
          ))}
          {manual.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No manual promotions active</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REVIEWS TAB
// ============================================================
function ReviewsTab({ reviews, reload }: { reviews: Review[]; reload: () => void }) {
  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);
  const reported = reviews.filter((r) => r.reported_count > 0);
  const [replyModal, setReplyModal] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');

  const submitReply = async () => {
    if (!replyModal || !replyText.trim()) return;
    const { error } = await supabase.from('reviews').update({
      owner_reply: replyText.trim(),
      owner_reply_at: new Date().toISOString(),
    }).eq('id', replyModal.id);
    if (error) { alert('Could not save reply: ' + error.message); return; }
    setReplyModal(null); setReplyText(''); reload();
  };

  const renderReviewCard = (r: Review, showActions: boolean) => {
    const productName = (r as unknown as { product?: { name?: string } }).product?.name ?? 'Unknown product';
    return (
      <div key={r.id} className="card p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{productName}</p>
              {r.verified_purchase && <Badge color="green">Verified Purchase</Badge>}
              {r.reported_count > 0 && <Badge color="red">Reported ({r.reported_count})</Badge>}
            </div>
            <p className="text-xs text-neutral-400">Rating: {r.rating}/5 · {formatDate(r.created_at)}</p>
            {r.body && <p className="mt-1 text-sm text-neutral-500">{r.body}</p>}
            {r.helpful_count > 0 && <p className="mt-1 text-xs text-neutral-400">{r.helpful_count} found this helpful</p>}
            {r.owner_reply && (
              <div className="mt-2 rounded-lg bg-primary-50 p-2 dark:bg-primary-900/20">
                <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">Owner Response</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{r.owner_reply}</p>
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 gap-2">
            {showActions && !r.approved && (
              <>
                <button onClick={async () => { const { error } = await supabase.rpc('moderate_review', { p_review_id: r.id, p_approve: true }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white">Approve</button>
                <button onClick={async () => { const { error } = await supabase.rpc('moderate_review', { p_review_id: r.id, p_approve: false }); if (error) { alert(error.message); return; } reload(); }} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white">Delete</button>
              </>
            )}
            {r.approved && (
              <button onClick={() => { setReplyModal(r); setReplyText(r.owner_reply ?? ''); }} className="btn-ghost p-1.5 text-sm">Reply</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {reported.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Reported Reviews ({reported.length})</h3>
          <div className="space-y-2">
            {reported.map((r) => renderReviewCard(r, true))}
          </div>
        </div>
      )}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Pending Approval ({pending.length})</h3>
        <div className="space-y-2">
          {pending.map((r) => renderReviewCard(r, true))}
          {pending.length === 0 && <EmptyState icon={<Star size={48} />} title="No pending reviews" />}
        </div>
      </div>
      <div>
        <h3 className="mb-4 text-lg font-semibold">Approved ({approved.length})</h3>
        <div className="space-y-2">
          {approved.slice(0, 20).map((r) => renderReviewCard(r, false))}
          {approved.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No approved reviews</p>}
        </div>
      </div>
      {replyModal && (
        <Modal open={!!replyModal} onClose={() => setReplyModal(null)} title="Reply to Review">
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">Rating: {replyModal.rating}/5</p>
            {replyModal.body && <p className="text-sm text-neutral-500">{replyModal.body}</p>}
            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="input min-h-[100px]" placeholder="Write your reply..." />
            <button onClick={submitReply} className="btn-primary w-full">Post Reply</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// NOTIFICATIONS TAB
// ============================================================
function NotificationsTab({ notifications, reload }: { notifications: Notification[]; reload: () => void }) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Recent Notifications ({notifications.length})</h3>
      <div className="space-y-2">
        {notifications.map((n) => (
          <div key={n.id} className={cn('card p-4', !n.read && 'border-primary-200 dark:border-primary-800')}>
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-semibold">{n.title}</p>{n.body && <p className="text-sm text-neutral-500">{n.body}</p>}<p className="mt-1 text-xs text-neutral-400">{formatDateTime(n.created_at)}</p></div>
              {!n.read && <button onClick={async () => { const { error } = await supabase.from('notifications').update({ read: true }).eq('id', n.id); if (error) { console.error('Notification update error:', error.message); return; } reload(); }} className="btn-ghost text-xs">Mark read</button>}
            </div>
          </div>
        ))}
        {notifications.length === 0 && <EmptyState icon={<Bell size={48} />} title="No notifications" />}
      </div>
    </div>
  );
}

// ============================================================
// WEBSITE TAB (Homepage Builder + Feature Switches)
// ============================================================
function WebsiteTab({ homepageSections, featureSwitches, settings, reload }: { homepageSections: HomepageSection[]; featureSwitches: FeatureSwitch[]; settings: Setting[]; reload: () => void }) {
  const [subTab, setSubTab] = useState<'sections' | 'features' | 'branding' | 'announcement' | 'nav' | 'footer' | 'social' | 'seo' | 'popup' | 'payment'>('sections');
  const { settings: site, saveSetting } = useSettings();

  const toggleSection = async (s: HomepageSection) => { const { error } = await supabase.from('homepage_sections').update({ is_visible: !s.is_visible, updated_at: new Date().toISOString() }).eq('id', s.id); if (error) { alert('Could not update section: ' + error.message); return; } reload(); };
  const toggleFeature = async (f: FeatureSwitch) => { const { error } = await supabase.from('feature_switches').update({ enabled: !f.enabled, updated_at: new Date().toISOString() }).eq('id', f.id); if (error) { alert('Could not update feature: ' + error.message); return; } reload(); };
  const saveSettingLocal = async (key: string, value: string) => { const existing = settings.find((s) => s.key === key); if (existing) { const { error } = await supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key); if (error) { alert('Could not save setting: ' + error.message); return; } } else { const { error } = await supabase.from('settings').insert({ key, value }); if (error) { alert('Could not save setting: ' + error.message); return; } } reload(); };

  const subTabs = [
    { key: 'sections', label: 'Homepage' },
    { key: 'features', label: 'Features' },
    { key: 'branding', label: 'Branding' },
    { key: 'announcement', label: 'Announcement' },
    { key: 'nav', label: 'Navigation' },
    { key: 'footer', label: 'Footer' },
    { key: 'social', label: 'Social Links' },
    { key: 'seo', label: 'SEO' },
    { key: 'popup', label: 'Popup' },
    { key: 'payment', label: 'Payment Methods' },
  ] as const;

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {subTabs.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)} className={cn('flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium', subTab === t.key ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>{t.label}</button>
        ))}
      </div>

      {subTab === 'sections' && (
        <div className="space-y-2">
          {homepageSections.map((s) => (
            <div key={s.id} className="card flex items-center justify-between p-4">
              <div><p className="text-sm font-semibold">{s.title || s.section_key}</p>{s.subtitle && <p className="text-xs text-neutral-400">{s.subtitle}</p>}</div>
              <div className="flex items-center gap-2"><Badge color={s.is_visible ? 'accent' : 'neutral'}>{s.is_visible ? 'Visible' : 'Hidden'}</Badge><button onClick={() => toggleSection(s)} className="btn-ghost p-1.5 text-sm">{s.is_visible ? 'Hide' : 'Show'}</button></div>
            </div>
          ))}
          {homepageSections.length === 0 && <EmptyState icon={<Globe size={48} />} title="No homepage sections configured" message="Sections will appear here once the homepage builder is fully seeded." />}
        </div>
      )}

      {subTab === 'features' && (
        <div className="space-y-2">
          {featureSwitches.map((f) => (
            <div key={f.id} className="card flex items-center justify-between p-4">
              <div><p className="text-sm font-semibold">{f.label}</p>{f.description && <p className="text-xs text-neutral-400">{f.description}</p>}</div>
              <button onClick={() => toggleFeature(f)} className={cn('relative h-6 w-11 rounded-full transition', f.enabled ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700')}><span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', f.enabled ? 'left-5' : 'left-0.5')} /></button>
            </div>
          ))}
        </div>
      )}

      {subTab === 'branding' && (
        <div className="space-y-4">
          <SettingField label="Shop Name" value={site.shop_name} onSave={(v) => saveSetting('shop_name', v)} />
          <SettingField label="Logo Text (header)" value={site.logo_text} onSave={(v) => saveSetting('logo_text', v)} />
          <SettingField label="Logo Image URL" value={site.logo_url} onSave={(v) => saveSetting('logo_url', v)} placeholder="https://..." />
          <SettingField label="Favicon URL" value={site.favicon_url} onSave={(v) => saveSetting('favicon_url', v)} placeholder="https://..." />
          <SettingField label="Shop Tagline" value={site.shop_tagline} onSave={(v) => saveSetting('shop_tagline', v)} />
          <SettingField label="Shop Phone" value={site.shop_phone} onSave={(v) => saveSetting('shop_phone', v)} />
          <SettingField label="WhatsApp Number" value={site.shop_whatsapp} onSave={(v) => saveSetting('shop_whatsapp', v)} />
          <SettingField label="Shop Email" value={site.shop_email} onSave={(v) => saveSetting('shop_email', v)} />
          <SettingField label="Shop Address" value={site.shop_address} onSave={(v) => saveSetting('shop_address', v)} />
          <SettingField label="Business Hours" value={site.business_hours} onSave={(v) => saveSetting('business_hours', v)} />
        </div>
      )}

      {subTab === 'announcement' && (
        <div className="space-y-4">
          <SettingToggle label="Enable Announcement Bar" value={site.announcement_enabled} onSave={(v) => saveSetting('announcement_enabled', v)} />
          <SettingField label="Announcement Text" value={site.announcement_text} onSave={(v) => saveSetting('announcement_text', v)} placeholder="Free delivery on orders over Rs. 5000!" />
          <SettingField label="Background Color" value={site.announcement_bg} onSave={(v) => saveSetting('announcement_bg', v)} type="color" />
          <SettingField label="Text Color" value={site.announcement_text_color} onSave={(v) => saveSetting('announcement_text_color', v)} type="color" />
        </div>
      )}

      {subTab === 'nav' && (
        <div className="space-y-2">
          <p className="mb-2 text-sm text-neutral-500">Show or hide navigation menu items.</p>
          <SettingToggle label="Custom Order" value={site.nav_show_custom_order} onSave={(v) => saveSetting('nav_show_custom_order', v)} />
          <SettingToggle label="Measure Bed" value={site.nav_show_measure} onSave={(v) => saveSetting('nav_show_measure', v)} />
          <SettingToggle label="Wholesale" value={site.nav_show_wholesale} onSave={(v) => saveSetting('nav_show_wholesale', v)} />
          <SettingToggle label="About" value={site.nav_show_about} onSave={(v) => saveSetting('nav_show_about', v)} />
          <SettingToggle label="Contact" value={site.nav_show_contact} onSave={(v) => saveSetting('nav_show_contact', v)} />
        </div>
      )}

      {subTab === 'footer' && (
        <div className="space-y-4">
          <SettingField label="Footer About Text" value={site.footer_about} onSave={(v) => saveSetting('footer_about', v)} textarea />
          <SettingField label="Footer Copyright Text" value={site.footer_copyright} onSave={(v) => saveSetting('footer_copyright', v)} />
        </div>
      )}

      {subTab === 'social' && (
        <div className="space-y-4">
          <SettingField label="Facebook URL" value={site.social_facebook} onSave={(v) => saveSetting('social_facebook', v)} placeholder="https://facebook.com/..." />
          <SettingField label="Instagram URL" value={site.social_instagram} onSave={(v) => saveSetting('social_instagram', v)} placeholder="https://instagram.com/..." />
          <SettingField label="YouTube URL" value={site.social_youtube} onSave={(v) => saveSetting('social_youtube', v)} placeholder="https://youtube.com/..." />
          <SettingField label="TikTok URL" value={site.social_tiktok} onSave={(v) => saveSetting('social_tiktok', v)} placeholder="https://tiktok.com/..." />
        </div>
      )}

      {subTab === 'seo' && (
        <div className="space-y-4">
          <SettingField label="SEO Title" value={site.seo_title} onSave={(v) => saveSetting('seo_title', v)} />
          <SettingField label="Meta Description" value={site.seo_description} onSave={(v) => saveSetting('seo_description', v)} textarea />
          <SettingField label="Keywords (comma separated)" value={site.seo_keywords} onSave={(v) => saveSetting('seo_keywords', v)} />
        </div>
      )}

      {subTab === 'popup' && (
        <div className="space-y-4">
          <SettingToggle label="Enable Popup" value={site.popup_enabled} onSave={(v) => saveSetting('popup_enabled', v)} />
          <SettingField label="Popup Title" value={site.popup_title} onSave={(v) => saveSetting('popup_title', v)} />
          <SettingField label="Popup Body" value={site.popup_body} onSave={(v) => saveSetting('popup_body', v)} textarea />
          <SettingField label="Popup Image URL" value={site.popup_image_url} onSave={(v) => saveSetting('popup_image_url', v)} placeholder="https://..." />
          <SettingField label="Button Text" value={site.popup_button_text} onSave={(v) => saveSetting('popup_button_text', v)} placeholder="Shop Now" />
          <SettingField label="Button Link" value={site.popup_button_link} onSave={(v) => saveSetting('popup_button_link', v)} placeholder="/shop" />
        </div>
      )}

      {subTab === 'payment' && (
        <div className="space-y-4">
          <p className="mb-2 text-sm text-neutral-500">Enable or disable payment methods shown to customers at checkout. Disabled methods will not appear on the checkout page.</p>
          <SettingToggle label="Cash on Delivery" value={site.cod_enabled} onSave={(v) => saveSetting('cod_enabled', v)} />
          <SettingToggle label="Bank Transfer" value={site.bank_transfer_enabled} onSave={(v) => saveSetting('bank_transfer_enabled', v)} />
          <SettingToggle label="EasyPaisa" value={site.easypaisa_enabled} onSave={(v) => saveSetting('easypaisa_enabled', v)} />
          <SettingToggle label="JazzCash" value={site.jazzcash_enabled} onSave={(v) => saveSetting('jazzcash_enabled', v)} />
          <SettingToggle label="Hand-to-Hand (Local Pickup)" value={site.hand_to_hand_enabled} onSave={(v) => saveSetting('hand_to_hand_enabled', v)} />
        </div>
      )}
    </div>
  );
}

function SettingField({ label, value, onSave, placeholder, textarea, type = 'text' }: { label: string; value: string; onSave: (v: string) => Promise<void>; placeholder?: string; textarea?: boolean; type?: string }) {
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setVal(value); }, [value]);
  const dirty = val !== value;
  const handleSave = async () => {
    setSaving(true);
    try { await onSave(val); } catch (err) { alert('Could not save: ' + (err instanceof Error ? err.message : 'Unknown error')); }
    setSaving(false);
  };
  return (
    <div className="card p-4">
      <label className="label">{label}</label>
      <div className="flex gap-2">
        {textarea ? (
          <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={3} className="input flex-1" placeholder={placeholder} />
        ) : (
          <input type={type} value={val} onChange={(e) => setVal(e.target.value)} className="input flex-1" placeholder={placeholder} />
        )}
        {dirty && <button onClick={handleSave} disabled={saving} className="btn-primary px-3">{saving ? <Spinner size={16} /> : <Check size={16} />}</button>}
      </div>
    </div>
  );
}

function SettingToggle({ label, value, onSave }: { label: string; value: boolean; onSave: (v: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    try { await onSave(String(!value)); } catch (err) { alert('Could not save: ' + (err instanceof Error ? err.message : 'Unknown error')); }
    setSaving(false);
  };
  return (
    <div className="card flex items-center justify-between p-4">
      <span className="text-sm font-semibold">{label}</span>
      <button onClick={handleSave} disabled={saving} className={cn('relative h-6 w-11 rounded-full transition', value ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', value ? 'left-5' : 'left-0.5')} />
      </button>
    </div>
  );
}

// ============================================================
// ANALYTICS TAB
// ============================================================
function AnalyticsTab({ orders, products, customers }: { orders: Order[]; products: Product[]; customers: CustomerProfile[] }) {
  const validOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded');
  const revenue = validOrders.reduce((s, o) => s + o.total, 0);
  const avgOrder = validOrders.length > 0 ? revenue / validOrders.length : 0;
  const statusCounts: Record<string, number> = {};
  orders.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  orders.forEach((o) => { o.order_items?.forEach((item) => { if (!productSales[item.product_name]) productSales[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 }; productSales[item.product_name].qty += item.quantity; productSales[item.product_name].revenue += item.unit_price * item.quantity; }); });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const repeatCustomers = customers.filter((c) => orders.filter((o) => o.user_id === c.id).length > 1).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-neutral-500">Total Revenue</p><p className="text-xl font-bold text-accent-600">{formatPrice(revenue)}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Avg Order Value</p><p className="text-xl font-bold">{formatPrice(avgOrder)}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Total Orders</p><p className="text-xl font-bold">{orders.length}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Repeat Customers</p><p className="text-xl font-bold">{repeatCustomers}</p></div>
      </div>
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-semibold">Orders by Status</h3>
        <div className="space-y-2">
          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (<div key={status} className="flex items-center gap-3"><span className="w-32 text-sm">{ORDER_STATUS_LABELS[status] ?? status}</span><div className="h-6 flex-1 rounded-lg bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-lg bg-primary-500" style={{ width: `${(count / orders.length) * 100}%` }} /></div><span className="text-sm font-medium">{count}</span></div>))}
        </div>
      </div>
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-semibold">Top Products</h3>
        {topProducts.length === 0 ? <p className="py-4 text-center text-sm text-neutral-400">No sales data yet</p> : <div className="space-y-2">{topProducts.map((p, i) => (<div key={p.name} className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">{i + 1}</span><span className="flex-1 text-sm font-medium">{p.name}</span><span className="text-sm text-neutral-500">{p.qty} sold</span><span className="text-sm font-bold">{formatPrice(p.revenue)}</span></div>))}</div>}
      </div>
    </div>
  );
}

// ============================================================
// FINANCE TAB
// ============================================================
function FinanceTab({ orders, expenses, expenseCategories, reload }: { orders: Order[]; expenses: Expense[]; expenseCategories: ExpenseCategory[]; reload: () => void }) {
  const validOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded');
  const revenue = validOrders.reduce((s, o) => s + o.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const refunds = orders.filter((o) => o.status === 'refunded' || o.payment_status === 'refunded').reduce((s, o) => s + o.total, 0);
  const discounts = validOrders.reduce((s, o) => s + o.discount, 0);
  const netSales = revenue - refunds;
  const netProfit = netSales - totalExpenses;
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: 'Cotton', amount: '', description: '', expense_date: new Date().toISOString().slice(0, 10), paid_by: '', payment_method: 'cash' });

  const save = async () => {
    if (!form.amount) { alert('Amount required'); return; }
    const cat = expenseCategories.find((c) => c.name === form.category);
    const { error } = await supabase.from('expenses').insert({ category_id: cat?.id ?? null, category: form.category, amount: parseFloat(form.amount), description: form.description || null, expense_date: form.expense_date, paid_by: form.paid_by || null, payment_method: form.payment_method });
    if (error) { alert('Could not save expense: ' + error.message); return; }
    setShowModal(false); setForm({ category: 'Cotton', amount: '', description: '', expense_date: new Date().toISOString().slice(0, 10), paid_by: '', payment_method: 'cash' }); reload();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-neutral-500">Gross Sales</p><p className="text-xl font-bold text-accent-600">{formatPrice(revenue)}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Discounts Given</p><p className="text-xl font-bold text-amber-600">{formatPrice(discounts)}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Refunds</p><p className="text-xl font-bold text-red-600">{formatPrice(refunds)}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Net Sales</p><p className="text-xl font-bold text-primary-600">{formatPrice(netSales)}</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-neutral-500">Expenses</p><p className="text-xl font-bold text-red-600">{formatPrice(totalExpenses)}</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500">Net Profit</p><p className="text-xl font-bold text-primary-600">{formatPrice(netProfit)}</p></div>
      </div>
      <div>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Recent Expenses</h3><button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Add Expense</button></div>
        <div className="space-y-2">
          {expenses.slice(0, 20).map((e) => (<div key={e.id} className="card flex items-center justify-between p-3"><div><p className="text-sm font-semibold">{e.category}: {e.description ?? 'No description'}</p><p className="text-xs text-neutral-400">{formatDate(e.expense_date)} · {e.paid_by ?? 'Unknown'} · {e.payment_method ?? ''}</p></div><span className="text-sm font-bold text-red-600">-{formatPrice(e.amount)}</span></div>))}
          {expenses.length === 0 && <EmptyState icon={<Wallet size={48} />} title="No expenses recorded" />}
        </div>
      </div>
      {showModal && <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Expense"><div className="space-y-3"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">{expenseCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" placeholder="Amount" /><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="Description" /><div className="grid grid-cols-2 gap-3"><input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="input" /><input value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })} className="input" placeholder="Paid by" /></div><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="input"><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="easypaisa">EasyPaisa</option><option value="other">Other</option></select><button onClick={save} className="btn-primary w-full">Save</button></div></Modal>}
    </div>
  );
}

// ============================================================
// REPORTS TAB
// ============================================================
function ReportsTab({ orders, products, expenses, customers }: { orders: Order[]; products: Product[]; expenses: Expense[]; customers: CustomerProfile[] }) {
  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Reports & Exports</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button onClick={() => exportCSV(orders.map((o) => ({ order: o.order_number, customer: o.customer_name, total: o.total, status: o.status, payment: o.payment_status, date: o.created_at })), 'orders.csv')} className="card p-5 text-left hover:shadow-md"><ClipboardList size={24} className="mb-2 text-primary-600" /><p className="font-semibold">Orders Report</p><p className="text-xs text-neutral-400">{orders.length} orders · Export to CSV</p></button>
        <button onClick={() => exportCSV(products.map((p) => ({ name: p.name, sku: p.sku, price: p.price, stock: p.stock, status: p.status })), 'products.csv')} className="card p-5 text-left hover:shadow-md"><Package size={24} className="mb-2 text-primary-600" /><p className="font-semibold">Products Report</p><p className="text-xs text-neutral-400">{products.length} products · Export to CSV</p></button>
        <button onClick={() => exportCSV(expenses.map((e) => ({ category: e.category, amount: e.amount, date: e.expense_date, method: e.payment_method })), 'expenses.csv')} className="card p-5 text-left hover:shadow-md"><Wallet size={24} className="mb-2 text-primary-600" /><p className="font-semibold">Expenses Report</p><p className="text-xs text-neutral-400">{expenses.length} expenses · Export to CSV</p></button>
        <button onClick={() => exportCSV(customers.map((c) => ({ name: c.full_name, phone: c.phone, joined: c.created_at })), 'customers.csv')} className="card p-5 text-left hover:shadow-md"><Users size={24} className="mb-2 text-primary-600" /><p className="font-semibold">Customers Report</p><p className="text-xs text-neutral-400">{customers.length} customers · Export to CSV</p></button>
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS TAB
// ============================================================
function SettingsTab({ settings, reload }: { settings: Setting[]; reload: () => void }) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const getValue = (key: string) => { const s = settings.find((s) => s.key === key); return editing[key] ?? s?.value ?? ''; };
  const save = async (key: string) => { const value = editing[key]; if (value === undefined) return; const existing = settings.find((s) => s.key === key); if (existing) { const { error } = await supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key); if (error) { alert('Could not save setting: ' + error.message); return; } } else { const { error } = await supabase.from('settings').insert({ key, value }); if (error) { alert('Could not save setting: ' + error.message); return; } } setEditing({ ...editing, [key]: undefined as unknown as string }); reload(); };

  const settingGroups = [
    { title: 'Shop Information', keys: ['shop_name', 'shop_address', 'shop_phone', 'shop_whatsapp', 'shop_email', 'business_hours'] },
    { title: 'Delivery', keys: ['default_delivery_fee', 'free_delivery_threshold'] },
    { title: 'Loyalty', keys: ['loyalty_points_per_rupee', 'loyalty_min_redemption'] },
    { title: 'Wholesale', keys: ['wholesale_min_qty'] },
  ];

  return (
    <div className="space-y-6">
      {settingGroups.map((group) => (
        <div key={group.title} className="card p-5">
          <h3 className="mb-4 text-lg font-semibold">{group.title}</h3>
          <div className="space-y-3">
            {group.keys.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-48 flex-shrink-0 text-sm font-medium text-neutral-500">{key.replace(/_/g, ' ')}:</label>
                <input value={getValue(key)} onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} className="input flex-1" />
                {editing[key] !== undefined && <button onClick={() => save(key)} className="btn-primary px-3 py-1.5 text-sm"><Check size={14} /></button>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// SECURITY CENTER
// ============================================================
function SecurityCenter({ auditLogs, onSignOut }: { auditLogs: AuditLog[]; onSignOut: () => void }) {
  const { user, profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentPassword) { setPasswordMsg({ type: 'error', text: 'Please enter your current password.' }); return; }
    if (newPassword.length < 8) { setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
    if (newPassword === currentPassword) { setPasswordMsg({ type: 'error', text: 'New password must be different from your current password.' }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' }); return; }

    setChangingPassword(true);

    // Re-authenticate with current password before updating
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });
    if (reauthError) {
      setPasswordMsg({ type: 'error', text: 'Current password is incorrect.' });
      setChangingPassword(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setPasswordMsg({ type: 'error', text: updateError.message });
    } else {
      setPasswordMsg({ type: 'success', text: 'Password updated successfully. Use your new password next time you sign in.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      await supabase.rpc('log_owner_action', { p_action: 'password_changed', p_entity: 'auth' });
    }
    setChangingPassword(false);
  };

  const passwordStrength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (newPassword.length >= 12) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();
  const strengthLabel = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][passwordStrength];
  const strengthColor = ['bg-neutral-300', 'bg-red-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'][passwordStrength];

  const actionLabels: Record<string, string> = {
    product_created: 'Product Created', product_updated: 'Product Updated', product_deleted: 'Product Deleted',
    order_status_changed: 'Order Status Changed', expense_added: 'Expense Added', delivery_zone_added: 'Delivery Zone Added',
    setting_changed: 'Setting Changed', setting_created: 'Setting Created', password_changed: 'Password Changed', owner_logout: 'Owner Logout',
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30"><Shield size={24} /></div>
          <div><h3 className="text-lg font-semibold">Owner Security Center</h3><p className="text-sm text-neutral-500">Manage your account security and view activity logs</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lock size={16} /> Current Login</div><p className="text-sm text-neutral-500">{user?.email}</p><p className="mt-1 text-xs text-neutral-400">Role: {profile?.role ?? 'owner'}</p></div>
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Key size={16} /> MFA / 2FA</div><p className="text-sm text-neutral-500">Not configured</p><p className="mt-1 text-xs text-neutral-400">Enable in Supabase Auth settings for enhanced security</p></div>
        </div>
      </div>

      <div className="card p-6">
        <h4 className="mb-3 flex items-center gap-2 font-semibold"><Key size={18} /> Change Password</h4>
        <p className="mb-4 text-sm text-neutral-500">Enter your current password for verification, then choose a new password. Your current password is never stored or displayed.</p>
        <form onSubmit={changePassword} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input px-10"
                placeholder="Enter your current password"
                required
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input px-10"
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < passwordStrength ? strengthColor : 'bg-neutral-200 dark:bg-neutral-700'}`} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-neutral-400">Strength: {strengthLabel}</p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="label">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input px-10"
                placeholder="Re-enter your new password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
            )}
          </div>

          {passwordMsg && (
            <p className={`rounded-lg p-3 text-sm ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-600 dark:bg-red-900/20'}`}>
              {passwordMsg.text}
            </p>
          )}

          <button type="submit" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword} className="btn-primary">
            {changingPassword ? <Spinner size={16} /> : 'Update Password'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h4 className="mb-3 flex items-center gap-2 font-semibold"><LogOut size={18} /> Session Management</h4>
        <p className="mb-3 text-sm text-neutral-500">Sign out from your current session. To sign out from all devices, change your password above.</p>
        <button onClick={onSignOut} className="btn-outline text-red-600"><LogOut size={16} /> Sign Out</button>
      </div>
      <div className="card p-6">
        <h4 className="mb-4 flex items-center gap-2 font-semibold"><Activity size={18} /> Recent Owner Actions (Audit Log)</h4>
        {auditLogs.length === 0 ? <EmptyState icon={<Activity size={48} />} title="No actions logged yet" /> : <div className="space-y-2">{auditLogs.map((log) => (<div key={log.id} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3 dark:border-neutral-800"><div><p className="text-sm font-medium">{actionLabels[log.action] ?? log.action}</p><p className="text-xs text-neutral-400">{log.entity ? `on ${log.entity}` : ''}{log.entity_id ? ` (${log.entity_id.slice(0, 8)})` : ''}</p></div><span className="text-xs text-neutral-400">{formatDateTime(log.created_at)}</span></div>))}</div>}
      </div>
    </div>
  );
}

// ============================================================
// AI COPILOT TAB
// ============================================================
function AICopilotTab({ orders, products, expenses, reviews }: {
  orders: Order[]; products: Product[]; expenses: Expense[]; reviews: Review[];
}) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'chat' | 'inventory' | 'reviews' | 'marketing' | 'seo'>('chat');

  const ask = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await getOwnerBusinessInsight(query, orders, products, expenses);
      setResponse(res);
    } catch {
      setResponse('Sorry, I could not process that request. Please try again.');
    }
    setLoading(false);
  };

  const reviewAnalysis = useMemo(() => analyzeReviews(reviews), [reviews]);

  const suggestions = [
    'What were my sales this month?',
    'What are my best-selling products?',
    'Which products are low in stock?',
    'Which products are not selling?',
    'What should I restock?',
    'What products should I promote?',
    'Which sizes are most popular?',
    'How many orders were cancelled?',
  ];

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: 'chat', label: 'Business Q&A', icon: MessageCircle },
            { key: 'inventory', label: 'Inventory Insights', icon: Boxes },
            { key: 'reviews', label: 'Review Analysis', icon: Star },
            { key: 'marketing', label: 'Marketing', icon: Megaphone },
            { key: 'seo', label: 'SEO Generator', icon: FileText },
          ] as const).map((s) => (
            <button key={s.key} onClick={() => setActiveSection(s.key)} className={cn('flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition', activeSection === s.key ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800')}>
              <s.icon size={14} /> {s.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'chat' && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Sparkles size={20} className="text-primary-600" /> AI Business Assistant</h3>
          <p className="mb-4 text-sm text-neutral-500">Ask me anything about your business. I analyze your real orders, products, and expenses — no guessing.</p>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="e.g. What are my best-selling products?" className="input flex-1" />
            <button onClick={ask} disabled={loading || !query.trim()} className="btn-primary">{loading ? <Spinner size={16} /> : <Send size={16} />} Ask</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => { setQuery(s); }} className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-primary-100 hover:text-primary-700 dark:bg-neutral-800 dark:text-neutral-300">
                {s}
              </button>
            ))}
          </div>
          {response && (
            <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm whitespace-pre-line text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {response}
            </div>
          )}
        </div>
      )}

      {activeSection === 'inventory' && (
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Boxes size={20} className="text-primary-600" /> Inventory Insights</h3>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-neutral-500">Low Stock Risk</h4>
              <div className="space-y-1.5">
                {products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-900/20">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-amber-600 dark:text-amber-400">{p.stock} left (threshold: {p.low_stock_threshold})</span>
                  </div>
                ))}
                {products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).length === 0 && <p className="text-sm text-neutral-400">No low-stock products.</p>}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-neutral-500">Stockout Risk (Out of Stock)</h4>
              <div className="space-y-1.5">
                {products.filter((p) => p.stock === 0 && !p.made_to_order).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-900/20">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-red-600 dark:text-red-400">Out of stock</span>
                  </div>
                ))}
                {products.filter((p) => p.stock === 0 && !p.made_to_order).length === 0 && <p className="text-sm text-neutral-400">No stockout risk.</p>}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-neutral-500">Slow Movers (no sales)</h4>
              <div className="space-y-1.5">
                {(() => {
                  const sold = new Set<string>();
                  for (const o of orders.filter((o) => o.status !== 'cancelled')) {
                    for (const item of o.order_items ?? []) { if (item.product_id) sold.add(item.product_id); }
                  }
                  return products.filter((p) => p.status === 'active' && !sold.has(p.id)).slice(0, 10);
                })().map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700">
                    <span>{p.name}</span>
                    <span className="text-neutral-400">Stock: {p.stock} · {formatPrice(p.price)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-neutral-400">Note: Insights are estimates based on historical data. AI does not automatically change stock levels.</p>
          </div>
        </div>
      )}

      {activeSection === 'reviews' && (
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Star size={20} className="text-primary-600" /> Review Analysis</h3>
          {reviewAnalysis.alert && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertTriangle size={16} className="mb-1 inline" /> {reviewAnalysis.alert}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-green-600">Positive Themes ({reviewAnalysis.positive.length})</h4>
              <div className="space-y-1">
                {reviewAnalysis.positive.slice(0, 5).map((r, i) => <p key={i} className="rounded-lg bg-green-50 p-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">{r}</p>)}
                {reviewAnalysis.positive.length === 0 && <p className="text-xs text-neutral-400">No positive themes detected.</p>}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-red-600">Negative Themes ({reviewAnalysis.negative.length})</h4>
              <div className="space-y-1">
                {reviewAnalysis.negative.slice(0, 5).map((r, i) => <p key={i} className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">{r}</p>)}
                {reviewAnalysis.negative.length === 0 && <p className="text-xs text-neutral-400">No negative themes detected.</p>}
              </div>
            </div>
          </div>
          {reviewAnalysis.themes.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold text-neutral-500">Common Topics</h4>
              <div className="flex flex-wrap gap-2">
                {reviewAnalysis.themes.map((t) => <span key={t} className="rounded-full bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-800">{t}</span>)}
              </div>
            </div>
          )}
          {reviews.length === 0 && <p className="py-4 text-center text-sm text-neutral-400">No reviews to analyze yet.</p>}
        </div>
      )}

      {activeSection === 'marketing' && (
        <MarketingGenerator products={products} />
      )}

      {activeSection === 'seo' && (
        <SEOGenerator products={products} />
      )}
    </div>
  );
}

function MarketingGenerator({ products }: { products: Product[] }) {
  const [selectedId, setSelectedId] = useState('');
  const [platform, setPlatform] = useState<'whatsapp' | 'facebook' | 'instagram'>('whatsapp');
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);

  const selected = products.find((p) => p.id === selectedId);

  const generate = () => {
    if (!selected) return;
    setContent(generateMarketingContent(selected, platform));
    setCopied(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card p-5">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Megaphone size={20} className="text-primary-600" /> Marketing Content Generator</h3>
      <p className="mb-4 text-sm text-neutral-500">Select a product and platform. AI generates promotional content from real product data. Review and approve before publishing.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Product</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input">
            <option value="">Select a product...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Platform</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="input">
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
      </div>
      <button onClick={generate} disabled={!selected} className="btn-primary mt-3"><Sparkles size={16} /> Generate Content</button>
      {content && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Generated Content (review before publishing):</p>
            <button onClick={copy} className="btn-ghost text-xs">{copied ? <Check size={14} /> : 'Copy'}</button>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} className="input text-sm" />
        </div>
      )}
    </div>
  );
}

function SEOGenerator({ products }: { products: Product[] }) {
  const [selectedId, setSelectedId] = useState('');
  const [content, setContent] = useState<{ shortDesc: string; fullDesc: string; highlights: string[]; seoTitle: string; metaDesc: string; keywords: string[] } | null>(null);

  const selected = products.find((p) => p.id === selectedId);

  const generate = () => {
    if (!selected) return;
    const variants = selected.product_variants ?? [];
    const filling = variants.find((v) => v.filling)?.filling;
    const fabric = variants.find((v) => v.fabric)?.fabric;
    const color = variants.find((v) => v.color)?.color;
    const size = variants.find((v) => v.size_label)?.size_label;
    setContent(generateProductDescription({
      name: selected.name,
      fabric: fabric ?? undefined,
      filling: filling ?? undefined,
      color: color ?? undefined,
      size: size ?? undefined,
      handmade: selected.handmade,
      premium: selected.premium,
    }));
  };

  const apply = async (field: 'short_desc' | 'full_desc' | 'seo_title' | 'meta_desc', value: string) => {
    if (!selected) return;
    await supabase.from('products').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', selected.id);
    await supabase.rpc('log_owner_action', { p_action: 'ai_seo_generated', p_entity: 'product', p_entity_id: selected.id, p_new_value: { field, value } as Record<string, unknown> });
    alert(`${field.replace('_', ' ')} updated!`);
  };

  return (
    <div className="card p-5">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><FileText size={20} className="text-primary-600" /> SEO & Description Generator</h3>
      <p className="mb-4 text-sm text-neutral-500">AI generates descriptions from your product's actual specifications. Never invents certifications or medical claims. Preview and edit before saving.</p>
      <div className="mb-3">
        <label className="label">Product</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input">
          <option value="">Select a product...</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <button onClick={generate} disabled={!selected} className="btn-primary mb-4"><Sparkles size={16} /> Generate</button>
      {content && (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between"><label className="label mb-0">SEO Title</label><button onClick={() => apply('seo_title', content.seoTitle)} className="btn-ghost text-xs">Apply</button></div>
            <textarea value={content.seoTitle} onChange={(e) => setContent({ ...content, seoTitle: e.target.value })} rows={1} className="input text-sm" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between"><label className="label mb-0">Meta Description</label><button onClick={() => apply('meta_desc', content.metaDesc)} className="btn-ghost text-xs">Apply</button></div>
            <textarea value={content.metaDesc} onChange={(e) => setContent({ ...content, metaDesc: e.target.value })} rows={2} className="input text-sm" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between"><label className="label mb-0">Short Description</label><button onClick={() => apply('short_desc', content.shortDesc)} className="btn-ghost text-xs">Apply</button></div>
            <textarea value={content.shortDesc} onChange={(e) => setContent({ ...content, shortDesc: e.target.value })} rows={2} className="input text-sm" />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between"><label className="label mb-0">Full Description</label><button onClick={() => apply('full_desc', content.fullDesc)} className="btn-ghost text-xs">Apply</button></div>
            <textarea value={content.fullDesc} onChange={(e) => setContent({ ...content, fullDesc: e.target.value })} rows={4} className="input text-sm" />
          </div>
          <div>
            <label className="label">Highlights</label>
            <ul className="space-y-1">
              {content.highlights.map((h, i) => <li key={i} className="rounded-lg bg-neutral-50 p-2 text-sm dark:bg-neutral-800">{h}</li>)}
            </ul>
          </div>
          <div>
            <label className="label">Keywords</label>
            <div className="flex flex-wrap gap-2">
              {content.keywords.map((k) => <span key={k} className="rounded-full bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-800">{k}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
