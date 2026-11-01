import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Truck, MapPin, Check, Loader2 } from 'lucide-react';
import type { DeliveryZone } from '@/lib/types';

export function DeliveryChecker() {
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeliveryZone | null>(null);
  const [notFound, setNotFound] = useState(false);

  const check = async () => {
    if (!city.trim()) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);

    const { data } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('active', true)
      .ilike('city', `%${city.trim()}%`)
      .limit(5);

    let zones = (data as DeliveryZone[]) ?? [];

    if (area.trim() && zones.length > 0) {
      const areaMatch = zones.filter(
        (z) =>
          z.area &&
          z.area.toLowerCase().includes(area.trim().toLowerCase())
      );
      if (areaMatch.length > 0) zones = areaMatch;
    }

    if (zones.length > 0) {
      const zone = zones.find((z) => z.free_delivery_threshold != null) ?? zones[0];
      setResult(zone);
    } else {
      setNotFound(true);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
        <Truck size={18} className="text-primary-600" />
        Delivery Checker
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g. Hyderabad)"
          className="input flex-1 py-2 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && check()}
        />
        <input
          type="text"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Area (optional)"
          className="input flex-1 py-2 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && check()}
        />
        <button
          onClick={check}
          disabled={loading || !city.trim()}
          className="btn-primary px-4 py-2 text-sm"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Check'}
        </button>
      </div>

      {result && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-white p-3 text-sm dark:bg-neutral-800">
          <p className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
            <Check size={16} /> Delivery available in {result.name}
          </p>
          <p className="text-neutral-600 dark:text-neutral-300">
            <MapPin size={14} className="mr-1 inline" />
            Delivery fee: Rs. {Number(result.delivery_fee).toLocaleString()}
          </p>
          {result.free_delivery_threshold && Number(result.free_delivery_threshold) > 0 && (
            <p className="text-neutral-600 dark:text-neutral-300">
              Free delivery on orders over Rs. {Number(result.free_delivery_threshold).toLocaleString()}
            </p>
          )}
          <p className="text-neutral-600 dark:text-neutral-300">
            Estimated delivery: {result.estimated_delivery_days} day{result.estimated_delivery_days > 1 ? 's' : ''}
          </p>
          <p className="text-neutral-500">Cash on Delivery available</p>
        </div>
      )}

      {notFound && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          No specific delivery zone found for "{city}". Nationwide shipping available (Rs. 350, 3 days).
        </p>
      )}
    </div>
  );
}
