export type Role = 'owner' | 'customer';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  category_id: string | null;
  short_desc: string | null;
  full_desc: string | null;
  price: number;
  sale_price: number | null;
  cost_price: number;
  labor_cost: number;
  material_cost: number;
  currency: string;
  status: string;
  stock: number;
  low_stock_threshold: number;
  low_stock_alert_sent: boolean;
  featured: boolean;
  is_new: boolean;
  best_seller: boolean;
  handmade: boolean;
  premium: boolean;
  sale: boolean;
  limited_stock: boolean;
  made_to_order: boolean;
  customizable: boolean;
  production_time: string | null;
  care_instructions: string | null;
  handmade_info: string | null;
  seo_title: string | null;
  meta_desc: string | null;
  avg_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  product_images?: ProductImage[];
  product_variants?: ProductVariant[];
  product_videos?: ProductVideo[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  price: number;
  sale_price: number | null;
  size_label: string | null;
  width: number | null;
  length: number | null;
  unit: string;
  weight: string | null;
  filling: string | null;
  fabric: string | null;
  color: string | null;
  color_hex: string | null;
  design: string | null;
  stitching: string | null;
  decoration: string | null;
  stock: number;
  production_time: string | null;
  active: boolean;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  variant_id: string | null;
  color: string | null;
  view_type: string;
  url: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVideo {
  id: string;
  product_id: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  is_primary: boolean;
  active: boolean;
  created_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  customization: Record<string, unknown> | null;
  note: string | null;
  unit_price: number;
  created_at: string;
  product?: Product;
  variant?: ProductVariant;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  landmark: string | null;
  delivery_instructions: string | null;
  notes: string | null;
  internal_notes: string | null;
  tracking_number: string | null;
  courier: string | null;
  tracking_token: string | null;
  coupon_code: string | null;
  coupon_discount: number;
  area: string | null;
  is_gift: boolean;
  gift_recipient_name: string | null;
  gift_message: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  order_status_history?: OrderStatusHistory[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  size_label: string | null;
  weight: string | null;
  filling: string | null;
  fabric: string | null;
  color: string | null;
  design: string | null;
  stitching: string | null;
  decoration: string | null;
  quantity: number;
  unit_price: number;
  customization: Record<string, unknown> | null;
  reference_images: string[] | null;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  quality: number | null;
  fabric: number | null;
  stitching: number | null;
  color_rating: number | null;
  size_rating: number | null;
  experience: number | null;
  body: string | null;
  approved: boolean;
  verified_purchase: boolean;
  helpful_count: number;
  owner_reply: string | null;
  owner_reply_at: string | null;
  reported_count: number;
  created_at: string;
  profiles?: { full_name: string | null } | null;
  review_images?: ReviewImage[];
}

export interface Question {
  id: string;
  product_id: string;
  user_id: string;
  question: string;
  answer: string | null;
  approved: boolean;
  created_at: string;
}

export interface CustomOrder {
  id: string;
  user_id: string;
  product_type: string;
  size_label: string | null;
  width: number | null;
  length: number | null;
  unit: string;
  weight: string | null;
  filling: string | null;
  fabric: string | null;
  fabric_source: string;
  fabric_details: string | null;
  color: string | null;
  color_hex: string | null;
  front_design: string | null;
  back_design: string | null;
  stitching: string | null;
  decoration: string | null;
  quantity: number;
  instructions: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  custom_order_images?: { id: string; url: string; note: string | null; image_type: string | null }[];
  custom_quotes?: CustomQuote[];
}

export interface CustomQuote {
  id: string;
  custom_order_id: string;
  price: number;
  production_time: string | null;
  delivery_charge: number;
  discount: number;
  expiry: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  product_id: string | null;
  order_id: string | null;
  sender: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  stock: number;
  cost: number;
  supplier_id: string | null;
  min_stock: number;
  reorder_level: number;
  created_at: string;
  supplier?: Supplier | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  material: string | null;
  notes: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  supplier_id: string | null;
  material_id: string | null;
  quantity: number;
  unit: string;
  cost: number;
  invoice: string | null;
  payment_status: string;
  purchase_date: string;
  created_at: string;
}

export interface ProductionOrder {
  id: string;
  order_id: string | null;
  custom_order_id: string | null;
  status: string;
  progress: number;
  stage_notes: string | null;
  deadline: string | null;
  expected_completion: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  name: string | null;
  discount_type: string;
  value: number;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number | null;
  per_customer_limit: number;
  min_order: number;
  max_discount: number | null;
  usage_count: number;
  active: boolean;
  auto_apply: boolean;
  priority: number;
  free_delivery: boolean;
  target_type: string | null;
  max_usage_per_customer: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  created_at: string;
  product?: Product;
}

export interface WholesaleAccount {
  id: string;
  user_id: string;
  business_name: string;
  contact: string | null;
  verified: boolean;
  status: string;
  created_at: string;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string | null;
  status: string;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  type: string;
  country: string;
  province: string | null;
  city: string | null;
  area: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  landmark: string | null;
  phone: string | null;
  delivery_instructions: string | null;
  is_default: boolean;
  created_at: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  country: string;
  province: string | null;
  city: string | null;
  area: string | null;
  postal_code: string | null;
  delivery_fee: number;
  min_order: number;
  free_delivery_threshold: number | null;
  estimated_delivery_days: number;
  delivery_methods: string[];
  active: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  support_messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  sender: string;
  body: string;
  attachment_url: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  category_id: string | null;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  paid_by: string | null;
  payment_method: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
}

export interface LoyaltyPoint {
  id: string;
  user_id: string;
  points: number;
  action: string;
  source: string | null;
  order_id: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_email: string | null;
  referred_id: string | null;
  referral_code: string;
  status: string;
  reward_type: string;
  reward_value: number;
  created_at: string;
}

export interface SavedDesign {
  id: string;
  user_id: string;
  name: string;
  product_type: string;
  configuration: Record<string, unknown>;
  estimated_price: number | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface HomepageSection {
  id: string;
  section_key: string;
  title: string;
  subtitle: string | null;
  content: Record<string, unknown>;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FeatureSwitch {
  id: string;
  feature_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MeasurementProfile {
  id: string;
  user_id: string;
  name: string;
  profile_type: string;
  length: number | null;
  width: number | null;
  unit: string;
  chest: number | null;
  waist: number | null;
  shoulder: number | null;
  sleeve: number | null;
  trouser_length: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderChangeRequest {
  id: string;
  order_id: string;
  user_id: string;
  change_type: string;
  current_value: string | null;
  requested_value: string | null;
  reason: string | null;
  status: string;
  owner_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
}

export interface AbandonedCart {
  id: string;
  user_id: string | null;
  cart_data: Record<string, unknown>;
  cart_total: number;
  items_count: number;
  status: string;
  recovery_coupon_code: string | null;
  recovered_at: string | null;
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  status: string;
  transaction_ref: string | null;
  proof_url: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  payment_events?: PaymentEvent[];
}

export interface PaymentEvent {
  id: string;
  payment_id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export interface ReviewImage {
  id: string;
  review_id: string;
  image_url: string;
  created_at: string;
}

export interface ReviewReport {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  user_id: string;
  order_id: string | null;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string | null;
}

export const ORDER_STATUSES = [
  'new', 'payment_pending', 'payment_verified', 'confirmed', 'production',
  'stitching', 'finishing', 'quality_check', 'ready', 'packed',
  'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded',
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'New', payment_pending: 'Payment Pending', payment_verified: 'Payment Verified',
  confirmed: 'Confirmed', production: 'In Production',
  stitching: 'Stitching', finishing: 'Finishing', quality_check: 'Quality Check',
  ready: 'Ready', packed: 'Packed', shipped: 'Dispatched',
  out_for_delivery: 'Out for Delivery', delivered: 'Delivered',
  cancelled: 'Cancelled', returned: 'Returned', refunded: 'Refunded',
};

export const ORDER_TRACKING_STEPS = [
  'new', 'confirmed', 'production', 'stitching',
  'quality_check', 'packed', 'shipped', 'out_for_delivery', 'delivered',
];

export const PRODUCTION_STAGES = [
  'order_received', 'cotton_preparation', 'cotton_processing', 'filling',
  'hand_stitching', 'hand_finishing', 'quality_check', 'packing', 'ready',
] as const;

export const PRODUCTION_STAGE_LABELS: Record<string, string> = {
  order_received: 'Order Received', cotton_preparation: 'Cotton Preparation',
  cotton_processing: 'Cotton Cleaning/Processing', filling: 'Hand Filling',
  hand_stitching: 'Hand Stitching', hand_finishing: 'Hand Finishing',
  quality_check: 'Quality Check', packing: 'Packing', ready: 'Ready for Dispatch',
};

export const PRODUCT_STATUSES = ['active', 'draft', 'discontinued'] as const;

export const PRODUCT_BADGES = [
  { key: 'featured', label: 'Featured' },
  { key: 'is_new', label: 'New' },
  { key: 'best_seller', label: 'Best Seller' },
  { key: 'handmade', label: 'Handmade' },
  { key: 'premium', label: 'Premium' },
  { key: 'sale', label: 'Sale' },
  { key: 'limited_stock', label: 'Limited Stock' },
  { key: 'made_to_order', label: 'Made to Order' },
  { key: 'customizable', label: 'Customizable' },
] as const;

export const SIZES = [
  { label: '48 × 80', width: 48, length: 80 },
  { label: '52 × 85', width: 52, length: 85 },
  { label: '60 × 94', width: 60, length: 94 },
  { label: '60 × 96', width: 60, length: 96 },
];

export const WEIGHTS = ['1 kg', '2 kg', '3 kg', '4 kg', '5 kg', '6 kg', 'Custom'];

export const FILLINGS = ['Pure Cotton', 'Handmade Cotton', 'Recycled Cotton', 'White Fiber', 'Polyester Fiber', 'Other'];

export const FABRICS = ['Cotton', 'Cotton Fabric', 'Printed Cotton', 'Plain Cotton', 'White Fabric', 'Premium Fabric', 'Custom Fabric', 'Other'];

export const COLORS = [
  { name: 'Red', hex: '#dc2626' }, { name: 'Blue', hex: '#2563eb' },
  { name: 'Green', hex: '#16a34a' }, { name: 'Pink', hex: '#ec4899' },
  { name: 'Yellow', hex: '#eab308' }, { name: 'White', hex: '#f8fafc' },
  { name: 'Black', hex: '#1e293b' }, { name: 'Grey', hex: '#6b7280' },
  { name: 'Maroon', hex: '#7f1d1d' }, { name: 'Brown', hex: '#78350f' },
  { name: 'Beige', hex: '#d6c7a4' }, { name: 'Purple', hex: '#7c3aed' },
  { name: 'Multi-color', hex: 'linear-gradient(135deg,#dc2626,#eab308,#16a34a,#2563eb)' },
];

export const DESIGNS = ['Floral', 'Traditional', 'Geometric', 'Plain', 'Printed', 'Embroidered', 'Patchwork', 'Block Print', 'Handmade Pattern', 'Custom Design', 'Other'];

export const STITCHINGS = ['Basic Stitching', 'Straight Stitch', 'Border Stitch', 'Box Stitch', 'Diamond Stitch', 'Channel Stitch', 'Decorative Stitch', 'Hand Stitch', 'Machine Stitch', 'Custom Stitching'];

export const DECORATIONS = ['None', 'Lace', 'Border', 'Piping', 'Embroidery', 'Buttons', 'Tassels', 'Decorative Edges', 'Handmade Patchwork', 'Custom Print'];

export const PRODUCT_TYPES = ['Lahaf', 'Razai', 'Gadda', 'Mattress', 'Quilt', 'Comforter', 'Bedding Set', 'Cushion', 'Floor Cushion', 'Sofa Cushion', 'Decorative Cushion', 'Bolster', 'Cotton Pillow', 'Fiber Pillow', 'Handmade Pillow', 'Custom Pillow', 'Custom Bedding Set', 'Custom Cotton Product'];
