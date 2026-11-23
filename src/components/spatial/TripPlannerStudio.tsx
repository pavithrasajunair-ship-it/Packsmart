import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Calendar,
  Check,
  CloudRain,
  CloudSun,
  Compass,
  Loader2,
  MapPin,
  Plus,
  Sun,
  X,
} from 'lucide-react';
import type {
  PackingList,
  PersonalEssential,
  TripType,
  UserAccount,
  WeatherPreference,
  WeatherReport,
} from '../../types';
import {
  calculateTripDays,
  createDefaultBeforeLeaveTasks,
  daysUntilDate,
  generateSmartPackingItems,
  generateSmartTimeline,
  MemoryLearningInsights,
} from '../../utils/packingEngine';
import { uid } from '../../utils/storage';
import { TiltCard } from '../editorial/MotionPrimitives';
import horizonImg from '../../assets/images/spatial_trip_horizon_1795246613797.jpg';
import kyotoImg from '../../assets/images/editorial_destination_kyoto_1795242652961.jpg';
import amalfiImg from '../../assets/images/editorial_destination_amalfi_1795242652302.jpg';

interface TripPlannerStudioProps {
  lists: PackingList[];
  user: UserAccount;
  personalEssentials: PersonalEssential[];
  memoryInsights: MemoryLearningInsights;
  defaultAllowanceKg: number;
  isOnline: boolean;
  onCreateList: (created: PackingList) => void;
  onUpdateList: (updated: PackingList) => void;
  onSaveWeather: (tripId: string, weather: WeatherReport) => void;
  onOpenSmartPacking: (tripId: string) => void;
  onOpenOutfitStudio: () => void;
}

const TRIP_PURPOSES: Array<{ label: string; tripType: TripType }> = [
  { label: 'Editorial Leisure', tripType: 'Vacation' },
  { label: 'Executive & Business', tripType: 'Business' },
  { label: 'Alpine & Adventure', tripType: 'Adventure' },
  { label: 'Family Retreat', tripType: 'Family' },
  { label: 'Campus & Study', tripType: 'College' },
];

const ACTIVITY_OPTIONS = [
  'City Exploring',
  'Fine Dining',
  'Beach & Swimming',
  'Business Meetings',
  'Museum & Culture',
  'Hiking & Outdoors',
  'Photography',
  'Spa & Wellness',
];

const WEATHER_PREFERENCES: WeatherPreference[] = [
  'Auto (Live Weather)',
  'Warm & Sunny',
  'Mild & Layered',
  'Rainy / Monsoon',
  'Cold & Winter',
];

const COVER_ROTATION = [horizonImg, kyotoImg, amalfiImg];

export const TripPlannerStudio: React.FC<TripPlannerStudioProps> = ({
  lists,
  user,
  personalEssentials,
  memoryInsights,
  defaultAllowanceKg,
  isOnline,
  onCreateList,
  onUpdateList,
  onSaveWeather,
  onOpenSmartPacking,
  onOpenOutfitStudio,
}) => {
  const [selectedTripId, setSelectedTripId] = useState<string>(lists[0]?.id || '');
  const [composerOpen, setComposerOpen] = useState(false);

  // Journey Composer Form State
  const defaultStart = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const defaultEnd = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10);

  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(defaultStart);
  const [returnDate, setReturnDate] = useState(defaultEnd);
  const [purposeLabel, setPurposeLabel] = useState(TRIP_PURPOSES[0].label);
  const [tripType, setTripType] = useState<TripType>('Vacation');
  const [weatherPref, setWeatherPref] = useState<WeatherPreference>('Auto (Live Weather)');
  const [activities, setActivities] = useState<string[]>(['City Exploring', 'Fine Dining']);
  const [creatingBusy, setCreatingBusy] = useState(false);

  const [weatherBusyId, setWeatherBusyId] = useState<string | null>(null);

  const activeTrip = useMemo(
    () => lists.find((l) => l.id === selectedTripId) || lists[0] || null,
    [lists, selectedTripId]
  );

  const fetchWeatherForTrip = async (trip: PackingList) => {
    if (!trip.destination || !isOnline) return;
    setWeatherBusyId(trip.id);
    try {
      const params = new URLSearchParams({
        city: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
      });
      const res = await fetch(`/api/weather?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        onSaveWeather(trip.id, data as WeatherReport);
      }
    } catch {
      // Ignore transient network failure
    } finally {
      setWeatherBusyId(null);
    }
  };

  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    const dest = destination.trim() || 'Kyoto';
    setCreatingBusy(true);

    let liveWeather: WeatherReport | null = null;
    if (isOnline && weatherPref === 'Auto (Live Weather)') {
      try {
        const params = new URLSearchParams({
          city: dest,
          startDate: departureDate,
          endDate: returnDate >= departureDate ? returnDate : departureDate,
        });
        const res = await fetch(`/api/weather?${params.toString()}`);
        if (res.ok) liveWeather = (await res.json()) as WeatherReport;
      } catch {
        liveWeather = null;
      }
    }

    const safeEnd = returnDate >= departureDate ? returnDate : departureDate;
    const generatedItems = generateSmartPackingItems({
      mode: tripType === 'Business' ? 'Work' : 'Travel',
      tripType,
      destination: dest,
      startDate: departureDate,
      endDate: safeEnd,
      travellers: 1,
      purpose: purposeLabel,
      travelMethod: 'Flight',
      accommodation: 'Hotel',
      weatherPreference: weatherPref,
      laundryAvailable: false,
      activities,
      preference: 'Minimalist',
      weather: liveWeather,
      personalEssentials,
      includePersonalEssentials: true,
      memoryInsights,
    });

    const coverImage = COVER_ROTATION[lists.length % COVER_ROTATION.length];
    const newTrip: PackingList = {
      id: uid('trip'),
      title: `${dest} Journey`,
      mode: tripType === 'Business' ? 'Work' : 'Travel',
      tripType,
      destination: dest,
      coverImage,
      startDate: departureDate,
      endDate: safeEnd,
      travellers: 1,
      purpose: purposeLabel,
      travelMethod: 'Flight',
      accommodation: 'Hotel',
      weatherPreference: weatherPref,
      laundryAvailable: false,
      activities,
      preference: 'Minimalist',
      customCategories: [],
      items: generatedItems,
      deletedItems: [],
      weather: liveWeather,
      luggageType: 'Carry-On Spinner (40L)',
      luggageCapacityLiters: 40,
      baggageAllowanceKg: defaultAllowanceKg,
      bagWeightKg: 2.5,
      dayOutfits: [],
      beforeLeaveTasks: createDefaultBeforeLeaveTasks(),
      timelineTasks: generateSmartTimeline(departureDate, dest, tripType, 'Flight'),
      shoppingBudget: 4000,
      shoppingItems: [],
      isShared: false,
      shareCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      allowMemberEdits: true,
      groupMembers: [
        { id: 'm-owner', name: user.name, role: 'Owner', initials: user.initials, color: '#0A0A0A' },
      ],
      groupActivity: [],
      groupSuggestions: [],
      postTripMemory: null,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreateList(newTrip);
    setSelectedTripId(newTrip.id);
    setDestination('');
    setComposerOpen(false);
    setCreatingBusy(false);
  };

  const toggleTimelineTask = (taskId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      timelineTasks: activeTrip.timelineTasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleBeforeLeaveTask = (taskId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      beforeLeaveTasks: activeTrip.beforeLeaveTasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-[#E6DFD2] text-[#0A0A0A] pt-20 pb-14">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-8">
        {/* CINEMATIC PANORAMIC HORIZON BANNER */}
        <div className="relative overflow-hidden border border-[#0A0A0A]/20 bg-[#0B3B40] text-[#FBFAF8]">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-between gap-8 relative z-10">
              <div className="space-y-3">
                <p className="font-mono text-[11px] tracking-[0.16em] text-[#E6DFD2]">
                  03. SPATIAL TRIP PLANNER · ITINERARY ATELIER
                </p>
                <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl leading-[0.98] font-normal text-[#FBFAF8]">
                  Chart the horizon. <span className="italic text-[#BCD2CF]">Arrive unhurried.</span>
                </h1>
                <p className="text-xs sm:text-sm text-white/75 max-w-md leading-relaxed">
                  Every journey automatically generates live meteorological forecasts, tailored 40L suitcase manifests, and a calm departure timeline connected to your AI Outfit Studio.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setComposerOpen((v) => !v)}
                  className="min-h-[48px] px-6 bg-[#E6DFD2] text-[#0A0A0A] text-xs font-bold inline-flex items-center gap-2 hover:bg-[#FBFAF8] transition-colors"
                >
                  {composerOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{composerOpen ? 'Close Composer' : 'Design New Journey'}</span>
                </button>
                {activeTrip && (
                  <button
                    type="button"
                    onClick={() => onOpenSmartPacking(activeTrip.id)}
                    className="min-h-[48px] px-5 border border-white/25 text-[#FBFAF8] text-xs font-bold hover:bg-white hover:text-[#0A0A0A] transition-colors"
                  >
                    Open 3D Suitcase
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 relative min-h-[260px] lg:min-h-[340px]">
              <img loading="lazy" decoding="async"
                src={horizonImg}
                alt="Minimalist limestone coastal horizon at sunset"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* COLLAPSIBLE SPATIAL JOURNEY COMPOSER */}
        <AnimatePresence>
          {composerOpen && (
            <motion.form
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleCreateJourney}
              className="bg-[#FBFAF8] border border-[#0A0A0A] p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-[#0A0A0A]/10 pb-4">
                <div>
                  <p className="font-mono text-[10px] text-[#0A0A0A]/60">NEW JOURNEY SPECIFICATION</p>
                  <h2 className="font-editorial text-3xl">Compose Destination &amp; Timeline</h2>
                </div>
                <Compass className="w-5 h-5 text-[#0A0A0A]" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-4 space-y-1.5">
                  <label className="font-mono text-[10px] text-[#0A0A0A]/65">DESTINATION</label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g., Kyoto, Milan, Paris, Reykjavik"
                    className="w-full min-h-[46px] px-3.5 border border-[#0A0A0A]/25 text-sm font-semibold"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-mono text-[10px] text-[#0A0A0A]/65">DEPARTURE</label>
                  <input
                    type="date"
                    required
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full min-h-[46px] px-3 border border-[#0A0A0A]/25 text-xs font-mono"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-mono text-[10px] text-[#0A0A0A]/65">RETURN</label>
                  <input
                    type="date"
                    required
                    value={returnDate}
                    min={departureDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full min-h-[46px] px-3 border border-[#0A0A0A]/25 text-xs font-mono"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-mono text-[10px] text-[#0A0A0A]/65">TRAVEL PURPOSE</label>
                  <select
                    value={purposeLabel}
                    onChange={(e) => {
                      const found = TRIP_PURPOSES.find((p) => p.label === e.target.value);
                      setPurposeLabel(e.target.value);
                      if (found) setTripType(found.tripType);
                    }}
                    className="w-full min-h-[46px] px-3 border border-[#0A0A0A]/25 text-xs font-semibold bg-[#FBFAF8]"
                  >
                    {TRIP_PURPOSES.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-mono text-[10px] text-[#0A0A0A]/65">WEATHER PREFERENCE</label>
                  <select
                    value={weatherPref}
                    onChange={(e) => setWeatherPref(e.target.value as WeatherPreference)}
                    className="w-full min-h-[46px] px-3 border border-[#0A0A0A]/25 text-xs font-semibold bg-[#FBFAF8]"
                  >
                    {WEATHER_PREFERENCES.map((wp) => (
                      <option key={wp} value={wp}>
                        {wp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-mono text-[10px] text-[#0A0A0A]/65">PLANNED ACTIVITIES</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map((act) => {
                    const active = activities.includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() =>
                          setActivities((prev) =>
                            active ? prev.filter((a) => a !== act) : [...prev, act]
                          )
                        }
                        className={`min-h-[36px] px-3.5 text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-[#0B3B40] border-[#0A0A0A] text-[#FBFAF8]'
                            : 'bg-[#FBFAF8] border-[#0A0A0A]/20 text-[#0A0A0A]/75 hover:border-[#0A0A0A]'
                        }`}
                      >
                        {act}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="min-h-[46px] px-5 border border-[#0A0A0A]/25 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBusy}
                  className="min-h-[46px] px-7 bg-[#0B3B40] text-[#FBFAF8] text-xs font-bold inline-flex items-center gap-2 hover:bg-[#0A0A0A]/85 disabled:opacity-50"
                >
                  {creatingBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#E6DFD2]" />
                      <span>Forecasting &amp; Building Journey...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Journey &amp; Packing List</span>
                      <ArrowRight className="w-4 h-4 text-[#E6DFD2]" />
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* FLOATING DESTINATION CARDS GALLERY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {lists.map((trip, idx) => {
            const isSelected = activeTrip?.id === trip.id;
            const days = calculateTripDays(trip.startDate, trip.endDate);
            const until = daysUntilDate(trip.startDate);
            const packedPct =
              trip.items.length > 0
                ? Math.round((trip.items.filter((i) => i.packed).length / trip.items.length) * 100)
                : 0;
            const fallbackPhoto = COVER_ROTATION[idx % COVER_ROTATION.length];

            return (
              <TiltCard key={trip.id} maxTilt={3.5}>
                <button
                  type="button"
                  onClick={() => setSelectedTripId(trip.id)}
                  className={`w-full text-left border overflow-hidden transition-colors flex flex-col ${
                    isSelected
                      ? 'bg-[#0B3B40] text-[#FBFAF8] border-[#0A0A0A]'
                      : 'bg-[#FBFAF8] text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#0A0A0A]'
                  }`}
                >
                  <div className="aspect-[16/9] relative overflow-hidden bg-[#BCD2CF]/40">
                    <img loading="lazy" decoding="async"
                      src={trip.coverImage || fallbackPhoto}
                      alt={trip.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = fallbackPhoto;
                      }}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#0B3B40] text-[#E6DFD2] font-mono text-[10px]">
                      {until > 0 ? `IN ${until} DAYS` : until === 0 ? 'TODAY' : `${days} DAYS`}
                    </span>
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p
                        className={`font-mono text-[10px] flex items-center gap-1 ${
                          isSelected ? 'text-[#BCD2CF]' : 'text-[#0A0A0A]/60'
                        }`}
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{trip.destination || trip.tripType} · {days}d</span>
                      </p>
                      <h3 className="font-editorial text-2xl mt-1">{trip.title}</h3>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-current/15">
                      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                        <span>{trip.startDate}</span>
                        <span>{packedPct}% packed</span>
                      </div>
                      <div className="h-1.5 w-full bg-current/15 overflow-hidden">
                        <div
                          className={`h-full ${isSelected ? 'bg-[#E6DFD2]' : 'bg-[#0B3B40]'}`}
                          style={{ width: `${packedPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              </TiltCard>
            );
          })}
        </div>

        {/* SELECTED TRIP FLOATING SPATIAL PANELS: WEATHER + TIMELINE + BEFORE YOU LEAVE */}
        {activeTrip && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel: Live Weather & Integrated Studio Portals */}
            <div className="lg:col-span-5 bg-[#FBFAF8] border border-[#0A0A0A]/15 p-6 space-y-6">
              <div className="flex items-start justify-between gap-3 border-b border-[#0A0A0A]/10 pb-4">
                <div>
                  <p className="font-mono text-[10px] text-[#0A0A0A]/60">ACTIVE JOURNEY BRIEF</p>
                  <h2 className="font-editorial text-3xl mt-0.5">{activeTrip.title}</h2>
                  <p className="font-mono text-[11px] text-[#0A0A0A]/65 mt-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {activeTrip.startDate} → {activeTrip.endDate} ({calculateTripDays(activeTrip.startDate, activeTrip.endDate)} days)
                    </span>
                  </p>
                </div>
                {activeTrip.destination && (
                  <button
                    type="button"
                    onClick={() => fetchWeatherForTrip(activeTrip)}
                    disabled={weatherBusyId === activeTrip.id || !isOnline}
                    className="min-h-[38px] px-3 bg-[#BCD2CF] text-[#0A0A0A] text-[11px] font-bold inline-flex items-center gap-1.5 hover:bg-[#0B3B40] hover:text-[#FBFAF8] transition-colors disabled:opacity-50"
                  >
                    {weatherBusyId === activeTrip.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudSun className="w-3.5 h-3.5" />
                    )}
                    <span>Forecast</span>
                  </button>
                )}
              </div>

              {/* Weather Box */}
              {activeTrip.weather ? (
                <div className="p-4 bg-[#BCD2CF]/45 border border-[#0A0A0A]/12 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {activeTrip.weather.summary.maxRainChance >= 45 ? (
                        <CloudRain className="w-5 h-5 text-[#0A0A0A]" />
                      ) : (
                        <Sun className="w-5 h-5 text-[#0A0A0A]" />
                      )}
                      <span className="font-mono text-lg font-bold tabular-nums">
                        {activeTrip.weather.summary.avgLow}°–{activeTrip.weather.summary.avgHigh}°C
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#0A0A0A]/70">
                      {activeTrip.weather.summary.primaryCondition} · {activeTrip.weather.summary.maxRainChance}% rain
                    </span>
                  </div>
                  <p className="text-xs text-[#0A0A0A]/75 leading-relaxed">
                    {activeTrip.weather.note}
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-[#D5DCD9]/40 border border-[#0A0A0A]/12 text-xs text-[#0A0A0A]/75">
                  Weather preference: <span className="font-bold">{activeTrip.weatherPreference}</span>. Tap Forecast above to pull live Open-Meteo data.
                </div>
              )}

              {/* Before You Leave Mini Checklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] text-[#0A0A0A]/65">BEFORE YOU LEAVE SAFETY CHECK</p>
                  <span className="font-mono text-[11px] font-bold tabular-nums">
                    {activeTrip.beforeLeaveTasks.filter((t) => t.completed).length}/
                    {activeTrip.beforeLeaveTasks.length}
                  </span>
                </div>
                <div className="divide-y divide-[#0A0A0A]/10 max-h-[210px] overflow-y-auto">
                  {activeTrip.beforeLeaveTasks.slice(0, 6).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleBeforeLeaveTask(task.id)}
                      className="w-full py-2.5 flex items-center gap-3 text-left min-h-[40px]"
                    >
                      <span
                        className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                          task.completed
                            ? 'bg-[#0B3B40] border-[#0A0A0A] text-[#E6DFD2]'
                            : 'border-[#0A0A0A]/35'
                        }`}
                      >
                        {task.completed && <Check className="w-3 h-3" />}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          task.completed ? 'line-through text-[#0A0A0A]/45' : 'text-[#0A0A0A]'
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seamless Bridges to Packing & Outfit Studio */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenSmartPacking(activeTrip.id)}
                  className="min-h-[46px] bg-[#0B3B40] text-[#FBFAF8] text-xs font-bold hover:bg-[#0A0A0A]/85 transition-colors"
                >
                  Pack 3D Suitcase →
                </button>
                <button
                  type="button"
                  onClick={onOpenOutfitStudio}
                  className="min-h-[46px] bg-[#D5DCD9] text-[#0A0A0A] text-xs font-bold hover:bg-[#0B3B40] hover:text-[#FBFAF8] transition-colors"
                >
                  Style Trip Outfits →
                </button>
              </div>
            </div>

            {/* Right Panel: Interactive Visual Departure Timeline */}
            <div className="lg:col-span-7 bg-[#FBFAF8] border border-[#0A0A0A]/15 p-6 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A0A0A]/10 pb-4">
                <div>
                  <p className="font-mono text-[10px] text-[#0A0A0A]/60">INTERACTIVE PREPARATION TIMELINE</p>
                  <h2 className="font-editorial text-3xl mt-0.5">Countdown Milestones</h2>
                </div>
                <span className="font-mono text-xs font-bold tabular-nums">
                  {activeTrip.timelineTasks.filter((t) => t.completed).length} / {activeTrip.timelineTasks.length} completed
                </span>
              </div>

              <div className="space-y-3">
                {activeTrip.timelineTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggleTimelineTask(task.id)}
                    className={`w-full text-left p-4 border transition-colors flex items-start justify-between gap-4 ${
                      task.completed
                        ? 'bg-[#BCD2CF]/25 border-[#0A0A0A]/10'
                        : 'bg-[#FBFAF8] border-[#0A0A0A]/18 hover:border-[#0A0A0A]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        className={`mt-0.5 w-5 h-5 border flex items-center justify-center shrink-0 ${
                          task.completed
                            ? 'bg-[#0B3B40] border-[#0A0A0A] text-[#E6DFD2]'
                            : 'border-[#0A0A0A]/35'
                        }`}
                      >
                        {task.completed && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <div className="space-y-0.5">
                        <p
                          className={`text-sm font-bold ${
                            task.completed ? 'line-through text-[#0A0A0A]/45' : 'text-[#0A0A0A]'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.notes && (
                          <p className="text-xs text-[#0A0A0A]/65 leading-snug">{task.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 font-mono">
                      <p className="text-[10px] font-bold text-[#0A0A0A]/70">{task.stage}</p>
                      <p className="text-[10px] text-[#0A0A0A]/50 tabular-nums">{task.dueDate}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
