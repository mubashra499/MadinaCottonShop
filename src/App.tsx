import { useRouter } from '@/lib/router';
import { Header, Footer } from '@/components/Layout';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { ProductPage } from '@/pages/ProductPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { OrderConfirmationPage } from '@/pages/OrderConfirmationPage';
import { TrackOrderPage } from '@/pages/TrackOrderPage';
import { InvoicePage } from '@/pages/InvoicePage';
import { CustomOrderPage } from '@/pages/CustomOrderPage';
import { WholesalePage } from '@/pages/WholesalePage';
import { AboutPage } from '@/pages/AboutPage';
import { ContactPage } from '@/pages/ContactPage';
import { AuthPage } from '@/pages/AuthPage';
import { AccountPage } from '@/pages/AccountPage';
import { OwnerPage } from '@/pages/OwnerPage';
import { HowWeMakeItPage } from '@/pages/HowWeMakeItPage';
import { BedMeasurePage } from '@/pages/BedMeasurePage';
import { FAQPage } from '@/pages/FAQPage';
import { ShippingPolicyPage } from '@/pages/ShippingPolicyPage';
import { ReturnPolicyPage } from '@/pages/ReturnPolicyPage';
import { PrivacyPolicyPage, TermsPage } from '@/pages/PolicyPages';
import { SupportPage } from '@/pages/SupportPage';
import { EmptyState } from '@/components/ui';
import { Link } from '@/lib/router';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { AIAssistantWidget } from '@/components/AIAssistantWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  const route = useRouter();
  const path = route.path;

  const renderPage = () => {
    if (path === '/' || path === '') return <HomePage />;
    if (path === '/shop') return <ShopPage />;
    if (path.startsWith('/product/')) return <ErrorBoundary key={path}><ProductPage /></ErrorBoundary>;
    if (path === '/cart') return <CartPage />;
    if (path === '/checkout') return <CheckoutPage />;
    if (path === '/order-confirmation') return <OrderConfirmationPage />;
    if (path === '/track-order') return <TrackOrderPage />;
    if (path === '/invoice') return <InvoicePage />;
    if (path === '/custom-order') return <CustomOrderPage />;
    if (path === '/wholesale') return <WholesalePage />;
    if (path === '/about') return <AboutPage />;
    if (path === '/contact') return <ContactPage />;
    if (path === '/auth') return <AuthPage />;
    if (path === '/account') return <AccountPage />;
    if (path === '/owner' || path === '/admin') return <OwnerPage />;
    if (path === '/how-we-make-it') return <HowWeMakeItPage />;
    if (path === '/bed-measure') return <BedMeasurePage />;
    if (path === '/faq') return <FAQPage />;
    if (path === '/shipping-policy') return <ShippingPolicyPage />;
    if (path === '/return-policy') return <ReturnPolicyPage />;
    if (path === '/privacy-policy') return <PrivacyPolicyPage />;
    if (path === '/terms') return <TermsPage />;
    if (path === '/support') return <SupportPage />;
    return (
      <div className="py-20">
        <EmptyState
          title="Page not found"
          message="The page you're looking for doesn't exist."
          action={<Link to="/" className="btn-primary">Go Home</Link>}
        />
      </div>
    );
  };

  // Auth and owner pages don't show header/footer
  const isStandalone = path === '/auth' || path === '/owner' || path === '/admin';

  if (isStandalone) {
    return <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">{renderPage()}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <Header />
      <main className="flex-1">{renderPage()}</main>
      <Footer />
      <WhatsAppButton />
      <AIAssistantWidget />
    </div>
  );
}

export default App;
