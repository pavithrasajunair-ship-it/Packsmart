import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  BookmarkCheck,
  Calendar,
  Check,
  CloudSun,
  Heart,
  Layers,
  Loader2,
  RefreshCw,
  Shirt,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type {
  AIMatchedOutfit,
  AIMissingPieceSuggestion,
  DayOutfitPlan,
  OutfitCombination,
  PackingItem,
  PackingList,
  WardrobeCategory,
  WardrobeItem,
  WeatherReport,
} from '../../types';
import { compressImageFileToJpegDataUrl, uid } from '../../utils/storage';
import fashionStudioImg from '../../assets/images/spatial_fashion_studio_1795246612585.jpg';

interface AIOutfitStudioViewProps {
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
  onUpdateTripDayOutfits: (tripId: string, dayOutfits: DayOutfitPlan[]) => void;
  onSyncWardrobeToTrip: (tripId: string, items: PackingItem[]) => number;
  onAddMissingPieceToShopping: (tripId: string, suggestion: AIMissingPieceSuggestion) => boolean;
  onSaveWeather?: (tripId: string, weather: WeatherReport) => void;
  onOpenSmartPacking?: () => void;
}

interface ScanJob {
  id: string;
  fileName: string;
  previewUrl: string;
  status: 'compressing' | 'analyzing' | 'done' | 'error';
  error?: string;
  detectedName?: string;
}

const OCCASIONS = [
  'City Exploring',
  'Evening Dinner',
  'Resort & Coast',
  'Gallery & Culture',
  'Business Meetings',
  'Travel Transit',
];

const PREFERRED_STYLES = [
  'Quiet Luxury',
  'Minimalist Editorial',
  'Resort Tailored',
  'Monochrome Noir',
  'Effortless Casual',
];

const WEATHER_PRESETS = [
  'Mild & Layered (16–23°C)',
  'Warm & Sunny (25–31°C)',
  'Cool & Crisp (9–15°C)',
  'Rainy & Breezy (15–21°C)',
  'Cold & Winter (1–8°C)',
];

function addDaysISO(baseISO: string, offset: number): string {
  const d = new Date(baseISO);
  if (Number.isNaN(d.getTime())) return baseISO;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const AIOutfitStudioView: React.FC<AIOutfitStudioViewProps> = ({
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
  onUpdateTripDayOutfits,
  onSyncWardrobeToTrip,
  onAddMissingPieceToShopping,
  onOpenSmartPacking,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scanJobs, setScanJobs] = useState<ScanJob[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Brief Parameters
  const activeTrip = trips.find((t) => !t.completed) || trips[0] || null;
  const [selectedTripId, setSelectedTripId] = useState<string>(activeTrip?.id || '');
  const [destination, setDestination] = useState<string>(activeTrip?.destination || 'Kyoto');
  const [durationDays, setDurationDays] = useState<number>(4);
  const [weatherSummary, setWeatherSummary] = useState<string>(WEATHER_PRESETS[0]);
  const [preferredStyle, setPreferredStyle] = useState<string>(PREFERRED_STYLES[0]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([
    'City Exploring',
    'Evening Dinner',
  ]);
  const [weatherBusy, setWeatherBusy] = useState(false);

  // Live AI Outfit Generation State
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [capsuleSummary, setCapsuleSummary] = useState('');
  const [generatedOutfits, setGeneratedOutfits] = useState<AIMatchedOutfit[]>([]);
  const [missingPieces, setMissingPieces] = useState<AIMissingPieceSuggestion[]>([]);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);

  // Interactive Click-to-Replace Piece State
  const [swappingPieceId, setSwappingPieceId] = useState<string | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string>('');

  const wardrobeMap = useMemo(() => {
    const map = new Map<string, WardrobeItem>();
    wardrobe.forEach((w) => map.set(w.id, w));
    return map;
  }, [wardrobe]);

  const activeOutfit = generatedOutfits[selectedDayIdx] || null;

  // Rewear Optimizer Stats (live-computed from generatedOutfits including manual swaps!)
  const rewearStats = useMemo(() => {
    const counts = new Map<string, number>();
    generatedOutfits.forEach((o) => {
      o.itemIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    });
    const uniquePieces = counts.size;
    const reusedPieces = Array.from(counts.values()).filter((c) => c > 1).length;
    const signatures = new Set(generatedOutfits.map((o) => [...o.itemIds].sort().join('|')));
    return {
      totalOutfits: generatedOutfits.length,
      uniquePieces,
      reusedPieces,
      hasDuplicates: signatures.size < generatedOutfits.length,
      counts,
    };
  }, [generatedOutfits]);

  const showNotice = (msg: string) => {
    setNoticeBanner(msg);
    window.setTimeout(() => setNoticeBanner(''), 3600);
  };

  // Real Multi-Photo Upload + Gemini Vision Analysis
  const processUploadedFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArr.length === 0) return;

    for (const file of fileArr) {
      const jobId = uid('scan');
      const previewUrl = URL.createObjectURL(file);
      setScanJobs((prev) => [
        { id: jobId, fileName: file.name, previewUrl, status: 'compressing' },
        ...prev,
      ]);

      try {
        const compressed = await compressImageFileToJpegDataUrl(file, 960);

        setScanJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: 'analyzing' } : j))
        );

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
          setScanJobs((prev) =>
            prev.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    status: 'error',
                    error: data.error || 'Could not detect a garment in this photo.',
                  }
                : j
            )
          );
          continue;
        }

        const photoId = uid('wphoto');
        await onSaveWardrobePhoto(photoId, compressed.dataUrl);

        const det = data.detected;
        const newItem: WardrobeItem = {
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
          activities: det.occasions || ['Travel'],
          weightGrams: det.estimatedWeightGrams || 240,
          volumeLiters: det.estimatedVolumeLiters || 1.0,
          reusableDays: 3,
          photoId,
          aiDetected: true,
          notes: det.stylingNote,
        };

        onAddWardrobeItem(newItem);
        setScanJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: 'done', detectedName: newItem.name } : j
          )
        );
      } catch {
        setScanJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, status: 'error', error: 'Network or vision error while scanning photo.' }
              : j
          )
        );
      }
    }
  };

  const fetchLiveWeatherForDestination = async () => {
    if (!destination.trim() || !isOnline) return;
    setWeatherBusy(true);
    try {
      const start = new Date().toISOString().slice(0, 10);
      const end = addDaysISO(start, Math.max(1, durationDays - 1));
      const res = await fetch(
        `/api/weather?city=${encodeURIComponent(destination.trim())}&startDate=${start}&endDate=${end}`
      );
      const data = await res.json();
      if (res.ok && data.summary) {
        setWeatherSummary(
          `${data.summary.primaryCondition} (${data.summary.avgLow}°–${data.summary.avgHigh}°C, ${data.summary.maxRainChance}% rain)`
        );
        showNotice(`Synced live weather for ${data.shortLocation}.`);
      }
    } catch {
      // keep existing weather summary
    } finally {
      setWeatherBusy(false);
    }
  };

  const handleGenerateOutfits = async () => {
    if (wardrobe.length < 2) {
      setMatchError('Upload at least 2 clothing photos to your wardrobe before generating outfits.');
      return;
    }
    if (!isOnline) {
      setMatchError('Connect to the internet so Gemini AI can style your owned garments.');
      return;
    }

    setMatchingBusy(true);
    setMatchError('');
    setSwappingPieceId(null);

    try {
      const startDate = new Date().toISOString().slice(0, 10);
      const endDate = addDaysISO(startDate, Math.max(1, durationDays - 1));
      const res = await fetch('/api/ai/match-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim() || 'Upcoming Trip',
          startDate,
          endDate,
          durationDays,
          weatherSummary: `${weatherSummary} · Preferred aesthetic: ${preferredStyle}`,
          occasions: selectedOccasions.length > 0 ? selectedOccasions : ['City Exploring'],
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
        setMatchError(data.error || 'Could not generate outfit combinations right now.');
      } else {
        setGeneratedOutfits(Array.isArray(data.outfits) ? data.outfits : []);
        setMissingPieces(Array.isArray(data.missingPieces) ? data.missingPieces : []);
        setCapsuleSummary(data.capsuleSummary || '');
        setSelectedDayIdx(0);
      }
    } catch {
      setMatchError('Failed to reach the AI Outfit Studio service. Please try again.');
    } finally {
      setMatchingBusy(false);
    }
  };

  // Interactive Click-to-Replace Piece inside Active Outfit
  const handleReplacePieceInActiveOutfit = (oldItemId: string, newItemId: string) => {
    if (!activeOutfit || oldItemId === newItemId) {
      setSwappingPieceId(null);
      return;
    }
    setGeneratedOutfits((prev) =>
      prev.map((o, idx) => {
        if (idx !== selectedDayIdx) return o;
        const nextIds = Array.from(
          new Set(o.itemIds.map((id) => (id === oldItemId ? newItemId : id)))
        );
        return {
          ...o,
          itemIds: nextIds,
          whyItWorks: `${o.whyItWorks} (Customized with ${wardrobeMap.get(newItemId)?.name || 'your piece'}.)`,
        };
      })
    );
    setSwappingPieceId(null);
    showNotice('Updated outfit composition with your owned piece.');
  };

  // Swap Day Order / Shuffle Combination
  const handleCycleAlternativeSwap = () => {
    if (!activeOutfit) return;
    // Find a replaceable category piece from owned wardrobe not currently in this outfit
    for (const id of activeOutfit.itemIds) {
      const current = wardrobeMap.get(id);
      if (!current) continue;
      const alt = wardrobe.find(
        (w) => w.category === current.category && !activeOutfit.itemIds.includes(w.id)
      );
      if (alt) {
        handleReplacePieceInActiveOutfit(id, alt.id);
        return;
      }
    }
    showNotice('Upload more garments in a category to unlock additional live swaps.');
  };

  const handleSaveCurrentOutfit = () => {
    if (!activeOutfit) return;
    const saved: OutfitCombination = {
      id: uid('outfit'),
      name: activeOutfit.title,
      occasion: activeOutfit.occasion,
      weatherFit: activeOutfit.weatherFit,
      itemIds: activeOutfit.itemIds,
      isFavorite: true,
      whyItWorks: activeOutfit.whyItWorks,
      stylingTip: activeOutfit.stylingTip,
      aiGenerated: true,
      createdAt: new Date().toISOString(),
    };
    onSaveOutfit(saved);
    showNotice(`Saved "${activeOutfit.title}" to your favorite looks.`);
  };

  const handleSyncCapsuleToSuitcase = () => {
    const trip = trips.find((t) => t.id === selectedTripId) || activeTrip;
    if (!trip || generatedOutfits.length === 0) return;

    const uniqueIds = Array.from(new Set(generatedOutfits.flatMap((o) => o.itemIds)));
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
        volumeLiters: w.volumeLiters,
        priority: 'Essential',
        essential: true,
        order: idx,
      }));

    const added = onSyncWardrobeToTrip(trip.id, packingItems);
    const dayPlans: DayOutfitPlan[] = generatedOutfits.map((o, idx) => ({
      dayIndex: idx + 1,
      date: addDaysISO(trip.startDate, idx),
      label: `Day ${idx + 1}`,
      activity: o.occasion,
      itemIds: o.itemIds,
      outfitName: o.title,
      whyItWorks: o.whyItWorks,
    }));
    onUpdateTripDayOutfits(trip.id, dayPlans);
    showNotice(
      added > 0
        ? `Synced ${added} owned garments & ${dayPlans.length} daily looks to ${trip.title}.`
        : `Updated ${dayPlans.length} daily looks on ${trip.title}.`
    );
  };

  const swappingPiece = swappingPieceId ? wardrobeMap.get(swappingPieceId) || null : null;
  const swapCandidates = useMemo(() => {
    if (!swappingPiece) return [];
    return wardrobe.filter(
      (w) => w.category === swappingPiece.category && w.id !== swappingPiece.id
    );
  }, [swappingPiece, wardrobe]);

  return (
    <div className="min-h-screen bg-[#D9C9F2] text-[#101010] pt-20 pb-14">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-8">
        {/* EDITORIAL ATELIER HEADER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end border-b border-[#101010]/15 pb-7">
          <div className="lg:col-span-7 space-y-2">
            <p className="font-mono text-[11px] tracking-[0.16em] text-[#101010]/65">
              02. AI OUTFIT STUDIO · OWNED-WARDROBE VISION ENGINE
            </p>
            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl leading-[0.98] font-normal">
              Styled strictly from <span className="italic">the clothes you own.</span>
            </h1>
          </div>
          <div className="lg:col-span-5 flex flex-wrap items-center lg:justify-end gap-4 text-xs">
            <span className="font-mono text-[#101010]/70 tabular-nums">
              {wardrobe.length} owned pieces · {savedOutfits.length} saved looks
            </span>
            {noticeBanner && (
              <span className="px-3 py-1.5 bg-[#101010] text-[#FFC5A8] font-semibold">
                {noticeBanner}
              </span>
            )}
          </div>
        </div>

        {/* MAIN 2-COLUMN ATELIER STAGE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* LEFT: GARMENT UPLOAD + STYLING BRIEF CONTROLS (4 COLS) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Real Gemini Vision Photo Upload Zone */}
            <div className="bg-[#FFFFFF] border border-[#101010]/15 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-extrabold tracking-tight">
                  Scan Your Real Wardrobe
                </h2>
                <span className="font-mono text-[10px] text-[#101010]/60">
                  {aiConfigured ? 'GEMINI VISION' : 'KEY NEEDED'}
                </span>
              </div>

              <motion.div
                whileHover={{ scale: 1.005 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  void processUploadedFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                className={`p-5 border border-dashed text-center cursor-pointer transition-colors space-y-2 ${
                  dragOver
                    ? 'border-[#101010] bg-[#FFC5A8]/40'
                    : 'border-[#101010]/35 bg-[#B8D9F2]/25 hover:bg-[#B8D9F2]/45'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void processUploadedFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Upload className="w-5 h-5 mx-auto text-[#101010]" />
                <p className="text-xs font-bold text-[#101010]">
                  Upload tops, bottoms, dresses, shoes, jackets or accessories
                </p>
                <p className="text-[11px] text-[#101010]/65">
                  AI Vision reads color, pattern, fabric &amp; warmth automatically
                </p>
              </motion.div>

              {/* Active Vision Scan Queue */}
              {scanJobs.length > 0 && (
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {scanJobs.slice(0, 4).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 p-2 border border-[#101010]/12 bg-[#FFFFFF]"
                    >
                      <img
                        src={job.previewUrl}
                        alt={job.fileName}
                        className="w-10 h-10 object-cover border border-[#101010]/15 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">
                          {job.detectedName || job.fileName}
                        </p>
                        <p className="font-mono text-[10px] text-[#101010]/65 truncate">
                          {job.status === 'compressing' && 'Optimizing image...'}
                          {job.status === 'analyzing' && 'AI Vision analyzing garment...'}
                          {job.status === 'done' && 'Added to your digital wardrobe'}
                          {job.status === 'error' && (job.error || 'Analysis failed')}
                        </p>
                      </div>
                      {(job.status === 'compressing' || job.status === 'analyzing') && (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      )}
                      {job.status === 'done' && <Check className="w-4 h-4 shrink-0" />}
                      {job.status === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Styling Brief Controls */}
            <div className="bg-[#FFFFFF] border border-[#101010]/15 p-5 space-y-4">
              <h2 className="font-display text-sm font-extrabold tracking-tight">
                Curate Trip Brief
              </h2>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] text-[#101010]/60">DESTINATION</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Kyoto, Paris, Amalfi..."
                    className="flex-1 min-h-[42px] px-3 border border-[#101010]/25 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={fetchLiveWeatherForDestination}
                    disabled={weatherBusy || !isOnline}
                    title="Fetch live Open-Meteo weather"
                    className="min-h-[42px] px-3 bg-[#B8D9F2] text-[#101010] text-xs font-bold inline-flex items-center gap-1 hover:bg-[#FFC5A8] transition-colors disabled:opacity-50"
                  >
                    {weatherBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudSun className="w-3.5 h-3.5" />
                    )}
                    <span>Live</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] text-[#101010]/60">DURATION</label>
                  <select
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 border border-[#101010]/25 text-xs font-semibold bg-[#FFFFFF]"
                  >
                    {[2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} Days ({d} Looks)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] text-[#101010]/60">PREFERRED STYLE</label>
                  <select
                    value={preferredStyle}
                    onChange={(e) => setPreferredStyle(e.target.value)}
                    className="w-full min-h-[42px] px-3 border border-[#101010]/25 text-xs font-semibold bg-[#FFFFFF]"
                  >
                    {PREFERRED_STYLES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-mono text-[10px] text-[#101010]/60">WEATHER CONDITION</label>
                <select
                  value={WEATHER_PRESETS.includes(weatherSummary) ? weatherSummary : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') setWeatherSummary(e.target.value);
                  }}
                  className="w-full min-h-[42px] px-3 border border-[#101010]/25 text-xs font-semibold bg-[#FFFFFF]"
                >
                  {!WEATHER_PRESETS.includes(weatherSummary) && (
                    <option value="custom">{weatherSummary}</option>
                  )}
                  {WEATHER_PRESETS.map((wp) => (
                    <option key={wp} value={wp}>
                      {wp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="font-mono text-[10px] text-[#101010]/60">OCCASIONS</p>
                <div className="flex flex-wrap gap-1.5">
                  {OCCASIONS.map((occ) => {
                    const active = selectedOccasions.includes(occ);
                    return (
                      <button
                        key={occ}
                        type="button"
                        onClick={() =>
                          setSelectedOccasions((prev) =>
                            active ? prev.filter((x) => x !== occ) : [...prev, occ]
                          )
                        }
                        className={`min-h-[34px] px-2.5 text-[11px] font-semibold border transition-colors ${
                          active
                            ? 'bg-[#101010] border-[#101010] text-[#FFFFFF]'
                            : 'bg-[#FFFFFF] border-[#101010]/20 text-[#101010]/75 hover:border-[#101010]'
                        }`}
                      >
                        {occ}
                      </button>
                    );
                  })}
                </div>
              </div>

              {matchError && (
                <div className="p-3 bg-[#FFC5A8] text-[#101010] text-xs font-semibold">
                  {matchError}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateOutfits}
                disabled={matchingBusy}
                className="w-full min-h-[50px] bg-[#101010] text-[#FFFFFF] text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-[#101010]/85 transition-colors disabled:opacity-50"
              >
                {matchingBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#FFC5A8]" />
                    <span>Styling Owned Wardrobe...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 text-[#FFC5A8]" />
                    <span>Generate Owned-Closet Outfits</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT: INTERACTIVE EDITORIAL FASHION GALLERY & ANIMATED COMPOSITION (8 COLS) */}
          <div className="lg:col-span-8 space-y-6">
            {generatedOutfits.length === 0 ? (
              /* Luxury Pre-Generation Stage with Live Owned Wardrobe Strip */
              <div className="bg-[#FFFFFF] border border-[#101010]/15 overflow-hidden grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-5 relative min-h-[320px] bg-[#101010]">
                  <img
                    src={fashionStudioImg}
                    alt="Luxury travel capsule atelier"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[#101010]/90 to-transparent text-[#FFFFFF]">
                    <p className="font-mono text-[10px] text-[#FFC5A8]">ATELIER CAPSULE</p>
                    <p className="font-editorial text-xl">Zero repeats. Owned pieces only.</p>
                  </div>
                </div>

                <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
                  <div className="space-y-3">
                    <p className="font-mono text-[11px] text-[#101010]/60">
                      YOUR READY CLOSET ({wardrobe.length} GARMENTS)
                    </p>
                    <h2 className="font-editorial text-3xl leading-tight">
                      Every outfit is assembled exclusively from garments in your archive.
                    </h2>
                    <p className="text-xs text-[#101010]/70 leading-relaxed">
                      Upload new photos on the left or style your current {wardrobe.length} items right now. Click any piece inside a generated outfit to swap it live with another garment you own.
                    </p>
                  </div>

                  {/* Floating Mini Archive Preview */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {wardrobe.slice(0, 8).map((item) => {
                      const photo = item.photoId ? wardrobePhotos[item.photoId] : undefined;
                      return (
                        <div
                          key={item.id}
                          className="border border-[#101010]/15 bg-[#B8D9F2]/25 p-2 flex flex-col justify-between min-h-[88px] relative group"
                        >
                          {photo ? (
                            <img
                              src={photo}
                              alt={item.name}
                              className="w-full h-14 object-cover mb-1.5"
                            />
                          ) : (
                            <span
                              className="w-7 h-7 border border-[#101010]/25 mb-2 flex items-center justify-center"
                              style={{ backgroundColor: item.colorHex }}
                            >
                              <Shirt className="w-3.5 h-3.5 text-[#FFFFFF]" />
                            </span>
                          )}
                          <p className="text-[10px] font-bold truncate">{item.name}</p>
                          <p className="font-mono text-[9px] text-[#101010]/60 truncate">
                            {item.category}
                          </p>
                          <button
                            type="button"
                            onClick={() => onDeleteWardrobeItem(item.id)}
                            aria-label={`Delete ${item.name}`}
                            className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 w-5 h-5 bg-[#101010] text-[#FFFFFF] flex items-center justify-center transition-opacity"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* LIVE INTERACTIVE OUTFIT GALLERY + ANIMATED COMPOSITION STAGE */
              <div className="space-y-6">
                {/* Outfit Calendar Strip + Rewear Optimizer Readout */}
                <div className="bg-[#101010] text-[#FFFFFF] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] text-[#FFC5A8]">
                        OUTFIT CALENDAR · REWEAR OPTIMIZER
                      </p>
                      <p className="text-xs text-white/80 mt-1 max-w-xl">{capsuleSummary}</p>
                    </div>
                    <div className="flex items-center gap-5 font-mono tabular-nums">
                      <div>
                        <p className="text-lg font-bold text-[#B8D9F2]">{rewearStats.totalOutfits}</p>
                        <p className="text-[10px] text-white/60">Looks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#D9C9F2]">{rewearStats.uniquePieces}</p>
                        <p className="text-[10px] text-white/60">Pieces</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#FFC5A8]">{rewearStats.reusedPieces}</p>
                        <p className="text-[10px] text-white/60">Reworn</p>
                      </div>
                    </div>
                  </div>

                  {/* Day Calendar Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                    {generatedOutfits.map((outfit, idx) => {
                      const selected = idx === selectedDayIdx;
                      return (
                        <button
                          key={`${outfit.dayIndex}-${idx}`}
                          type="button"
                          onClick={() => {
                            setSelectedDayIdx(idx);
                            setSwappingPieceId(null);
                          }}
                          className={`min-h-[44px] px-4 py-2 text-left border transition-colors shrink-0 ${
                            selected
                              ? 'bg-[#FFFFFF] border-[#FFFFFF] text-[#101010]'
                              : 'bg-white/5 border-white/15 text-white/80 hover:border-white/50'
                          }`}
                        >
                          <p className="font-mono text-[10px] flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            <span>DAY {idx + 1}</span>
                          </p>
                          <p className="text-xs font-bold whitespace-nowrap">{outfit.occasion}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ANIMATED OUTFIT COMPOSITION STAGE */}
                {activeOutfit && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${selectedDayIdx}-${activeOutfit.itemIds.join('-')}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="bg-[#FFFFFF] border border-[#101010]/15 p-6 space-y-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#101010]/10 pb-4">
                        <div className="space-y-1">
                          <p className="font-mono text-[11px] text-[#101010]/60">
                            DAY {selectedDayIdx + 1} · {activeOutfit.occasion} · {activeOutfit.weatherFit}
                          </p>
                          <h2 className="font-editorial text-3xl sm:text-4xl font-medium">
                            {activeOutfit.title}
                          </h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCycleAlternativeSwap}
                            className="min-h-[40px] px-3.5 border border-[#101010]/25 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#B8D9F2]/40 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Swap Piece</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCurrentOutfit}
                            className="min-h-[40px] px-4 bg-[#101010] text-[#FFFFFF] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#101010]/85 transition-colors"
                          >
                            <Heart className="w-3.5 h-3.5 text-[#FFC5A8]" />
                            <span>Save Look</span>
                          </button>
                        </div>
                      </div>

                      {/* Spatial Choreographed Piece Assembly (Click Any Piece to Replace!) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {activeOutfit.itemIds.map((id, pieceIdx) => {
                          const piece = wardrobeMap.get(id);
                          if (!piece) return null;
                          const photo = piece.photoId ? wardrobePhotos[piece.photoId] : undefined;
                          const isSwapping = swappingPieceId === id;
                          const wearCount = rewearStats.counts.get(id) || 1;
                          const vectors = [
                            { x: -24, y: -16 },
                            { x: 24, y: -12 },
                            { x: -18, y: 20 },
                            { x: 20, y: 18 },
                          ];
                          const v = vectors[pieceIdx % vectors.length];

                          return (
                            <motion.button
                              key={id}
                              type="button"
                              initial={{ opacity: 0, x: v.x, y: v.y, scale: 0.92 }}
                              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                              transition={{
                                duration: 0.45,
                                delay: pieceIdx * 0.08,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              onClick={() =>
                                setSwappingPieceId((curr) => (curr === id ? null : id))
                              }
                              className={`text-left border overflow-hidden transition-colors group ${
                                isSwapping
                                  ? 'border-[#101010] ring-2 ring-[#FFC5A8]'
                                  : 'border-[#101010]/15 hover:border-[#101010]'
                              }`}
                            >
                              <div className="aspect-[4/3] relative bg-[#B8D9F2]/30 overflow-hidden">
                                {photo ? (
                                  <img
                                    src={photo}
                                    alt={piece.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex flex-col items-center justify-center p-4"
                                    style={{ backgroundColor: '#D9C9F2' }}
                                  >
                                    <span
                                      className="w-10 h-10 border border-[#101010]/25 flex items-center justify-center mb-2"
                                      style={{ backgroundColor: piece.colorHex }}
                                    >
                                      <Shirt className="w-5 h-5 text-[#FFFFFF]" />
                                    </span>
                                    <span className="font-mono text-[10px] text-[#101010]/70">
                                      {piece.fabric || piece.style}
                                    </span>
                                  </div>
                                )}
                                <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#101010] text-[#FFC5A8] font-mono text-[9px]">
                                  {isSwapping ? 'REPLACING' : 'CLICK TO SWAP'}
                                </span>
                              </div>
                              <div className="p-3 bg-[#FFFFFF] space-y-0.5">
                                <p className="text-xs font-bold text-[#101010] truncate">
                                  {piece.name}
                                </p>
                                <p className="font-mono text-[10px] text-[#101010]/60">
                                  {piece.category} · {piece.colorName}
                                  {wearCount > 1 ? ` · Worn ${wearCount}×` : ''}
                                </p>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Inline Click-to-Replace Owned Closet Drawer */}
                      <AnimatePresence>
                        {swappingPiece && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden border border-[#101010] bg-[#B8D9F2]/40 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-mono text-[11px] font-bold">
                                REPLACE &ldquo;{swappingPiece.name}&rdquo; WITH ANOTHER OWNED {swappingPiece.category.toUpperCase()}
                              </p>
                              <button
                                type="button"
                                onClick={() => setSwappingPieceId(null)}
                                className="w-7 h-7 flex items-center justify-center hover:bg-[#101010] hover:text-[#FFFFFF]"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {swapCandidates.length === 0 ? (
                              <p className="text-xs text-[#101010]/75">
                                You currently have only this item in {swappingPiece.category}. Upload another {swappingPiece.category.toLowerCase()} photo on the left to swap here.
                              </p>
                            ) : (
                              <div className="flex gap-2.5 overflow-x-auto pb-1">
                                {swapCandidates.map((cand) => {
                                  const cPhoto = cand.photoId ? wardrobePhotos[cand.photoId] : undefined;
                                  return (
                                    <button
                                      key={cand.id}
                                      type="button"
                                      onClick={() =>
                                        handleReplacePieceInActiveOutfit(swappingPiece.id, cand.id)
                                      }
                                      className="shrink-0 w-36 bg-[#FFFFFF] border border-[#101010]/20 hover:border-[#101010] p-2 text-left space-y-1.5"
                                    >
                                      {cPhoto ? (
                                        <img
                                          src={cPhoto}
                                          alt={cand.name}
                                          className="w-full h-16 object-cover"
                                        />
                                      ) : (
                                        <div
                                          className="w-full h-16 flex items-center justify-center"
                                          style={{ backgroundColor: cand.colorHex }}
                                        >
                                          <Shirt className="w-4 h-4 text-[#FFFFFF]" />
                                        </div>
                                      )}
                                      <p className="text-[11px] font-bold truncate">{cand.name}</p>
                                      <p className="font-mono text-[9px] text-[#101010]/60">
                                        {cand.colorName}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Stylist Note + Sync Capsule Bar */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 border-t border-[#101010]/10 items-center">
                        <div className="md:col-span-7 space-y-1">
                          <p className="text-xs text-[#101010]/85 leading-relaxed">
                            <span className="font-bold">Why it works:</span> {activeOutfit.whyItWorks}
                          </p>
                          <p className="font-mono text-[11px] text-[#101010]/65">
                            Styling note: {activeOutfit.stylingTip}
                          </p>
                        </div>

                        <div className="md:col-span-5 flex flex-wrap md:justify-end gap-2">
                          {trips.length > 0 && (
                            <select
                              aria-label="Target trip for suitcase sync"
                              value={selectedTripId}
                              onChange={(e) => setSelectedTripId(e.target.value)}
                              className="min-h-[40px] px-2.5 border border-[#101010]/25 text-xs font-semibold bg-[#FFFFFF]"
                            >
                              {trips.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.title}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={handleSyncCapsuleToSuitcase}
                            className="min-h-[40px] px-4 bg-[#FFC5A8] text-[#101010] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#101010] hover:text-[#FFFFFF] transition-colors"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Sync to Suitcase</span>
                          </button>
                          {onOpenSmartPacking && (
                            <button
                              type="button"
                              onClick={onOpenSmartPacking}
                              className="min-h-[40px] px-3 border border-[#101010]/25 text-xs font-bold hover:bg-[#101010] hover:text-[#FFFFFF] transition-colors"
                            >
                              View 3D Bag
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Strategic Missing-Item Suggestions */}
                {missingPieces.length > 0 && (
                  <div className="bg-[#FFFFFF] border border-[#101010]/15 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-[10px] text-[#101010]/60">
                          STRATEGIC CAPSULE MULTIPLIERS
                        </p>
                        <h3 className="font-editorial text-2xl">
                          Single pieces that unlock new combinations
                        </h3>
                      </div>
                      <Sparkles className="w-5 h-5 text-[#101010]" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {missingPieces.map((mp) => (
                        <div
                          key={mp.name}
                          className="p-4 bg-[#B8D9F2]/30 border border-[#101010]/12 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-[#101010]">{mp.name}</p>
                              <span className="font-mono text-[10px] font-bold text-[#101010]">
                                +{mp.unlockedCombosCount} looks
                              </span>
                            </div>
                            <p className="font-mono text-[10px] text-[#101010]/60">
                              {mp.category} · {mp.colorSuggestion}
                            </p>
                            <p className="text-[11px] text-[#101010]/75 leading-snug">
                              {mp.impactSummary}
                            </p>
                          </div>
                          {activeTrip && (
                            <button
                              type="button"
                              onClick={() => {
                                const added = onAddMissingPieceToShopping(
                                  selectedTripId || activeTrip.id,
                                  mp
                                );
                                showNotice(
                                  added
                                    ? `Added "${mp.name}" to your trip shopping radar.`
                                    : `"${mp.name}" is already in your shopping radar.`
                                );
                              }}
                              className="self-start min-h-[34px] px-3 bg-[#101010] text-[#FFFFFF] text-[11px] font-bold inline-flex items-center gap-1.5 hover:bg-[#FFC5A8] hover:text-[#101010] transition-colors"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>Add to Shopping Radar</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saved Favorite Outfits Ribbon */}
            {savedOutfits.length > 0 && (
              <div className="bg-[#FFFFFF] border border-[#101010]/15 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] text-[#101010]/60 flex items-center gap-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>SAVED ARCHIVE LOOKS ({savedOutfits.length})</span>
                  </p>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {savedOutfits.slice(0, 6).map((look) => (
                    <div
                      key={look.id}
                      className="shrink-0 w-56 p-3.5 border border-[#101010]/15 bg-[#D9C9F2]/30 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold leading-snug">{look.name}</p>
                        <button
                          type="button"
                          onClick={() => onToggleFavoriteOutfit(look.id)}
                          aria-label="Toggle favorite look"
                          className="shrink-0"
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              look.isFavorite ? 'fill-[#101010] text-[#101010]' : 'text-[#101010]/40'
                            }`}
                          />
                        </button>
                      </div>
                      <p className="font-mono text-[10px] text-[#101010]/65">
                        {look.occasion} · {look.itemIds.length} pieces
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
