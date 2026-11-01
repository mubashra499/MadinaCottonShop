import { useEffect, useState } from 'react';
import { Link, navigate } from '@/lib/router';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/lib/types';
import { ShoppingBag, User, Menu, X, Search, Sun, Moon, Crown, Package, ChevronDown, Phone, Clock, MapPin, Facebook, Instagram, Youtube, X as XIcon, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHOP_INFO } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';

export function AnnouncementBar() {
  const { settings } = useSettings();
  if (!settings.announcement_enabled || !settings.announcement_text) return null;
  return (
    <div
      className="px-4 py-2 text-center text-sm font-medium"
      style={{ backgroundColor: settings.announcement_bg, color: settings.announcement_text_color }}
    >
      {settings.announcement_text}
    </div>
  );
}

function SitePopup() {
  const { settings } = useSettings();
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const seen = sessionStorage.getItem('popup_dismissed');
    if (seen) setDismissed(true);
  }, []);
  if (!settings.popup_enabled || dismissed || !settings.popup_title) return null;
  const close = () => { setDismissed(true); sessionStorage.setItem('popup_dismissed', '1'); };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-neutral-900">
        <button onClick={close} className="absolute right-3 top-3 z-10 rounded-full bg-black/20 p-1.5 text-white hover:bg-black/40"><XIcon size={16} /></button>
        {settings.popup_image_url && (
          <img src={settings.popup_image_url} alt="" className="h-48 w-full object-cover" />
        )}
        <div className="p-6">
          <h3 className="font-display text-xl font-bold">{settings.popup_title}</h3>
          {settings.popup_body && <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{settings.popup_body}</p>}
          {settings.popup_button_text && (
            <Link to={settings.popup_button_link || '/shop'} onClick={close} className="btn-primary mt-4 inline-block">
              {settings.popup_button_text}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const { count } = useCart();
  const { user, isOwner, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [megaOpen, setMegaOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('categories').select('*').is('parent_id', null).eq('active', true).order('sort_order');
      if (error) { console.error('Category fetch error:', error.message); return; }
      setCategories((data as Category[]) ?? []);
    })();
  }, []);

  const allNavLinks = [
    { label: 'Home', to: '/', always: true },
    { label: 'Shop', to: '/shop', mega: true, always: true },
    { label: 'Custom Order', to: '/custom-order', show: settings.nav_show_custom_order },
    { label: 'Measure Bed', to: '/bed-measure', show: settings.nav_show_measure },
    { label: 'Wholesale', to: '/wholesale', show: settings.nav_show_wholesale },
    { label: 'About', to: '/about', show: settings.nav_show_about },
    { label: 'Contact', to: '/contact', show: settings.nav_show_contact },
  ];
  const navLinks = allNavLinks.filter((l) => l.always || l.show);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/shop?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
      setMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90">
      <AnnouncementBar />
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt={settings.shop_name} className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <Package size={20} />
            </div>
          )}
          <span className="font-display text-lg font-semibold">{settings.logo_text}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            link.mega ? (
              <div
                key={link.to}
                className="relative"
                onMouseEnter={() => setMegaOpen(true)}
                onMouseLeave={() => setMegaOpen(false)}
              >
                <Link
                  to={link.to}
                  className="flex items-center gap-0.5 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
                >
                  {link.label} <ChevronDown size={14} className={cn('transition-transform', megaOpen && 'rotate-180')} />
                </Link>
                {megaOpen && categories.length > 0 && (
                  <div className="absolute left-0 top-full pt-1">
                    <div className="w-64 rounded-2xl border border-neutral-200 bg-white p-3 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
                      <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Categories</div>
                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          to={`/shop?category=${cat.slug}`}
                          onClick={() => setMegaOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-neutral-600 hover:bg-primary-50 hover:text-primary-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          <Package size={14} className="text-primary-500" />
                          {cat.name}
                        </Link>
                      ))}
                      <Link
                        to="/shop"
                        onClick={() => setMegaOpen(false)}
                        className="mt-1 flex items-center gap-2 rounded-lg border-t border-neutral-100 px-2 pt-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:border-neutral-800"
                      >
                        View All Products
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                {link.label}
              </Link>
            )
          ))}
        </nav>

        {/* Search (desktop) */}
        <form onSubmit={handleSearch} className="hidden flex-1 max-w-xs items-center md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800" aria-label="Toggle theme">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {user ? (
            <Link to="/account" className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800" title="My Account">
              <User size={20} />
            </Link>
          ) : (
            <Link to="/auth" className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800" title="Sign In">
              <User size={20} />
            </Link>
          )}

          {isOwner && (
            <Link to="/owner" className="rounded-lg p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20" title="Owner Command Center">
              <Crown size={20} />
            </Link>
          )}

          <Link to="/cart" className="relative rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800" title="Cart">
            <ShoppingBag size={20} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 py-4 lg:hidden dark:border-neutral-800 dark:bg-neutral-950">
          <form onSubmit={handleSearch} className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
          </form>
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {link.label}
              </Link>
            ))}
            {categories.length > 0 && (
              <>
                <div className="mt-2 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">Categories</div>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/shop?category=${cat.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <Package size={14} className="text-primary-500" />
                    {cat.name}
                  </Link>
                ))}
              </>
            )}
            {user && (
              <button
                onClick={async () => { await signOut(); setMenuOpen(false); navigate('/'); }}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { isOwner } = useAuth();
  const { settings } = useSettings();
  const socials = [
    { url: settings.social_facebook, icon: Facebook, label: 'Facebook' },
    { url: settings.social_instagram, icon: Instagram, label: 'Instagram' },
    { url: settings.social_youtube, icon: Youtube, label: 'YouTube' },
  ].filter((s) => s.url);

  return (
    <footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                  <Package size={16} />
                </div>
              )}
              <h3 className="font-display text-lg font-semibold">{settings.shop_name}</h3>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{settings.footer_about}</p>
            {socials.length > 0 && (
              <div className="mt-3 flex gap-2">
                {socials.map((s) => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-neutral-100 p-2 text-neutral-600 hover:bg-primary-100 hover:text-primary-600 dark:bg-neutral-800 dark:text-neutral-300" title={s.label}>
                    <s.icon size={16} />
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Shop</h4>
            <ul className="space-y-2 text-sm text-neutral-500 dark:text-neutral-400">
              <li><Link to="/shop" className="hover:text-primary-600">All Products</Link></li>
              {settings.nav_show_custom_order && <li><Link to="/custom-order" className="hover:text-primary-600">Custom Order</Link></li>}
              {settings.nav_show_measure && <li><Link to="/bed-measure" className="hover:text-primary-600">Measure My Bed</Link></li>}
              {settings.nav_show_wholesale && <li><Link to="/wholesale" className="hover:text-primary-600">Wholesale</Link></li>}
              <li><Link to="/how-we-make-it" className="hover:text-primary-600">How We Make It</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Contact</h4>
            <ul className="space-y-2 text-sm text-neutral-500 dark:text-neutral-400">
              <li className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 flex-shrink-0" /> {settings.shop_address}</li>
              <li className="flex items-center gap-2 font-medium text-neutral-700 dark:text-neutral-300"><Phone size={14} /> {settings.shop_phone}</li>
              <li className="flex items-center gap-2"><Clock size={14} /> {settings.business_hours}</li>
              <li className="text-xs">COD, Bank Transfer, EasyPaisa, Hand-to-Hand</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Help & Info</h4>
            <ul className="space-y-2 text-sm text-neutral-500 dark:text-neutral-400">
              <li><Link to="/account" className="hover:text-primary-600">My Account</Link></li>
              <li><Link to="/track-order" className="hover:text-primary-600">Track Order</Link></li>
              <li><Link to="/support" className="hover:text-primary-600">Customer Support</Link></li>
              <li><Link to="/faq" className="hover:text-primary-600">FAQ</Link></li>
              <li><Link to="/shipping-policy" className="hover:text-primary-600">Shipping Policy</Link></li>
              <li><Link to="/return-policy" className="hover:text-primary-600">Return Policy</Link></li>
              <li><Link to="/privacy-policy" className="hover:text-primary-600">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-primary-600">Terms & Conditions</Link></li>
              {isOwner && <li><Link to="/owner" className="hover:text-primary-600">Owner Command Center</Link></li>}
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-400 dark:border-neutral-800">
          &copy; {new Date().getFullYear()} {settings.footer_copyright}
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <SitePopup />
    </div>
  );
}
