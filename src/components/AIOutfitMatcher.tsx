import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  BookmarkCheck,
  Calendar,
  Camera,
  Check,
  CloudSun,
  Heart,
  ImagePlus,
  Layers,
  Loader2,
  MapPin,
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
  AIMatchSession,
  AIMissingPieceSuggestion,
  DayOutfitPlan,
  OutfitCombination,
  PackingItem,
  PackingList,
  WardrobeCategory,
  WardrobeItem,
  WeatherReport,
} from '../types';
import { calculateTripDays } from '../utils/packingEngine';
import { compressImageFileToJpegDataUrl, uid } from '../utils/storage';

interface AIOutfitMatcherProps {
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
}

interface UploadScanJob {
  id: string;
  file: File;
  fileName: string;
  previewUrl: string;
  status: 'compressing' | 'analyzing' | 'done' | 'error';
  error?: string;
  errorCode?: string;
  detectedItem?: WardrobeItem;
}

const OCCASION_OPTIONS = [
  'City Exploring',
  'Evening Dinner',
  'Beach & Resort',
  'Business Meetings',
  'Travel Transit',
  'Outdoor Hike',
  'Formal Event',
  'Cafe & Casual',
];

const WEATHER_PRESETS = [
  'Warm & Sunny (26–32°C)',
  'Mild & Layered (16–23°C)',
  'Humid & Tropical (28–33°C, occasional rain)',
  'Rainy & Breezy (18–24°C)',
  'Cool & Crisp (8–15°C)',
  'Cold & Winter (0–8°C)',
];

function addDaysISO(baseISO: string, offsetDays: number): string {
  const base = new Date(baseISO);
  if (Number.isNaN(base.getTime())) return baseISO;
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface CollageTileProps {
  item: WardrobeItem;
  photoUrl?: string;
  tall?: boolean;
  extraCount?: number;
}

const CollageTile: React.FC<CollageTileProps> = ({ item, photoUrl, tall = false, extraCount = 0 }) => {
  return (
    <div
      className={`relative overflow-hidden border border-[#101010]/15 bg-[#B8D9F2]/35 group ${
        tall ? 'h-full min-h-[224px]' : 'h-[108px]'
      }`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center p-3 text-center"
          style={{ backgroundColor: '#D9C9F2' }}
        >
          <span
            className="w-9 h-9 border border-[#101010]/20 flex items-center justify-center mb-2"
            style={{ backgroundColor: item.colorHex }}
          >
            <Shirt className="w-4 h-4 text-[#FFFFFF]" />
          </span>
          <p className="text-[11px] font-bold text-[#101010] line-clamp-2 leading-tight">
            {item.name}
          </p>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 px-2.5 py-2 bg-gradient-to-t from-[#101010]/90 via-[#101010]/50 to-transparent flex items-end justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-[#FFFFFF] truncate leading-tight">
            {item.category}
          </p>
          <p className="text-[9px] text-[#FFFFFF]/80 truncate leading-tight">
            {item.colorName}
          </p>
        </div>
        {extraCount > 0 && (
          <span className="font-mono text-[10px] font-bold text-[#FFC5A8] shrink-0">
            +{extraCount}
          </span>
        )}
      </div>
    </div>
  );
};

interface OutfitCollageProps {
  pieces: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
}

const OutfitCollage: React.FC<OutfitCollageProps> = ({ pieces, wardrobePhotos }) => {
  if (pieces.length === 0) return null;

  const priorityOrder: Record<WardrobeCategory, number> = {
    Dresses: 0,
    Outerwear: 1,
    Tops: 2,
    Bottoms: 3,
    Footwear: 4,
    Accessories: 5,
  };
  const ordered = [...pieces].sort(
    (a, b) => (priorityOrder[a.category] ?? 9) - (priorityOrder[b.category] ?? 9)
  );

  if (ordered.length === 1) {
    const p = ordered[0];
    return (
      <div className="grid grid-cols-1">
        <CollageTile item={p} photoUrl={p.photoId ? wardrobePhotos[p.photoId] : undefined} tall />
      </div>
    );
  }

  if (ordered.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {ordered.map((p) => (
          <CollageTile
            key={p.id}
            item={p}
            photoUrl={p.photoId ? wardrobePhotos[p.photoId] : undefined}
            tall
          />
        ))}
      </div>
    );
  }

  if (ordered.length === 3) {
    const [hero, second, third] = ordered;
    return (
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-7">
          <CollageTile
            item={hero}
            photoUrl={hero.photoId ? wardrobePhotos[hero.photoId] : undefined}
            tall
          />
        </div>
        <div className="col-span-5 flex flex-col gap-2">
          <CollageTile
            item={second}
            photoUrl={second.photoId ? wardrobePhotos[second.photoId] : undefined}
          />
          <CollageTile
            item={third}
            photoUrl={third.photoId ? wardrobePhotos[third.photoId] : undefined}
          />
        </div>
      </div>
    );
  }

  const visible = ordered.slice(0, 4);
  const extra = Math.max(0, ordered.length - 4);
  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-6">
        <CollageTile
          item={visible[0]}
          photoUrl={visible[0].photoId ? wardrobePhotos[visible[0].photoId] : undefined}
          tall
        />
      </div>
      <div className="col-span-6 grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <CollageTile
            item={visible[1]}
            photoUrl={visible[1].photoId ? wardrobePhotos[visible[1].photoId] : undefined}
          />
        </div>
        <CollageTile
          item={visible[2]}
          photoUrl={visible[2].photoId ? wardrobePhotos[visible[2].photoId] : undefined}
        />
        <CollageTile
          item={visible[3]}
          photoUrl={visible[3].photoId ? wardrobePhotos[visible[3].photoId] : undefined}
          extraCount={extra}
        />
      </div>
    </div>
  );
};

export const AIOutfitMatcher: React.FC<AIOutfitMatcherProps> = ({
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
  onSaveWeather,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const photoWardrobeItems = useMemo(
    () => wardrobe.filter((item) => Boolean(item.photoId && wardrobePhotos[item.photoId])),
    [wardrobe, wardrobePhotos]
  );

  const [wardrobeScope, setWardrobeScope] = useState<'photos' | 'all'>(() =>
    photoWardrobeItems.length >= 2 ? 'photos' : 'all'
  );
  const [dragActive, setDragActive] = useState(false);
  const [scanJobs, setScanJobs] = useState<UploadScanJob[]>([]);

  const defaultTrip = useMemo(
    () => trips.find((t) => !t.completed) || trips[0] || null,
    [trips]
  );
  const [linkedTripId, setLinkedTripId] = useState<string>(defaultTrip?.id || 'custom');
  const [destination, setDestination] = useState<string>(defaultTrip?.destination || '');
  const [startDate, setStartDate] = useState<string>(
    defaultTrip?.startDate || new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    defaultTrip?.endDate || addDaysISO(new Date().toISOString().slice(0, 10), 3)
  );
  const [weatherSummary, setWeatherSummary] = useState<string>(() => {
    if (defaultTrip?.weather) {
      const w = defaultTrip.weather.summary;
      return `${w.primaryCondition}, ${w.avgLow}–${w.avgHigh}°C, ${w.maxRainChance}% rain chance`;
    }
    return WEATHER_PRESETS[1];
  });
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([
    'City Exploring',
    'Evening Dinner',
    'Travel Transit',
  ]);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFeedback, setWeatherFeedback] = useState('');

  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [session, setSession] = useState<AIMatchSession | null>(null);
  const [actionToast, setActionToast] = useState('');
  const [addedMissingNames, setAddedMissingNames] = useState<Record<string, boolean>>({});

  const linkedTrip = useMemo(
    () => (linkedTripId === 'custom' ? null : trips.find((t) => t.id === linkedTripId) || null),
    [trips, linkedTripId]
  );

  useEffect(() => {
    if (!linkedTrip) return;
    setDestination(linkedTrip.destination || linkedTrip.title);
    setStartDate(linkedTrip.startDate);
    setEndDate(linkedTrip.endDate);
    if (linkedTrip.weather) {
      const s = linkedTrip.weather.summary;
      setWeatherSummary(
        `${s.primaryCondition}, ${s.avgLow}–${s.avgHigh}°C, ${s.maxRainChance}% rain chance (${linkedTrip.weather.shortLocation})`
      );
    } else if (linkedTrip.weatherPreference && linkedTrip.weatherPreference !== 'Auto (Live Weather)') {
      setWeatherSummary(linkedTrip.weatherPreference);
    }
  }, [linkedTrip?.id]);

  // Switch automatically to uploaded photos once user uploads at least 2 real garments
  useEffect(() => {
    if (photoWardrobeItems.length >= 2) {
      setWardrobeScope('photos');
    }
  }, [photoWardrobeItems.length]);

  const durationDays = useMemo(() => {
    const raw = calculateTripDays(startDate, endDate);
    return Math.max(1, Math.min(10, raw));
  }, [startDate, endDate]);

  const activeSourceItems = useMemo(
    () => (wardrobeScope === 'photos' ? photoWardrobeItems : wardrobe),
    [wardrobeScope, photoWardrobeItems, wardrobe]
  );

  const photoCategoryCounts = useMemo(() => {
    const map: Partial<Record<WardrobeCategory, number>> = {};
    photoWardrobeItems.forEach((item) => {
      map[item.category] = (map[item.category] || 0) + 1;
    });
    return map;
  }, [photoWardrobeItems]);

  const showToast = (msg: string) => {
    setActionToast(msg);
    window.setTimeout(() => setActionToast(''), 4200);
  };

  const processSingleUpload = async (jobId: string, file: File) => {
    setScanJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, status: 'compressing', error: undefined, errorCode: undefined } : j
      )
    );

    if (!isOnline) {
      setScanJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'error',
                error: 'You are currently offline. Reconnect to analyze clothing photos with AI Vision.',
              }
            : j
        )
      );
      return;
    }

    try {
      const { dataUrl, base64, mimeType } = await compressImageFileToJpegDataUrl(file, 768);
      setScanJobs((prev) =>
        prev.map((j) => {
          if (j.id !== jobId) return j;
          if (j.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(j.previewUrl);
          }
          return { ...j, previewUrl: dataUrl, status: 'analyzing' };
        })
      );

      const res = await fetch('/api/ai/analyze-clothing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          fileName: file.name,
        }),
      });

      const payload = (await res.json()) as {
        error?: string;
        code?: string;
        detected?: {
          name: string;
          category: WardrobeCategory;
          colorName: string;
          colorHex: string;
          secondaryColors: string[];
          pattern: string;
          style: string;
          fabric: string;
          warmth: WardrobeItem['warmth'];
          occasions: string[];
          estimatedWeightGrams: number;
          estimatedVolumeLiters: number;
          stylingNote: string;
        };
      };

      if (!res.ok || !payload.detected) {
        setScanJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: 'error',
                  errorCode: payload.code,
                  error:
                    payload.error ||
                    'Could not identify a clothing item in this photo. Try a clear, well-lit garment photo.',
                }
              : j
          )
        );
        return;
      }

      const d = payload.detected;
      const photoId = uid('wphoto');
      await onSaveWardrobePhoto(photoId, dataUrl);

      const newItem: WardrobeItem = {
        id: uid('w'),
        name: d.name,
        category: d.category,
        colorName: d.colorName,
        colorHex: d.colorHex,
        secondaryColors: d.secondaryColors,
        pattern: d.pattern,
        style: d.style,
        fabric: d.fabric,
        warmth: d.warmth,
        activities: d.occasions.length > 0 ? d.occasions : ['Travel', 'Casual'],
        weightGrams: d.estimatedWeightGrams,
        volumeLiters: d.estimatedVolumeLiters,
        reusableDays:
          d.category === 'Footwear' || d.category === 'Outerwear' ? 6 : d.category === 'Bottoms' ? 3 : 2,
        notes: d.stylingNote,
        photoId,
        aiDetected: true,
      };

      onAddWardrobeItem(newItem);

      setScanJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: 'done', detectedItem: newItem } : j))
      );
    } catch (err) {
      setScanJobs((prev) =>
        prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                status: 'error',
                error:
                  err instanceof Error
                    ? err.message
                    : 'Upload failed. Please retry with a JPG, PNG, or WebP photo.',
              }
            : j
        )
      );
    }
  };

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 12);
    if (files.length === 0) return;

    const jobs: UploadScanJob[] = files.map((file) => ({
      id: uid('scan'),
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      status: 'compressing',
    }));

    setScanJobs((prev) => [...jobs, ...prev].slice(0, 16));

    const queue = [...jobs];
    const worker = async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next) {
          await processSingleUpload(next.id, next.file);
        }
      }
    };
    await Promise.all([worker(), worker()]);
  };

  const handleFetchLiveWeather = async () => {
    const queryCity = destination.trim();
    if (!queryCity) {
      setWeatherFeedback('Enter a destination city first to fetch live weather.');
      return;
    }
    if (!isOnline) {
      setWeatherFeedback('Live weather needs an active internet connection.');
      return;
    }

    setWeatherLoading(true);
    setWeatherFeedback('');
    try {
      const params = new URLSearchParams({
        city: queryCity,
        startDate,
        endDate,
      });
      const res = await fetch(`/api/weather?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setWeatherFeedback(data.error || 'Could not fetch weather for that destination.');
        return;
      }
      const report = data as WeatherReport;
      const s = report.summary;
      setWeatherSummary(
        `${s.primaryCondition}, ${s.avgLow}–${s.avgHigh}°C, ${s.maxRainChance}% rain (${report.shortLocation})`
      );
      setWeatherFeedback(report.note);
      if (linkedTrip && onSaveWeather) {
        onSaveWeather(linkedTrip.id, report);
      }
    } catch {
      setWeatherFeedback('Could not reach live weather right now.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleToggleOccasion = (occ: string) => {
    setSelectedOccasions((prev) => {
      if (prev.includes(occ)) {
        return prev.length > 1 ? prev.filter((o) => o !== occ) : prev;
      }
      return [...prev, occ];
    });
  };

  const handleGenerateMatches = async () => {
    setMatchError('');
    if (!isOnline) {
      setMatchError('You are offline. Reconnect to generate AI outfit combinations.');
      return;
    }
    if (activeSourceItems.length < 2) {
      setMatchError(
        wardrobeScope === 'photos'
          ? 'Upload at least 2 photos of your clothes first (or switch to Full Closet).'
          : 'Add at least 2 clothing pieces to your digital wardrobe first.'
      );
      return;
    }

    setIsMatching(true);
    try {
      const res = await fetch('/api/ai/match-outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim() || 'Upcoming Trip',
          startDate,
          endDate,
          durationDays,
          weatherSummary,
          occasions: selectedOccasions,
          wardrobeItems: activeSourceItems.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            colorName: item.colorName,
            pattern: item.pattern,
            style: item.style,
            fabric: item.fabric,
            warmth: item.warmth,
            occasions: item.activities,
          })),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        capsuleSummary?: string;
        outfits?: Array<Omit<AIMatchedOutfit, 'id' | 'date'>>;
        missingPieces?: AIMissingPieceSuggestion[];
        stats?: {
          totalOutfits: number;
          uniquePiecesUsed: number;
          reusedPiecesCount: number;
        };
      };

      if (!res.ok || !Array.isArray(data.outfits) || data.outfits.length === 0) {
        setMatchError(
          data.error ||
            'AI Outfit Matcher could not build combinations right now. Please try again.'
        );
        return;
      }

      const outfitsWithMeta: AIMatchedOutfit[] = data.outfits.map((o, idx) => ({
        ...o,
        id: uid('aimatch'),
        dayIndex: idx + 1,
        date: addDaysISO(startDate, idx),
      }));

      setSession({
        generatedAt: new Date().toISOString(),
        destination: destination.trim() || 'Upcoming Trip',
        startDate,
        endDate,
        durationDays: outfitsWithMeta.length,
        weatherSummary,
        occasions: selectedOccasions,
        capsuleSummary: data.capsuleSummary || '',
        outfits: outfitsWithMeta,
        missingPieces: Array.isArray(data.missingPieces) ? data.missingPieces : [],
        stats: data.stats || {
          totalOutfits: outfitsWithMeta.length,
          uniquePiecesUsed: new Set(outfitsWithMeta.flatMap((o) => o.itemIds)).size,
          reusedPiecesCount: 0,
        },
      });
      setAddedMissingNames({});
    } catch {
      setMatchError('Network error while connecting to AI Outfit Matcher. Please try again.');
    } finally {
      setIsMatching(false);
    }
  };

  const pieceReuseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!session) return counts;
    session.outfits.forEach((o) =>
      o.itemIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1))
    );
    return counts;
  }, [session]);

  const findMatchingSavedOutfit = (outfit: AIMatchedOutfit): OutfitCombination | undefined => {
    const sig = [...outfit.itemIds].sort().join('|');
    return savedOutfits.find(
      (s) => [...s.itemIds].sort().join('|') === sig && s.name === outfit.title
    );
  };

  const handleToggleSaveAIOutfit = (outfit: AIMatchedOutfit) => {
    const existing = findMatchingSavedOutfit(outfit);
    if (existing) {
      onToggleFavoriteOutfit(existing.id);
      showToast(
        existing.isFavorite
          ? `Removed "${outfit.title}" from favourites.`
          : `Marked "${outfit.title}" as a favourite.`
      );
      return;
    }

    onSaveOutfit({
      id: uid('outfit'),
      name: outfit.title,
      itemIds: outfit.itemIds,
      occasion: outfit.occasion,
      weatherFit: outfit.weatherFit,
      whyItWorks: outfit.whyItWorks,
      stylingTip: outfit.stylingTip,
      aiGenerated: true,
      isFavorite: true,
      createdAt: new Date().toISOString(),
    });
    showToast(`Saved "${outfit.title}" to your Favourite Outfits.`);
  };

  const handleApplyToTripPlanner = () => {
    if (!session || !linkedTrip) return;
    const plans: DayOutfitPlan[] = session.outfits.map((o, idx) => ({
      dayIndex: idx + 1,
      date: o.date || addDaysISO(linkedTrip.startDate, idx),
      label: `Day ${idx + 1}`,
      outfitName: o.title,
      itemIds: o.itemIds,
      activity: o.occasion,
      whyItWorks: o.whyItWorks,
    }));
    onUpdateTripDayOutfits(linkedTrip.id, plans);
    showToast(`Applied ${plans.length}-day AI lookbook to "${linkedTrip.title}".`);
  };

  const handleSyncCapsuleToSuitcase = () => {
    if (!session || !linkedTrip) return;
    const uniqueIds = Array.from(new Set(session.outfits.flatMap((o) => o.itemIds)));
    const items: PackingItem[] = uniqueIds
      .map((id, idx) => {
        const w = wardrobe.find((item) => item.id === id);
        if (!w) return null;
        return {
          id: uid('ward-ai'),
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
          priority: 'Essential' as const,
          essential: true,
          aiRecommended: true,
          notes: `AI Outfit Matcher capsule for ${session.destination}`,
          order: 100 + idx,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const added = onSyncWardrobeToTrip(linkedTrip.id, items);
    showToast(
      added > 0
        ? `Packed ${added} capsule piece${added === 1 ? '' : 's'} into "${linkedTrip.title}".`
        : `All ${items.length} capsule pieces are already in "${linkedTrip.title}".`
    );
  };

  const handleAddMissingPiece = (suggestion: AIMissingPieceSuggestion) => {
    if (!linkedTrip) return;
    const added = onAddMissingPieceToShopping(linkedTrip.id, suggestion);
    setAddedMissingNames((prev) => ({ ...prev, [suggestion.name]: true }));
    showToast(
      added
        ? `Added "${suggestion.name}" to ${linkedTrip.title} Shopping Radar.`
        : `"${suggestion.name}" is already on ${linkedTrip.title} Shopping Radar.`
    );
  };

  const activeScansCount = scanJobs.filter(
    (j) => j.status === 'compressing' || j.status === 'analyzing'
  ).length;

  return (
    <div className="space-y-6 text-[#101010]">
      {!aiConfigured && (
        <div
          role="alert"
          className="p-4 bg-[#FFC5A8] border border-[#101010] text-xs text-[#101010] flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>AI Vision &amp; Stylist Model Offline:</strong> Configure{' '}
            <code className="font-mono font-semibold">GEMINI_API_KEY</code> in Settings &gt; Secrets to enable live photo scanning and AI outfit curation. PackSmart never generates fake AI results.
          </p>
        </div>
      )}

      {actionToast && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-[#101010] text-[#FFFFFF] text-xs font-semibold flex items-center gap-2.5"
        >
          <Check className="w-4 h-4 text-[#FFC5A8] shrink-0" />
          <span>{actionToast}</span>
        </motion.div>
      )}

      {/* ==================== STEP 1: MULTI-PHOTO CLOTHING UPLOAD STUDIO ==================== */}
      <section className="bg-[#FFFFFF] border border-[#101010]/15 p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#101010]/10 pb-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.14em] text-[#101010]/60">
              STEP 01 · DIGITIZE YOUR CLOSET
            </p>
            <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[#101010] mt-1">
              Upload Your Clothing Photos
            </h3>
            <p className="text-xs text-[#101010]/70 mt-1">
              Upload tops, bottoms, dresses, shoes, jackets, or accessories. AI Vision detects category, color, pattern, fabric, and warmth.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-cursor="UPLOAD"
            className="min-h-[44px] px-5 bg-[#101010] text-[#FFFFFF] text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 hover:bg-[#101010]/85 transition-colors"
          >
            <Camera className="w-4 h-4 text-[#FFC5A8]" />
            <span>Upload Photos</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              void handleFilesSelected(e.target.files);
              e.target.value = '';
            }
          }}
        />

        {/* Editorial Drag-and-Drop Zone */}
        <motion.div
          role="button"
          tabIndex={0}
          whileTap={{ scale: 0.995 }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              void handleFilesSelected(e.dataTransfer.files);
            }
          }}
          className={`border border-dashed p-7 text-center transition-colors cursor-pointer ${
            dragActive
              ? 'border-[#101010] bg-[#FFC5A8]/45'
              : 'border-[#101010]/35 bg-[#B8D9F2]/25 hover:bg-[#B8D9F2]/40'
          }`}
        >
          <div className="w-12 h-12 bg-[#101010] text-[#FFFFFF] flex items-center justify-center mx-auto mb-3">
            {activeScansCount > 0 ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#FFC5A8]" />
            ) : (
              <ImagePlus className="w-5 h-5 text-[#B8D9F2]" />
            )}
          </div>
          <p className="text-sm font-bold text-[#101010]">
            {activeScansCount > 0
              ? `Scanning ${activeScansCount} garment photo${activeScansCount === 1 ? '' : 's'} with AI Vision...`
              : 'Drop multiple garment photos here or click to browse'}
          </p>
          <p className="text-xs text-[#101010]/65 mt-1">
            JPG, PNG, or WebP · Stored privately on your device · Real Gemini Vision recognition
          </p>
        </motion.div>

        {/* Live Vision Upload Queue */}
        {scanJobs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-[#101010]/70">
                Vision Scan Queue ({scanJobs.length})
              </p>
              <button
                type="button"
                onClick={() => setScanJobs([])}
                className="text-xs font-semibold text-[#101010]/65 hover:text-[#101010] min-h-[34px] px-2"
              >
                Clear log
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scanJobs.map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border p-3.5 flex items-start gap-3 ${
                    job.status === 'error'
                      ? 'bg-[#FFC5A8]/45 border-[#101010]'
                      : job.status === 'done'
                      ? 'bg-[#B8D9F2]/25 border-[#101010]/20'
                      : 'bg-[#D9C9F2]/40 border-[#101010]/30'
                  }`}
                >
                  <img
                    src={job.previewUrl}
                    alt={job.fileName}
                    className="w-16 h-20 object-cover border border-[#101010]/15 shrink-0 bg-[#FFFFFF]"
                  />
                  <div className="flex-1 min-w-0">
                    {job.status === 'compressing' || job.status === 'analyzing' ? (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-xs font-bold text-[#101010] flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          <span>
                            {job.status === 'compressing'
                              ? 'Optimizing photo...'
                              : 'AI Vision identifying garment...'}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#101010]/65 truncate">{job.fileName}</p>
                      </div>
                    ) : job.status === 'done' && job.detectedItem ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#101010] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>Added to Wardrobe</span>
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setScanJobs((prev) => prev.filter((j) => j.id !== job.id))
                            }
                            aria-label="Dismiss scan card"
                            className="text-[#101010]/60 hover:text-[#101010] p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-sm font-bold text-[#101010] truncate">
                          {job.detectedItem.name}
                        </p>
                        <p className="text-[11px] text-[#101010]/75 flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-block w-2.5 h-2.5 border border-[#101010]/30 shrink-0"
                            style={{ backgroundColor: job.detectedItem.colorHex }}
                          />
                          <span>
                            {job.detectedItem.colorName} · {job.detectedItem.category} ·{' '}
                            {job.detectedItem.pattern || 'Solid'} · {job.detectedItem.style || 'Casual'}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs font-bold text-[#101010] flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {job.errorCode === 'NOT_CLOTHING'
                              ? 'Not recognized as clothing'
                              : 'Scan unsuccessful'}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#101010]/80 leading-snug">{job.error}</p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => void processSingleUpload(job.id, job.file)}
                            className="min-h-[32px] px-3 bg-[#101010] text-[#FFFFFF] text-[11px] font-semibold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setScanJobs((prev) => prev.filter((j) => j.id !== job.id))
                            }
                            className="min-h-[32px] px-2 text-[11px] font-semibold text-[#101010]/70"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Wardrobe Source Selector & Uploaded Photo Grid */}
        <div className="pt-4 border-t border-[#101010]/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#101010]">Wardrobe Source for AI Matching</p>
              <p className="text-[11px] text-[#101010]/65">
                {photoWardrobeItems.length > 0
                  ? Object.entries(photoCategoryCounts)
                      .map(([cat, count]) => `${count} ${cat}`)
                      .join(' · ')
                  : 'Upload photos of your garments above, or match using your digital closet.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-[#101010]/10 shrink-0">
              <button
                type="button"
                onClick={() => setWardrobeScope('photos')}
                className={`min-h-[36px] px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  wardrobeScope === 'photos'
                    ? 'bg-[#101010] text-[#FFFFFF]'
                    : 'text-[#101010]/75 hover:text-[#101010]'
                }`}
              >
                My Photos ({photoWardrobeItems.length})
              </button>
              <button
                type="button"
                onClick={() => setWardrobeScope('all')}
                className={`min-h-[36px] px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  wardrobeScope === 'all'
                    ? 'bg-[#101010] text-[#FFFFFF]'
                    : 'text-[#101010]/75 hover:text-[#101010]'
                }`}
              >
                Full Closet ({wardrobe.length})
              </button>
            </div>
          </div>

          {photoWardrobeItems.length === 0 ? (
            <div className="bg-[#D9C9F2]/35 border border-[#101010]/15 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#101010]">No uploaded garment photos yet</p>
                <p className="text-xs text-[#101010]/75">
                  Upload 2+ photos of your clothes so AI Vision can scan them—or use{' '}
                  <strong>Full Closet ({wardrobe.length})</strong> right away.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[42px] px-4 bg-[#101010] text-[#FFFFFF] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <Upload className="w-3.5 h-3.5 text-[#FFC5A8]" />
                <span>Add First Photos</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {photoWardrobeItems.map((item) => {
                const photoUrl = item.photoId ? wardrobePhotos[item.photoId] : undefined;
                return (
                  <div
                    key={item.id}
                    className="group bg-[#FFFFFF] border border-[#101010]/15 flex flex-col overflow-hidden"
                  >
                    <div className="relative aspect-[4/5] bg-[#B8D9F2]/30 overflow-hidden">
                      {photoUrl && (
                        <img
                          src={photoUrl}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteWardrobeItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="absolute top-2 right-2 w-8 h-8 bg-[#101010]/80 text-[#FFFFFF] flex items-center justify-center hover:bg-[#101010]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 bg-[#101010]/80 text-[10px] font-mono text-[#FFFFFF] flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 border border-[#FFFFFF]/50 shrink-0"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        <span className="truncate">
                          {item.category} · {item.warmth}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 space-y-0.5">
                      <p className="text-xs font-bold text-[#101010] truncate">{item.name}</p>
                      <p className="text-[10px] text-[#101010]/65 truncate">
                        {item.colorName}
                        {item.pattern ? ` · ${item.pattern}` : ''}
                        {item.style ? ` · ${item.style}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ==================== STEP 2: TRIP, WEATHER & OCCASION CURATOR ==================== */}
      <section className="bg-[#FFFFFF] border border-[#101010]/15 p-5 sm:p-7 space-y-5">
        <div className="border-b border-[#101010]/10 pb-4">
          <p className="font-mono text-[11px] tracking-[0.14em] text-[#101010]/60">
            STEP 02 · TRIP BRIEF &amp; CLIMATE
          </p>
          <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[#101010] mt-1">
            Set Destination, Weather &amp; Occasions
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
          <div className="lg:col-span-4">
            <label
              htmlFor="matcher-trip-link"
              className="block font-mono text-[11px] text-[#101010]/65 mb-1.5"
            >
              Link PackSmart Trip
            </label>
            <select
              id="matcher-trip-link"
              value={linkedTripId}
              onChange={(e) => setLinkedTripId(e.target.value)}
              className="w-full min-h-[44px] px-3 bg-[#FFFFFF] border border-[#101010]/25 text-sm font-semibold text-[#101010]"
            >
              <option value="custom">Custom Trip Brief</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.destination || t.tripType})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4">
            <label
              htmlFor="matcher-dest"
              className="block font-mono text-[11px] text-[#101010]/65 mb-1.5"
            >
              Destination
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#101010]/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="matcher-dest"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Kyoto, Paris, Amalfi"
                className="w-full min-h-[44px] pl-9 pr-3 bg-[#FFFFFF] border border-[#101010]/25 text-sm text-[#101010]"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="matcher-start"
              className="block font-mono text-[11px] text-[#101010]/65 mb-1.5"
            >
              Start Date
            </label>
            <input
              id="matcher-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                setStartDate(nextStart);
                if (endDate < nextStart) setEndDate(addDaysISO(nextStart, 2));
              }}
              className="w-full min-h-[44px] px-2.5 bg-[#FFFFFF] border border-[#101010]/25 text-xs font-mono text-[#101010]"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="matcher-end"
              className="block font-mono text-[11px] text-[#101010]/65 mb-1.5"
            >
              End Date ({durationDays}d)
            </label>
            <input
              id="matcher-end"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full min-h-[44px] px-2.5 bg-[#FFFFFF] border border-[#101010]/25 text-xs font-mono text-[#101010]"
            />
          </div>
        </div>

        {/* Live Open-Meteo Weather Fetch */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-8">
            <label
              htmlFor="matcher-weather"
              className="block font-mono text-[11px] text-[#101010]/65 mb-1.5"
            >
              Weather Conditions
            </label>
            <select
              id="matcher-weather"
              value={WEATHER_PRESETS.includes(weatherSummary) ? weatherSummary : '__custom'}
              onChange={(e) => {
                if (e.target.value !== '__custom') {
                  setWeatherSummary(e.target.value);
                  setWeatherFeedback('');
                }
              }}
              className="w-full min-h-[44px] px-3 bg-[#FFFFFF] border border-[#101010]/25 text-sm text-[#101010]"
            >
              {!WEATHER_PRESETS.includes(weatherSummary) && (
                <option value="__custom">Live Forecast: {weatherSummary}</option>
              )}
              {WEATHER_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void handleFetchLiveWeather()}
            disabled={weatherLoading || !destination.trim() || !isOnline}
            className="sm:col-span-4 min-h-[44px] px-4 bg-[#B8D9F2] text-[#101010] border border-[#101010]/25 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 hover:bg-[#B8D9F2]/80 transition-colors"
          >
            {weatherLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudSun className="w-4 h-4" />
            )}
            <span>Fetch Live Forecast</span>
          </button>
        </div>

        {weatherFeedback && (
          <p className="font-mono text-[11px] text-[#101010]/75">{weatherFeedback}</p>
        )}

        {/* Occasions */}
        <div>
          <p className="font-mono text-[11px] text-[#101010]/65 mb-2">
            Occasions ({selectedOccasions.length} selected)
          </p>
          <div className="flex flex-wrap gap-2">
            {OCCASION_OPTIONS.map((occ) => {
              const active = selectedOccasions.includes(occ);
              return (
                <button
                  key={occ}
                  type="button"
                  onClick={() => handleToggleOccasion(occ)}
                  className={`min-h-[38px] px-3.5 text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-[#101010] border-[#101010] text-[#FFFFFF]'
                      : 'bg-[#FFFFFF] border-[#101010]/25 text-[#101010]/80 hover:border-[#101010]'
                  }`}
                >
                  {occ}
                </button>
              );
            })}
          </div>
        </div>

        {matchError && (
          <div
            role="alert"
            className="p-4 bg-[#FFC5A8] border border-[#101010] text-xs text-[#101010] flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{matchError}</span>
          </div>
        )}

        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#101010]/10">
          <p className="text-xs text-[#101010]/75">
            Matching strictly from{' '}
            <strong className="text-[#101010]">
              {activeSourceItems.length}{' '}
              {wardrobeScope === 'photos' ? 'uploaded photo piece' : 'owned closet piece'}
              {activeSourceItems.length === 1 ? '' : 's'}
            </strong>{' '}
            across {durationDays} non-repeating days.
          </p>

          <button
            type="button"
            onClick={() => void handleGenerateMatches()}
            disabled={isMatching || activeSourceItems.length < 2 || !isOnline}
            data-cursor="STYLE"
            className="min-h-[48px] px-6 bg-[#101010] text-[#FFFFFF] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-45 hover:bg-[#101010]/85 transition-colors whitespace-nowrap shrink-0"
          >
            {isMatching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#FFC5A8]" />
                <span>Curating Lookbook...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-[#FFC5A8]" />
                <span>Generate AI Outfits</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* ==================== EDITORIAL LOADING STATE ==================== */}
      {isMatching && (
        <section className="bg-[#101010] text-[#FFFFFF] p-10 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#FFC5A8] mx-auto" />
          <h3 className="font-editorial text-2xl font-medium">
            Styling {durationDays} distinct looks from your wardrobe...
          </h3>
          <p className="text-xs text-[#FFFFFF]/70 max-w-md mx-auto">
            Balancing color harmony, {weatherSummary.toLowerCase()}, zero repeated combinations, and capsule reuse.
          </p>
        </section>
      )}

      {/* ==================== STEP 3: EDITORIAL LOOKBOOK RESULTS ==================== */}
      {session && !isMatching && (
        <div className="space-y-6">
          <section className="bg-[#101010] text-[#FFFFFF] p-6 sm:p-7 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2">
                <p className="font-mono text-xs text-[#FFC5A8] flex items-center gap-1.5 flex-wrap">
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {session.destination} · {session.stats.totalOutfits} Unique Outfits ·{' '}
                    {session.stats.uniquePiecesUsed} Owned Pieces · {session.stats.reusedPiecesCount}{' '}
                    Reused Staples
                  </span>
                </p>
                <h3 className="font-editorial text-3xl sm:text-4xl font-normal">
                  Your Curated Daily Lookbook
                </h3>
                {session.capsuleSummary && (
                  <p className="text-xs sm:text-sm text-[#FFFFFF]/75 leading-relaxed max-w-3xl">
                    {session.capsuleSummary}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {linkedTrip && (
                  <>
                    <button
                      type="button"
                      onClick={handleApplyToTripPlanner}
                      className="min-h-[42px] px-4 bg-[#FFC5A8] text-[#101010] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-[#FFFFFF] transition-colors"
                    >
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>Apply to {linkedTrip.title}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSyncCapsuleToSuitcase}
                      className="min-h-[42px] px-4 bg-[#B8D9F2] text-[#101010] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-[#FFFFFF] transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Pack Capsule</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void handleGenerateMatches()}
                  className="min-h-[42px] px-4 border border-[#FFFFFF]/30 text-[#FFFFFF] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#FFFFFF]/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Remix</span>
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {session.outfits.map((outfit) => {
              const pieces = outfit.itemIds
                .map((id) => wardrobe.find((w) => w.id === id))
                .filter((x): x is WardrobeItem => Boolean(x));
              const savedMatch = findMatchingSavedOutfit(outfit);
              const isFavorited = Boolean(savedMatch?.isFavorite);

              return (
                <motion.article
                  key={outfit.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#FFFFFF] border border-[#101010]/15 p-5 sm:p-6 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] text-[#101010]/65 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Day {outfit.dayIndex}
                            {outfit.date ? ` · ${formatShortDate(outfit.date)}` : ''} · {outfit.occasion}
                          </span>
                        </p>
                        <h4 className="font-editorial text-2xl font-medium text-[#101010] mt-1 leading-tight">
                          {outfit.title}
                        </h4>
                        <p className="text-[11px] text-[#101010]/60 mt-0.5">
                          Weather fit: {outfit.weatherFit}
                        </p>
                      </div>

                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.94 }}
                        onClick={() => handleToggleSaveAIOutfit(outfit)}
                        aria-label={isFavorited ? 'Remove from favourite outfits' : 'Save to favourite outfits'}
                        className={`min-h-[42px] px-3.5 border text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
                          isFavorited
                            ? 'bg-[#FFC5A8] border-[#101010] text-[#101010]'
                            : 'bg-[#FFFFFF] border-[#101010]/25 text-[#101010] hover:border-[#101010]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                        <span>{isFavorited ? 'Saved' : 'Save'}</span>
                      </motion.button>
                    </div>

                    <OutfitCollage pieces={pieces} wardrobePhotos={wardrobePhotos} />

                    <div className="p-4 bg-[#B8D9F2]/30 border border-[#101010]/10 space-y-1.5">
                      <p className="text-xs text-[#101010] leading-relaxed">
                        <strong>Why it works: </strong>
                        {outfit.whyItWorks}
                      </p>
                      {outfit.stylingTip && (
                        <p className="text-[11px] text-[#101010]/75 leading-relaxed">
                          <strong>Stylist note: </strong>
                          {outfit.stylingTip}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#101010]/55">
                        Owned Pieces Used ({pieces.length})
                      </p>
                      <div className="divide-y divide-[#101010]/10">
                        {pieces.map((piece) => {
                          const uses = pieceReuseCounts.get(piece.id) || 1;
                          const thumb = piece.photoId ? wardrobePhotos[piece.photoId] : undefined;
                          return (
                            <div
                              key={piece.id}
                              className="py-2 flex items-center justify-between gap-2.5"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {thumb ? (
                                  <img
                                    src={thumb}
                                    alt={piece.name}
                                    className="w-9 h-9 object-cover border border-[#101010]/15 shrink-0"
                                  />
                                ) : (
                                  <span
                                    className="w-9 h-9 border border-[#101010]/20 flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: piece.colorHex }}
                                  >
                                    <Shirt className="w-4 h-4 text-[#FFFFFF]" />
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#101010] truncate">
                                    {piece.name}
                                  </p>
                                  <p className="text-[11px] text-[#101010]/65 truncate">
                                    {piece.category} · {piece.colorName}
                                    {piece.pattern ? ` · ${piece.pattern}` : ''}
                                  </p>
                                </div>
                              </div>

                              <span className="font-mono text-[11px] font-semibold text-[#101010] shrink-0 tabular-nums">
                                {uses > 1 ? `Reused ${uses}×` : `${piece.volumeLiters}L`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>

          {session.missingPieces.length > 0 && (
            <section className="bg-[#FFFFFF] border border-[#101010]/15 p-5 sm:p-7 space-y-4">
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-[#101010]/60">
                  CAPSULE UPGRADE RADAR
                </p>
                <h3 className="font-editorial text-2xl sm:text-3xl font-medium text-[#101010] mt-1">
                  Missing Pieces That Expand Your Lookbook
                </h3>
                <p className="text-xs text-[#101010]/70 mt-1">
                  Every outfit above uses strictly what you own. Adding any single piece below creates multiple extra combinations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {session.missingPieces.map((piece) => {
                  const alreadyAdded = Boolean(addedMissingNames[piece.name]);
                  return (
                    <div
                      key={piece.name}
                      className="bg-[#FFC5A8]/30 border border-[#101010]/15 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] text-[#101010]/65">
                              {piece.category} · {piece.colorSuggestion}
                            </p>
                            <h4 className="font-display text-sm font-bold text-[#101010] mt-0.5">
                              {piece.name}
                            </h4>
                          </div>
                          <span className="font-mono text-xs font-bold text-[#101010] shrink-0 tabular-nums">
                            +{piece.unlockedCombosCount} looks
                          </span>
                        </div>
                        <p className="text-xs text-[#101010]/75 leading-relaxed">
                          {piece.impactSummary}
                        </p>
                      </div>

                      {linkedTrip && (
                        <button
                          type="button"
                          onClick={() => handleAddMissingPiece(piece)}
                          disabled={alreadyAdded}
                          className={`min-h-[40px] px-4 text-xs font-bold flex items-center justify-center gap-1.5 self-start transition-colors ${
                            alreadyAdded
                              ? 'bg-[#B8D9F2] text-[#101010]'
                              : 'bg-[#101010] text-[#FFFFFF] hover:bg-[#101010]/85'
                          }`}
                        >
                          {alreadyAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Shopping Radar</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3.5 h-3.5 text-[#FFC5A8]" />
                              <span>Add to {linkedTrip.title} Shopping</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
