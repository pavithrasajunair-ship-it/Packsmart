import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Footprints,
  Glasses,
  Layers,
  Loader2,
  Wind,
  Plus,
  Shirt,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { WardrobeCategory, WardrobeItem } from '../../types';
import { WARDROBE_CATEGORIES } from '../../types';
import { compressImageFileToJpegDataUrl, uid } from '../../utils/storage';
import type { PlatformRoute } from './HomePage';
import { PageHero, SwatchCloud } from './PageHero';

interface DigitalWardrobeViewProps {
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  isOnline: boolean;
  onAddWardrobeItem: (item: WardrobeItem) => void;
  onSaveWardrobePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  onDeleteWardrobeItem: (itemId: string) => void;
  onNavigate: (route: PlatformRoute) => void;
}

/** Pick black or white for an icon so it reads on any garment colour. */
function inkFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#0A0A0A';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#0A0A0A' : '#FBFAF8';
}

function iconFor(category: string): React.ComponentType<{ className?: string }> {
  switch (category) {
    case 'Bottoms':
      return Layers;
    case 'Dresses':
      return Sparkles;
    case 'Footwear':
      return Footprints;
    case 'Outerwear':
      return Wind;
    case 'Accessories':
      return Glasses;
    default:
      return Shirt;
  }
}

export const DigitalWardrobeView: React.FC<DigitalWardrobeViewProps> = ({
  wardrobe,
  wardrobePhotos,
  isOnline,
  onAddWardrobeItem,
  onSaveWardrobePhoto,
  onDeleteWardrobeItem,
  onNavigate,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<'All' | WardrobeCategory>('All');
  const [warmthFilter, setWarmthFilter] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState<WardrobeCategory>('Tops');
  const [manualColor, setManualColor] = useState('Warm Ivory');
  const [manualHex, setManualHex] = useState('#D5DCD9');
  const [manualWarmth, setManualWarmth] =
    useState<WardrobeItem['warmth']>('All-Season');

  const [uploadingCount, setUploadingCount] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const filteredWardrobe = useMemo(() => {
    return wardrobe.filter((item) => {
      const catOk = categoryFilter === 'All' || item.category === categoryFilter;
      const warmthOk = warmthFilter === 'All' || item.warmth === warmthFilter;
      const q = query.trim().toLowerCase();
      const textOk =
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        item.colorName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return catOk && warmthOk && textOk;
    });
  }, [wardrobe, categoryFilter, warmthFilter, query]);

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isOnline) {
      setError('Connect to the internet for AI vision garment scanning.');
      return;
    }

    const batch = Array.from(files).slice(0, 8);
    setUploadingCount(batch.length);
    setError('');
    setNotice('');
    let count = 0;

    for (const file of batch) {
      try {
        const compressed = await compressImageFileToJpegDataUrl(file, 900);
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
        if (!res.ok) {
          setError(data.error || `Could not analyze ${file.name}.`);
          continue;
        }
        const det = data.detected;
        const photoId = uid('photo');
        await onSaveWardrobePhoto(photoId, compressed.dataUrl);
        onAddWardrobeItem({
          id: uid('ward'),
          name: det.name || 'Detected Garment',
          category: det.category as WardrobeCategory,
          colorName: det.colorName || 'Neutral',
          colorHex: det.colorHex || '#0A0A0A',
          secondaryColors: det.secondaryColors || [],
          pattern: det.pattern || 'Solid',
          style: det.style || 'Minimalist',
          fabric: det.fabric || 'Cotton Blend',
          warmth: det.warmth || 'All-Season',
          activities: Array.isArray(det.occasions) ? det.occasions : ['Everyday'],
          weightGrams: det.estimatedWeightGrams || 230,
          volumeLiters: det.estimatedVolumeLiters || 1.0,
          reusableDays: 2,
          notes: det.stylingNote || '',
          photoId,
          aiDetected: true,
        });
        count += 1;
      } catch {
        setError(`Could not upload ${file.name}.`);
      }
    }

    setUploadingCount(0);
    if (count > 0) {
      setNotice(`Added ${count} photo-scanned ${count === 1 ? 'item' : 'items'} to your wardrobe.`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;
    onAddWardrobeItem({
      id: uid('ward'),
      name: manualName.trim(),
      category: manualCategory,
      colorName: manualColor.trim() || 'Neutral',
      colorHex: manualHex,
      pattern: 'Solid',
      style: 'Smart Casual',
      warmth: manualWarmth,
      activities: ['Everyday', 'Travel'],
      weightGrams: manualCategory === 'Footwear' ? 620 : manualCategory === 'Outerwear' ? 480 : 220,
      volumeLiters: manualCategory === 'Footwear' ? 3.8 : manualCategory === 'Outerwear' ? 2.2 : 1.0,
      reusableDays: 2,
    });
    setManualName('');
    setShowManualForm(false);
    setNotice('Added garment to your digital wardrobe.');
  };

  return (
    <div className="ps-work relative min-h-[calc(100vh-4rem)] py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <PageHero
          surface="#0B3B40"
          tagline="Your whole closet, tagged, filtered and ready to pack."
          stats={[
            { label: 'Pieces', value: wardrobe.length },
            { label: 'Categories', value: new Set(wardrobe.map((w) => w.category)).size },
            { label: 'Photo scans', value: wardrobe.filter((w) => w.photoId).length },
          ]}
        >
          <SwatchCloud colours={wardrobe.map((w) => w.colorHex)} />
        </PageHero>

        {/* ==================== HEADER ==================== */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="inline-flex h-7 items-center rounded-full bg-[#FBFAF8]/85 px-3.5 text-xs font-semibold text-[#0A0A0A]">Digital Wardrobe</p>
            <h1 className="text-4xl sm:text-6xl font-bold leading-[1.02] tracking-[-0.045em] text-[#0A0A0A]">
              Owned Clothing Archive
            </h1>
            <p className="text-sm text-[#0A0A0A]/70">
              {wardrobe.length} garments cataloged · {wardrobe.filter((w) => w.photoId).length} with uploaded photos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleUploadPhotos(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCount > 0}
              className="h-10 px-4 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#0A0A0A]/88 transition-colors disabled:opacity-50"
            >
              {uploadingCount > 0 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>
                {uploadingCount > 0 ? `Scanning ${uploadingCount}...` : 'Scan Photos with AI'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowManualForm((v) => !v)}
              className="h-10 px-4 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/20 text-sm font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 hover:border-[#0A0A0A] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Manually</span>
            </button>
          </div>
        </div>

        {notice && (
          <div className="rounded-lg bg-[#BCD2CF]/40 border border-[#0A0A0A]/12 px-4 py-3 text-sm font-medium text-[#0A0A0A]">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-[#E6DFD2]/50 border border-[#0A0A0A]/15 px-4 py-3 text-sm font-medium text-[#0A0A0A]">
            {error}
          </div>
        )}

        {/* ==================== MANUAL ENTRY FORM ==================== */}
        {showManualForm && (
          <form
            onSubmit={handleAddManual}
            className="rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/15 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <label className="space-y-1 text-xs font-medium text-[#0A0A0A]/75 lg:col-span-2">
              <span>Garment Name *</span>
              <input
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g., Ivory Linen Shirt"
                className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[#0A0A0A]/75">
              <span>Category</span>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value as WardrobeCategory)}
                className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
              >
                {WARDROBE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-[#0A0A0A]/75">
              <span>Warmth</span>
              <select
                value={manualWarmth}
                onChange={(e) => setManualWarmth(e.target.value as WardrobeItem['warmth'])}
                className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
              >
                <option value="Warm Weather">Warm Weather</option>
                <option value="All-Season">All-Season</option>
                <option value="Cool & Cold">Cool &amp; Cold</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Color swatch"
                value={manualHex}
                onChange={(e) => setManualHex(e.target.value)}
                className="h-10 w-10 rounded-lg border border-[#0A0A0A]/15 bg-[#FBFAF8] p-1 shrink-0"
              />
              <button
                type="submit"
                className="flex-1 h-10 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-xs font-medium hover:bg-[#0A0A0A]/88"
              >
                Save Piece
              </button>
            </div>
          </form>
        )}

        {/* ==================== FILTER BAR ==================== */}
        <div className="rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/10 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(['All', ...WARDROBE_CATEGORIES] as Array<'All' | WardrobeCategory>).map((cat) => {
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#0B3B40] text-[#FBFAF8]'
                      : 'bg-[#FBFAF8] text-[#0A0A0A]/70 hover:text-[#0A0A0A]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <input
            type="search"
            aria-label="Search wardrobe by name, colour or category"
            placeholder="Search name or colour"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full sm:w-56 px-4 rounded-full bg-[#FBFAF8] border border-[#0A0A0A]/15 text-xs font-medium text-[#0A0A0A] placeholder:text-[#0A0A0A]/50"
          />

          <select
            aria-label="Filter by season warmth"
            value={warmthFilter}
            onChange={(e) => setWarmthFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-xs font-medium text-[#0A0A0A]"
          >
            <option value="All">All Climates</option>
            <option value="Warm Weather">Warm Weather</option>
            <option value="All-Season">All-Season</option>
            <option value="Cool & Cold">Cool &amp; Cold</option>
          </select>
        </div>

        {/* ==================== UNIFORM SHOWROOM GRID (ZERO OVERLAID TEXT) ==================== */}
        {filteredWardrobe.length === 0 && (
          <div role="status" className="rounded-3xl bg-[#FBFAF8]/80 p-10 text-center space-y-3">
            <p className="text-xl font-bold tracking-[-0.03em]">
              {wardrobe.length === 0 ? 'Your wardrobe is empty' : 'No pieces match these filters'}
            </p>
            <p className="text-sm text-[#0A0A0A]/75">
              {wardrobe.length === 0
                ? 'Upload photos of clothes you own or add a piece by hand to start building outfits.'
                : 'Try a different category, climate or search word.'}
            </p>
            {wardrobe.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('All');
                  setWarmthFilter('All');
                  setQuery('');
                }}
                className="h-10 px-5 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-sm font-semibold"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredWardrobe.map((item) => {
            const photo = item.photoId ? wardrobePhotos[item.photoId] : undefined;
            const Icon = iconFor(item.category);
            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                whileHover={{ y: -8, rotate: -0.6 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="text-left rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/10 overflow-hidden flex flex-col"
              >
                <div
                  className="relative aspect-square w-full flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: photo ? '#FBFAF8' : item.colorHex }}
                >
                  {photo ? (
                    <img decoding="async"
                      src={photo}
                      alt={item.name}
                      className="w-full h-full object-cover block"
                      loading="lazy"
                    />
                  ) : (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full"
                        style={{ backgroundColor: inkFor(item.colorHex), opacity: 0.08 }}
                      />
                      <span className="relative" style={{ color: inkFor(item.colorHex) }}>
                        <Icon className="w-20 h-20 sm:w-24 sm:h-24" />
                      </span>
                      <span className="absolute left-3 bottom-3 rounded-full bg-[#FBFAF8]/90 px-3 py-1 text-xs font-semibold text-[#0A0A0A]">
                        {item.colorName}
                      </span>
                    </>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-[#0A0A0A] truncate">{item.name}</p>
                    <p className="text-xs text-[#0A0A0A]/75 truncate">
                      {item.category} · {item.colorName}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#0A0A0A]/8 flex items-center justify-between text-[11px] text-[#0A0A0A]/75 tabular-nums">
                    <span>{item.warmth}</span>
                    <span>{item.volumeLiters}L</span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ==================== GARMENT INSPECTOR MODAL ==================== */}
        {selectedItem && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selectedItem.name}
            className="fixed inset-0 z-50 bg-[#0A0A0A]/45 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-[#FBFAF8] border border-[#0A0A0A]/15 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#0A0A0A]/10">
                <div>
                  <p className="text-xs font-medium text-[#0A0A0A]/75">{selectedItem.category}</p>
                  <h3 className="font-serif text-2xl font-medium text-[#0A0A0A]">
                    {selectedItem.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close modal"
                  className="w-9 h-9 rounded-lg bg-[#FBFAF8] flex items-center justify-center text-[#0A0A0A] hover:bg-[#0B3B40] hover:text-[#FBFAF8] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
                  <div className="aspect-square rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/10 overflow-hidden flex items-center justify-center">
                    {selectedItem.photoId && wardrobePhotos[selectedItem.photoId] ? (
                      <img loading="lazy" decoding="async"
                        src={wardrobePhotos[selectedItem.photoId]}
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="w-16 h-16 rounded-3xl border border-[#0A0A0A]/15 flex items-center justify-center"
                        style={{ backgroundColor: selectedItem.colorHex }}
                      >
                        <Shirt className="w-8 h-8 text-[#FBFAF8]" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-[#0A0A0A]/75">Color &amp; Pattern</p>
                      <p className="text-sm font-medium text-[#0A0A0A] mt-0.5">
                        {selectedItem.colorName}
                        {selectedItem.pattern ? ` · ${selectedItem.pattern}` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#0A0A0A]/75">Climate Suitability</p>
                      <p className="text-sm font-medium text-[#0A0A0A] mt-0.5">
                        {selectedItem.warmth}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#0A0A0A]/75">Suitcase Footprint</p>
                      <p className="text-sm font-medium text-[#0A0A0A] mt-0.5 tabular-nums">
                        {selectedItem.volumeLiters}L · {selectedItem.weightGrams}g
                      </p>
                    </div>
                    {selectedItem.notes && (
                      <div>
                        <p className="text-[#0A0A0A]/75">Styling Note</p>
                        <p className="text-xs text-[#0A0A0A]/80 mt-0.5 leading-relaxed">
                          {selectedItem.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#0A0A0A]/10 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteWardrobeItem(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    className="h-10 px-4 rounded-lg bg-[#E6DFD2]/45 text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 hover:bg-[#E6DFD2] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Item</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(null);
                      onNavigate('ai-outfit-studio');
                    }}
                    className="h-10 px-5 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#0A0A0A]/88 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Style in AI Outfit Studio</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
