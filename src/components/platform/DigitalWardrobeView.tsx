import React, { useMemo, useRef, useState } from 'react';
import {
  Loader2,
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

interface DigitalWardrobeViewProps {
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  isOnline: boolean;
  onAddWardrobeItem: (item: WardrobeItem) => void;
  onSaveWardrobePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  onDeleteWardrobeItem: (itemId: string) => void;
  onNavigate: (route: PlatformRoute) => void;
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
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState<WardrobeCategory>('Tops');
  const [manualColor, setManualColor] = useState('Warm Ivory');
  const [manualHex, setManualHex] = useState('#D9C9F2');
  const [manualWarmth, setManualWarmth] =
    useState<WardrobeItem['warmth']>('All-Season');

  const [uploadingCount, setUploadingCount] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const filteredWardrobe = useMemo(() => {
    return wardrobe.filter((item) => {
      const catOk = categoryFilter === 'All' || item.category === categoryFilter;
      const warmthOk = warmthFilter === 'All' || item.warmth === warmthFilter;
      return catOk && warmthOk;
    });
  }, [wardrobe, categoryFilter, warmthFilter]);

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
          colorHex: det.colorHex || '#171717',
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
    <div className="bg-[#FFFFFF] min-h-[calc(100vh-4rem)] py-8 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* ==================== HEADER ==================== */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#171717]/60">Digital Wardrobe</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#171717]">
              Owned Clothing Archive
            </h1>
            <p className="text-sm text-[#171717]/70">
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
              className="h-10 px-4 rounded-lg bg-[#171717] text-[#FFFFFF] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#171717]/88 transition-colors disabled:opacity-50"
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
              className="h-10 px-4 rounded-lg bg-[#FFFFFF] border border-[#171717]/20 text-sm font-medium text-[#171717] inline-flex items-center gap-1.5 hover:border-[#171717] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Manually</span>
            </button>
          </div>
        </div>

        {notice && (
          <div className="rounded-lg bg-[#B8D9F2]/40 border border-[#171717]/12 px-4 py-3 text-sm font-medium text-[#171717]">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-[#FFC5A8]/50 border border-[#171717]/15 px-4 py-3 text-sm font-medium text-[#171717]">
            {error}
          </div>
        )}

        {/* ==================== MANUAL ENTRY FORM ==================== */}
        {showManualForm && (
          <form
            onSubmit={handleAddManual}
            className="rounded-xl bg-[#FFFFFF] border border-[#171717]/15 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <label className="space-y-1 text-xs font-medium text-[#171717]/75 lg:col-span-2">
              <span>Garment Name *</span>
              <input
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g., Ivory Linen Shirt"
                className="w-full h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717]"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-[#171717]/75">
              <span>Category</span>
              <select
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value as WardrobeCategory)}
                className="w-full h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717]"
              >
                {WARDROBE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-[#171717]/75">
              <span>Warmth</span>
              <select
                value={manualWarmth}
                onChange={(e) => setManualWarmth(e.target.value as WardrobeItem['warmth'])}
                className="w-full h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717]"
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
                className="h-10 w-10 rounded-lg border border-[#171717]/15 bg-[#FFFFFF] p-1 shrink-0"
              />
              <button
                type="submit"
                className="flex-1 h-10 rounded-lg bg-[#171717] text-[#FFFFFF] text-xs font-medium hover:bg-[#171717]/88"
              >
                Save Piece
              </button>
            </div>
          </form>
        )}

        {/* ==================== FILTER BAR ==================== */}
        <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                      ? 'bg-[#171717] text-[#FFFFFF]'
                      : 'bg-[#FFFFFF] text-[#171717]/70 hover:text-[#171717]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <select
            aria-label="Filter by season warmth"
            value={warmthFilter}
            onChange={(e) => setWarmthFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717]"
          >
            <option value="All">All Climates</option>
            <option value="Warm Weather">Warm Weather</option>
            <option value="All-Season">All-Season</option>
            <option value="Cool & Cold">Cool &amp; Cold</option>
          </select>
        </div>

        {/* ==================== UNIFORM SHOWROOM GRID (ZERO OVERLAID TEXT) ==================== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredWardrobe.map((item) => {
            const photo = item.photoId ? wardrobePhotos[item.photoId] : undefined;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="text-left rounded-xl bg-[#FFFFFF] border border-[#171717]/10 overflow-hidden hover:border-[#171717]/40 transition-colors flex flex-col"
              >
                <div className="aspect-square w-full bg-[#FFFFFF] flex items-center justify-center overflow-hidden">
                  {photo ? (
                    <img
                      src={photo}
                      alt={item.name}
                      className="w-full h-full object-cover block"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="w-12 h-12 rounded-xl border border-[#171717]/15 flex items-center justify-center"
                      style={{ backgroundColor: item.colorHex }}
                    >
                      <Shirt className="w-6 h-6 text-[#FFFFFF]" />
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-[#171717] truncate">{item.name}</p>
                    <p className="text-xs text-[#171717]/60 truncate">
                      {item.category} · {item.colorName}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#171717]/8 flex items-center justify-between text-[11px] text-[#171717]/60 tabular-nums">
                    <span>{item.warmth}</span>
                    <span>{item.volumeLiters}L</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ==================== GARMENT INSPECTOR MODAL ==================== */}
        {selectedItem && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selectedItem.name}
            className="fixed inset-0 z-50 bg-[#171717]/45 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] border border-[#171717]/15 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#171717]/10">
                <div>
                  <p className="text-xs font-medium text-[#171717]/60">{selectedItem.category}</p>
                  <h3 className="font-serif text-2xl font-medium text-[#171717]">
                    {selectedItem.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close modal"
                  className="w-9 h-9 rounded-lg bg-[#FFFFFF] flex items-center justify-center text-[#171717] hover:bg-[#171717] hover:text-[#FFFFFF] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
                  <div className="aspect-square rounded-xl bg-[#FFFFFF] border border-[#171717]/10 overflow-hidden flex items-center justify-center">
                    {selectedItem.photoId && wardrobePhotos[selectedItem.photoId] ? (
                      <img
                        src={wardrobePhotos[selectedItem.photoId]}
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="w-16 h-16 rounded-xl border border-[#171717]/15 flex items-center justify-center"
                        style={{ backgroundColor: selectedItem.colorHex }}
                      >
                        <Shirt className="w-8 h-8 text-[#FFFFFF]" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-[#171717]/55">Color &amp; Pattern</p>
                      <p className="text-sm font-medium text-[#171717] mt-0.5">
                        {selectedItem.colorName}
                        {selectedItem.pattern ? ` · ${selectedItem.pattern}` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#171717]/55">Climate Suitability</p>
                      <p className="text-sm font-medium text-[#171717] mt-0.5">
                        {selectedItem.warmth}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#171717]/55">Suitcase Footprint</p>
                      <p className="text-sm font-medium text-[#171717] mt-0.5 tabular-nums">
                        {selectedItem.volumeLiters}L · {selectedItem.weightGrams}g
                      </p>
                    </div>
                    {selectedItem.notes && (
                      <div>
                        <p className="text-[#171717]/55">Styling Note</p>
                        <p className="text-xs text-[#171717]/80 mt-0.5 leading-relaxed">
                          {selectedItem.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#171717]/10 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteWardrobeItem(selectedItem.id);
                      setSelectedItem(null);
                    }}
                    className="h-10 px-4 rounded-lg bg-[#FFC5A8]/45 text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 hover:bg-[#FFC5A8] transition-colors"
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
                    className="h-10 px-5 rounded-lg bg-[#171717] text-[#FFFFFF] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#171717]/88 transition-colors"
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
