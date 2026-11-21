import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Heart,
  Layers,
  Plus,
  RefreshCw,
  Shirt,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AIMissingPieceSuggestion,
  DayOutfitPlan,
  OutfitCombination,
  PackingItem,
  PackingList,
  WardrobeCategory,
  WardrobeItem,
  WeatherReport,
} from '../types';
import { WARDROBE_CATEGORIES } from '../types';
import { calculateTripDays, generateCapsuleOutfitPlan } from '../utils/packingEngine';
import { ASSETS } from '../data/templates';
import { SafeImage } from '../components/ui/SafeImage';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AIOutfitMatcher } from '../components/AIOutfitMatcher';
import { uid } from '../utils/storage';

interface WardrobeScreenProps {
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  savedOutfits: OutfitCombination[];
  trips: PackingList[];
  isOnline: boolean;
  aiConfigured: boolean;
  onAddWardrobeItem: (item: WardrobeItem) => void;
  onSaveWardrobePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  onDeleteWardrobeItem: (itemId: string) => void;
  onSaveOutfit: (outfit: OutfitCombination) => void;
  onToggleFavoriteOutfit: (outfitId: string) => void;
  onDeleteOutfit: (outfitId: string) => void;
  onUpdateTripDayOutfits: (tripId: string, dayOutfits: DayOutfitPlan[]) => void;
  onSyncWardrobeToTrip: (tripId: string, items: PackingItem[]) => number;
  onAddMissingPieceToShopping: (tripId: string, suggestion: AIMissingPieceSuggestion) => boolean;
  onSaveWeather?: (tripId: string, weather: WeatherReport) => void;
}

const SWATCH_PRESETS = [
  { name: 'Midnight Navy', hex: '#182247' },
  { name: 'Soft Lavender', hex: '#B8ADFA' },
  { name: 'Muted Teal', hex: '#0F968C' },
  { name: 'Warm White', hex: '#F2EFE8' },
  { name: 'Warm Sand', hex: '#D8CDB8' },
  { name: 'Charcoal', hex: '#2E3448' },
  { name: 'Terracotta', hex: '#B86B52' },
  { name: 'Olive', hex: '#5D6B4B' },
];

export const WardrobeScreen: React.FC<WardrobeScreenProps> = ({
  wardrobe,
  wardrobePhotos,
  savedOutfits,
  trips,
  isOnline,
  aiConfigured,
  onAddWardrobeItem,
  onSaveWardrobePhoto,
  onDeleteWardrobeItem,
  onSaveOutfit,
  onToggleFavoriteOutfit,
  onDeleteOutfit,
  onUpdateTripDayOutfits,
  onSyncWardrobeToTrip,
  onAddMissingPieceToShopping,
  onSaveWeather,
}) => {
  const [section, setSection] = useState<'matcher' | 'planner' | 'wardrobe' | 'favorites'>('matcher');
  const [catFilter, setCatFilter] = useState<'All' | WardrobeCategory>('All');
  const [selectedTripId, setSelectedTripId] = useState<string>(
    trips.find((t) => !t.completed)?.id || trips[0]?.id || ''
  );

  // Visual Outfit Builder state
  const [builderSelectedIds, setBuilderSelectedIds] = useState<string[]>([
    wardrobe[0]?.id,
    wardrobe[4]?.id,
    wardrobe[9]?.id,
  ].filter(Boolean));
  const [comboName, setComboName] = useState('');
  const [comboOccasion, setComboOccasion] = useState('Daytime Exploring');
  const [syncMessage, setSyncMessage] = useState('');

  // Add Wardrobe Item Modal
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<WardrobeCategory>('Tops');
  const [newColor, setNewColor] = useState(SWATCH_PRESETS[0]);
  const [newWarmth, setNewWarmth] = useState<WardrobeItem['warmth']>('All-Season');
  const [newWeight, setNewWeight] = useState(200);
  const [newVol, setNewVol] = useState(1.0);
  const [formErr, setFormErr] = useState('');

  // Confirm delete wardrobe item
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeTrip = useMemo(
    () => trips.find((t) => t.id === selectedTripId) || null,
    [trips, selectedTripId]
  );

  const tripDays = useMemo(
    () => (activeTrip ? calculateTripDays(activeTrip.startDate, activeTrip.endDate) : 4),
    [activeTrip]
  );

  const smartPlan = useMemo(
    () =>
      generateCapsuleOutfitPlan(
        wardrobe,
        activeTrip?.startDate || new Date().toISOString().slice(0, 10),
        tripDays,
        activeTrip?.weather,
        activeTrip?.activities || ['Sightseeing', 'Dining']
      ),
    [wardrobe, activeTrip, tripDays]
  );

  const currentDayPlans: DayOutfitPlan[] = useMemo(() => {
    if (activeTrip && activeTrip.dayOutfits && activeTrip.dayOutfits.length > 0) {
      return activeTrip.dayOutfits;
    }
    return smartPlan.dayPlans;
  }, [activeTrip, smartPlan]);

  // Compute reuse metrics from currently planned days
  const reuseSummary = useMemo(() => {
    const counts = new Map<string, number>();
    currentDayPlans.forEach((d) =>
      d.itemIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1))
    );
    const uniqueCount = counts.size;
    let litersSaved = 0;
    let gramsSaved = 0;
    let reusedItems = 0;
    counts.forEach((count, id) => {
      if (count > 1) {
        reusedItems += 1;
        const piece = wardrobe.find((w) => w.id === id);
        if (piece) {
          litersSaved += piece.volumeLiters * (count - 1);
          gramsSaved += piece.weightGrams * (count - 1);
        }
      }
    });
    return {
      uniqueCount,
      reusedItems,
      litersSaved: Number(litersSaved.toFixed(1)),
      kgSaved: Number((gramsSaved / 1000).toFixed(2)),
    };
  }, [currentDayPlans, wardrobe]);

  const filteredWardrobe = useMemo(
    () => (catFilter === 'All' ? wardrobe : wardrobe.filter((w) => w.category === catFilter)),
    [wardrobe, catFilter]
  );

  const handleToggleBuilderItem = (item: WardrobeItem) => {
    setBuilderSelectedIds((prev) => {
      if (prev.includes(item.id)) return prev.filter((id) => id !== item.id);
      // Replace existing item in same single-slot category (Tops/Bottoms/Dresses/Footwear)
      const singleSlots: WardrobeCategory[] = ['Tops', 'Bottoms', 'Dresses', 'Footwear'];
      const cleaned = singleSlots.includes(item.category)
        ? prev.filter((id) => wardrobe.find((w) => w.id === id)?.category !== item.category)
        : prev;
      return [...cleaned, item.id];
    });
  };

  const handleSaveBuiltOutfit = (e: React.FormEvent) => {
    e.preventDefault();
    if (builderSelectedIds.length === 0) return;
    const pieces = builderSelectedIds
      .map((id) => wardrobe.find((w) => w.id === id))
      .filter((x): x is WardrobeItem => Boolean(x));

    const outfit: OutfitCombination = {
      id: uid('outfit'),
      name: comboName.trim() || pieces.slice(0, 2).map((p) => p.name.split(' ')[0]).join(' + ') + ' Look',
      itemIds: builderSelectedIds,
      occasion: comboOccasion,
      weatherFit: pieces.some((p) => p.warmth === 'Cool & Cold')
        ? 'Cool & Layered'
        : pieces.some((p) => p.warmth === 'Warm Weather')
        ? 'Warm & Breathable'
        : 'All-Season',
      isFavorite: true,
      createdAt: new Date().toISOString(),
    };
    onSaveOutfit(outfit);
    setComboName('');
    setSyncMessage(`Saved "${outfit.name}" to your Favourite Outfits.`);
    window.setTimeout(() => setSyncMessage(''), 3000);
  };

  const handleApplySmartCapsule = () => {
    if (!activeTrip) return;
    onUpdateTripDayOutfits(activeTrip.id, smartPlan.dayPlans);
    setSyncMessage(
      `Generated ${smartPlan.dayPlans.length}-day capsule plan reusing ${smartPlan.reusedPiecesCount} pieces (saving ${smartPlan.litersSaved}L).`
    );
    window.setTimeout(() => setSyncMessage(''), 4000);
  };

  const handleAssignComboToDay = (dayIndex: number, outfit: OutfitCombination) => {
    if (!activeTrip) return;
    const base = [...currentDayPlans];
    const next = base.map((d) =>
      d.dayIndex === dayIndex
        ? { ...d, outfitName: outfit.name, itemIds: outfit.itemIds, activity: outfit.occasion }
        : d
    );
    onUpdateTripDayOutfits(activeTrip.id, next);
  };

  const handleSyncToSuitcase = () => {
    if (!activeTrip) return;
    const uniqueIds = Array.from(new Set(currentDayPlans.flatMap((d) => d.itemIds)));
    const itemsToSync: PackingItem[] = uniqueIds
      .map((id, idx) => {
        const w = wardrobe.find((item) => item.id === id);
        if (!w) return null;
        return {
          id: uid('ward-item'),
          name: w.name,
          category: w.category === 'Footwear' ? 'Footwear' : w.category === 'Accessories' ? 'Accessories' : 'Clothing',
          quantity: 1,
          packed: false,
          weightGrams: w.weightGrams,
          volumeLiters: w.volumeLiters,
          priority: 'Essential' as const,
          essential: true,
          notes: `Synced from ${activeTrip.title} Capsule Outfit Plan`,
          order: 100 + idx,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const addedCount = onSyncWardrobeToTrip(activeTrip.id, itemsToSync);
    setSyncMessage(
      addedCount > 0
        ? `Added ${addedCount} unique capsule piece${addedCount === 1 ? '' : 's'} to ${activeTrip.title} suitcase.`
        : `All planned capsule pieces are already in ${activeTrip.title}.`
    );
    window.setTimeout(() => setSyncMessage(''), 4000);
  };

  const handleAddWardrobe = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (!newName.trim()) {
      setFormErr('Please enter a clothing item name.');
      return;
    }
    onAddWardrobeItem({
      id: uid('w'),
      name: newName.trim(),
      category: newCat,
      colorName: newColor.name,
      colorHex: newColor.hex,
      warmth: newWarmth,
      activities: ['Sightseeing', 'Casual'],
      weightGrams: Math.max(30, newWeight),
      volumeLiters: Math.max(0.2, newVol),
      reusableDays: newCat === 'Footwear' || newCat === 'Outerwear' ? 6 : 2,
    });
    setNewName('');
    setAddOpen(false);
  };

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[#111834] dark:text-white tracking-tight">
            Wardrobe & Outfit Planner
          </h1>
          <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5 tabular-nums">
            {wardrobe.length} digital wardrobe items · {savedOutfits.filter((o) => o.isFavorite).length} favourite looks
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormErr('');
            setAddOpen(true);
          }}
          className="min-h-[44px] px-4 rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Piece</span>
        </button>
      </div>

      {/* Sub-navigation tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-[#EDEAE3] dark:bg-[#12182F] rounded-2xl max-w-2xl">
        {[
          { id: 'matcher', label: 'AI Outfit Matcher' },
          { id: 'planner', label: 'Trip Outfits' },
          { id: 'wardrobe', label: `Closet (${wardrobe.length})` },
          { id: 'favorites', label: `Saved (${savedOutfits.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSection(t.id as typeof section)}
            className={`min-h-[42px] px-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              section === t.id
                ? 'bg-white dark:bg-[#1D264A] text-[#111834] dark:text-white shadow-xs'
                : 'text-[#646B84] dark:text-[#9AA3C2]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Capsule Banner (shown on Trip Outfits / Closet / Saved tabs) */}
      {section !== 'matcher' && (
        <div className="rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] overflow-hidden grid grid-cols-1 md:grid-cols-12 items-center">
          <div className="md:col-span-7 p-5 space-y-2.5">
            <p className="text-xs font-semibold text-[#0F968C] dark:text-[#2AB5A8] flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>Capsule Reuse Optimizer</span>
            </p>
            <h2 className="font-display text-lg font-bold text-[#111834] dark:text-white">
              Pack fewer clothes. Mix smarter outfits.
            </h2>
            <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] leading-relaxed">
              Reusing <span className="font-mono font-bold text-[#111834] dark:text-white">{reuseSummary.reusedItems}</span> core pieces across {currentDayPlans.length} trip days saves an estimated{' '}
              <span className="font-mono font-bold text-[#0F968C] dark:text-[#2AB5A8]">{reuseSummary.litersSaved}L</span> and{' '}
              <span className="font-mono font-bold text-[#0F968C] dark:text-[#2AB5A8]">{reuseSummary.kgSaved} kg</span> in your suitcase.
            </p>
          </div>
          <div className="md:col-span-5 h-36 md:h-full">
            <SafeImage
              src={ASSETS.wardrobe}
              alt="Curated travel capsule wardrobe flat-lay"
              className="w-full h-full object-cover"
              fallbackLabel="Capsule Wardrobe"
            />
          </div>
        </div>
      )}

      {section === 'matcher' && (
        <AIOutfitMatcher
          wardrobe={wardrobe}
          wardrobePhotos={wardrobePhotos}
          savedOutfits={savedOutfits}
          trips={trips}
          isOnline={isOnline}
          aiConfigured={aiConfigured}
          onAddWardrobeItem={onAddWardrobeItem}
          onSaveWardrobePhoto={onSaveWardrobePhoto}
          onDeleteWardrobeItem={(itemId) => setDeleteConfirmId(itemId)}
          onSaveOutfit={onSaveOutfit}
          onToggleFavoriteOutfit={onToggleFavoriteOutfit}
          onUpdateTripDayOutfits={onUpdateTripDayOutfits}
          onSyncWardrobeToTrip={onSyncWardrobeToTrip}
          onAddMissingPieceToShopping={onAddMissingPieceToShopping}
          onSaveWeather={onSaveWeather}
        />
      )}

      {syncMessage && (
        <div className="p-3.5 rounded-2xl bg-[#EEF9F7] dark:bg-[#102928] text-[#0C7A72] dark:text-[#2AB5A8] text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* ==================== SECTION 1: TRIP DAY-BY-DAY OUTFIT PLANNER ==================== */}
      {section === 'planner' && (
        <div className="space-y-5">
          {/* Trip selector & Auto-Capsule CTA */}
          <div className="bg-white dark:bg-[#131A33] rounded-3xl p-4 sm:p-5 border border-[#E6E2DA] dark:border-[#242E52] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <label htmlFor="outfit-trip-sel" className="block text-[11px] font-semibold text-[#646B84] dark:text-[#9AA3C2] mb-1">
                Planning Outfits For
              </label>
              <select
                id="outfit-trip-sel"
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm font-semibold text-[#111834] dark:text-white"
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.destination || t.tripType} ({calculateTripDays(t.startDate, t.endDate)} days)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplySmartCapsule}
                className="min-h-[42px] px-4 rounded-xl bg-[#F4F2FF] dark:bg-[#1B2344] text-[#5645D2] dark:text-[#BDB2FF] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Smart Capsule Plan</span>
              </button>
              <button
                type="button"
                onClick={handleSyncToSuitcase}
                className="min-h-[42px] px-4 rounded-xl bg-[#0F968C] text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sync to Suitcase</span>
              </button>
            </div>
          </div>

          {/* Day-by-Day Visual Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentDayPlans.map((day) => {
              const pieces = day.itemIds
                .map((id) => wardrobe.find((w) => w.id === id))
                .filter((x): x is WardrobeItem => Boolean(x));

              return (
                <div
                  key={`${day.dayIndex}-${day.date}`}
                  className="rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] p-4 flex flex-col justify-between gap-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#5645D2] dark:text-[#A799FF] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{day.label} · {day.date}</span>
                      </p>
                      <span className="text-[11px] text-[#646B84] dark:text-[#9AA3C2] truncate">
                        {day.activity || 'Leisure'}
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#111834] dark:text-white mt-1">
                      {day.outfitName}
                    </h3>

                    {/* Visual Swatch / Uploaded Photo Stack */}
                    <div className="mt-3 space-y-2">
                      {pieces.map((piece) => {
                        const photoUrl = piece.photoId ? wardrobePhotos[piece.photoId] : undefined;
                        return (
                          <div
                            key={piece.id}
                            className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={piece.name}
                                  className="w-8 h-8 rounded-lg object-cover border border-black/10 shrink-0"
                                />
                              ) : (
                                <span
                                  className="w-6 h-6 rounded-lg border border-black/10 shrink-0"
                                  style={{ backgroundColor: piece.colorHex }}
                                  aria-hidden="true"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#111834] dark:text-white truncate">
                                  {piece.name}
                                </p>
                                <p className="text-[10px] text-[#646B84] dark:text-[#9AA3C2]">
                                  {piece.category} · {piece.warmth}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono text-[10px] text-[#848BA6] shrink-0">
                              {piece.volumeLiters}L
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {day.whyItWorks && (
                      <p className="mt-2.5 text-[11px] text-[#646B84] dark:text-[#9AA3C2] leading-relaxed">
                        {day.whyItWorks}
                      </p>
                    )}
                  </div>

                  {/* Swap with a saved favourite outfit */}
                  {savedOutfits.length > 0 && (
                    <div className="pt-2.5 border-t border-[#F1EFEA] dark:border-[#202948]">
                      <select
                        aria-label={`Assign saved outfit to ${day.label}`}
                        defaultValue=""
                        onChange={(e) => {
                          const found = savedOutfits.find((o) => o.id === e.target.value);
                          if (found) handleAssignComboToDay(day.dayIndex, found);
                          e.target.value = '';
                        }}
                        className="w-full min-h-[38px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs font-medium text-[#505770] dark:text-[#B4BCD9]"
                      >
                        <option value="">Swap with a saved outfit...</option>
                        {savedOutfits.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Visual Outfit Combination Builder */}
          <div className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#111834] dark:text-white">
                Visual Outfit Combination Studio
              </h2>
              <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5">
                Tap pieces from your digital wardrobe to compose a reusable look and save it as a favourite.
              </p>
            </div>

            {/* Live Selected Look Preview */}
            <div className="p-4 rounded-2xl bg-[#111834] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                {builderSelectedIds.length === 0 ? (
                  <p className="text-xs text-white/70">Select clothing pieces below to build a combination.</p>
                ) : (
                  builderSelectedIds.map((id) => {
                    const piece = wardrobe.find((w) => w.id === id);
                    if (!piece) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 text-xs"
                      >
                        <span
                          className="w-4 h-4 rounded-md border border-white/25 shrink-0"
                          style={{ backgroundColor: piece.colorHex }}
                        />
                        <span className="font-medium">{piece.name}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="text-right font-mono text-xs text-[#2AB5A8] shrink-0 tabular-nums">
                {builderSelectedIds
                  .reduce((s, id) => s + (wardrobe.find((w) => w.id === id)?.volumeLiters || 0), 0)
                  .toFixed(1)}
                L total
              </div>
            </div>

            {/* Quick piece picker */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {wardrobe.map((item) => {
                const picked = builderSelectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleBuilderItem(item)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-all ${
                      picked
                        ? 'bg-[#6E5DE7] border-[#6E5DE7] text-white'
                        : 'bg-[#FAF9F7] dark:bg-[#0D1326] border-[#E2DDD4] dark:border-[#28335C] text-[#111834] dark:text-[#F4F3EF]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                      style={{ backgroundColor: item.colorHex }}
                    />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSaveBuiltOutfit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-[#F0EDE7] dark:border-[#202948]">
              <input
                type="text"
                value={comboName}
                onChange={(e) => setComboName(e.target.value)}
                placeholder="Outfit name (e.g., Sunset Cafe Linen Look)"
                className="sm:col-span-5 min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              />
              <input
                type="text"
                value={comboOccasion}
                onChange={(e) => setComboOccasion(e.target.value)}
                placeholder="Occasion (e.g., Dinner, Flight)"
                className="sm:col-span-4 min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              />
              <button
                type="submit"
                disabled={builderSelectedIds.length === 0}
                className="sm:col-span-3 min-h-[44px] rounded-xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Heart className="w-4 h-4" />
                <span>Save Favourite</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SECTION 2: DIGITAL WARDROBE ==================== */}
      {section === 'wardrobe' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {(['All', ...WARDROBE_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatFilter(cat)}
                className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  catFilter === cat
                    ? 'bg-[#111834] dark:bg-[#6E5DE7] text-white'
                    : 'bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] text-[#505770] dark:text-[#B4BCD9]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredWardrobe.map((item) => {
              const photoUrl = item.photoId ? wardrobePhotos[item.photoId] : undefined;
              return (
                <div
                  key={item.id}
                  className="rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={item.name}
                        className="w-14 h-16 rounded-2xl object-cover border border-black/10 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-2xl border border-black/10 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: item.colorHex }}
                      >
                        <Shirt className="w-5 h-5 text-white drop-shadow-xs" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#111834] dark:text-white truncate">{item.name}</p>
                      <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] truncate">
                        {item.category} · {item.colorName}
                        {item.pattern ? ` · ${item.pattern}` : ''}
                      </p>
                      <p className="text-[11px] text-[#646B84] dark:text-[#9AA3C2] truncate">
                        {item.warmth}
                        {item.style ? ` · ${item.style}` : ''}
                        {item.aiDetected ? ' · AI Vision' : ''}
                      </p>
                      <p className="font-mono text-[11px] text-[#848BA6] mt-0.5 tabular-nums">
                        {item.weightGrams}g · {item.volumeLiters}L · Reusable {item.reusableDays}d
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(item.id)}
                    aria-label={`Remove ${item.name}`}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#9399B2] hover:text-[#DC2626] shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== SECTION 3: SAVED FAVOURITE OUTFITS ==================== */}
      {section === 'favorites' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedOutfits.length === 0 ? (
            <div className="md:col-span-2 rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] p-8 text-center">
              <p className="font-display font-bold text-base text-[#111834] dark:text-white">
                No saved outfit combinations yet
              </p>
              <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1">
                Compose a look in the Trip Outfits studio to save your go-to combinations.
              </p>
            </div>
          ) : (
            savedOutfits.map((outfit) => {
              const pieces = outfit.itemIds
                .map((id) => wardrobe.find((w) => w.id === id))
                .filter((x): x is WardrobeItem => Boolean(x));

              return (
                <div
                  key={outfit.id}
                  className="rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#0F968C] dark:text-[#2AB5A8]">
                        {outfit.occasion} · {outfit.weatherFit}
                      </p>
                      <h3 className="font-display text-base font-bold text-[#111834] dark:text-white mt-0.5">
                        {outfit.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteOutfit(outfit.id)}
                        aria-label="Toggle favourite"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#EC4899]"
                      >
                        <Heart className={`w-4 h-4 ${outfit.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteOutfit(outfit.id)}
                        aria-label="Delete saved outfit"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#9399B2] hover:text-[#DC2626]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mini photo strip if saved outfit uses uploaded photos */}
                  {pieces.some((p) => p.photoId && wardrobePhotos[p.photoId]) && (
                    <div className="grid grid-cols-4 gap-2">
                      {pieces.slice(0, 4).map((p) => {
                        const photoUrl = p.photoId ? wardrobePhotos[p.photoId] : undefined;
                        return photoUrl ? (
                          <img
                            key={p.id}
                            src={photoUrl}
                            alt={p.name}
                            className="aspect-square rounded-xl object-cover border border-black/10"
                          />
                        ) : (
                          <div
                            key={p.id}
                            className="aspect-square rounded-xl border border-black/10 flex items-center justify-center"
                            style={{ backgroundColor: p.colorHex }}
                          >
                            <Shirt className="w-4 h-4 text-white drop-shadow-xs" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {outfit.whyItWorks && (
                    <p className="text-xs text-[#505770] dark:text-[#B4BCD9] leading-relaxed">
                      {outfit.whyItWorks}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    {pieces.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5 text-xs text-[#353C54] dark:text-[#D5DBEE]">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                          style={{ backgroundColor: p.colorHex }}
                        />
                        <span className="font-medium">{p.name}</span>
                        <span className="text-[#848BA6]">· {p.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add Clothing Piece Bottom Sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add to Digital Wardrobe"
        subtitle="Use your pieces across trips to cut luggage bulk"
      >
        <form onSubmit={handleAddWardrobe} className="space-y-4">
          <div>
            <label htmlFor="w-name" className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1">
              Clothing Item Name
            </label>
            <input
              id="w-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Navy linen overshirt"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="w-cat" className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1">
                Category
              </label>
              <select
                id="w-cat"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value as WardrobeCategory)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              >
                {WARDROBE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="w-warm" className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1">
                Weather Fit
              </label>
              <select
                id="w-warm"
                value={newWarmth}
                onChange={(e) => setNewWarmth(e.target.value as WardrobeItem['warmth'])}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              >
                <option value="Warm Weather">Warm Weather</option>
                <option value="All-Season">All-Season</option>
                <option value="Cool & Cold">Cool & Cold</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
              Color Tone ({newColor.name})
            </label>
            <div className="flex flex-wrap gap-2">
              {SWATCH_PRESETS.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setNewColor(s)}
                  aria-label={s.name}
                  className={`w-9 h-9 rounded-full border-2 transition-transform ${
                    newColor.name === s.name ? 'border-[#6E5DE7] scale-110' : 'border-black/15'
                  }`}
                  style={{ backgroundColor: s.hex }}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="w-weight" className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1">
                Weight (grams)
              </label>
              <input
                id="w-weight"
                type="number"
                min={30}
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value) || 180)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] font-mono text-sm text-[#111834] dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="w-vol" className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1">
                Packed Volume (L)
              </label>
              <input
                id="w-vol"
                type="number"
                step="0.1"
                min={0.2}
                value={newVol}
                onChange={(e) => setNewVol(Number(e.target.value) || 0.9)}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] font-mono text-sm text-[#111834] dark:text-white"
              />
            </div>
          </div>

          {formErr && <p role="alert" className="text-xs font-medium text-[#DC2626]">{formErr}</p>}

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white font-semibold text-sm"
          >
            Add to Wardrobe
          </button>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(deleteConfirmId)}
        title="Remove wardrobe piece?"
        description="This will remove the clothing item from your digital wardrobe. Saved trips will keep their existing packing items."
        confirmLabel="Remove Piece"
        onConfirm={() => {
          if (deleteConfirmId) onDeleteWardrobeItem(deleteConfirmId);
          setDeleteConfirmId(null);
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
