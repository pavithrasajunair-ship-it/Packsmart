import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  CloudRain,
  CloudSun,
  Loader2,
  Luggage,
  MapPin,
  Plus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import type {
  DocumentRecord,
  OutfitCombination,
  PackingItem,
  PackingList,
  TabId,
  UserAccount,
  WardrobeItem,
  WeatherReport,
} from '../../types';
import {
  analyzeSuitcaseSpace,
  calculateTripDays,
  daysUntilDate,
  estimateItemVolumeLiters,
} from '../../utils/packingEngine';
import { uid } from '../../utils/storage';
import type { PlatformRoute } from './HomePage';

interface DashboardViewProps {
  user: UserAccount;
  lists: PackingList[];
  selectedTripId: string | null;
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  savedOutfits: OutfitCombination[];
  documents: DocumentRecord[];
  isOnline: boolean;
  onSelectTrip: (tripId: string) => void;
  onUpdateList: (updated: PackingList) => void;
  onSaveWeather: (tripId: string, weather: WeatherReport) => void;
  onNavigate: (route: PlatformRoute) => void;
  onOpenClassicTool: (tab: TabId) => void;
  onOpenClassicTripSubTab: (tripId: string, subTab: 'checklist' | 'suitcase' | 'before_leave' | 'group') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  lists,
  selectedTripId,
  wardrobe,
  wardrobePhotos,
  savedOutfits,
  documents,
  isOnline,
  onSelectTrip,
  onUpdateList,
  onSaveWeather,
  onNavigate,
  onOpenClassicTool,
  onOpenClassicTripSubTab,
}) => {
  const activeTrip = useMemo(
    () =>
      lists.find((l) => l.id === selectedTripId) ||
      lists.find((l) => !l.completed) ||
      lists[0] ||
      null,
    [lists, selectedTripId]
  );

  const metrics = useMemo(
    () => (activeTrip ? analyzeSuitcaseSpace(activeTrip) : null),
    [activeTrip]
  );

  const [quickItem, setQuickItem] = useState('');
  const [quickCat, setQuickCat] = useState('Clothing');
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherError, setWeatherError] = useState('');

  const packedCount = activeTrip ? activeTrip.items.filter((i) => i.packed).length : 0;
  const totalCount = activeTrip ? activeTrip.items.length : 0;
  const packedPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;
  const daysLeft = activeTrip ? daysUntilDate(activeTrip.startDate) : null;
  const tripDuration = activeTrip
    ? calculateTripDays(activeTrip.startDate, activeTrip.endDate)
    : 0;

  const handleToggleItem = (itemId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      items: activeTrip.items.map((it) =>
        it.id === itemId ? { ...it, packed: !it.packed } : it
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !quickItem.trim()) return;
    const weight = quickCat === 'Electronics' ? 280 : quickCat === 'Documents' ? 60 : 240;
    const created: PackingItem = {
      id: uid('item'),
      name: quickItem.trim(),
      category: quickCat,
      quantity: 1,
      packed: false,
      weightGrams: weight,
      volumeLiters: estimateItemVolumeLiters(quickCat, weight),
      priority: 'Essential',
      essential: true,
      order: 0,
    };
    onUpdateList({
      ...activeTrip,
      items: [created, ...activeTrip.items],
      updatedAt: new Date().toISOString(),
    });
    setQuickItem('');
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

  const handleFetchWeather = async () => {
    if (!activeTrip) return;
    const city = activeTrip.destination || activeTrip.title;
    if (!city) return;
    if (!isOnline) {
      setWeatherError('Connect to the internet to refresh the live forecast.');
      return;
    }
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
        setWeatherError(data.error || 'Could not load weather for this destination.');
      } else {
        onSaveWeather(activeTrip.id, data as WeatherReport);
      }
    } catch {
      setWeatherError('Weather service is temporarily unavailable.');
    } finally {
      setWeatherBusy(false);
    }
  };

  return (
    <div className="bg-[#FFFFFF] min-h-[calc(100vh-4rem)] py-8 sm:py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* ==================== PAGE HEADER ==================== */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#171717]/60">Travel Workspace</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#171717]">
              Good to see you, {user.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lists.length > 0 && activeTrip && (
              <select
                aria-label="Select active trip"
                value={activeTrip.id}
                onChange={(e) => onSelectTrip(e.target.value)}
                className="h-10 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm font-medium text-[#171717]"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => onNavigate('trip-planner')}
              className="h-10 px-5 rounded-lg bg-[#171717] text-[#FFFFFF] text-sm font-medium inline-flex items-center gap-1.5 hover:bg-[#171717]/88 transition-colors duration-150 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>New Trip</span>
            </button>
          </div>
        </div>

        {/* ==================== 4 CONSISTENT KPI SUMMARY CARDS ==================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#171717]/60">Upcoming Departure</p>
            <p className="font-serif text-2xl sm:text-3xl font-medium text-[#171717] tabular-nums">
              {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days` : 'Ready'}
            </p>
            <p className="text-xs text-[#171717]/60 truncate">
              {activeTrip ? `${activeTrip.startDate} · ${tripDuration}d trip` : 'No active trip'}
            </p>
          </div>

          <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#171717]/60">Packing Checklist</p>
            <p className="font-serif text-2xl sm:text-3xl font-medium text-[#171717] tabular-nums">
              {packedPct}%
            </p>
            <p className="text-xs text-[#171717]/60 tabular-nums">
              {packedCount} of {totalCount} items packed
            </p>
          </div>

          <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#171717]/60">Suitcase Space</p>
            <p className="font-serif text-2xl sm:text-3xl font-medium text-[#171717] tabular-nums">
              {metrics ? `${metrics.totalVolumeLiters}L` : '0L'}
            </p>
            <p className="text-xs text-[#171717]/60 tabular-nums">
              {metrics
                ? `${metrics.volumePercent}% of ${metrics.capacityLiters}L · ${metrics.totalWeightKg} kg`
                : '40L carry-on target'}
            </p>
          </div>

          <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-5 flex flex-col justify-between gap-2">
            <p className="text-xs font-medium text-[#171717]/60">Digital Wardrobe</p>
            <p className="font-serif text-2xl sm:text-3xl font-medium text-[#171717] tabular-nums">
              {wardrobe.length} pieces
            </p>
            <p className="text-xs text-[#171717]/60 tabular-nums">
              {savedOutfits.length} saved outfits · {documents.length} vault docs
            </p>
          </div>
        </div>

        {/* ==================== ROW 1: UPCOMING TRIP OVERVIEW + WEATHER SUMMARY ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Upcoming Trip Overview (7 cols) */}
          <div className="lg:col-span-7 rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 flex flex-col justify-between gap-6">
            {activeTrip && metrics ? (
              <>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[#171717]/60">Upcoming Trip Overview</p>
                      <h2 className="font-serif text-2xl sm:text-3xl font-medium text-[#171717]">
                        {activeTrip.title}
                      </h2>
                      <p className="text-sm text-[#171717]/70 inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{activeTrip.destination || activeTrip.tripType}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {activeTrip.startDate} to {activeTrip.endDate}
                          </span>
                        </span>
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#FFFFFF] border border-[#171717]/10 text-[#171717]">
                      {activeTrip.luggageType}
                    </span>
                  </div>

                  {/* Progress Bars */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-[#171717]/65">Checklist Progress</span>
                        <span className="font-semibold text-[#171717]">{packedPct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#101010]/10 overflow-hidden">
                        <div
                          className="h-full bg-[#171717] rounded-full transition-all duration-300"
                          style={{ width: `${packedPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-[#171717]/65">Suitcase Capacity</span>
                        <span className="font-semibold text-[#171717]">
                          {metrics.volumePercent}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#101010]/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            metrics.isVolumeOverloaded ? 'bg-[#FFC5A8]' : 'bg-[#B8D9F2]'
                          }`}
                          style={{ width: `${Math.min(100, metrics.volumePercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#171717]/10 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('smart-packing')}
                    className="h-10 px-4 rounded-lg bg-[#171717] text-[#FFFFFF] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#171717]/88 transition-colors duration-150"
                  >
                    <Luggage className="w-3.5 h-3.5" />
                    <span>Open Smart Packing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('ai-outfit-studio')}
                    className="h-10 px-4 rounded-lg bg-[#D9C9F2]/55 text-[#171717] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#D9C9F2] transition-colors duration-150"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Match Outfits</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenClassicTripSubTab(activeTrip.id, 'before_leave')}
                    className="h-10 px-4 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-[#171717] text-xs font-medium hover:border-[#171717] transition-colors duration-150"
                  >
                    Before You Leave ({activeTrip.beforeLeaveTasks.filter((t) => t.completed).length}/
                    {activeTrip.beforeLeaveTasks.length})
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center space-y-3">
                <p className="font-serif text-2xl text-[#171717]">No upcoming trip yet</p>
                <p className="text-sm text-[#171717]/65">
                  Start a trip in the Trip Planner to see your live packing progress and weather.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('trip-planner')}
                  className="h-10 px-5 rounded-lg bg-[#171717] text-[#FFFFFF] text-sm font-medium"
                >
                  Create Your First Trip
                </button>
              </div>
            )}
          </div>

          {/* Clean Weather Summary (5 cols — Supporting Powder Blue Surface) */}
          <div className="lg:col-span-5 rounded-xl bg-[#B8D9F2]/28 border border-[#171717]/10 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#171717]/65">Weather Summary</p>
                  <h2 className="font-serif text-2xl font-medium text-[#171717] mt-0.5">
                    {activeTrip?.weather?.shortLocation || activeTrip?.destination || 'Destination Forecast'}
                  </h2>
                </div>
                {activeTrip && (
                  <button
                    type="button"
                    onClick={handleFetchWeather}
                    disabled={weatherBusy || !isOnline}
                    className="h-9 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717] inline-flex items-center gap-1.5 hover:border-[#171717] transition-colors disabled:opacity-50"
                  >
                    {weatherBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudSun className="w-3.5 h-3.5" />
                    )}
                    <span>{activeTrip.weather ? 'Refresh' : 'Load Live'}</span>
                  </button>
                )}
              </div>

              {weatherError && (
                <p className="text-xs font-medium text-[#171717] bg-[#FFC5A8]/60 rounded-lg p-3">
                  {weatherError}
                </p>
              )}

              {activeTrip?.weather ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-[#FFFFFF] rounded-lg border border-[#171717]/10 p-4">
                    <div className="flex items-center gap-3">
                      {activeTrip.weather.summary.maxRainChance >= 45 ? (
                        <CloudRain className="w-6 h-6 text-[#171717]" />
                      ) : (
                        <Sun className="w-6 h-6 text-[#171717]" />
                      )}
                      <div>
                        <p className="text-xl font-semibold text-[#171717] tabular-nums">
                          {activeTrip.weather.summary.avgLow}° – {activeTrip.weather.summary.avgHigh}°C
                        </p>
                        <p className="text-xs text-[#171717]/65">
                          {activeTrip.weather.summary.primaryCondition}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[#171717]/70 tabular-nums">
                      <p>Rain {activeTrip.weather.summary.maxRainChance}%</p>
                      <p>Humidity {activeTrip.weather.summary.avgHumidity}%</p>
                    </div>
                  </div>

                  {activeTrip.weather.recommendations.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[#171717]/65">Weather Recommendations</p>
                      <ul className="space-y-1.5 text-xs text-[#171717]/80">
                        {activeTrip.weather.recommendations.slice(0, 2).map((rec) => (
                          <li
                            key={rec.name}
                            className="bg-[#FFFFFF]/80 rounded-lg px-3 py-2 border border-[#171717]/8"
                          >
                            <span className="font-semibold text-[#171717]">{rec.name}</span> —{' '}
                            {rec.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#FFFFFF]/80 rounded-lg border border-[#171717]/10 p-4 space-y-2">
                  <p className="text-sm font-medium text-[#171717]">
                    {activeTrip?.weatherPreference || 'Auto (Live Weather)'}
                  </p>
                  <p className="text-xs text-[#171717]/70 leading-relaxed">
                    Fetch live Open-Meteo meteorological data for your trip dates to tailor layers and rain gear.
                  </p>
                </div>
              )}
            </div>

            <p className="text-xs text-[#171717]/60">
              {activeTrip?.weather
                ? activeTrip.weather.note
                : 'Powered by Open-Meteo live forecasts'}
            </p>
          </div>
        </div>

        {/* ==================== ROW 2: PACKING CHECKLIST + PREPARATION TIMELINE ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Interactive Packing Checklist (6 cols) */}
          <div className="lg:col-span-6 rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#171717]/60">Packing Checklist</p>
                  <h2 className="font-serif text-2xl font-medium text-[#171717]">
                    Essential Items
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('smart-packing')}
                  className="text-xs font-medium text-[#171717] inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                >
                  <span>Full List</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeTrip && (
                <form onSubmit={handleQuickAdd} className="flex gap-2">
                  <input
                    type="text"
                    value={quickItem}
                    onChange={(e) => setQuickItem(e.target.value)}
                    placeholder="Add an item to pack..."
                    className="flex-1 h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717] placeholder:text-[#171717]/45"
                  />
                  <select
                    aria-label="Category"
                    value={quickCat}
                    onChange={(e) => setQuickCat(e.target.value)}
                    className="h-10 px-2.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717]"
                  >
                    <option value="Clothing">Clothing</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Documents">Documents</option>
                    <option value="Toiletries">Toiletries</option>
                  </select>
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-lg bg-[#171717] text-[#FFFFFF] text-xs font-medium hover:bg-[#171717]/88 transition-colors shrink-0"
                  >
                    Add
                  </button>
                </form>
              )}

              <div className="divide-y divide-[#171717]/8 max-h-[300px] overflow-y-auto pr-1">
                {activeTrip && activeTrip.items.length > 0 ? (
                  activeTrip.items.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleItem(item.id)}
                      className="w-full py-2.5 flex items-center justify-between gap-3 text-left min-h-[44px] hover:bg-[#FFFFFF]/60 px-2 -mx-2 rounded-lg transition-colors duration-150"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                            item.packed
                              ? 'bg-[#171717] border-[#171717] text-[#FFFFFF]'
                              : 'border-[#171717]/30 bg-[#FFFFFF]'
                          }`}
                        >
                          {item.packed && <Check className="w-3 h-3" />}
                        </span>
                        <span
                          className={`text-sm truncate ${
                            item.packed
                              ? 'line-through text-[#171717]/45'
                              : 'text-[#171717] font-medium'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>
                      <span className="text-xs text-[#171717]/55 tabular-nums shrink-0">
                        {item.category} · ×{item.quantity}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-sm text-[#171717]/60 text-center">
                    No packing items yet. Add one above or create a trip.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Preparation Timeline (6 cols) */}
          <div className="lg:col-span-6 rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#171717]/60">Preparation Timeline</p>
                  <h2 className="font-serif text-2xl font-medium text-[#171717]">
                    Departure Milestones
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('trip-planner')}
                  className="text-xs font-medium text-[#171717] inline-flex items-center gap-1 hover:opacity-70 transition-opacity"
                >
                  <span>Full Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-[#171717]/8 max-h-[345px] overflow-y-auto pr-1">
                {activeTrip && activeTrip.timelineTasks.length > 0 ? (
                  activeTrip.timelineTasks.slice(0, 7).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => handleToggleTimeline(task.id)}
                      className="w-full py-2.5 flex items-start justify-between gap-3 text-left min-h-[44px] hover:bg-[#FFFFFF]/60 px-2 -mx-2 rounded-lg transition-colors duration-150"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                            task.completed
                              ? 'bg-[#171717] border-[#171717] text-[#FFFFFF]'
                              : 'border-[#171717]/30 bg-[#FFFFFF]'
                          }`}
                        >
                          {task.completed && <Check className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-sm leading-snug ${
                              task.completed
                                ? 'line-through text-[#171717]/45'
                                : 'text-[#171717] font-medium'
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.notes && (
                            <p className="text-xs text-[#171717]/55 truncate mt-0.5">
                              {task.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-[#171717]/55 tabular-nums shrink-0">
                        {task.dueDate}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-sm text-[#171717]/60 text-center">
                    Create a trip with dates to generate your preparation timeline.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ==================== ROW 3: DIGITAL WARDROBE OVERVIEW ==================== */}
        <div className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-[#171717]/60">Digital Wardrobe Overview</p>
              <h2 className="font-serif text-2xl font-medium text-[#171717]">
                Your Owned Capsule Pieces
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate('digital-wardrobe')}
                className="h-9 px-4 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors"
              >
                Manage Wardrobe ({wardrobe.length})
              </button>
              <button
                type="button"
                onClick={() => onNavigate('ai-outfit-studio')}
                className="h-9 px-4 rounded-lg bg-[#171717] text-[#FFFFFF] text-xs font-medium hover:bg-[#171717]/88 transition-colors"
              >
                Generate Outfits
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {wardrobe.slice(0, 6).map((item) => {
              const photo = item.photoId ? wardrobePhotos[item.photoId] : undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate('digital-wardrobe')}
                  className="text-left rounded-lg border border-[#171717]/10 bg-[#FFFFFF]/50 overflow-hidden hover:border-[#171717]/35 transition-colors flex flex-col"
                >
                  <div className="aspect-square w-full bg-[#FFFFFF] flex items-center justify-center overflow-hidden">
                    {photo ? (
                      <img
                        src={photo}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span
                        className="w-10 h-10 rounded-lg border border-[#171717]/15 flex items-center justify-center"
                        style={{ backgroundColor: item.colorHex }}
                      >
                        <Shirt className="w-5 h-5 text-[#FFFFFF]" />
                      </span>
                    )}
                  </div>
                  <div className="p-3 bg-[#FFFFFF] space-y-0.5">
                    <p className="text-xs font-semibold text-[#171717] truncate">{item.name}</p>
                    <p className="text-[11px] text-[#171717]/60 truncate">
                      {item.category} · {item.colorName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================== ADDITIONAL WORKSPACE TOOLS STRIP ==================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onOpenClassicTool('essentials')}
            className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-5 text-left flex items-center justify-between gap-4 hover:border-[#171717]/35 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#FFC5A8]/45 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#171717]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#171717] truncate">Document Vault &amp; Templates</p>
                <p className="text-xs text-[#171717]/60 truncate">
                  {documents.length} encrypted documents &amp; expiry alerts
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#171717]/50 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() =>
              activeTrip
                ? onOpenClassicTripSubTab(activeTrip.id, 'group')
                : onOpenClassicTool('trips')
            }
            className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-5 text-left flex items-center justify-between gap-4 hover:border-[#171717]/35 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#D9C9F2]/55 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-[#171717]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#171717] truncate">Group Packing &amp; Sharing</p>
                <p className="text-xs text-[#171717]/60 truncate">
                  Assign shared items and invite travel companions
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#171717]/50 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onOpenClassicTool('profile')}
            className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-5 text-left flex items-center justify-between gap-4 hover:border-[#171717]/35 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#B8D9F2]/55 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-[#171717]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#171717] truncate">Post-Trip Memory &amp; Backup</p>
                <p className="text-xs text-[#171717]/60 truncate">
                  Preferences, JSON backup &amp; packing insights
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#171717]/50 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
