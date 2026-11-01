import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const missingVars: string[] = [];
if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}. Check your .env file.`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SHOP_INFO = {
  name: 'Madina Cotton Shop',
  address: 'Latifabad, Unit No. 11, near Tameer Bank, Hyderabad, Sindh, Pakistan',
  phone: '0313 3344068',
  email: 'myousufshaikh399@gmail.com',
  ownerEmail: 'myousufshaikh399@gmail.com',
  paymentMethods: ['Cash on Delivery', 'Bank Transfer', 'EasyPaisa', 'Hand-to-Hand (local pickup)'],
  businessHours: '9:00 AM - 9:00 PM',
};
