import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Loader2,
  Shirt,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { OutfitCombination, WardrobeCategory, WardrobeItem } from '../../types';
import { compressImageFileToJpegDataUrl, uid } from '../../utils/storage';
import { TiltCard } from '../editorial/MotionPrimitives';
import showroomImg from '../../assets/images/spatial_wardrobe_gallery_1795246613207.jpg';

interface DigitalWardrobeStudioProps {
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  savedOutfits: OutfitCombination[];
  isOnline: boolean;
  onAddWardrobeItem: (item: WardrobeItem) => void;
  onSaveWardrobePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  onDeleteWardrobeItem: (itemId: string) => void;
  onOpenOutfitStudio: () => void;
}

const CATEGORIES: Array<'All' | WardrobeCategory> = [
  'All',
  'Tops',
  'Bottoms',
  'Dresses',
  'Outerwear',
  'Footwear',
  'Accessories',
];

export const DigitalWardrobeStudio: React.FC<DigitalWardrobeStudioProps> = ({
  wardrobe,
  wardrobePhotos,
  savedOutfits,
  isOnline,
  onAddWardrobeItem,
  onSaveWardrobePhoto,
  onDeleteWardrobeItem,
  onOpenOutfitStudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeCategory, setActiveCategory] = useState<'All' | WardrobeCategory>('All');
  const [warmthFilter, setWarmthFilter] = useState<string>('All');
  const [inspectItem, setInspectItem] = useState<WardrobeItem | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState('');

  const filteredWardrobe = useMemo(() => {
    return wardrobe.filter((w) => {
      if (activeCategory !== 'All' && w.category !== activeCategory) return false;
      if (warmthFilter !== 'All' && w.warmth !== warmthFilter) return false;
      return true;
    });
  }, [wardrobe, activeCategory, warmthFilter]);

  const outfitAppearances = useMemo(() => {
    const map = new Map<string, number>();
    savedOutfits.forEach((o) => {
      o.itemIds.forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    });
    return map;
  }, [savedOutfits]);

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isOnline) {
      setUploadFeedback('Connect to the internet so Gemini Vision can catalog your photo.');
      return;
    }

    setUploadBusy(true);
    setUploadFeedback('');
    let added = 0;

    for (const file of Array.from(files).filter((f) => f.type.startsWith('image/'))) {
      try {
        const compressed = await compressImageFileToJpegDataUrl(file, 960);

        const res = await fetch('/api/ai/analyze-clothing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compressed.base64,
            mimeType: compressed.mimeType,
            fileName: file.name,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.detected) {
          setUploadFeedback(data.error || `Could not identify clothing in ${file.name}.`);
          continue;
        }

        const photoId = uid('wphoto');
        await onSaveWardrobePhoto(photoId, compressed.dataUrl);
        const det = data.detected;

        onAddWardrobeItem({
          id: uid('ward'),
          name: det.name,
          category: det.category as WardrobeCategory,
          colorName: det.colorName,
          colorHex: det.colorHex,
          secondaryColors: det.secondaryColors || [],
          pattern: det.pattern,
          style: det.style,
          fabric: det.fabric,
          warmth: det.warmth,
          activities: det.occasions || ['Everyday'],
          weightGrams: det.estimatedWeightGrams || 240,
          volumeLiters: det.estimatedVolumeLiters || 1.0,
          reusableDays: 3,
          photoId,
          aiDetected: true,
          notes: det.stylingNote,
        });
        added++;
      } catch {
        setUploadFeedback('Error uploading or analyzing one of your garment photos.');
      }
    }

    if (added > 0) {
      setUploadFeedback(`Cataloged ${added} new piece${added > 1 ? 's' : ''} into your digital archive.`);
    }
    setUploadBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#0B3B40] text-[#FBFAF8] pt-20 pb-14">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-9">
        {/* SHOWROOM EDITORIAL HERO STRIP */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center border-b border-white/15 pb-8">
          <div className="lg:col-span-7 space-y-5">
            <p className="font-mono text-[11px] tracking-[0.16em] text-[#D5DCD9]">
              04. MY DIGITAL WARDROBE · PRIVATE ARCHIVE
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl leading-[0.98] font-normal text-[#FBFAF8]">
              Every silhouette you own,{' '}
              <span className="italic text-[#E6DFD2]">curated in light.</span>
            </h1>
            <p className="text-sm text-white/70 max-w-xl leading-relaxed">
              Your living digital closet. Photograph garments straight from your hangers or suitcase—AI Vision logs color, fabric, warmth, and styling versatility so every outfit is built from what you genuinely wear.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleUploadPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={uploadBusy}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[48px] px-6 bg-[#FBFAF8] text-[#0A0A0A] text-xs font-bold inline-flex items-center gap-2 hover:bg-[#E6DFD2] transition-colors disabled:opacity-50"
              >
                {uploadBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scanning with AI Vision...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Add Garment Photos</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenOutfitStudio}
                className="min-h-[48px] px-6 border border-white/25 text-[#FBFAF8] text-xs font-bold inline-flex items-center gap-2 hover:bg-[#D5DCD9] hover:text-[#0A0A0A] hover:border-[#D5DCD9] transition-colors"
              >
                <span>Style in AI Outfit Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {uploadFeedback && (
              <p className="inline-block px-3.5 py-2 bg-[#E6DFD2] text-[#0A0A0A] text-xs font-semibold">
                {uploadFeedback}
              </p>
            )}
          </div>

          <div className="lg:col-span-5">
            <div className="aspect-[4/3] overflow-hidden border border-white/15 bg-white/5 relative">
              <img loading="lazy" decoding="async"
                src={showroomImg}
                alt="Curated monochrome and pastel wardrobe showroom"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-[#0A0A0A]/85 flex items-center justify-between font-mono text-[11px]">
                <span className="text-[#BCD2CF]">{wardrobe.length} ARCHIVED PIECES</span>
                <span className="text-[#E6DFD2]">
                  {wardrobe.filter((w) => w.photoId).length} PHOTO SCANNED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER CONTROLS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`min-h-[40px] px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                    active
                      ? 'bg-[#D5DCD9] border-[#D5DCD9] text-[#0A0A0A] font-bold'
                      : 'border-white/15 text-white/75 hover:border-white/50 hover:text-[#FBFAF8]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <select
            aria-label="Filter by warmth"
            value={warmthFilter}
            onChange={(e) => setWarmthFilter(e.target.value)}
            className="min-h-[40px] px-3.5 bg-[#0B3B40] border border-white/25 text-xs font-semibold text-[#FBFAF8]"
          >
            <option value="All">All Climates</option>
            <option value="Warm Weather">Warm Weather</option>
            <option value="All-Season">All-Season</option>
            <option value="Cool & Cold">Cool &amp; Cold</option>
          </select>
        </div>

        {/* FLOATING DEPTH-LAYERED WARDROBE ARCHIVE GRID */}
        {filteredWardrobe.length === 0 ? (
          <div className="border border-white/15 p-12 text-center space-y-4">
            <p className="font-editorial text-3xl text-white/90">
              No pieces in this filter yet.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory('All');
                setWarmthFilter('All');
              }}
              className="min-h-[42px] px-5 bg-[#BCD2CF] text-[#0A0A0A] text-xs font-bold"
            >
              Show Entire Archive
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredWardrobe.map((item, idx) => {
              const photo = item.photoId ? wardrobePhotos[item.photoId] : undefined;
              const appears = outfitAppearances.get(item.id) || 0;
              const surfaceTints = ['#FBFAF8', '#BCD2CF', '#D5DCD9', '#E6DFD2'];
              const swatchBg = surfaceTints[idx % surfaceTints.length];

              return (
                <TiltCard key={item.id} maxTilt={4} className={idx % 2 === 1 ? 'lg:mt-6' : ''}>
                  <motion.div
                    layout
                    onClick={() => setInspectItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setInspectItem(item);
                    }}
                    className="border border-white/15 bg-white/[0.04] hover:border-[#E6DFD2] transition-colors overflow-hidden cursor-pointer group flex flex-col h-full"
                  >
                    <div className="aspect-[4/5] relative overflow-hidden bg-white/5">
                      {photo ? (
                        <img decoding="async"
                          src={photo}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex flex-col items-center justify-center p-6 text-[#0A0A0A]"
                          style={{ backgroundColor: swatchBg }}
                        >
                          <span
                            className="w-14 h-14 border border-[#0A0A0A]/25 flex items-center justify-center mb-4"
                            style={{ backgroundColor: item.colorHex }}
                          >
                            <Shirt className="w-6 h-6 text-[#FBFAF8]" />
                          </span>
                          <p className="font-mono text-[10px] tracking-[0.14em] text-[#0A0A0A]/65">
                            {item.category.toUpperCase()}
                          </p>
                          <p className="font-editorial text-2xl text-center mt-1 leading-tight">
                            {item.name}
                          </p>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#0A0A0A]/90 text-[#FBFAF8] font-mono text-[10px]">
                        {item.warmth}
                      </span>
                      {item.aiDetected && (
                        <span className="absolute top-3 right-3 px-2 py-1 bg-[#E6DFD2] text-[#0A0A0A] font-mono text-[9px] font-bold">
                          AI VISION
                        </span>
                      )}
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <p className="font-display text-sm font-bold text-[#FBFAF8] truncate">
                          {item.name}
                        </p>
                        <p className="font-mono text-[11px] text-white/60 mt-0.5">
                          {item.colorName} · {item.pattern || 'Solid'} · {item.fabric || item.style || 'Tailored'}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between font-mono text-[10px] text-white/55 tabular-nums">
                        <span>{item.weightGrams}g · {item.volumeLiters}L</span>
                        <span className="text-[#BCD2CF]">
                          {appears > 0 ? `In ${appears} look${appears > 1 ? 's' : ''}` : 'Ready to style'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </TiltCard>
              );
            })}
          </div>
        )}
      </div>

      {/* EDITORIAL GARMENT INSPECTION MODAL */}
      <AnimatePresence>
        {inspectItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInspectItem(null)}
            className="fixed inset-0 z-50 bg-[#0A0A0A]/85 flex items-center justify-center p-4 sm:p-8"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#FBFAF8] text-[#0A0A0A] border border-[#0A0A0A] overflow-hidden grid grid-cols-1 sm:grid-cols-12"
            >
              <div className="sm:col-span-5 min-h-[240px] bg-[#D5DCD9] relative flex items-center justify-center">
                {inspectItem.photoId && wardrobePhotos[inspectItem.photoId] ? (
                  <img loading="lazy" decoding="async"
                    src={wardrobePhotos[inspectItem.photoId]}
                    alt={inspectItem.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-8 text-center space-y-3">
                    <span
                      className="w-16 h-16 mx-auto border border-[#0A0A0A]/25 flex items-center justify-center"
                      style={{ backgroundColor: inspectItem.colorHex }}
                    >
                      <Shirt className="w-7 h-7 text-[#FBFAF8]" />
                    </span>
                    <p className="font-mono text-xs">{inspectItem.colorName}</p>
                  </div>
                )}
              </div>

              <div className="sm:col-span-7 p-6 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] text-[#0A0A0A]/60">
                        {inspectItem.category.toUpperCase()} · {inspectItem.warmth}
                      </p>
                      <h3 className="font-editorial text-3xl mt-0.5">{inspectItem.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectItem(null)}
                      aria-label="Close inspection panel"
                      className="w-9 h-9 border border-[#0A0A0A]/20 flex items-center justify-center hover:bg-[#0B3B40] hover:text-[#FBFAF8]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#0A0A0A]/10 py-3 font-mono">
                    <div>
                      <span className="text-[#0A0A0A]/55 block text-[10px]">COLOR / PATTERN</span>
                      <span className="font-bold">{inspectItem.colorName} · {inspectItem.pattern || 'Solid'}</span>
                    </div>
                    <div>
                      <span className="text-[#0A0A0A]/55 block text-[10px]">STYLE / FABRIC</span>
                      <span className="font-bold">{inspectItem.style || 'Tailored'} · {inspectItem.fabric || 'Cotton'}</span>
                    </div>
                    <div>
                      <span className="text-[#0A0A0A]/55 block text-[10px]">SUITCASE FOOTPRINT</span>
                      <span className="font-bold">{inspectItem.weightGrams}g · {inspectItem.volumeLiters}L</span>
                    </div>
                    <div>
                      <span className="text-[#0A0A0A]/55 block text-[10px]">OCCASIONS</span>
                      <span className="font-bold">{(inspectItem.activities || ['Travel']).slice(0, 2).join(', ')}</span>
                    </div>
                  </div>

                  {inspectItem.notes && (
                    <p className="text-xs text-[#0A0A0A]/75 leading-relaxed">
                      {inspectItem.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteWardrobeItem(inspectItem.id);
                      setInspectItem(null);
                    }}
                    className="min-h-[42px] px-3.5 border border-[#0A0A0A]/25 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#E6DFD2]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspectItem(null);
                      onOpenOutfitStudio();
                    }}
                    className="min-h-[42px] px-5 bg-[#0B3B40] text-[#FBFAF8] text-xs font-bold inline-flex items-center gap-2 hover:bg-[#0A0A0A]/85"
                  >
                    <span>Style This Piece</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#E6DFD2]" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
