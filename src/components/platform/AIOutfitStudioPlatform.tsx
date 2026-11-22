import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Heart,
  Loader2,
  Luggage,
  Plus,
  RefreshCw,
  Shirt,
  ShoppingBag,
  Sparkles,
  Upload,
} from 'lucide-react';
import type {
  AIMatchedOutfit,
  AIMatchSession,
  AIMissingPieceSuggestion,
  DayOutfitPlan,
  OutfitCombination,
  PackingItem,
  PackingList,
  WardrobeCategory,
  WardrobeItem,
} from '../../types';
import {
  addDaysToDateStr,
  calculateTripDays,
  estimateItemVolumeLiters,
} from '../../utils/packingEngine';
import { compressImageFileToJpegDataUrl, uid } from '../../utils/storage';

interface AIOutfitStudioPlatformProps {
  lists: PackingList[];
  selectedTripId: string | null;
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  savedOutfits: OutfitCombination[];
  isOnline: boolean;
  aiConfigured: boolean;
  onSelectTrip: (tripId: string) => void;
  onAddWardrobeItem: (item: WardrobeItem) => void;
  onSaveWardrobePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  onSaveOutfit: (outfit: OutfitCombination) => void;
  onToggleFavoriteOutfit: (outfitId: string) => void;
  onUpdateTripDayOutfits: (tripId: string, dayOutfits: DayOutfitPlan[]) => void;
  onSyncWardrobeToTrip: (tripId: string, items: PackingItem[]) => number;
  onAddMissingPieceToShopping: (
    tripId: string,
    suggestion: AIMissingPieceSuggestion
  ) => boolean;
}

const OCCASION_OPTIONS = [
  'City Sightseeing',
  'Smart Dinner',
  'Travel Day',
  'Cafe & Gallery',
  'Business Casual',
  'Resort & Coastal',
  'Evening Out',
];

const WEATHER_OPTIONS = [
  'Mild & Layered (16°–23°C)',
  'Warm & Sunny (25°–32°C)',
  'Cool & Crisp (8°–15°C)',
  'Rainy & Humid (20°–27°C)',
  'Cold & Winter (0°–8°C)',
];

export const AIOutfitStudioPlatform: React.FC<AIOutfitStudioPlatformProps> = ({
  lists,
  selectedTripId,
  wardrobe,
  wardrobePhotos,
  savedOutfits,
  isOnline,
  aiConfigured,
  onSelectTrip,
  onAddWardrobeItem,
  onSaveWardrobePhoto,
  onSaveOutfit,
  onToggleFavoriteOutfit,
  onUpdateTripDayOutfits,
  onSyncWardrobeToTrip,
  onAddMissingPieceToShopping,
}) => {
  const activeTrip = useMemo(
    () =>
      lists.find((l) => l.id === selectedTripId) ||
      lists.find((l) => !l.completed) ||
      lists[0] ||
      null,
    [lists, selectedTripId]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [destination, setDestination] = useState(
    activeTrip?.destination || activeTrip?.title || 'Kyoto, Japan'
  );
  const [durationDays, setDurationDays] = useState(
    activeTrip ? Math.min(7, Math.max(2, calculateTripDays(activeTrip.startDate, activeTrip.endDate))) : 4
  );
  const [weatherSummary, setWeatherSummary] = useState(
    activeTrip?.weather
      ? `${activeTrip.weather.summary.avgLow}°–${activeTrip.weather.summary.avgHigh}°C, ${activeTrip.weather.summary.primaryCondition}`
      : WEATHER_OPTIONS[0]
  );
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([
    'City Sightseeing',
    'Smart Dinner',
    'Travel Day',
  ]);

  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadNotice, setUploadNotice] = useState('');
  const [uploadError, setUploadError] = useState('');

  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [session, setSession] = useState<AIMatchSession | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(1);
  const [swappingSlot, setSwappingSlot] = useState<{
    outfitId: string;
    itemId: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const wardrobeMap = useMemo(() => {
    const map = new Map<string, WardrobeItem>();
    wardrobe.forEach((w) => map.set(w.id, w));
    return map;
  }, [wardrobe]);

  const toggleOccasion = (occ: string) => {
    setSelectedOccasions((prev) =>
      prev.includes(occ)
        ? prev.length > 1
          ? prev.filter((o) => o !== occ)
          : prev
        : [...prev, occ]
    );
  };

  const handleSelectTripChange = (tripId: string) => {
    onSelectTrip(tripId);
    const chosen = lists.find((l) => l.id === tripId);
    if (chosen) {
      setDestination(chosen.destination || chosen.title);
      setDurationDays(
        Math.min(7, Math.max(2, calculateTripDays(chosen.startDate, chosen.endDate)))
      );
      if (chosen.weather) {
        setWeatherSummary(
          `${chosen.weather.summary.avgLow}°–${chosen.weather.summary.avgHigh}°C, ${chosen.weather.summary.primaryCondition}`
        );
      }
    }
  };

  // Real Gemini Vision multi-photo clothing upload
  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isOnline) {
      setUploadError('Connect to the internet for AI vision garment recognition.');
      return;
    }

    const fileArr = Array.from(files).slice(0, 8);
    setUploadingCount(fileArr.length);
    setUploadError('');
    setUploadNotice('');
    let added = 0;

    for (const file of fileArr) {
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
          setUploadError(data.error || `Could not analyze ${file.name}.`);
          continue;
        }
        const det = data.detected;
        const photoId = uid('photo');
        await onSaveWardrobePhoto(photoId, compressed.dataUrl);
        const newItem: WardrobeItem = {
          id: uid('ward'),
          name: det.name || 'Uploaded Garment',
          category: det.category as WardrobeCategory,
          colorName: det.colorName || 'Neutral',
          colorHex: det.colorHex || '#171717',
          secondaryColors: det.secondaryColors || [],
          pattern: det.pattern || 'Solid',
          style: det.style || 'Smart Casual',
          fabric: det.fabric || 'Cotton Blend',
          warmth: det.warmth || 'All-Season',
          activities: Array.isArray(det.occasions) ? det.occasions : ['Everyday'],
          weightGrams: det.estimatedWeightGrams || 240,
          volumeLiters: det.estimatedVolumeLiters || 1.1,
          reusableDays: 2,
          notes: det.stylingNote || '',
          photoId,
          aiDetected: true,
        };
        onAddWardrobeItem(newItem);
        added += 1;
      } catch {
        setUploadError(`Failed to process ${file.name}. Please try a clearer image.`);
      }
    }

    setUploadingCount(0);
    if (added > 0) {
      setUploadNotice(
        `Scanned and added ${added} ${added === 1 ? 'garment' : 'garments'} to your digital wardrobe.`
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Real Owned-Wardrobe AI Outfit Generation
  const handleGenerateOutfits = async () => {
    if (wardrobe.length < 2) {
      setMatchError('Add or upload at least 2 garments in your wardrobe first.');
      return;
    }
    if (!isOnline) {
      setMatchError('An internet connection is required to generate AI outfits.');
      return;
    }

    setMatching(true);
    setMatchError('');
    setStatusMessage('');

    try {
      const startDate = activeTrip?.startDate || new Date().toISOString().slice(0, 10);
      const endDate = addDaysToDateStr(startDate, Math.max(1, durationDays - 1));

      const res = await fetch('/api/ai/match-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          durationDays,
          weatherSummary,
          occasions: selectedOccasions,
          wardrobeItems: wardrobe.map((w) => ({
            id: w.id,
            name: w.name,
            category: w.category,
            colorName: w.colorName,
            pattern: w.pattern,
            style: w.style,
            fabric: w.fabric,
            warmth: w.warmth,
            occasions: w.activities,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMatchError(data.error || 'Could not generate outfit combinations.');
        return;
      }

      const outfitsWithDates: AIMatchedOutfit[] = (data.outfits || []).map(
        (o: AIMatchedOutfit, idx: number) => ({
          ...o,
          id: o.id || uid('ai_look'),
          dayIndex: idx + 1,
          date: addDaysToDateStr(startDate, idx),
        })
      );

      const newSession: AIMatchSession = {
        generatedAt: new Date().toISOString(),
        destination,
        startDate,
        endDate,
        durationDays: outfitsWithDates.length,
        weatherSummary,
        occasions: selectedOccasions,
        capsuleSummary: data.capsuleSummary || '',
        outfits: outfitsWithDates,
        missingPieces: data.missingPieces || [],
        stats: data.stats || {
          totalOutfits: outfitsWithDates.length,
          uniquePiecesUsed: new Set(outfitsWithDates.flatMap((o) => o.itemIds)).size,
          reusedPiecesCount: 0,
        },
      };

      setSession(newSession);
      setActiveDayIndex(1);
      setSwappingSlot(null);

      // Persist daily outfit calendar to selected trip
      if (activeTrip) {
        const dayPlans: DayOutfitPlan[] = outfitsWithDates.map((o) => ({
          dayIndex: o.dayIndex,
          date: o.date || addDaysToDateStr(startDate, o.dayIndex - 1),
          label: `Day ${o.dayIndex}`,
          outfitName: o.title,
          itemIds: o.itemIds,
          activity: o.occasion,
          whyItWorks: o.whyItWorks,
        }));
        onUpdateTripDayOutfits(activeTrip.id, dayPlans);
      }
    } catch {
      setMatchError('Unable to reach AI Outfit Matcher right now. Please try again.');
    } finally {
      setMatching(false);
    }
  };

  // Interactive Click-to-Replace Garment Swapping
  const handleReplaceGarment = (outfitId: string, oldItemId: string, newItemId: string) => {
    if (!session) return;
    const updatedOutfits = session.outfits.map((o) => {
      if (o.id !== outfitId) return o;
      return {
        ...o,
        itemIds: o.itemIds.map((id) => (id === oldItemId ? newItemId : id)),
      };
    });

    const usageCounts = new Map<string, number>();
    updatedOutfits.forEach((o) =>
      o.itemIds.forEach((id) => usageCounts.set(id, (usageCounts.get(id) || 0) + 1))
    );

    const updatedSession: AIMatchSession = {
      ...session,
      outfits: updatedOutfits,
      stats: {
        totalOutfits: updatedOutfits.length,
        uniquePiecesUsed: usageCounts.size,
        reusedPiecesCount: Array.from(usageCounts.values()).filter((c) => c > 1).length,
      },
    };
    setSession(updatedSession);
    setSwappingSlot(null);

    if (activeTrip) {
      onUpdateTripDayOutfits(
        activeTrip.id,
        updatedOutfits.map((o) => ({
          dayIndex: o.dayIndex,
          date: o.date || addDaysToDateStr(activeTrip.startDate, o.dayIndex - 1),
          label: `Day ${o.dayIndex}`,
          outfitName: o.title,
          itemIds: o.itemIds,
          activity: o.occasion,
          whyItWorks: o.whyItWorks,
        }))
      );
    }
  };

  const handleSaveLook = (look: AIMatchedOutfit) => {
    const combo: OutfitCombination = {
      id: uid('outfit'),
      name: look.title,
      itemIds: look.itemIds,
      occasion: look.occasion,
      weatherFit: look.weatherFit,
      whyItWorks: look.whyItWorks,
      stylingTip: look.stylingTip,
      aiGenerated: true,
      isFavorite: true,
      createdAt: new Date().toISOString(),
    };
    onSaveOutfit(combo);
    setStatusMessage(`Saved "${look.title}" to your favorite looks.`);
    window.setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleSyncCapsuleToSuitcase = () => {
    if (!session || !activeTrip) return;
    const uniqueIds = Array.from(new Set(session.outfits.flatMap((o) => o.itemIds)));
    const packingItems: PackingItem[] = uniqueIds
      .map((id) => wardrobeMap.get(id))
      .filter((w): w is WardrobeItem => Boolean(w))
      .map((w, idx) => ({
        id: uid('item'),
        name: w.name,
        category:
          w.category === 'Footwear'
            ? 'Footwear'
            : w.category === 'Accessories'
            ? 'Accessories'
            : 'Clothing',
        quantity: 1,
        packed: false,
        weightGrams: w.weightGrams,
        volumeLiters:
          w.volumeLiters || estimateItemVolumeLiters(w.category, w.weightGrams),
        priority: 'Essential',
        essential: true,
        aiRecommended: true,
        notes: `${w.colorName} · Capsule wardrobe piece`,
        order: idx,
      }));

    const addedCount = onSyncWardrobeToTrip(activeTrip.id, packingItems);
    setStatusMessage(
      addedCount > 0
        ? `Synced ${addedCount} capsule pieces into "${activeTrip.title}".`
        : `All capsule pieces are already packed in "${activeTrip.title}".`
    );
    window.setTimeout(() => setStatusMessage(''), 3500);
  };

  const activeOutfit = useMemo(() => {
    if (!session) return null;
    return (
      session.outfits.find((o) => o.dayIndex === activeDayIndex) ||
      session.outfits[0] ||
      null
    );
  }, [session, activeDayIndex]);

  const swapCandidates = useMemo(() => {
    if (!swappingSlot) return [];
    const currentItem = wardrobeMap.get(swappingSlot.itemId);
    if (!currentItem) return wardrobe;
    const sameCategory = wardrobe.filter(
      (w) => w.category === currentItem.category && w.id !== currentItem.id
    );
    return sameCategory.length > 0
      ? sameCategory
      : wardrobe.filter((w) => w.id !== currentItem.id);
  }, [swappingSlot, wardrobe, wardrobeMap]);

  return (
    <div className="bg-[#FFFFFF] min-h-[calc(100vh-4rem)] py-8 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* ==================== HEADER ==================== */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#171717]/60">AI Outfit Studio</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#171717]">
              Owned-Wardrobe Styling
            </h1>
            <p className="text-sm text-[#171717]/70 max-w-2xl">
              Upload photos of clothes you actually own. Gemini Vision catalogs each piece and builds non-repeating, weather-ready combinations exclusively from your wardrobe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleUploadFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingCount > 0}
              className="h-10 px-4 rounded-lg bg-[#FFFFFF] border border-[#171717]/20 text-sm font-medium text-[#171717] inline-flex items-center gap-2 hover:border-[#171717] transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {uploadingCount > 0 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>
                {uploadingCount > 0
                  ? `Analyzing ${uploadingCount}...`
                  : 'Upload Garment Photos'}
              </span>
            </button>
          </div>
        </div>

        {(uploadNotice || statusMessage) && (
          <div className="rounded-lg bg-[#B8D9F2]/40 border border-[#171717]/12 px-4 py-3 text-sm font-medium text-[#171717]">
            {uploadNotice || statusMessage}
          </div>
        )}

        {(uploadError || matchError) && (
          <div className="rounded-lg bg-[#FFC5A8]/50 border border-[#171717]/15 px-4 py-3 text-sm font-medium text-[#171717]">
            {uploadError || matchError}
          </div>
        )}

        {/* ==================== STYLING BRIEF & CONTROLS ==================== */}
        <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#171717]">
                Trip Styling Brief
              </h2>
              <p className="text-xs text-[#171717]/65 mt-0.5">
                Using {wardrobe.length} owned wardrobe pieces ({wardrobe.filter((w) => w.photoId).length}{' '}
                photo-scanned).
              </p>
            </div>
            {lists.length > 0 && activeTrip && (
              <select
                aria-label="Link to trip"
                value={activeTrip.id}
                onChange={(e) => handleSelectTripChange(e.target.value)}
                className="h-10 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717]"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    Trip: {l.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1.5 text-xs font-medium text-[#171717]/75">
              <span>Destination</span>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717]"
              />
            </label>

            <label className="space-y-1.5 text-xs font-medium text-[#171717]/75">
              <span>Days to Style</span>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717]"
              >
                {[2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d} Days ({d} distinct outfits)
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs font-medium text-[#171717]/75">
              <span>Expected Weather</span>
              <input
                type="text"
                list="weather-presets"
                value={weatherSummary}
                onChange={(e) => setWeatherSummary(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717]"
              />
              <datalist id="weather-presets">
                {WEATHER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#171717]/75">Occasions</p>
            <div className="flex flex-wrap gap-2">
              {OCCASION_OPTIONS.map((occ) => {
                const selected = selectedOccasions.includes(occ);
                return (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => toggleOccasion(occ)}
                    className={`h-9 px-3.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-[#171717] text-[#FFFFFF] border-[#171717]'
                        : 'bg-[#FFFFFF] text-[#171717] border-[#171717]/15 hover:border-[#171717]'
                    }`}
                  >
                    {occ}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-[#171717]/10 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#171717]/60">
              {aiConfigured
                ? 'Powered by Gemini Vision & Owned-Wardrobe Capsule Engine'
                : 'Configure GEMINI_API_KEY in Secrets to enable live AI vision & matching'}
            </p>
            <button
              type="button"
              onClick={handleGenerateOutfits}
              disabled={matching || wardrobe.length < 2}
              className="h-11 px-6 rounded-lg bg-[#171717] text-[#FFFFFF] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#171717]/88 transition-colors disabled:opacity-50"
            >
              {matching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>
                {matching
                  ? 'Styling Your Wardrobe...'
                  : session
                  ? 'Regenerate Capsule Plan'
                  : 'Generate Daily Outfits'}
              </span>
            </button>
          </div>
        </div>

        {/* ==================== GENERATED OUTFIT PLAN & LOOKBOARD ==================== */}
        {session && activeOutfit && (
          <div className="space-y-6">
            {/* Capsule Metrics & Sync Bar */}
            <div className="rounded-xl bg-[#D9C9F2]/45 border border-[#171717]/10 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1 max-w-2xl">
                <p className="text-xs font-medium text-[#171717]/65">Capsule Efficiency Summary</p>
                <p className="text-sm font-medium text-[#171717] leading-relaxed">
                  {session.capsuleSummary}
                </p>
                <p className="text-xs text-[#171717]/70 tabular-nums">
                  {session.stats.totalOutfits} unique looks · {session.stats.uniquePiecesUsed}{' '}
                  pieces packed · {session.stats.reusedPiecesCount} versatile items reused
                </p>
              </div>
              {activeTrip && (
                <button
                  type="button"
                  onClick={handleSyncCapsuleToSuitcase}
                  className="h-10 px-5 rounded-lg bg-[#171717] text-[#FFFFFF] text-xs font-medium inline-flex items-center gap-2 hover:bg-[#171717]/88 transition-colors shrink-0 self-start lg:self-auto"
                >
                  <Luggage className="w-4 h-4" />
                  <span>Sync Capsule to {activeTrip.title}</span>
                </button>
              )}
            </div>

            {/* Day Selector Tabs */}
            <div className="flex flex-wrap gap-2">
              {session.outfits.map((look) => {
                const isActive = look.dayIndex === activeOutfit.dayIndex;
                return (
                  <button
                    key={look.id}
                    type="button"
                    onClick={() => {
                      setActiveDayIndex(look.dayIndex);
                      setSwappingSlot(null);
                    }}
                    className={`h-10 px-4 rounded-lg text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-[#171717] text-[#FFFFFF] border-[#171717]'
                        : 'bg-[#FFFFFF] text-[#171717] border-[#171717]/15 hover:border-[#171717]'
                    }`}
                  >
                    Day {look.dayIndex} · {look.occasion}
                  </button>
                );
              })}
            </div>

            {/* Active Outfit Composition Card */}
            <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#171717]/60">
                    Day {activeOutfit.dayIndex}
                    {activeOutfit.date ? ` · ${activeOutfit.date}` : ''} · {activeOutfit.occasion}
                  </p>
                  <h3 className="font-serif text-3xl font-medium text-[#171717]">
                    {activeOutfit.title}
                  </h3>
                  <p className="text-xs text-[#171717]/65">
                    Weather fit: {activeOutfit.weatherFit}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveLook(activeOutfit)}
                  className="h-10 px-4 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 hover:border-[#171717] transition-colors shrink-0 self-start"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Save Outfit</span>
                </button>
              </div>

              {/* Garment Collage Grid (Zero Overlaid Text — Clean Captions Below) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeOutfit.itemIds.map((itemId) => {
                  const piece = wardrobeMap.get(itemId);
                  if (!piece) return null;
                  const photo = piece.photoId ? wardrobePhotos[piece.photoId] : undefined;
                  const isSwappingThis =
                    swappingSlot?.outfitId === activeOutfit.id &&
                    swappingSlot?.itemId === itemId;

                  return (
                    <div
                      key={itemId}
                      className={`rounded-xl border overflow-hidden flex flex-col justify-between bg-[#FFFFFF] ${
                        isSwappingThis ? 'border-[#171717] ring-1 ring-[#171717]' : 'border-[#171717]/10'
                      }`}
                    >
                      <div className="aspect-square w-full bg-[#FFFFFF] flex items-center justify-center overflow-hidden">
                        {photo ? (
                          <img
                            src={photo}
                            alt={piece.name}
                            className="w-full h-full object-cover block"
                          />
                        ) : (
                          <span
                            className="w-12 h-12 rounded-lg border border-[#171717]/15 flex items-center justify-center"
                            style={{ backgroundColor: piece.colorHex }}
                          >
                            <Shirt className="w-6 h-6 text-[#FFFFFF]" />
                          </span>
                        )}
                      </div>
                      <div className="p-3.5 space-y-2">
                        <div>
                          <p className="text-xs font-semibold text-[#171717] truncate">
                            {piece.name}
                          </p>
                          <p className="text-[11px] text-[#171717]/60 truncate">
                            {piece.category} · {piece.colorName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSwappingSlot(
                              isSwappingThis
                                ? null
                                : { outfitId: activeOutfit.id, itemId }
                            )
                          }
                          className="w-full h-8 rounded-md bg-[#FFFFFF] border border-[#171717]/12 text-[11px] font-medium text-[#171717] inline-flex items-center justify-center gap-1 hover:border-[#171717] transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{isSwappingThis ? 'Cancel Swap' : 'Swap Piece'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Inline Swap Selector Panel */}
              {swappingSlot && swappingSlot.outfitId === activeOutfit.id && (
                <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/15 p-4 space-y-3">
                  <p className="text-xs font-semibold text-[#171717]">
                    Choose a replacement from your wardrobe:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {swapCandidates.slice(0, 8).map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() =>
                          handleReplaceGarment(
                            activeOutfit.id,
                            swappingSlot.itemId,
                            cand.id
                          )
                        }
                        className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/12 hover:border-[#171717] text-left transition-colors"
                      >
                        <p className="text-xs font-semibold text-[#171717] truncate">
                          {cand.name}
                        </p>
                        <p className="text-[11px] text-[#171717]/60 truncate">
                          {cand.category} · {cand.colorName}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Styling Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#171717]/10">
                <div className="rounded-lg bg-[#FFFFFF] p-4 space-y-1">
                  <p className="text-xs font-semibold text-[#171717]">Why this combination works</p>
                  <p className="text-sm text-[#171717]/75 leading-relaxed">
                    {activeOutfit.whyItWorks}
                  </p>
                </div>
                <div className="rounded-lg bg-[#B8D9F2]/25 p-4 space-y-1">
                  <p className="text-xs font-semibold text-[#171717]">Styling note</p>
                  <p className="text-sm text-[#171717]/75 leading-relaxed">
                    {activeOutfit.stylingTip}
                  </p>
                </div>
              </div>
            </div>

            {/* Missing Wardrobe Pieces Recommendations */}
            {session.missingPieces.length > 0 && (
              <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 space-y-4">
                <div>
                  <p className="text-xs font-medium text-[#171717]/60">Wardrobe Gap Analysis</p>
                  <h3 className="font-serif text-2xl font-medium text-[#171717]">
                    High-Impact Pieces to Expand Your Capsule
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {session.missingPieces.map((piece) => (
                    <div
                      key={piece.name}
                      className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#171717]">{piece.name}</p>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#FFC5A8]/60 text-[#171717] shrink-0">
                            +{piece.unlockedCombosCount} looks
                          </span>
                        </div>
                        <p className="text-xs text-[#171717]/65">
                          {piece.category} · Suggested shade: {piece.colorSuggestion}
                        </p>
                        <p className="text-xs text-[#171717]/75 leading-relaxed">
                          {piece.impactSummary}
                        </p>
                      </div>
                      {activeTrip && (
                        <button
                          type="button"
                          onClick={() => {
                            const ok = onAddMissingPieceToShopping(activeTrip.id, piece);
                            setStatusMessage(
                              ok
                                ? `Added "${piece.name}" to ${activeTrip.title} shopping list.`
                                : `"${piece.name}" is already in your shopping list.`
                            );
                          }}
                          className="h-9 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717] inline-flex items-center justify-center gap-1.5 hover:border-[#171717] transition-colors self-start"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Add to Shopping List</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== SAVED FAVORITE OUTFITS ==================== */}
        <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#171717]/60">Saved Looks</p>
              <h2 className="font-serif text-2xl font-medium text-[#171717]">
                Favorite Combinations ({savedOutfits.length})
              </h2>
            </div>
          </div>

          {savedOutfits.length === 0 ? (
            <p className="text-sm text-[#171717]/60 py-4">
              Generate daily looks above and save your favorites for quick packing reuse.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedOutfits.slice(0, 6).map((look) => (
                <div
                  key={look.id}
                  className="rounded-xl bg-[#FFFFFF]/65 border border-[#171717]/10 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif text-xl font-medium text-[#171717]">
                        {look.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteOutfit(look.id)}
                        aria-label="Toggle favorite"
                        className="p-1 text-[#171717] hover:opacity-70"
                      >
                        <Heart
                          className={`w-4 h-4 ${look.isFavorite ? 'fill-[#171717]' : ''}`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-[#171717]/65">
                      {look.occasion} · {look.weatherFit}
                    </p>
                    <ul className="text-xs text-[#171717]/80 space-y-1 pt-1">
                      {look.itemIds.map((id) => {
                        const w = wardrobeMap.get(id);
                        return w ? (
                          <li key={id} className="flex items-center gap-1.5 truncate">
                            <Check className="w-3 h-3 text-[#171717]/60 shrink-0" />
                            <span className="truncate">{w.name}</span>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
