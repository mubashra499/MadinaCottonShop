import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ChevronLeft, ChevronRight, Package, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProductImage, ProductVideo } from '@/lib/types';

interface ImageGalleryProps {
  images: ProductImage[];
  productName: string;
  videos?: ProductVideo[];
}

type ViewFilter = 'all' | 'front' | 'back';

export function ImageGallery({ images, productName, videos = [] }: ImageGalleryProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [showVideo, setShowVideo] = useState(false);
  const touchStartX = useRef(0);

  const activeVideos = videos.filter((v) => v.active);

  const hasFrontBack =
    images.some((i) => i.view_type === 'front') &&
    images.some((i) => i.view_type === 'back');

  const filteredImages =
    viewFilter === 'all'
      ? images
      : images.filter((i) => i.view_type === viewFilter);

  const displayImages = filteredImages.length > 0 ? filteredImages : images;
  const currentImage = displayImages[selectedIdx] ?? displayImages[0] ?? null;

  useEffect(() => {
    setSelectedIdx(0);
    setShowVideo(false);
  }, [viewFilter, images]);

  const goPrev = () =>
    setSelectedIdx((i) => (i === 0 ? displayImages.length - 1 : i - 1));
  const goNext = () =>
    setSelectedIdx((i) => (i === displayImages.length - 1 ? 0 : i + 1));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
        <Package size={64} className="text-neutral-300" />
      </div>
    );
  }

  return (
    <div>
      {/* Front/Back tabs + Video button */}
      <div className="mb-3 flex gap-2">
        {hasFrontBack && (
          <>
            {(['all', 'front', 'back'] as ViewFilter[]).map((vt) => (
              <button
                key={vt}
                onClick={() => { setViewFilter(vt); setShowVideo(false); }}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-sm font-medium transition',
                  viewFilter === vt && !showVideo
                    ? 'bg-primary-600 text-white'
                    : 'border border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300'
                )}
              >
                {vt === 'all' ? 'All' : vt === 'front' ? 'Front' : 'Back'}
              </button>
            ))}
          </>
        )}
        {activeVideos.length > 0 && (
          <button
            onClick={() => setShowVideo(true)}
            className={cn(
              'flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-medium transition',
              showVideo
                ? 'bg-primary-600 text-white'
                : 'border border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300'
            )}
          >
            <Play size={14} /> Video ({activeVideos.length})
          </button>
        )}
      </div>

      {/* Video player */}
      {showVideo && activeVideos.length > 0 && (
        <div className="mb-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-black dark:border-neutral-800">
            <video
              key={activeVideos[0].id}
              src={activeVideos[0].url}
              poster={activeVideos[0].thumbnail_url ?? undefined}
              controls
              autoPlay
              className="h-full w-full object-contain"
            />
          </div>
          {activeVideos.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {activeVideos.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => {
                    const sorted = [...activeVideos].sort((a, b) => a.sort_order - b.sort_order);
                    const target = sorted[idx];
                    if (target) {
                      const el = document.querySelector(`video[src="${target.url}"]`) as HTMLVideoElement | null;
                      if (el) { el.src = target.url; el.play(); }
                    }
                  }}
                  className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.title ?? ''} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Play size={16} className="text-neutral-400" /></div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main image */}
      {showVideo ? null : (
      <div
        className="group relative aspect-square overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentImage ? (
          <img
            src={currentImage.url}
            alt={`${productName} - ${currentImage.view_type}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            <Package size={64} />
          </div>
        )}

        {/* Zoom */}
        <button
          onClick={() => setZoomOpen(true)}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-soft transition hover:bg-white dark:bg-neutral-900/90"
          aria-label="Zoom image"
        >
          <ZoomIn size={18} />
        </button>

        {/* Prev/next arrows */}
        {displayImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 opacity-0 shadow-soft transition group-hover:opacity-100 hover:bg-white dark:bg-neutral-900/80"
              aria-label="Previous image"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goNext}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 opacity-0 shadow-soft transition group-hover:opacity-100 hover:bg-white dark:bg-neutral-900/80"
              aria-label="Next image"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Image counter */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            {selectedIdx + 1} / {displayImages.length}
          </div>
        )}
      </div>
      )}

      {/* Thumbnails */}
      {displayImages.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {displayImages.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setSelectedIdx(idx)}
              className={cn(
                'h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 transition',
                idx === selectedIdx
                  ? 'border-primary-600'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'
              )}
            >
              <img
                src={img.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Mobile swipe dots */}
      {displayImages.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5 lg:hidden">
          {displayImages.map((_, idx) => (
            <span
              key={idx}
              className={cn(
                'h-2 w-2 rounded-full transition',
                idx === selectedIdx ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'
              )}
            />
          ))}
        </div>
      )}

      {/* Zoom modal */}
      {zoomOpen && currentImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomOpen(false)}
        >
          <img
            src={currentImage.url}
            alt={`${productName} - zoomed`}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
          <button
            onClick={() => setZoomOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Close zoom"
          >
            <ChevronRight size={24} className="rotate-45" />
          </button>
        </div>
      )}
    </div>
  );
}
