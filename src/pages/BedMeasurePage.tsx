import { useState } from 'react';
import { Link } from '@/lib/router';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui';
import { convertLength, recommendBedSize } from '@/lib/whatsapp';
import { Ruler, Bed, Calculator, MessageCircle } from 'lucide-react';

export function BedMeasurePage() {
  const [unit, setUnit] = useState('inches');
  const [bedWidth, setBedWidth] = useState('');
  const [bedLength, setBedLength] = useState('');
  const [desiredDrop, setDesiredDrop] = useState('');
  const [gaddaThickness, setGaddaThickness] = useState('');
  const [result, setResult] = useState<{ lahaf: string; gadda: string; takiya: string } | null>(null);

  const calculate = () => {
    if (!bedWidth || !bedLength) return;
    const widthIn = convertLength(parseFloat(bedWidth), unit, 'inches');
    const lengthIn = convertLength(parseFloat(bedLength), unit, 'inches');
    const dropIn = desiredDrop ? convertLength(parseFloat(desiredDrop), unit, 'inches') : 4;
    const gaddaThickIn = gaddaThickness ? convertLength(parseFloat(gaddaThickness), unit, 'inches') : 0;
    const base = recommendBedSize(widthIn, lengthIn);
    const lahafParts = base.lahaf.split(' × ');
    const lahafW = parseInt(lahafParts[0]) + Math.round(dropIn);
    const lahafL = parseInt(lahafParts[1]) + (gaddaThickIn > 0 ? Math.round(gaddaThickIn) : 0);
    setResult({
      lahaf: `${lahafW} × ${lahafL}`,
      gadda: base.gadda,
      takiya: base.takiya,
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO
        title="Bed Measurement Tool | Madina Cotton Shop — Size Guide"
        description="Measure your bed in inches, feet, cm, or meters and get recommended lahaf, gadda, and takiya sizes. Free online bedding size calculator for Pakistan customers."
        canonicalPath="/bed-measure"
      />
      <Badge color="primary"><Ruler size={12} className="mr-1" /> Measurement Tool</Badge>
      <h1 className="mt-3 font-display text-3xl font-bold">Measure My Bed</h1>
      <p className="mt-2 text-neutral-500">Enter your bed dimensions and we'll recommend the right lahaf, gadda, and takiya sizes for you.</p>

      <div className="mt-6 card p-6">
        <div className="mb-4">
          <label className="label">Measurement Unit</label>
          <div className="flex gap-2">
            {['inches', 'feet', 'cm', 'meters'].map((u) => (
              <button key={u} onClick={() => setUnit(u)} className={`rounded-lg px-4 py-2 text-sm font-medium ${unit === u ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
                {u.charAt(0).toUpperCase() + u.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Bed Width *</label>
            <input type="number" value={bedWidth} onChange={(e) => setBedWidth(e.target.value)} className="input" placeholder={`Width in ${unit}`} />
          </div>
          <div>
            <label className="label">Bed Length *</label>
            <input type="number" value={bedLength} onChange={(e) => setBedLength(e.target.value)} className="input" placeholder={`Length in ${unit}`} />
          </div>
          <div>
            <label className="label">Desired Lahaf Drop (sides)</label>
            <input type="number" value={desiredDrop} onChange={(e) => setDesiredDrop(e.target.value)} className="input" placeholder={`Drop in ${unit} (default 4)`} />
          </div>
          <div>
            <label className="label">Desired Gadda Thickness</label>
            <input type="number" value={gaddaThickness} onChange={(e) => setGaddaThickness(e.target.value)} className="input" placeholder={`Thickness in ${unit}`} />
          </div>
        </div>

        <button onClick={calculate} className="btn-primary mt-4 w-full">
          <Calculator size={18} /> Get Recommendations
        </button>
      </div>

      {result && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold">Recommended Sizes</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card p-5 text-center">
              <Bed className="mx-auto mb-2 text-primary-600" size={28} />
              <p className="text-sm font-semibold">Lahaf</p>
              <p className="text-lg font-bold text-primary-600">{result.lahaf}</p>
              <p className="text-xs text-neutral-400">inches</p>
            </div>
            <div className="card p-5 text-center">
              <Bed className="mx-auto mb-2 text-primary-600" size={28} />
              <p className="text-sm font-semibold">Gadda</p>
              <p className="text-lg font-bold text-primary-600">{result.gadda}</p>
              <p className="text-xs text-neutral-400">inches</p>
            </div>
            <div className="card p-5 text-center">
              <Bed className="mx-auto mb-2 text-primary-600" size={28} />
              <p className="text-sm font-semibold">Takiya</p>
              <p className="text-lg font-bold text-primary-600">{result.takiya}</p>
              <p className="text-xs text-neutral-400">inches</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link to="/shop" className="btn-outline flex-1">Shop Now</Link>
            <Link to="/custom-order" className="btn-primary flex-1">Custom Order</Link>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500 dark:bg-neutral-900">
        <p className="font-medium text-neutral-700 dark:text-neutral-300">How to Measure:</p>
        <ul className="mt-2 space-y-1">
          <li>• Measure the width of your bed from left to right</li>
          <li>• Measure the length from head to foot</li>
          <li>• For lahaf, add 4-6 inches to width for proper drop</li>
          <li>• For gadda, match your bed dimensions exactly</li>
          <li>• Standard takiya size is 18 × 28 inches</li>
        </ul>
        <p className="mt-3">Need help? <a href="https://wa.me/923133344068" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 inline-flex items-center gap-1"><MessageCircle size={14} /> WhatsApp us</a></p>
      </div>
    </div>
  );
}
