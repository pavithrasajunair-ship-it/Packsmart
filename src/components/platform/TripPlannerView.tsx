import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  CloudSun,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
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
import type { PlatformRoute } from './HomePage';
import { PageHero, PhotoFan } from './PageHero';

import kyotoCoverImg from '../../assets/images/editorial_destination_kyoto_1795242652961.jpg';
import amalfiCoverImg from '../../assets/images/editorial_destination_amalfi_1795242652302.jpg';
import horizonCoverImg from '../../assets/images/spatial_trip_horizon_1795246613797.jpg';

interface TripPlannerViewProps {
  user: UserAccount;
  lists: PackingList[];
  selectedTripId: string | null;
  personalEssentials: PersonalEssential[];
  memoryInsights: MemoryLearningInsights;
  defaultAllowanceKg: number;
  isOnline: boolean;
  onSelectTrip: (tripId: string) => void;
  onCreateList: (created: PackingList) => void;
  onUpdateList: (updated: PackingList) => void;
  onSaveWeather: (tripId: string, weather: WeatherReport) => void;
  onNavigate: (route: PlatformRoute) => void;
}

const TRIP_TYPES: TripType[] = ['Vacation', 'Business', 'Adventure', 'College', 'Family', 'Other'];
const WEATHER_PREFS: WeatherPreference[] = [
  'Auto (Live Weather)',
  'Warm & Sunny',
  'Mild & Layered',
  'Rainy / Monsoon',
  'Cold & Winter',
];
const ACTIVITY_OPTIONS = [
  'City Sightseeing',
  'Fine Dining',
  'Beach / Swimming',
  'Hiking / Outdoors',
  'Business Meetings',
  'Photography',
];

export const TripPlannerView: React.FC<TripPlannerViewProps> = ({
  user,
  lists,
  selectedTripId,
  personalEssentials,
  memoryInsights,
  defaultAllowanceKg,
  isOnline,
  onSelectTrip,
  onCreateList,
  onUpdateList,
  onSaveWeather,
  onNavigate,
}) => {
  const activeTrip = useMemo(
    () =>
      lists.find((l) => l.id === selectedTripId) ||
      lists.find((l) => !l.completed) ||
      lists[0] ||
      null,
    [lists, selectedTripId]
  );

  const [showComposer, setShowComposer] = useState(false);
  const [destination, setDestination] = useState('');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  });
  const [tripType, setTripType] = useState<TripType>('Vacation');
  const [weatherPreference, setWeatherPreference] =
    useState<WeatherPreference>('Auto (Live Weather)');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([
    'City Sightseeing',
    'Fine Dining',
  ]);
  const [creating, setCreating] = useState(false);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState('');

  const coverPool = [kyotoCoverImg, amalfiCoverImg, horizonCoverImg];

  const toggleActivity = (act: string) => {
    setSelectedActivities((prev) =>
      prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act]
    );
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim()) return;
    setCreating(true);

    let liveWeather: WeatherReport | null = null;
    if (isOnline && weatherPreference === 'Auto (Live Weather)') {
      try {
        const params = new URLSearchParams({
          city: destination.trim(),
          startDate,
          endDate,
        });
        const res = await fetch(`/api/weather?${params.toString()}`);
        if (res.ok) {
          liveWeather = (await res.json()) as WeatherReport;
        }
      } catch {
        // Proceed with smart fallback weather preference
      }
    }

    const mode = tripType === 'Business' ? 'Work' : tripType === 'College' ? 'College' : 'Travel';
    const items = generateSmartPackingItems({
      mode,
      tripType,
      destination: destination.trim(),
      startDate,
      endDate,
      travellers: 1,
      purpose: tripType,
      travelMethod: 'Flight',
      accommodation: 'Hotel',
      weatherPreference,
      laundryAvailable: false,
      activities: selectedActivities,
      preference: 'Balanced',
      weather: liveWeather,
      personalEssentials,
      includePersonalEssentials: true,
      memoryInsights,
    });

    const created: PackingList = {
      id: uid('trip'),
      title: title.trim() || `${destination.trim()} ${tripType}`,
      mode,
      tripType,
      destination: destination.trim(),
      coverImage: coverPool[lists.length % coverPool.length],
      startDate,
      endDate,
      travellers: 1,
      purpose: tripType,
      travelMethod: 'Flight',
      accommodation: 'Hotel',
      weatherPreference,
      laundryAvailable: false,
      activities: selectedActivities,
      preference: 'Balanced',
      customCategories: [],
      items,
      deletedItems: [],
      weather: liveWeather,
      luggageType: 'Carry-On Spinner (40L)',
      luggageCapacityLiters: 40,
      baggageAllowanceKg: defaultAllowanceKg,
      bagWeightKg: 2.5,
      dayOutfits: [],
      beforeLeaveTasks: createDefaultBeforeLeaveTasks(),
      timelineTasks: generateSmartTimeline(startDate, destination.trim(), tripType, 'Flight'),
      shoppingBudget: 5000,
      shoppingItems: [],
      isShared: false,
      shareCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      allowMemberEdits: true,
      groupMembers: [
        {
          id: 'm-owner',
          name: user.name,
          role: 'Owner',
          initials: user.initials,
          color: '#0A0A0A',
        },
      ],
      groupActivity: [],
      groupSuggestions: [],
      postTripMemory: null,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onCreateList(created);
    onSelectTrip(created.id);
    setDestination('');
    setTitle('');
    setShowComposer(false);
    setCreating(false);
  };

  const handleRefreshWeather = async () => {
    if (!activeTrip) return;
    const city = activeTrip.destination || activeTrip.title;
    if (!city || !isOnline) return;
    setWeatherBusy(true);
    setWeatherError('');
    try {
      const params = new URLSearchParams({
        city,
        startDate: activeTrip.startDate,
        endDate: activeTrip.endDate,
      });
      const res = await fetch(`/api/weather?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setWeatherError(data.error || 'Could not load forecast for this city.');
      } else {
        onSaveWeather(activeTrip.id, data as WeatherReport);
      }
    } catch {
      setWeatherError('Unable to reach weather service right now.');
    } finally {
      setWeatherBusy(false);
    }
  };

  const handleToggleTimeline = (taskId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      timelineTasks: activeTrip.timelineTasks.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleToggleBeforeLeave = (taskId: string) => {
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
    <div className="ps-work relative min-h-[calc(100vh-4rem)] py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <PageHero
          surface="#0B3B40"
          tagline="Where to next? Pick a place, read the sky, pack for it."
          stats={[
            { label: 'Itineraries', value: lists.length },
            { label: 'Upcoming', value: lists.filter((l) => !l.completed).length },
            { label: 'Items listed', value: lists.reduce((n, l) => n + l.items.length, 0) },
          ]}
        >
          <PhotoFan images={[kyotoCoverImg, horizonCoverImg, amalfiCoverImg]} />
        </PageHero>

        {/* ==================== HEADER ==================== */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="inline-flex h-7 items-center rounded-full bg-[#FBFAF8]/85 px-3.5 text-xs font-semibold text-[#0A0A0A]">Trip Planner</p>
            <h1 className="text-4xl sm:text-6xl font-bold leading-[1.02] tracking-[-0.045em] text-[#0A0A0A]">
              Itineraries &amp; Preparation
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setShowComposer((v) => !v)}
            className="h-10 px-5 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-sm font-medium inline-flex items-center justify-center gap-1.5 hover:bg-[#0A0A0A]/88 transition-colors self-start sm:self-auto whitespace-nowrap"
          >
            {showComposer ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showComposer ? 'Close Composer' : 'New Trip'}</span>
          </button>
        </div>

        {/* ==================== COLLAPSIBLE TRIP COMPOSER ==================== */}
        {showComposer && (
          <form
            onSubmit={handleCreateTrip}
            className="rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/15 p-6 space-y-5"
          >
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-medium text-[#0A0A0A]">
                Plan a New Journey
              </h2>
              <p className="text-xs text-[#0A0A0A]/65">
                PackSmart will fetch live destination weather and build your checklist, timeline, and departure tasks automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="space-y-1.5 text-xs font-medium text-[#0A0A0A]/75">
                <span>Destination City *</span>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g., Kyoto, Lisbon, Goa"
                  className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
                />
              </label>

              <label className="space-y-1.5 text-xs font-medium text-[#0A0A0A]/75">
                <span>Trip Name (Optional)</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Autumn in Kyoto"
                  className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
                />
              </label>

              <label className="space-y-1.5 text-xs font-medium text-[#0A0A0A]/75">
                <span>Departure Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
                />
              </label>

              <label className="space-y-1.5 text-xs font-medium text-[#0A0A0A]/75">
                <span>Return Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5 text-xs font-medium text-[#0A0A0A]/75">
                <span>Trip Purpose</span>
                <select
                  value={tripType}
                  onChange={(e) => setTripType(e.target.value as TripType)}
                  className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
                >
                  {TRIP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-xs font-medium text-[#0A0A0A]/75">
                <span>Climate &amp; Weather</span>
                <select
                  value={weatherPreference}
                  onChange={(e) => setWeatherPreference(e.target.value as WeatherPreference)}
                  className="w-full h-10 px-3 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm text-[#0A0A0A]"
                >
                  {WEATHER_PREFS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-[#0A0A0A]/75">Planned Activities</p>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_OPTIONS.map((act) => {
                  const selected = selectedActivities.includes(act);
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() => toggleActivity(act)}
                      className={`h-9 px-3.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-[#0B3B40] text-[#FBFAF8] border-[#0A0A0A]'
                          : 'bg-[#FBFAF8] text-[#0A0A0A] border-[#0A0A0A]/15 hover:border-[#0A0A0A]'
                      }`}
                    >
                      {act}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#0A0A0A]/10">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="h-10 px-4 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-sm font-medium text-[#0A0A0A]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !destination.trim()}
                className="h-10 px-6 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#0A0A0A]/88 disabled:opacity-50"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Create Trip &amp; Smart Checklist</span>
              </button>
            </div>
          </form>
        )}

        {/* ==================== UNIFORM DESTINATION CARDS GRID (METADATA BELOW IMAGE) ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {lists.map((trip, idx) => {
            const isSelected = activeTrip?.id === trip.id;
            const days = calculateTripDays(trip.startDate, trip.endDate);
            const until = daysUntilDate(trip.startDate);
            const packed = trip.items.filter((i) => i.packed).length;
            const coverSrc =
              trip.coverImage && trip.coverImage.startsWith('http')
                ? coverPool[idx % coverPool.length]
                : trip.coverImage || coverPool[idx % coverPool.length];

            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => onSelectTrip(trip.id)}
                className={`text-left rounded-3xl bg-[#0A0A0A]/10 overflow-hidden border transition-colors flex flex-col ${
                  isSelected
                    ? 'border-[#0A0A0A] ring-1 ring-[#0A0A0A]'
                    : 'border-[#0A0A0A]/10 hover:border-[#0A0A0A]/35'
                }`}
              >
                <div className="w-full aspect-[16/9] bg-[#0A0A0A]/10 overflow-hidden">
                  <img decoding="async"
                    src={coverSrc}
                    alt={trip.title}
                    className="w-full h-full object-cover block"
                    loading="lazy"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#0A0A0A]/75">
                      <span>{trip.tripType}</span>
                      <span className="tabular-nums">
                        {until >= 0 ? `In ${until} days` : `${days} days`}
                      </span>
                    </div>
                    <h3 className="font-serif text-2xl font-medium text-[#0A0A0A]">
                      {trip.title}
                    </h3>
                    <p className="text-xs text-[#0A0A0A]/65 inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>
                        {trip.destination || 'Flexible destination'} · {trip.startDate}
                      </span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#0A0A0A]/10 flex items-center justify-between text-xs tabular-nums">
                    <span className="text-[#0A0A0A]/65">
                      {packed}/{trip.items.length} packed
                    </span>
                    <span className="font-medium text-[#0A0A0A]">
                      {isSelected ? 'Selected' : 'Inspect'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ==================== SELECTED TRIP DETAIL: TIMELINE + BEFORE YOU LEAVE ==================== */}
        {activeTrip && (
          <div className="space-y-6">
            {/* Weather & Quick Route Bar */}
            <div className="rounded-3xl bg-[#BCD2CF]/28 border border-[#0A0A0A]/10 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#0A0A0A]/65">Active Itinerary</p>
                <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#0A0A0A]">
                  {activeTrip.title}
                </h2>
                <p className="text-sm text-[#0A0A0A]/75 inline-flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {activeTrip.startDate} to {activeTrip.endDate}
                    </span>
                  </span>
                  {activeTrip.weather && (
                    <>
                      <span>·</span>
                      <span className="tabular-nums font-medium text-[#0A0A0A]">
                        {activeTrip.weather.summary.avgLow}°–{activeTrip.weather.summary.avgHigh}°C ·{' '}
                        {activeTrip.weather.summary.primaryCondition}
                      </span>
                    </>
                  )}
                </p>
                {weatherError && (
                  <p className="text-xs text-[#0A0A0A] bg-[#E6DFD2]/60 rounded-md px-3 py-1.5 mt-2 inline-block">
                    {weatherError}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRefreshWeather}
                  disabled={weatherBusy || !isOnline}
                  className="h-10 px-4 rounded-lg bg-[#FBFAF8] border border-[#0A0A0A]/15 text-xs font-medium text-[#0A0A0A] inline-flex items-center gap-1.5 hover:border-[#0A0A0A] transition-colors disabled:opacity-50"
                >
                  {weatherBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CloudSun className="w-3.5 h-3.5" />
                  )}
                  <span>{activeTrip.weather ? 'Refresh Weather' : 'Load Weather'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('smart-packing')}
                  className="h-10 px-4 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#0A0A0A]/88 transition-colors"
                >
                  <span>Smart Packing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('ai-outfit-studio')}
                  className="h-10 px-4 rounded-lg bg-[#D5DCD9]/70 text-[#0A0A0A] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#D5DCD9] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Plan Outfits</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Preparation Timeline */}
              <div className="lg:col-span-6 rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#0A0A0A]/75">Countdown Schedule</p>
                    <h3 className="font-serif text-2xl font-medium text-[#0A0A0A]">
                      Preparation Timeline
                    </h3>
                  </div>
                  <span className="text-xs font-medium text-[#0A0A0A]/65 tabular-nums">
                    {activeTrip.timelineTasks.filter((t) => t.completed).length}/
                    {activeTrip.timelineTasks.length}
                  </span>
                </div>

                <div className="divide-y divide-[#0A0A0A]/8">
                  {activeTrip.timelineTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleToggleTimeline(task.id)}
                      className="w-full py-3 flex items-start justify-between gap-3 text-left hover:bg-[#FBFAF8]/60 px-2 -mx-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            task.completed
                              ? 'bg-[#0B3B40] border-[#0A0A0A] text-[#FBFAF8]'
                              : 'border-[#0A0A0A]/30 bg-[#FBFAF8]'
                          }`}
                        >
                          {task.completed && <Check className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-sm ${
                              task.completed
                                ? 'line-through text-[#0A0A0A]/45'
                                : 'text-[#0A0A0A] font-medium'
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.notes && (
                            <p className="text-xs text-[#0A0A0A]/75 mt-0.5">{task.notes}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-[#0A0A0A]/75 tabular-nums shrink-0">
                        {task.dueDate}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Before You Leave Mode */}
              <div className="lg:col-span-6 rounded-3xl bg-[#FBFAF8] border border-[#0A0A0A]/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#0A0A0A]/75">Departure Safety</p>
                    <h3 className="font-serif text-2xl font-medium text-[#0A0A0A]">
                      Before You Leave
                    </h3>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-[#0A0A0A]/65" />
                </div>

                <div className="divide-y divide-[#0A0A0A]/8">
                  {activeTrip.beforeLeaveTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleToggleBeforeLeave(task.id)}
                      className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-[#FBFAF8]/60 px-2 -mx-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                            task.completed
                              ? 'bg-[#0B3B40] border-[#0A0A0A] text-[#FBFAF8]'
                              : 'border-[#0A0A0A]/30 bg-[#FBFAF8]'
                          }`}
                        >
                          {task.completed && <Check className="w-3 h-3" />}
                        </span>
                        <span
                          className={`text-sm ${
                            task.completed
                              ? 'line-through text-[#0A0A0A]/45'
                              : 'text-[#0A0A0A] font-medium'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#FBFAF8] text-[#0A0A0A]/65 shrink-0">
                        {task.category}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
