import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CloudRain,
  CloudSun,
  DoorClosed,
  Luggage,
  Plus,
  RefreshCw,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { DocumentRecord, PackingList, ReminderItem, UserAccount, WeatherReport } from '../types';
import {
  daysUntilDate,
  evaluateTripDocumentReadiness,
  extractMemoryInsights,
} from '../utils/packingEngine';
import { ProgressRing } from '../components/ui/ProgressRing';
import { SafeImage } from '../components/ui/SafeImage';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export type TripJumpTab =
  | 'checklist'
  | 'suitcase'
  | 'timeline'
  | 'before_leave'
  | 'weather'
  | 'group'
  | 'shopping'
  | 'memory';

interface HomeScreenProps {
  user: UserAccount;
  lists: PackingList[];
  reminders: ReminderItem[];
  documents: DocumentRecord[];
  isOnline: boolean;
  hasSampleData: boolean;
  sampleBannerDismissed?: boolean;
  onDismissSampleBanner: () => void;
  onClearSampleData: () => void;
  onOpenList: (listId: string, subTab?: TripJumpTab) => void;
  onCreateTrip: () => void;
  onOpenWardrobe: () => void;
  onOpenEssentials: () => void;
  onOpenAI: (listId?: string) => void;
  onOpenHistory: () => void;
  onToggleReminder: (reminderId: string) => void;
  onSaveWeather: (listId: string, weather: WeatherReport) => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  lists,
  reminders,
  documents,
  isOnline,
  hasSampleData,
  sampleBannerDismissed,
  onDismissSampleBanner,
  onClearSampleData,
  onOpenList,
  onCreateTrip,
  onOpenWardrobe,
  onOpenEssentials,
  onOpenAI,
  onOpenHistory,
  onToggleReminder,
  onSaveWeather,
}) => {
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [clearSampleConfirm, setClearSampleConfirm] = useState(false);

  const activeTrips = useMemo(
    () =>
      lists
        .filter((l) => !l.completed)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [lists]
  );

  const nextTrip = activeTrips[0] || null;
  const daysToNext = nextTrip ? daysUntilDate(nextTrip.startDate) : null;

  const memoryInsights = useMemo(() => extractMemoryInsights(lists), [lists]);

  const nextTripPrepPct = useMemo(() => {
    if (!nextTrip) return 0;
    const totalTasks = nextTrip.items.length + (nextTrip.timelineTasks?.length || 0);
    const doneTasks =
      nextTrip.items.filter((i) => i.packed).length +
      (nextTrip.timelineTasks || []).filter((t) => t.completed).length;
    return totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  }, [nextTrip]);

  const beforeLeaveStats = useMemo(() => {
    if (!nextTrip || !nextTrip.beforeLeaveTasks) return { done: 0, total: 0, pct: 0 };
    const total = nextTrip.beforeLeaveTasks.length;
    const done = nextTrip.beforeLeaveTasks.filter((t) => t.completed).length;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [nextTrip]);

  const docReadiness = useMemo(
    () => (nextTrip ? evaluateTripDocumentReadiness(nextTrip, documents) : null),
    [nextTrip, documents]
  );

  const urgentShoppingCount = useMemo(() => {
    if (!nextTrip) return 0;
    return nextTrip.shoppingItems.filter((s) => s.status === 'To Buy').length;
  }, [nextTrip]);

  const fetchTripWeather = async (trip: PackingList) => {
    if (!trip.destination || !isOnline) return;
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const params = new URLSearchParams({
        city: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
      });
      const res = await fetch(`/api/weather?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setWeatherError(data.error || 'Weather forecast unavailable.');
      } else {
        onSaveWeather(trip.id, data as WeatherReport);
      }
    } catch {
      setWeatherError('Could not reach live weather right now.');
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (nextTrip && nextTrip.destination && !nextTrip.weather && isOnline && !weatherLoading) {
      fetchTripWeather(nextTrip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextTrip?.id, isOnline]);

  const firstName = user.name.split(' ')[0] || 'Traveller';

  return (
    <div className="space-y-6 pb-8">
      {/* Transparent Sample Data Notice for First-Time Users */}
      {hasSampleData && !sampleBannerDismissed && (
        <div className="p-3.5 rounded-2xl bg-[#D9C9F266] dark:bg-[#FFFFFF0f] border border-[#D9C9F2] dark:border-[#FFFFFF24] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#101010cc] dark:text-[#FFFFFF]">
            <span className="font-bold text-[#101010] dark:text-white">Sample Trip Data Active:</span>{' '}
            Explore Kerala, Tokyo, and Coorg sample trips right away, or clear them anytime for a blank slate.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setClearSampleConfirm(true)}
              className="min-h-[34px] px-3 rounded-xl bg-white dark:bg-[#FFFFFF0f] border border-[#D9C9F2] dark:border-[#FFFFFF24] text-xs font-semibold text-[#101010] dark:text-[#D9C9F2]"
            >
              Clear Samples
            </button>
            <button
              type="button"
              onClick={onDismissSampleBanner}
              className="min-h-[34px] px-2.5 text-xs font-medium text-[#101010b2] hover:text-[#101010] dark:hover:text-white"
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {/* Greeting Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#101010b2] dark:text-[#FFFFFFa8]">
            {getTimeGreeting()}, {firstName}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#101010] dark:text-white mt-0.5">
            Your Travel Command Center
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onOpenAI(nextTrip?.id)}
          className="min-h-[44px] px-3.5 rounded-2xl bg-[#D9C9F266] dark:bg-[#FFFFFF0f] border border-[#D9C9F2] dark:border-[#FFFFFF24] text-[#101010] dark:text-[#D9C9F2] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>PackSmart AI</span>
        </button>
      </div>

      {/* Main Hero Grid: Upcoming Trip + Before You Leave Mode */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7">
          {nextTrip ? (
            <div className="h-full rounded-3xl overflow-hidden bg-[#101010] text-white shadow-lg shadow-[#101010]/12 border border-[#101010] flex flex-col">
              <div className="relative h-40 sm:h-44 overflow-hidden">
                <SafeImage
                  src={nextTrip.coverImage}
                  alt={nextTrip.title}
                  className="w-full h-full object-cover"
                  fallbackLabel={nextTrip.destination || nextTrip.title}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-[#101010]/50 to-transparent" />
                <div className="absolute bottom-3.5 left-5 right-5 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#D9C9F2]">
                      {nextTrip.tripType} · {nextTrip.destination || 'Local'}
                      {nextTrip.isSampleData ? ' · Sample Trip' : ''}
                    </p>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                      {nextTrip.title}
                    </h2>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono tabular-nums text-lg font-bold text-[#101010]">
                      {daysToNext !== null && daysToNext < 0
                        ? 'In progress'
                        : daysToNext === 0
                        ? 'Today'
                        : daysToNext === 1
                        ? 'Tomorrow'
                        : `${daysToNext} days`}
                    </span>
                    <p className="text-[11px] text-white/70">{nextTrip.startDate}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <ProgressRing
                      percent={nextTripPrepPct}
                      size={58}
                      strokeWidth={5}
                      progressColor="#B8D9F2"
                      trackClassName="stroke-white/15"
                      labelClassName="text-xs font-bold text-white"
                    />
                    <div>
                      <p className="text-sm font-semibold text-white">Overall Trip Preparation</p>
                      <p className="text-xs text-white/70 mt-0.5 tabular-nums">
                        {nextTrip.items.filter((i) => i.packed).length}/{nextTrip.items.length} packed ·{' '}
                        {nextTrip.luggageType.split(' ')[0]} ·{' '}
                        {docReadiness?.ready ? 'Docs Ready' : docReadiness?.label}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenList(nextTrip.id, 'checklist')}
                    className="min-h-[44px] px-4 rounded-xl bg-[#B8D9F2] text-[#101010] font-bold text-xs flex items-center gap-1 hover:opacity-95 whitespace-nowrap shrink-0"
                  >
                    <span>Prepare</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Live Weather Strip */}
                <div className="pt-3.5 border-t border-white/10 flex items-center justify-between gap-3">
                  {nextTrip.weather ? (
                    <button
                      type="button"
                      onClick={() => onOpenList(nextTrip.id, 'weather')}
                      className="flex-1 flex items-center justify-between gap-3 text-left min-h-[44px]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          {nextTrip.weather.summary.maxRainChance >= 45 ? (
                            <CloudRain className="w-4 h-4 text-[#D9C9F2]" />
                          ) : (
                            <Sun className="w-4 h-4 text-[#101010]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {nextTrip.weather.shortLocation} ·{' '}
                            <span className="font-mono tabular-nums">
                              {nextTrip.weather.summary.avgLow}°–{nextTrip.weather.summary.avgHigh}°C
                            </span>
                          </p>
                          <p className="text-[11px] text-white/70 truncate">
                            {nextTrip.weather.source === 'live_forecast' ? 'Actual Live Forecast' : 'Current Preview (trip >16d out)'} ·{' '}
                            {nextTrip.weather.summary.maxRainChance}% rain
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#D9C9F2] shrink-0">Weather</span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-between gap-3">
                      <span className="text-xs text-white/75 flex items-center gap-2">
                        <CloudSun className="w-4 h-4 text-[#D9C9F2]" />
                        {weatherLoading
                          ? `Fetching live weather for ${nextTrip.destination}...`
                          : weatherError || `Check live weather for ${nextTrip.destination}`}
                      </span>
                      {isOnline && (
                        <button
                          type="button"
                          onClick={() => fetchTripWeather(nextTrip)}
                          className="min-h-[36px] px-3 rounded-lg bg-white/10 text-xs font-semibold flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
                          <span>Fetch</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full rounded-3xl bg-[#101010] text-white p-6 flex flex-col justify-between gap-5">
              <div>
                <p className="text-xs text-[#D9C9F2]">No upcoming trips planned</p>
                <h2 className="font-display text-2xl font-bold mt-1">Plan your next journey smartly</h2>
                <p className="text-sm text-white/75 mt-2">
                  Build a tailored preparation timeline, capsule wardrobe plan, suitcase space map, and departure safety checklist in minutes.
                </p>
              </div>
              <button
                type="button"
                onClick={onCreateTrip}
                className="min-h-[48px] px-5 rounded-2xl bg-[#B8D9F2] text-[#101010] font-bold text-sm flex items-center justify-center gap-2 self-start"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Trip</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Before You Leave Mode + New Trip CTA */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {nextTrip && (
            <button
              type="button"
              onClick={() => onOpenList(nextTrip.id, 'before_leave')}
              className={`w-full p-5 rounded-3xl border text-left transition-all flex items-center justify-between gap-4 ${
                daysToNext !== null && daysToNext <= 3
                  ? 'bg-[#B8D9F266] dark:bg-[#101010] border-[#10101040] dark:border-[#FFFFFF24]'
                  : 'bg-white dark:bg-[#FFFFFF0f] border-[#1010101f] dark:border-[#FFFFFF24]'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#101010] text-white flex items-center justify-center shrink-0">
                  <DoorClosed className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#101010] dark:text-[#FFFFFF]">
                    {daysToNext !== null && daysToNext <= 3
                      ? 'Activated · Departure Approaching'
                      : 'Departure Safety Checklist'}
                  </p>
                  <p className="font-display font-bold text-base text-[#101010] dark:text-white truncate">
                    Before You Leave Mode
                  </p>
                  <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8] tabular-nums mt-0.5">
                    {beforeLeaveStats.done}/{beforeLeaveStats.total} tasks complete · Locks, gas, devices
                  </p>
                </div>
              </div>
              <ProgressRing
                percent={beforeLeaveStats.pct}
                size={46}
                strokeWidth={4}
                progressColor="#B8D9F2"
              />
            </button>
          )}

          {/* Connected Workflow Hub Grid */}
          <div className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-4 border border-[#1010101f] dark:border-[#FFFFFF24] flex-1 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#101010b2] dark:text-[#FFFFFFa8]">
                Connected Preparation Tools
              </p>
              <button
                type="button"
                onClick={onCreateTrip}
                className="text-xs font-bold text-[#101010] dark:text-[#D9C9F2] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Trip</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onOpenWardrobe}
                className="min-h-[68px] p-3 rounded-2xl bg-[#D9C9F266] dark:bg-[#FFFFFF0f] hover:bg-[#D9C9F266] dark:hover:bg-[#FFFFFF0f] border border-[#D9C9F2] dark:border-[#FFFFFF24] text-left transition-colors"
              >
                <Shirt className="w-4 h-4 text-[#101010] dark:text-[#D9C9F2] mb-1.5" />
                <p className="text-xs font-bold text-[#101010] dark:text-white">AI Outfit Matcher</p>
                <p className="text-[11px] text-[#101010cc] dark:text-[#FFFFFFa8]">Scan clothes &amp; style</p>
              </button>

              <button
                type="button"
                onClick={() => (nextTrip ? onOpenList(nextTrip.id, 'suitcase') : onCreateTrip())}
                className="min-h-[68px] p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#101010] hover:bg-[#B8D9F266] dark:hover:bg-[#FFFFFF0f] border border-[#1010101f] dark:border-[#FFFFFF24] text-left transition-colors"
              >
                <Luggage className="w-4 h-4 text-[#101010] dark:text-[#FFFFFF] mb-1.5" />
                <p className="text-xs font-bold text-[#101010] dark:text-white">Suitcase Space</p>
                <p className="text-[11px] text-[#101010b2] dark:text-[#FFFFFFa8]">Visual fit & folding</p>
              </button>

              <button
                type="button"
                onClick={() => (nextTrip ? onOpenList(nextTrip.id, 'timeline') : onCreateTrip())}
                className="min-h-[68px] p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#101010] hover:bg-[#D9C9F266] dark:hover:bg-[#FFFFFF0f] border border-[#1010101f] dark:border-[#FFFFFF24] text-left transition-colors"
              >
                <CalendarClock className="w-4 h-4 text-[#101010] dark:text-[#D9C9F2] mb-1.5" />
                <p className="text-xs font-bold text-[#101010] dark:text-white">Smart Timeline</p>
                <p className="text-[11px] text-[#101010b2] dark:text-[#FFFFFFa8]">1 week to arrival</p>
              </button>

              <button
                type="button"
                onClick={onOpenEssentials}
                className="min-h-[68px] p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#101010] hover:bg-[#B8D9F266] dark:hover:bg-[#FFFFFF0f] border border-[#1010101f] dark:border-[#FFFFFF24] text-left transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-[#101010] dark:text-[#FFFFFF] mb-1.5" />
                <p className="text-xs font-bold text-[#101010] dark:text-white">Document Radar</p>
                <p className="text-[11px] text-[#101010b2] dark:text-[#FFFFFFa8]">
                  {docReadiness?.ready ? 'All valid' : docReadiness?.label || 'Expiry checks'}
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Radar Row: Shopping Radar + Post-Trip Memory Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Last-Minute Shopping Radar Alert */}
        <div className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-5 border border-[#1010101f] dark:border-[#FFFFFF24] flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FFC5A866] dark:bg-[#FFFFFF0f] text-[#101010] dark:text-[#FFC5A8] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#101010] dark:text-white">
                  Last-Minute Shopping Radar
                </h2>
                <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8]">
                  {urgentShoppingCount > 0
                    ? `${urgentShoppingCount} item${urgentShoppingCount === 1 ? '' : 's'} still pending for ${nextTrip?.title}`
                    : 'No pending purchases before departure'}
                </p>
              </div>
            </div>
            {nextTrip && (
              <button
                type="button"
                onClick={() => onOpenList(nextTrip.id, 'shopping')}
                className="min-h-[38px] px-3 rounded-xl bg-[#D9C9F266] dark:bg-[#FFFFFF0f] text-[#101010] dark:text-[#D9C9F2] text-xs font-semibold shrink-0"
              >
                Open
              </button>
            )}
          </div>

          {nextTrip && urgentShoppingCount > 0 && (
            <div className="divide-y divide-[#1010101f] dark:divide-[#FFFFFF24]">
              {nextTrip.shoppingItems
                .filter((s) => s.status === 'To Buy')
                .slice(0, 2)
                .map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#101010] dark:text-white flex items-center gap-1.5">
                      {s.priority === 'Urgent' && <AlertTriangle className="w-3.5 h-3.5 text-[#101010]" />}
                      {s.name}
                    </span>
                    <span className="text-[#101010b2] dark:text-[#FFFFFFa8]">{s.priority}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Post-Trip Memory Learning Card */}
        <div className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-5 border border-[#1010101f] dark:border-[#FFFFFF24] flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#D9C9F266] dark:bg-[#FFFFFF0f] text-[#101010] dark:text-[#D9C9F2] flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#101010] dark:text-white">
                  Learned From Past Trips
                </h2>
                <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8]">
                  {memoryInsights.totalReviews > 0
                    ? `Active intelligence from ${memoryInsights.totalReviews} post-trip review${memoryInsights.totalReviews === 1 ? '' : 's'}`
                    : 'Complete a post-trip review to make future lists smarter'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenHistory}
              className="min-h-[38px] px-3 rounded-xl bg-[#B8D9F266] dark:bg-[#101010] text-[#101010] dark:text-[#FFFFFF] text-xs font-semibold shrink-0"
            >
              Insights
            </button>
          </div>

          {memoryInsights.totalReviews > 0 && (
            <div className="space-y-1.5 text-xs">
              {memoryInsights.frequentlyForgotten[0] && (
                <p className="text-[#101010] dark:text-[#FFFFFF]">
                  • Auto-prioritizing{' '}
                  <span className="font-bold text-[#101010] dark:text-[#D9C9F2]">
                    {memoryInsights.frequentlyForgotten[0].name}
                  </span>{' '}
                  so it isn't forgotten again.
                </p>
              )}
              {memoryInsights.frequentlyUnused[0] && (
                <p className="text-[#101010] dark:text-[#FFFFFF]">
                  • Suggesting to skip{' '}
                  <span className="font-bold text-[#101010] dark:text-[#FFFFFF]">
                    {memoryInsights.frequentlyUnused[0].name}
                  </span>{' '}
                  (packed previously, never used).
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Reminders */}
      {reminders.filter((r) => !r.completed).length > 0 && (
        <section className="bg-white dark:bg-[#FFFFFF0f] rounded-3xl p-5 border border-[#1010101f] dark:border-[#FFFFFF24]">
          <h2 className="font-display text-base font-bold text-[#101010] dark:text-white mb-3">
            Preparation Reminders
          </h2>
          <div className="divide-y divide-[#1010101f] dark:divide-[#FFFFFF24]">
            {reminders
              .filter((r) => !r.completed)
              .slice(0, 3)
              .map((rem) => (
                <button
                  key={rem.id}
                  type="button"
                  onClick={() => onToggleReminder(rem.id)}
                  className="w-full py-2.5 flex items-center gap-3 text-left min-h-[46px]"
                >
                  <span className="w-5 h-5 rounded-full border-2 border-[#10101040] dark:border-[#FFFFFF24] flex items-center justify-center shrink-0">
                    {rem.completed && <CheckCircle2 className="w-4 h-4 text-[#101010]" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#101010] dark:text-white truncate">{rem.title}</p>
                    <p className="text-xs text-[#101010b2] dark:text-[#FFFFFFa8]">
                      {rem.category} · Due {rem.dueDate}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={clearSampleConfirm}
        title="Clear sample trips and documents?"
        description="This removes the pre-loaded sample trips and sample documents so you can start completely fresh with your own trips. Your digital wardrobe stays ready."
        confirmLabel="Clear Sample Data"
        onConfirm={() => {
          onClearSampleData();
          setClearSampleConfirm(false);
        }}
        onCancel={() => setClearSampleConfirm(false)}
      />
    </div>
  );
};
