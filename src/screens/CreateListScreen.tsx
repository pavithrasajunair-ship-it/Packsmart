import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Calendar,
  Check,
  CloudRain,
  CloudSun,
  Loader2,
  Luggage,
  MapPin,
  Shirt,
  Sparkles,
  Users,
} from 'lucide-react';
import type {
  AccommodationType,
  LuggageType,
  PackingItem,
  PackingList,
  PackingMode,
  PackingPreference,
  PersonalEssential,
  TravelMethod,
  TripType,
  UserAccount,
  WardrobeItem,
  WeatherPreference,
  WeatherReport,
} from '../types';
import { LUGGAGE_PRESETS } from '../types';
import {
  calculateSmartClothingQuantities,
  calculateTripDays,
  createDefaultBeforeLeaveTasks,
  estimateItemVolumeLiters,
  generateCapsuleOutfitPlan,
  generateSmartPackingItems,
  generateSmartTimeline,
  type MemoryLearningInsights,
} from '../utils/packingEngine';
import { ASSETS } from '../data/templates';
import { uid } from '../utils/storage';

interface CreateListScreenProps {
  initialMode?: PackingMode;
  user: UserAccount;
  wardrobe: WardrobeItem[];
  personalEssentials: PersonalEssential[];
  memoryInsights: MemoryLearningInsights;
  defaultAllowanceKg: number;
  isOnline: boolean;
  aiConfigured: boolean;
  onCreated: (list: PackingList) => void;
  onCancel: () => void;
}

const TRIP_TYPE_OPTIONS: Array<{ type: TripType; mode: PackingMode; subtitle: string; cover: string }> = [
  { type: 'Vacation', mode: 'Travel', subtitle: 'Beaches, cities, retreats', cover: ASSETS.kerala },
  { type: 'Business', mode: 'Work', subtitle: 'Conferences & client visits', cover: ASSETS.tokyo },
  { type: 'Adventure', mode: 'Travel', subtitle: 'Treks, hills & outdoors', cover: ASSETS.tokyo },
  { type: 'College', mode: 'College', subtitle: 'Hostel, campus & semester', cover: ASSETS.campus },
  { type: 'Family', mode: 'Travel', subtitle: 'Group & family holidays', cover: ASSETS.kerala },
  { type: 'Other', mode: 'Everyday', subtitle: 'Custom or emergency kit', cover: ASSETS.vault },
];

const WEATHER_PREFS: WeatherPreference[] = [
  'Auto (Live Weather)',
  'Warm & Sunny',
  'Rainy / Monsoon',
  'Mild & Layered',
  'Cold & Winter',
];

const ACTIVITY_OPTIONS = [
  'Beach & Swimming',
  'Hiking & Trekking',
  'Business Meetings',
  'Photography',
  'Formal Dining',
  'Gym & Workout',
  'City Sightseeing',
  'Camping',
];

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const CreateListScreen: React.FC<CreateListScreenProps> = ({
  initialMode = 'Travel',
  user,
  wardrobe,
  personalEssentials,
  memoryInsights,
  isOnline,
  aiConfigured,
  onCreated,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Intelligent Trip Details
  const [tripType, setTripType] = useState<TripType>(
    initialMode === 'Work'
      ? 'Business'
      : initialMode === 'College'
      ? 'College'
      : initialMode === 'Emergency'
      ? 'Other'
      : 'Vacation'
  );
  const [mode, setMode] = useState<PackingMode>(initialMode);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(offsetDate(5));
  const [endDate, setEndDate] = useState(offsetDate(9));
  const [travellers, setTravellers] = useState(1);

  // Step 2: Weather Preferences, Activities, Luggage & Special Requirements
  const [weatherPreference, setWeatherPreference] = useState<WeatherPreference>('Auto (Live Weather)');
  const [luggageType, setLuggageType] = useState<LuggageType>('Carry-On Spinner (40L)');
  const [travelMethod, setTravelMethod] = useState<TravelMethod>('Flight');
  const [accommodation, setAccommodation] = useState<AccommodationType>('Hotel');
  const [laundryAvailable, setLaundryAvailable] = useState(false);
  const [preference, setPreference] = useState<PackingPreference>('Balanced');
  const [activities, setActivities] = useState<string[]>(['City Sightseeing']);
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [includePersonalEssentials, setIncludePersonalEssentials] = useState(true);

  // Step 3: Live Weather, Post-Trip Memory & Smart Generation Preview
  const [weather, setWeather] = useState<WeatherReport | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [aiExtras, setAiExtras] = useState<PackingItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [validationError, setValidationError] = useState('');

  const selectedLuggage = useMemo(
    () => LUGGAGE_PRESETS.find((p) => p.type === luggageType) || LUGGAGE_PRESETS[1],
    [luggageType]
  );

  const days = useMemo(() => calculateTripDays(startDate, endDate), [startDate, endDate]);

  const clothingMath = useMemo(
    () => calculateSmartClothingQuantities(days, laundryAvailable, preference, travellers),
    [days, laundryAvailable, preference, travellers]
  );

  const generatedItems = useMemo(() => {
    const base = generateSmartPackingItems({
      mode,
      tripType,
      destination,
      startDate,
      endDate,
      travellers,
      purpose: `${tripType} trip`,
      travelMethod,
      accommodation,
      weatherPreference,
      specialRequirements,
      laundryAvailable,
      activities,
      preference,
      weather,
      personalEssentials,
      includePersonalEssentials,
      memoryInsights,
    });
    const names = new Set(base.map((i) => i.name.toLowerCase()));
    const mergedExtras = aiExtras.filter((e) => !names.has(e.name.toLowerCase()));
    return [...base, ...mergedExtras];
  }, [
    mode,
    tripType,
    destination,
    startDate,
    endDate,
    travellers,
    travelMethod,
    accommodation,
    weatherPreference,
    specialRequirements,
    laundryAvailable,
    activities,
    preference,
    weather,
    personalEssentials,
    includePersonalEssentials,
    memoryInsights,
    aiExtras,
  ]);

  const memoryBoostCount = useMemo(
    () => generatedItems.filter((i) => Boolean(i.memoryPriorityReason)).length,
    [generatedItems]
  );

  const toggleActivity = (act: string) => {
    setActivities((prev) => (prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]));
  };

  const fetchLiveWeather = async () => {
    if (!destination.trim()) {
      setWeatherError('Enter a destination city first to fetch live weather.');
      return;
    }
    if (!isOnline) {
      setWeatherError('You are offline. Live weather updates once connectivity returns.');
      return;
    }
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const qs = new URLSearchParams({
        city: destination.trim(),
        startDate,
        endDate,
      });
      const res = await fetch(`/api/weather?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setWeatherError(data.error || 'Could not retrieve live weather for that city.');
        setWeather(null);
      } else {
        setWeather(data as WeatherReport);
      }
    } catch {
      setWeatherError('Network error while checking live weather.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleEnhanceWithAI = async () => {
    if (!isOnline || !aiConfigured) {
      setAiError('PackSmart cloud AI is offline right now. Your Smart Engine list below is already personalized.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/ai/enhance-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination || tripType,
          mode,
          purpose: `${tripType}${specialRequirements ? ` (${specialRequirements})` : ''}`,
          days,
          travellers,
          travelMethod,
          accommodation,
          activities,
          weatherSummary: weather
            ? `${weather.shortLocation}: ${weather.summary.avgLow}°C to ${weather.summary.avgHigh}°C, ${weather.summary.maxRainChance}% rain`
            : weatherPreference,
          existingItems: generatedItems.map((i) => i.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'AI enhancement could not be completed.');
      } else if (Array.isArray(data.items)) {
        const mapped: PackingItem[] = data.items.map(
          (
            it: { name: string; category: string; quantity: number; weightGrams: number; reason?: string },
            idx: number
          ) => {
            const cat = it.category || 'Miscellaneous';
            const grams = Math.max(0, Number(it.weightGrams) || 150);
            return {
              id: uid('ai-item'),
              name: it.name,
              category: cat,
              quantity: Math.max(1, Number(it.quantity) || 1),
              packed: false,
              weightGrams: grams,
              volumeLiters: estimateItemVolumeLiters(cat, grams),
              priority: 'Helpful',
              notes: it.reason,
              aiRecommended: true,
              order: 500 + idx,
            };
          }
        );
        setAiExtras(mapped);
      }
    } catch {
      setAiError('Network issue while contacting PackSmart AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleStepNext = () => {
    setValidationError('');
    if (step === 1) {
      if (!title.trim() && !destination.trim()) {
        setValidationError('Please enter a trip title or destination.');
        return;
      }
      if (endDate < startDate) {
        setValidationError('Return date cannot be earlier than departure date.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
      if (destination.trim() && isOnline && !weather) {
        fetchLiveWeather();
      }
    }
  };

  const handleFinalize = () => {
    const coverForTrip =
      destination.toLowerCase().includes('tokyo') || destination.toLowerCase().includes('japan')
        ? ASSETS.tokyo
        : TRIP_TYPE_OPTIONS.find((t) => t.type === tripType)?.cover || ASSETS.kerala;

    const finalTitle =
      title.trim() || (destination.trim() ? `${destination.trim()} ${tripType}` : `${tripType} Trip`);

    const capsuleOutfits = generateCapsuleOutfitPlan(wardrobe, startDate, days, weather, activities);

    const newList: PackingList = {
      id: uid('trip'),
      title: finalTitle,
      mode,
      tripType,
      destination: destination.trim(),
      coverImage: coverForTrip,
      startDate,
      endDate,
      travellers,
      purpose: `${tripType} trip`,
      travelMethod,
      accommodation,
      weatherPreference,
      specialRequirements: specialRequirements.trim() || undefined,
      laundryAvailable,
      activities,
      preference,
      customCategories: [],
      items: generatedItems.map((it, idx) => ({ ...it, order: idx })),
      deletedItems: [],
      weather,
      luggageType: selectedLuggage.type,
      luggageCapacityLiters: selectedLuggage.capacityLiters,
      baggageAllowanceKg: selectedLuggage.defaultAllowanceKg,
      bagWeightKg: selectedLuggage.emptyWeightKg,
      dayOutfits: capsuleOutfits.dayPlans,
      beforeLeaveTasks: createDefaultBeforeLeaveTasks(),
      timelineTasks: generateSmartTimeline(startDate, destination.trim(), tripType, travelMethod),
      shoppingBudget: 5000,
      shoppingItems: [],
      isShared: travellers > 1,
      shareCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      allowMemberEdits: true,
      groupMembers: [
        {
          id: 'm-owner',
          name: user.name,
          role: 'Owner',
          initials: user.initials,
          color: '#D9C9F2',
        },
      ],
      groupActivity: [
        {
          id: uid('act'),
          memberName: user.name,
          action: `created ${finalTitle} (${generatedItems.length} items)`,
          timestamp: new Date().toISOString(),
        },
      ],
      groupSuggestions: [],
      postTripMemory: null,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreated(newList);
  };

  return (
    <div className="space-y-5 pb-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2) : onCancel())}
          aria-label="Go back"
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-2xl text-[#101010] dark:text-white hover:bg-[#FFFFFF] dark:hover:bg-[#FFFFFF0f]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[#101010] dark:text-white tracking-tight">
            Intelligent Trip Creation
          </h1>
          <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8]">
            Step {step} of 3 ·{' '}
            {step === 1
              ? 'Destination, Dates & Trip Type'
              : step === 2
              ? 'Luggage, Weather & Activities'
              : 'Live Forecast, Outfits & Checklist Preview'}
          </p>
        </div>
      </div>

      {/* Step progress bar */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 rounded-full transition-colors ${
              n <= step ? 'bg-[#101010]' : 'bg-[#10101014] dark:bg-[#FFFFFF0f]'
            }`}
          />
        ))}
      </div>

      {validationError && (
        <div role="alert" className="p-3.5 rounded-2xl bg-[#FFC5A866] dark:bg-[#FFFFFF0f] text-[#101010] dark:text-[#FFC5A8] text-xs font-medium">
          {validationError}
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-5 sm:p-6 border border-[#1010101f] dark:border-[#FFFFFF24] space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-2.5">
              Trip Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRIP_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setTripType(opt.type);
                    setMode(opt.mode);
                  }}
                  className={`min-h-[54px] px-3.5 py-2.5 rounded-2xl border text-left transition-all ${
                    tripType === opt.type
                      ? 'bg-[#101010] dark:bg-[#D9C9F2] dark:text-[#101010] border-[#101010] dark:border-[#FFFFFF24] text-white'
                      : 'bg-[#FFFFFF] dark:bg-[#101010] border-[#1010101f] dark:border-[#FFFFFF24] text-[#101010] dark:text-[#FFFFFF]'
                  }`}
                >
                  <p className="text-xs font-bold">{opt.type}</p>
                  <p className={`text-[10px] mt-0.5 truncate ${tripType === opt.type ? 'text-white/75' : 'text-[#101010b2] dark:text-[#FFFFFFa8]'}`}>
                    {opt.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-dest" className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-1.5">
                Destination City
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#10101099] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="create-dest"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g., Kochi, Tokyo, Zurich, Manali"
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm text-[#101010] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="create-title" className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-1.5">
                Trip Name (optional)
              </label>
              <input
                id="create-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Kerala Monsoon Escape"
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm text-[#101010] dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="create-start" className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-1.5">
                Departure Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#10101099] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="create-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full min-h-[46px] pl-10 pr-3 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm font-mono text-[#101010] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="create-end" className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-1.5">
                Return Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#10101099] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="create-end"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full min-h-[46px] pl-10 pr-3 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm font-mono text-[#101010] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-1.5">
                Number of Travellers
              </label>
              <div className="min-h-[46px] px-3 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] flex items-center justify-between">
                <Users className="w-4 h-4 text-[#10101099]" />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTravellers((t) => Math.max(1, t - 1))}
                    aria-label="Decrease travellers"
                    className="w-8 h-8 rounded-lg bg-white dark:bg-[#FFFFFF0f] border border-[#1010101f] dark:border-[#FFFFFF24] font-bold text-sm"
                  >
                    −
                  </button>
                  <span className="font-mono font-bold text-sm tabular-nums w-5 text-center">{travellers}</span>
                  <button
                    type="button"
                    onClick={() => setTravellers((t) => Math.min(12, t + 1))}
                    aria-label="Increase travellers"
                    className="w-8 h-8 rounded-lg bg-white dark:bg-[#FFFFFF0f] border border-[#1010101f] dark:border-[#FFFFFF24] font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8] font-mono tabular-nums">
            Trip duration: {days} day{days === 1 ? '' : 's'} · Auto-generates Smart Timeline, Outfits & Before You Leave checklist
          </p>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-5 sm:p-6 border border-[#1010101f] dark:border-[#FFFFFF24] space-y-5">
            {/* Luggage Type */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-2">
                <Luggage className="w-4 h-4 text-[#101010]" />
                <span>Luggage Type & Space Capacity</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LUGGAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.type}
                    type="button"
                    onClick={() => setLuggageType(preset.type)}
                    className={`min-h-[52px] px-3.5 py-2.5 rounded-2xl border text-left transition-colors ${
                      luggageType === preset.type
                        ? 'bg-[#101010] dark:bg-[#D9C9F2] dark:text-[#101010] border-[#101010] dark:border-[#FFFFFF24] text-white'
                        : 'bg-[#FFFFFF] dark:bg-[#101010] border-[#1010101f] dark:border-[#FFFFFF24] text-[#101010] dark:text-[#FFFFFF]'
                    }`}
                  >
                    <p className="text-xs font-bold">{preset.type}</p>
                    <p className={`text-[11px] font-mono mt-0.5 ${luggageType === preset.type ? 'text-white/75' : 'text-[#101010b2] dark:text-[#FFFFFFa8]'}`}>
                      {preset.defaultAllowanceKg}kg limit · {preset.dimensions}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-2">
                  Weather Preference
                </label>
                <select
                  value={weatherPreference}
                  onChange={(e) => setWeatherPreference(e.target.value as WeatherPreference)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm text-[#101010] dark:text-white"
                >
                  {WEATHER_PREFS.map((wp) => (
                    <option key={wp} value={wp}>
                      {wp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-2">
                  Travel Method & Stay
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={travelMethod}
                    onChange={(e) => setTravelMethod(e.target.value as TravelMethod)}
                    className="min-h-[44px] px-3 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-xs text-[#101010] dark:text-white"
                  >
                    {(['Flight', 'Train', 'Bus', 'Car', 'Local'] as TravelMethod[]).map((tm) => (
                      <option key={tm} value={tm}>{tm}</option>
                    ))}
                  </select>
                  <select
                    value={accommodation}
                    onChange={(e) => setAccommodation(e.target.value as AccommodationType)}
                    className="min-h-[44px] px-3 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-xs text-[#101010] dark:text-white"
                  >
                    {(['Hotel', 'Hostel', 'Resort', 'Camping', 'Home / Family', 'Not Applicable'] as AccommodationType[]).map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div>
              <label className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-2">
                Planned Activities
              </label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_OPTIONS.map((act) => {
                  const selected = activities.includes(act);
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() => toggleActivity(act)}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        selected
                          ? 'bg-[#101010] text-white'
                          : 'bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-[#101010cc] dark:text-[#FFFFFFa8]'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                      <span>{act}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Requirements */}
            <div>
              <label htmlFor="create-special" className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-1.5">
                Special Requirements (optional)
              </label>
              <input
                id="create-special"
                type="text"
                value={specialRequirements}
                onChange={(e) => setSpecialRequirements(e.target.value)}
                placeholder="e.g., Travelling with baby, DSLR camera gear, prescription meds"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm text-[#101010] dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1010101f] dark:border-[#FFFFFF24]">
              <div>
                <label className="block text-xs font-semibold text-[#101010cc] dark:text-[#FFFFFFa8] mb-2">
                  Packing Style
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Minimalist', 'Balanced', 'Comfort'] as PackingPreference[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPreference(p)}
                      className={`min-h-[42px] rounded-xl text-xs font-semibold ${
                        preference === p
                          ? 'bg-[#101010] dark:bg-[#D9C9F2] dark:text-[#101010] text-white'
                          : 'bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-[#101010cc] dark:text-[#FFFFFFa8]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] cursor-pointer">
                  <span className="text-xs font-semibold text-[#101010] dark:text-white">
                    Laundry available mid-trip
                  </span>
                  <input
                    type="checkbox"
                    checked={laundryAvailable}
                    onChange={(e) => setLaundryAvailable(e.target.checked)}
                    className="w-5 h-5 accent-[#10101073]"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] cursor-pointer">
                  <span className="text-xs font-semibold text-[#101010] dark:text-white">
                    Include Reusable Staples ({personalEssentials.filter((p) => p.autoInclude).length})
                  </span>
                  <input
                    type="checkbox"
                    checked={includePersonalEssentials}
                    onChange={(e) => setIncludePersonalEssentials(e.target.checked)}
                    className="w-5 h-5 accent-[#10101073]"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Smart Quantity Math */}
          <div className="p-4 rounded-3xl bg-[#D9C9F266] dark:bg-[#FFFFFF0f] border border-[#D9C9F2] dark:border-[#FFFFFF24]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#101010] dark:text-[#D9C9F2] mb-1.5">
              <Shirt className="w-4 h-4" />
              <span>Smart Clothing Quantity Math</span>
            </div>
            <p className="text-xs text-[#101010cc] dark:text-[#FFFFFF] mb-3">{clothingMath.note}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Tops', val: clothingMath.tops },
                { label: 'Bottoms', val: clothingMath.bottoms },
                { label: 'Undergarments', val: clothingMath.underwear },
                { label: 'Socks', val: clothingMath.socks },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-[#FFFFFF0f] rounded-2xl py-2 px-1">
                  <p className="font-mono text-lg font-bold text-[#101010] dark:text-white tabular-nums">{stat.val}</p>
                  <p className="text-[10px] text-[#101010b2] dark:text-[#FFFFFFa8]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div className="space-y-4">
          {memoryBoostCount > 0 && (
            <div className="p-4 rounded-3xl bg-[#B8D9F266] dark:bg-[#101010] border border-[#10101040] dark:border-[#FFFFFF24] flex items-start gap-3">
              <Brain className="w-5 h-5 text-[#101010] dark:text-[#FFFFFF] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#101010] dark:text-[#FFFFFF]">
                  Post-Trip Memory Applied Automatically
                </p>
                <p className="text-xs text-[#101010] dark:text-[#FFFFFF] mt-0.5">
                  Prioritized {memoryBoostCount} item{memoryBoostCount === 1 ? '' : 's'} you previously forgot so they won't be missed on this trip.
                </p>
              </div>
            </div>
          )}

          {/* Live Weather Card */}
          <div className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-5 border border-[#1010101f] dark:border-[#FFFFFF24]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-[#101010]" />
                <h2 className="font-display text-base font-bold text-[#101010] dark:text-white">
                  Live Weather Check
                </h2>
              </div>
              {destination.trim() && (
                <button
                  type="button"
                  onClick={fetchLiveWeather}
                  disabled={weatherLoading}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#D9C9F266] dark:bg-[#FFFFFF0f] text-[#101010] dark:text-[#D9C9F2] text-xs font-semibold flex items-center gap-1.5"
                >
                  {weatherLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{weather ? 'Refresh' : 'Fetch Forecast'}</span>
                </button>
              )}
            </div>

            {weather ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-2xl bg-[#101010] text-white">
                  <div>
                    <p className="text-sm font-bold">{weather.locationName}</p>
                    <p className="text-xs text-[#D9C9F2] mt-0.5">
                      {weather.source === 'live_forecast' ? 'Actual Live Forecast' : 'Current Preview (trip >16d out)'} · {weather.summary.primaryCondition}
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-lg font-bold text-[#101010]">
                      {weather.summary.avgLow}°–{weather.summary.avgHigh}°C
                    </p>
                    <p className="text-[11px] text-white/75 flex items-center justify-end gap-1">
                      <CloudRain className="w-3 h-3" />
                      {weather.summary.maxRainChance}% rain
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8]">{weather.note}</p>
              </div>
            ) : (
              <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8]">
                {weatherLoading
                  ? `Fetching live Open-Meteo weather for ${destination}...`
                  : weatherError ||
                    `Using "${weatherPreference}" preference rules until live weather is fetched.`}
              </p>
            )}
          </div>

          {/* Optional PackSmart AI Enhancement */}
          <div className="bg-[#D9C9F266] dark:bg-[#FFFFFF0f] rounded-3xl p-4 border border-[#D9C9F2] dark:border-[#FFFFFF24] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#101010] dark:text-[#D9C9F2] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#101010] dark:text-white">
                  Enhance with PackSmart AI
                </p>
                <p className="text-xs text-[#101010cc] dark:text-[#FFFFFFa8]">
                  {aiExtras.length > 0
                    ? `Added ${aiExtras.length} destination-specific AI items below.`
                    : aiError || 'Add smart destination-specific essentials tailored to your itinerary.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnhanceWithAI}
              disabled={aiLoading}
              className="min-h-[42px] px-4 rounded-xl bg-[#101010] text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{aiLoading ? 'Thinking...' : aiExtras.length > 0 ? 'Regenerate AI' : 'Add AI Picks'}</span>
            </button>
          </div>

          {/* Generated Preview */}
          <div className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-5 border border-[#1010101f] dark:border-[#FFFFFF24]">
            <div className="mb-4">
              <h2 className="font-display text-base font-bold text-[#101010] dark:text-white">
                Complete Trip Preparation Preview
              </h2>
              <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8] font-mono tabular-nums mt-0.5">
                {generatedItems.length} items · Est.{' '}
                {generatedItems.reduce((s, i) => s + i.volumeLiters * i.quantity, 0).toFixed(1)}L /{' '}
                {selectedLuggage.capacityLiters}L ({selectedLuggage.type.split(' ')[0]}) · 10 Timeline steps · 7 Departure safety checks
              </p>
            </div>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {Array.from(new Set(generatedItems.map((i) => i.category))).map((cat) => {
                const catItems = generatedItems.filter((i) => i.category === cat);
                return (
                  <div key={cat}>
                    <p className="text-xs font-bold text-[#101010] dark:text-[#D9C9F2] mb-1.5">
                      {cat} ({catItems.length})
                    </p>
                    <div className="divide-y divide-[#1010101f] dark:divide-[#FFFFFF24]">
                      {catItems.map((it) => (
                        <div key={it.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-[#101010] dark:text-[#FFFFFF] truncate">{it.name}</p>
                            {it.memoryPriorityReason && (
                              <p className="text-[11px] text-[#101010] dark:text-[#D9C9F2] truncate">
                                {it.memoryPriorityReason}
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-xs text-[#101010b2] dark:text-[#FFFFFFa8] tabular-nums shrink-0">
                            ×{it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2) : onCancel())}
          className="min-h-[48px] px-5 rounded-2xl bg-white dark:bg-[#FFFFFF0f] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm font-semibold text-[#101010cc] dark:text-[#FFFFFFa8]"
        >
          {step === 1 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={handleStepNext}
            className="flex-1 sm:flex-none min-h-[48px] px-7 rounded-2xl bg-[#101010] dark:bg-[#D9C9F2] dark:text-[#101010] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-md"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinalize}
            className="flex-1 sm:flex-none min-h-[48px] px-7 rounded-2xl bg-[#101010] hover:bg-[#101010] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>Create Trip & Open Workspace</span>
          </button>
        )}
      </div>
    </div>
  );
};
