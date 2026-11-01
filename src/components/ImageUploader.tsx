import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, X, Star, Trash2, ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadedImage {
  id?: string;
  url: string;
  view_type: string;
  is_primary: boolean;
  sort_order: number;
  variant_id?: string | null;
  color?: string | null;
}

const VIEW_TYPES = [
  { value: 'main', label: 'Main' },
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left Side' },
  { value: 'right', label: 'Right Side' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'detail', label: 'Detail' },
  { value: 'fabric', label: 'Fabric' },
  { value: 'cotton', label: 'Cotton' },
  { value: 'stitching', label: 'Stitching' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'other', label: 'Other' },
];

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface ImageUploaderProps {
  productId?: string;
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  variantColors?: { name: string; hex: string }[];
}

export function ImageUploader({ productId, images, onImagesChange, variantColors }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState('');
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setError('');
    setUploading(true);

    const newImages: UploadedImage[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setUploadProgress(`Uploading ${i + 1} of ${fileArray.length}...`);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`${file.name}: Unsupported file type. Use JPG, PNG, WebP, or GIF.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name}: File too large. Max 8MB.`);
        continue;
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const folder = productId || 'drafts';
      const path = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(path);

      const isFirst = images.length === 0 && newImages.length === 0;
      newImages.push({
        url: urlData.publicUrl,
        view_type: fileArray.length === 1 && i === 0 ? 'main' : 'other',
        is_primary: isFirst,
        sort_order: images.length + newImages.length,
      });
    }

    setUploadProgress('');
    setUploading(false);

    if (newImages.length > 0) {
      const updated = [...images, ...newImages];
      if (!updated.some((img) => img.is_primary)) {
        updated[0].is_primary = true;
      }
      onImagesChange(updated);
    }
  }, [images, onImagesChange, productId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const removeImage = async (idx: number) => {
    const img = images[idx];
    if (!img) return;

    // NOTE: We intentionally do NOT delete from storage or the database here.
    // Removing an existing, already-saved image only marks it for removal in
    // local state. The parent commits DB deletions when the owner saves the
    // product (see ProductsTab.save), so closing the form without saving
    // leaves the original image intact. New (unsaved) uploads are kept in
    // storage; an orphan-cleanup pass can reap them later if needed.
    const updated = images.filter((_, i) => i !== idx);
    if (updated.length > 0 && !updated.some((img) => img.is_primary)) {
      updated[0].is_primary = true;
    }
    onImagesChange(updated);
  };

  const setPrimary = (idx: number) => {
    const updated = images.map((img, i) => ({ ...img, is_primary: i === idx }));
    onImagesChange(updated);
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= images.length) return;
    const updated = [...images];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onImagesChange(updated.map((img, i) => ({ ...img, sort_order: i })));
  };

  const setViewType = (idx: number, viewType: string) => {
    const updated = [...images];
    updated[idx] = { ...updated[idx], view_type: viewType };
    onImagesChange(updated);
  };

  const setVariantColor = (idx: number, color: string | null) => {
    const updated = [...images];
    updated[idx] = { ...updated[idx], color };
    onImagesChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center transition',
          dragOver
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-neutral-300 dark:border-neutral-700'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-primary-500" />
            <p className="text-sm text-neutral-500">{uploadProgress || 'Uploading...'}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <Upload size={24} className="text-neutral-400" />
            </div>
            <p className="text-sm font-medium">Drag & drop images here</p>
            <p className="text-xs text-neutral-400">or choose an option below</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary text-sm"
              >
                <ImageIcon size={16} /> Select Files
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="btn-outline text-sm"
              >
                <Upload size={16} /> Take Photo
              </button>
            </div>
            <p className="text-xs text-neutral-400">JPG, PNG, WebP, GIF · Max 8MB each</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{images.length} image(s) uploaded</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className={cn(
                  'group relative overflow-hidden rounded-xl border-2',
                  img.is_primary ? 'border-primary-500' : 'border-neutral-200 dark:border-neutral-700'
                )}
              >
                <div
                  className="relative aspect-square cursor-pointer bg-neutral-100 dark:bg-neutral-800"
                  onClick={() => setPreviewIdx(idx)}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {img.is_primary && (
                    <div className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-primary-500 px-2 py-0.5 text-xs font-medium text-white">
                      <Star size={10} fill="currentColor" /> Main
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 p-2">
                  <select
                    value={img.view_type}
                    onChange={(e) => setViewType(idx, e.target.value)}
                    className="input w-full py-1 text-xs"
                  >
                    {VIEW_TYPES.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>

                  {variantColors && variantColors.length > 0 && (
                    <select
                      value={img.color ?? ''}
                      onChange={(e) => setVariantColor(idx, e.target.value || null)}
                      className="input w-full py-1 text-xs"
                    >
                      <option value="">No color link</option>
                      {variantColors.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(idx, -1)}
                        disabled={idx === 0}
                        className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 1)}
                        disabled={idx === images.length - 1}
                        className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="flex gap-1">
                      {!img.is_primary && (
                        <button
                          type="button"
                          onClick={() => setPrimary(idx)}
                          className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          title="Set as main"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen preview */}
      {previewIdx !== null && images[previewIdx] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewIdx(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setPreviewIdx(null); }}
          >
            <X size={24} />
          </button>
          {previewIdx > 0 && (
            <button
              className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setPreviewIdx(previewIdx - 1); }}
            >
              <ChevronLeft size={28} />
            </button>
          )}
          {previewIdx < images.length - 1 && (
            <button
              className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); setPreviewIdx(previewIdx + 1); }}
            >
              <ChevronRight size={28} />
            </button>
          )}
          <img
            src={images[previewIdx].url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
