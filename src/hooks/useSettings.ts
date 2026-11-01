import { useEffect, useState, useCallback } from 'react';
import { supabase, SHOP_INFO } from '@/lib/supabase';

export interface SiteSettings {
  shop_name: string;
  shop_tagline: string;
  shop_address: string;
  shop_phone: string;
  shop_whatsapp: string;
  shop_email: string;
  business_hours: string;
  logo_text: string;
  logo_url: string;
  favicon_url: string;
  announcement_text: string;
  announcement_enabled: boolean;
  announcement_bg: string;
  announcement_text_color: string;
  footer_about: string;
  footer_copyright: string;
  social_facebook: string;
  social_instagram: string;
  social_youtube: string;
  social_tiktok: string;
  nav_show_wholesale: boolean;
  nav_show_custom_order: boolean;
  nav_show_measure: boolean;
  nav_show_about: boolean;
  nav_show_contact: boolean;
  popup_enabled: boolean;
  popup_title: string;
  popup_body: string;
  popup_image_url: string;
  popup_button_text: string;
  popup_button_link: string;
  cod_enabled: boolean;
  bank_transfer_enabled: boolean;
  easypaisa_enabled: boolean;
  jazzcash_enabled: boolean;
  hand_to_hand_enabled: boolean;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  primary_color: string;
}

const DEFAULTS: SiteSettings = {
  shop_name: SHOP_INFO.name,
  shop_tagline: 'Handmade cotton bedding, crafted with care',
  shop_address: SHOP_INFO.address,
  shop_phone: SHOP_INFO.phone,
  shop_whatsapp: SHOP_INFO.phone,
  shop_email: SHOP_INFO.email,
  business_hours: SHOP_INFO.businessHours,
  logo_text: 'Madina Cotton',
  logo_url: '',
  favicon_url: '',
  announcement_text: '',
  announcement_enabled: false,
  announcement_bg: '#1e293b',
  announcement_text_color: '#ffffff',
  footer_about: 'Handmade cotton lahaf, razai, gadda, cushions, pillows & custom bedding. Crafted with care in Hyderabad, Sindh.',
  footer_copyright: 'Madina Cotton Shop. All rights reserved.',
  social_facebook: '',
  social_instagram: '',
  social_youtube: '',
  social_tiktok: '',
  nav_show_wholesale: true,
  nav_show_custom_order: true,
  nav_show_measure: true,
  nav_show_about: true,
  nav_show_contact: true,
  popup_enabled: false,
  popup_title: '',
  popup_body: '',
  popup_image_url: '',
  popup_button_text: '',
  popup_button_link: '',
  cod_enabled: true,
  bank_transfer_enabled: true,
  easypaisa_enabled: true,
  jazzcash_enabled: false,
  hand_to_hand_enabled: true,
  seo_title: 'Madina Cotton Shop — Handmade Bedding in Pakistan',
  seo_description: 'Handmade cotton lahaf, razai, gadda, cushions, pillows & custom bedding. Crafted with care in Hyderabad, Sindh.',
  seo_keywords: 'cotton bedding, lahaf, razai, gadda, handmade, pakistan, hyderabad',
  primary_color: '#2563eb',
};

const BOOLEAN_KEYS = new Set([
  'announcement_enabled', 'nav_show_wholesale', 'nav_show_custom_order',
  'nav_show_measure', 'nav_show_about', 'nav_show_contact', 'popup_enabled',
  'cod_enabled', 'bank_transfer_enabled', 'easypaisa_enabled', 'jazzcash_enabled', 'hand_to_hand_enabled',
]);

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: loadError } = await supabase.from('settings').select('key, value');
    if (loadError) {
      console.error('Settings load error:', loadError.message);
      setError(loadError.message);
      setLoaded(true);
      return;
    }
    const map: Record<string, string | null> = {};
    for (const row of data ?? []) {
      map[row.key] = row.value;
    }
    setSettings((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(DEFAULTS) as (keyof SiteSettings)[]) {
        if (key in map && map[key] != null) {
          if (BOOLEAN_KEYS.has(key)) {
            (next as Record<string, unknown>)[key] = map[key] === 'true';
          } else {
            (next as Record<string, unknown>)[key] = map[key];
          }
        }
      }
      return next;
    });
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSetting = useCallback(async (key: string, value: string) => {
    const { data: existing } = await supabase.from('settings').select('key').eq('key', key).maybeSingle();
    if (existing) {
      const { error: updateError } = await supabase.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
      if (updateError) {
        console.error('Settings update error:', updateError.message);
        throw new Error(updateError.message);
      }
    } else {
      const { error: insertError } = await supabase.from('settings').insert({ key, value });
      if (insertError) {
        console.error('Settings insert error:', insertError.message);
        throw new Error(insertError.message);
      }
    }
    await load();
  }, [load]);

  return { settings, loaded, error, saveSetting, reload: load };
}
