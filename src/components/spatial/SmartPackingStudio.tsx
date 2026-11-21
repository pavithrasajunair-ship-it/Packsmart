import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CloudSun,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { PackingItem, PackingList, WeatherReport } from '../../types';
import { analyzeSuitcaseSpace, calculateTripDays, estimateItemVolumeLiters } from '../../utils/packingEngine';
import { uid } from '../../utils/storage';
import { OpenSuitcase3D, SuitcaseCameraView } from './OpenSuitcase3D';

interface SmartPackingStudioProps {
  lists: PackingList[];
  selectedTripId: string | null;
  isOnline: boolean;
  aiConfigured: boolean;
  onSelectTrip: (tripId: string) => void;
  onUpdateList: (updated: PackingList) => void;
  onOpenTripPlanner: () => void;
  onOpenOutfitStudio: () => void;
  onOpenClassicDetail: (tripId: string, subTab?: 'suitcase' | 'before_leave' | 'checklist') => void;
  onSaveWeather: (tripId: string, weather: WeatherReport) => void;
}

const CATEGORIES = [
  'All',
  'Clothing',
  'Footwear',
  'Electronics',
  'Toiletries',
  'Accessories',
  'Documents',
] as const;

interface AssistantSuggestion {
  name: string;
  category: string;
  quantity: number;
  weightGrams: number;
  reason: string;
}

export const SmartPackingStudio: React.FC<SmartPackingStudioProps> = ({
  lists,
  selectedTripId,
  isOnline,
  aiConfigured,
  onSelectTrip,
  onUpdateList,
  onOpenTripPlanner,
  onOpenOutfitStudio,
  onOpenClassicDetail,
  onSaveWeather,
}) => {
  const activeTrip = useMemo(
    () =>
      lists.find((l) => l.id === selectedTripId) ||
      lists.find((l) => !l.completed) ||
      lists[0] ||
      null,
    [lists, selectedTripId]
  );

  const [cameraView, setCameraView] = useState<SuitcaseCameraView>('editorial');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [rightTab, setRightTab] = useState<'items' | 'assistant'>('items');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Add item state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Clothing');
  const [newEssential, setNewEssential] = useState<boolean>(true);

  // Intelligent Packing Assistant state
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantReply, setAssistantReply] = useState('');
  const [assistantSuggestions, setAssistantSuggestions] = useState<AssistantSuggestion[]>([]);
  const [assistantAlerts, setAssistantAlerts] = useState<string[]>([]);
  const [assistantError, setAssistantError] = useState('');
  const [weatherBusy, setWeatherBusy] = useState(false);

  const metrics = useMemo(
    () => (activeTrip ? analyzeSuitcaseSpace(activeTrip) : null),
    [activeTrip]
  );

  const filteredItems = useMemo(() => {
    if (!activeTrip) return [];
    if (activeCategory === 'All') return activeTrip.items;
    return activeTrip.items.filter((i) => i.category === activeCategory);
  }, [activeTrip, activeCategory]);

  const missingEssentials = useMemo(() => {
    if (!activeTrip) return [];
    return activeTrip.items.filter((i) => i.essential && !i.packed);
  }, [activeTrip]);

  const packedCount = activeTrip ? activeTrip.items.filter((i) => i.packed).length : 0;
  const totalCount = activeTrip ? activeTrip.items.length : 0;
  const progressPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const toggleItemPacked = (itemId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      items: activeTrip.items.map((it) =>
        it.id === itemId ? { ...it, packed: !it.packed } : it
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const removeItem = (itemId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      items: activeTrip.items.filter((it) => it.id !== itemId),
      updatedAt: new Date().toISOString(),
    });
  };

  const addItem = (
    name: string,
    category: string,
    quantity = 1,
    weightGrams?: number,
    essential = true
  ) => {
    if (!activeTrip || !name.trim()) return;
    const defaultWeight =
      weightGrams ??
      (category === 'Footwear'
        ? 580
        : category === 'Electronics'
        ? 320
        : category === 'Clothing'
        ? 250
        : category === 'Documents'
        ? 50
        : 140);
    const created: PackingItem = {
      id: uid('item'),
      name: name.trim(),
      category,
      quantity,
      packed: false,
      weightGrams: defaultWeight,
      volumeLiters: estimateItemVolumeLiters(category, defaultWeight),
      priority: essential ? 'Essential' : 'Helpful',
      essential,
      order: 0,
    };
    onUpdateList({
      ...activeTrip,
      items: [created, ...activeTrip.items],
      updatedAt: new Date().toISOString(),
    });
    setHighlightedId(created.id);
    window.setTimeout(() => setHighlightedId(null), 1600);
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addItem(newName, newCategory, 1, undefined, newEssential);
    setNewName('');
  };

  const handleRefreshTripWeather = async () => {
    if (!activeTrip || !activeTrip.destination || !isOnline) return;
    setWeatherBusy(true);
    try {
      const params = new URLSearchParams({
        city: activeTrip.destination,
        startDate: activeTrip.startDate,
        endDate: activeTrip.endDate,
      });
      const res = await fetch(`/api/weather?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        onSaveWeather(activeTrip.id, data as WeatherReport);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setWeatherBusy(false);
    }
  };

  const runIntelligentAssistant = async (customQuery?: string) => {
    if (!activeTrip) return;
    setAssistantBusy(true);
    setAssistantError('');

    const days = calculateTripDays(activeTrip.startDate, activeTrip.endDate);
    const weatherSummary = activeTrip.weather
      ? `${activeTrip.weather.summary.avgLow}°–${activeTrip.weather.summary.avgHigh}°C, ${activeTrip.weather.summary.primaryCondition}, ${activeTrip.weather.summary.maxRainChance}% rain`
      : activeTrip.weatherPreference;

    const queryText =
      (customQuery ?? assistantPrompt).trim() ||
      `Audit my ${days}-day ${activeTrip.destination || activeTrip.tripType} suitcase for missing essentials, weather readiness, and ${activeTrip.activities.join(', ') || 'city travel'}.`;

    try {
      if (isOnline && aiConfigured) {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: queryText,
            listContext: {
              title: activeTrip.title,
              destination: activeTrip.destination,
              mode: activeTrip.mode,
              days,
              travellers: activeTrip.travellers,
              weatherSummary,
              existingItems: activeTrip.items.map((i) => i.name),
            },
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setAssistantReply(data.reply || 'Here are tailored suitcase upgrades for your itinerary.');
          setAssistantSuggestions(Array.isArray(data.suggestedItems) ? data.suggestedItems : []);
          setAssistantAlerts(Array.isArray(data.forgottenAlerts) ? data.forgottenAlerts : []);
          setAssistantPrompt('');
          setAssistantBusy(false);
          return;
        }
      }

      // Deterministic weather + trip-duration smart rules fallback when offline or unconfigured
      const existingNames = new Set(activeTrip.items.map((i) => i.name.toLowerCase()));
      const fallback: AssistantSuggestion[] = [];

      if (activeTrip.weather?.recommendations) {
        activeTrip.weather.recommendations.forEach((rec) => {
          if (!existingNames.has(rec.name.toLowerCase())) {
            fallback.push({
              name: rec.name,
              category: rec.category,
              quantity: rec.quantity,
              weightGrams: rec.weightGrams,
              reason: rec.reason,
            });
          }
        });
      }

      const universalChecks: AssistantSuggestion[] = [
        {
          name: '65W Compact GaN Travel Adapter',
          category: 'Electronics',
          quantity: 1,
          weightGrams: 145,
          reason: `Single high-speed brick for ${days} days replaces multiple heavy chargers.`,
        },
        {
          name: 'Silk Sleep Mask & Earplugs',
          category: 'Accessories',
          quantity: 1,
          weightGrams: 45,
          reason: `Ideal for ${activeTrip.travelMethod.toLowerCase()} transit and hotel rest.`,
        },
        {
          name: 'Compression Packing Cubes (Set of 2)',
          category: 'Accessories',
          quantity: 1,
          weightGrams: 160,
          reason: 'Compresses knitwear and shirts by up to 28% inside your 40L shell.',
        },
        {
          name: 'Travel Fabric Wrinkle-Release Spray (60ml)',
          category: 'Toiletries',
          quantity: 1,
          weightGrams: 85,
          reason: 'Refreshes tailored blazers and shirts immediately on arrival.',
        },
      ];

      universalChecks.forEach((item) => {
        if (!existingNames.has(item.name.toLowerCase())) fallback.push(item);
      });

      setAssistantReply(
        `Analyzed your ${days}-day ${activeTrip.destination || activeTrip.title} suitcase (${metrics?.volumePercent ?? 0}% full, ${metrics?.totalWeightKg ?? 0} kg). Tap any recommendation below to drop it straight into your 3D suitcase.`
      );
      setAssistantSuggestions(fallback.slice(0, 6));
      setAssistantAlerts([
        'Verify passport validity (6+ months) & digital boarding pass backup.',
        'Pack liquids under 100ml in a single top-access pouch for cabin screening.',
      ]);
      setAssistantPrompt('');
    } catch {
      setAssistantError('Could not reach the packing advisor right now.');
    } finally {
      setAssistantBusy(false);
    }
  };

  if (!activeTrip || !metrics) {
    return (
      <div className="min-h-screen bg-[#B8D9F2] text-[#101010] pt-24 px-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-[#FFFFFF] border border-[#101010]/15 p-10 text-center space-y-5">
          <p className="font-mono text-xs tracking-[0.14em] text-[#101010]/60">SMART PACKING</p>
          <h2 className="font-editorial text-4xl">Your 3D suitcase awaits a destination.</h2>
          <button
            type="button"
            onClick={onOpenTripPlanner}
            className="min-h-[48px] px-7 bg-[#101010] text-[#FFFFFF] text-xs font-bold"
          >
            Plan Your First Trip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#B8D9F2] text-[#101010] pt-20 pb-10">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT / CENTER: INTERACTIVE 3D OPEN SUITCASE ATELIER */}
        <div className="lg:col-span-7 flex flex-col bg-[#FFFFFF] border border-[#101010]/15 overflow-hidden">
          {/* Top Quiet Studio Header */}
          <div className="px-6 py-5 border-b border-[#101010]/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-[#101010]/60">
                01. INTERACTIVE 3D SUITCASE ATELIER
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <select
                  aria-label="Select active trip"
                  value={activeTrip.id}
                  onChange={(e) => onSelectTrip(e.target.value)}
                  className="font-editorial text-2xl sm:text-3xl font-medium bg-transparent text-[#101010] pr-2 cursor-pointer border-b border-[#101010]/20"
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title} {l.destination ? `— ${l.destination}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-6 tabular-nums">
              <div>
                <p className="font-mono text-[10px] text-[#101010]/55">PACKED</p>
                <p className="font-mono text-lg font-bold text-[#101010]">
                  {progressPct}% <span className="text-xs font-normal text-[#101010]/60">({packedCount}/{totalCount})</span>
                </p>
              </div>
              <div className="h-7 w-px bg-[#101010]/12" />
              <div>
                <p className="font-mono text-[10px] text-[#101010]/55">VOLUME</p>
                <p className={`font-mono text-lg font-bold ${metrics.isVolumeOverloaded ? 'text-[#101010] underline decoration-[#FFC5A8] decoration-4' : 'text-[#101010]'}`}>
                  {metrics.totalVolumeLiters}L <span className="text-xs font-normal text-[#101010]/60">/ {metrics.capacityLiters}L</span>
                </p>
              </div>
              <div className="hidden sm:block h-7 w-px bg-[#101010]/12" />
              <div className="hidden sm:block">
                <p className="font-mono text-[10px] text-[#101010]/55">WEIGHT</p>
                <p className="font-mono text-lg font-bold text-[#101010]">
                  {metrics.totalWeightKg} <span className="text-xs font-normal text-[#101010]/60">/ {metrics.allowanceKg} kg</span>
                </p>
              </div>
            </div>
          </div>

          {/* 3D OPEN SUITCASE VIEWPORT (Unobstructed Center) */}
          <div className="relative flex-1 min-h-[380px] lg:min-h-[540px] bg-[#B8D9F2]/35">
            <OpenSuitcase3D
              items={activeTrip.items}
              highlightedItemId={highlightedId}
              cameraView={cameraView}
              onToggleItem={toggleItemPacked}
              className="w-full h-full"
            />

            {/* Minimal Bottom Camera Dock (Zero Side Occlusion) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[#101010] text-[#FFFFFF] px-2.5 py-1.5 border border-[#101010]">
              {(
                [
                  { id: 'editorial', label: 'Studio 3/4' },
                  { id: 'flatlay', label: 'Flat-Lay' },
                  { id: 'low', label: 'Low Angle' },
                ] as Array<{ id: SuitcaseCameraView; label: string }>
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setCameraView(preset.id)}
                  className={`min-h-[34px] px-3 font-mono text-[11px] transition-colors whitespace-nowrap ${
                    cameraView === preset.id
                      ? 'bg-[#FFC5A8] text-[#101010] font-bold'
                      : 'text-[#FFFFFF]/75 hover:text-[#FFFFFF]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <p className="hidden sm:block absolute top-3.5 left-5 font-mono text-[10px] tracking-[0.08em] text-[#101010]/60 pointer-events-none">
              DRAG TO ORBIT · CLICK ANY 3D OBJECT TO PACK / UNPACK
            </p>
          </div>

          {/* Animated Packing Capacity & Progress Bar */}
          <div className="px-6 py-4 bg-[#101010] text-[#FFFFFF] flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                <span className="text-[#B8D9F2]">
                  {metrics.isVolumeOverloaded
                    ? 'Overloaded — trim optional pieces or roll garments'
                    : `${activeTrip.luggageType} · ${metrics.volumePercent}% volume utilized`}
                </span>
                <span className="text-[#FFC5A8]">{progressPct}% packed</span>
              </div>
              <div className="h-2 w-full bg-white/15 overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: `${Math.min(100, progressPct)}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full bg-[#FFC5A8]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenOutfitStudio}
                className="min-h-[38px] px-3.5 border border-white/25 text-xs font-semibold text-[#FFFFFF] hover:bg-white hover:text-[#101010] transition-colors whitespace-nowrap"
              >
                Match Outfits
              </button>
              <button
                type="button"
                onClick={() => onOpenClassicDetail(activeTrip.id, 'before_leave')}
                className="min-h-[38px] px-3.5 bg-[#D9C9F2] text-[#101010] text-xs font-bold hover:bg-[#FFFFFF] transition-colors inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Before You Leave</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: INTERACTIVE ITEM CONSOLE & INTELLIGENT ASSISTANT */}
        <div className="lg:col-span-5 flex flex-col bg-[#FFFFFF] border border-[#101010]/15 overflow-hidden">
          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 border-b border-[#101010]/12">
            <button
              type="button"
              onClick={() => setRightTab('items')}
              className={`min-h-[52px] text-xs font-bold tracking-tight transition-colors ${
                rightTab === 'items'
                  ? 'bg-[#101010] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] text-[#101010]/70 hover:text-[#101010]'
              }`}
            >
              Suitcase Manifest ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setRightTab('assistant');
                if (assistantSuggestions.length === 0 && !assistantBusy) {
                  void runIntelligentAssistant();
                }
              }}
              className={`min-h-[52px] text-xs font-bold tracking-tight transition-colors inline-flex items-center justify-center gap-1.5 ${
                rightTab === 'assistant'
                  ? 'bg-[#101010] text-[#FFC5A8]'
                  : 'bg-[#FFFFFF] text-[#101010]/70 hover:text-[#101010]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Packing Assistant</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {rightTab === 'items' ? (
              <motion.div
                key="items"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex-1 flex flex-col p-5 sm:p-6 gap-5"
              >
                {/* Missing Essentials Callout */}
                {missingEssentials.length > 0 && (
                  <div className="bg-[#FFC5A8] text-[#101010] p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{missingEssentials.length} ESSENTIALS NOT YET PACKED</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleItemPacked(missingEssentials[0].id)}
                        className="text-[11px] font-bold underline underline-offset-2 whitespace-nowrap"
                      >
                        Pack &ldquo;{missingEssentials[0].name}&rdquo;
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Add Item Form */}
                <form onSubmit={handleQuickAddSubmit} className="space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Add clothing, shoes, tech, or essential..."
                      className="flex-1 min-h-[44px] px-3.5 border border-[#101010]/25 bg-[#FFFFFF] text-sm text-[#101010]"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 bg-[#101010] text-[#FFFFFF] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#101010]/85 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#FFC5A8]" />
                      <span>Add</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                      aria-label="New item category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="min-h-[36px] px-3 border border-[#101010]/20 bg-[#FFFFFF] text-xs font-semibold text-[#101010]"
                    >
                      {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-[#101010]/75 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newEssential}
                        onChange={(e) => setNewEssential(e.target.checked)}
                        className="accent-[#101010]"
                      />
                      <span>Mark as essential</span>
                    </label>
                  </div>
                </form>

                {/* Category Filter Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-[#101010]/10">
                  {CATEGORIES.map((cat) => {
                    const active = activeCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`min-h-[34px] px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#D9C9F2] text-[#101010] font-bold'
                            : 'text-[#101010]/65 hover:text-[#101010]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Live Interactive Packing Rows */}
                <div className="flex-1 max-h-[410px] overflow-y-auto divide-y divide-[#101010]/10 pr-1">
                  {filteredItems.length === 0 ? (
                    <p className="py-10 text-center text-xs text-[#101010]/60">
                      No items in this category yet. Add one above to animate it into the 3D suitcase.
                    </p>
                  ) : (
                    filteredItems.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        onMouseEnter={() => setHighlightedId(item.id)}
                        onMouseLeave={() => setHighlightedId(null)}
                        className="py-3 flex items-center justify-between gap-3 group"
                      >
                        <button
                          type="button"
                          onClick={() => toggleItemPacked(item.id)}
                          className="flex-1 flex items-center gap-3 text-left min-w-0 min-h-[40px]"
                        >
                          <span
                            className={`w-5 h-5 border flex items-center justify-center shrink-0 transition-colors ${
                              item.packed
                                ? 'bg-[#101010] border-[#101010] text-[#FFC5A8]'
                                : 'border-[#101010]/35 bg-[#FFFFFF] group-hover:border-[#101010]'
                            }`}
                          >
                            {item.packed && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${
                                item.packed ? 'line-through text-[#101010]/45' : 'text-[#101010]'
                              }`}
                            >
                              {item.name}
                            </p>
                            <p className="font-mono text-[11px] text-[#101010]/55">
                              {item.category} · ×{item.quantity} · {item.volumeLiters}L · {item.weightGrams}g
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="w-9 h-9 flex items-center justify-center text-[#101010]/40 hover:text-[#101010] transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="assistant"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex-1 flex flex-col p-5 sm:p-6 gap-4"
              >
                {/* Live Trip Context Strip */}
                <div className="p-4 bg-[#D9C9F2] text-[#101010] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.12em] text-[#101010]/65">
                      INTELLIGENT CONTEXT
                    </p>
                    <p className="text-xs font-bold mt-0.5">
                      {activeTrip.destination || activeTrip.title} ·{' '}
                      {calculateTripDays(activeTrip.startDate, activeTrip.endDate)} days ·{' '}
                      {activeTrip.weather
                        ? `${activeTrip.weather.summary.avgLow}°–${activeTrip.weather.summary.avgHigh}°C`
                        : activeTrip.weatherPreference}
                    </p>
                  </div>
                  {activeTrip.destination && (
                    <button
                      type="button"
                      onClick={handleRefreshTripWeather}
                      disabled={weatherBusy || !isOnline}
                      className="min-h-[34px] px-3 bg-[#101010] text-[#FFFFFF] text-[11px] font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {weatherBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CloudSun className="w-3.5 h-3.5 text-[#FFC5A8]" />
                      )}
                      <span>Sync Weather</span>
                    </button>
                  )}
                </div>

                {/* Ask Assistant Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void runIntelligentAssistant();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={assistantPrompt}
                    onChange={(e) => setAssistantPrompt(e.target.value)}
                    placeholder="Ask: What am I missing for rain or evening dinner?"
                    className="flex-1 min-h-[44px] px-3.5 border border-[#101010]/25 text-xs text-[#101010]"
                  />
                  <button
                    type="submit"
                    disabled={assistantBusy}
                    className="min-h-[44px] px-4 bg-[#101010] text-[#FFFFFF] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {assistantBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#FFC5A8]" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-[#FFC5A8]" />
                    )}
                    <span>Advise</span>
                  </button>
                </form>

                {assistantError && (
                  <p className="p-3 bg-[#FFC5A8] text-[#101010] text-xs font-semibold">
                    {assistantError}
                  </p>
                )}

                {assistantReply && (
                  <p className="text-xs text-[#101010]/80 leading-relaxed border-b border-[#101010]/10 pb-3">
                    {assistantReply}
                  </p>
                )}

                {assistantAlerts.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-mono text-[10px] text-[#101010]/60">ESSENTIAL REMINDERS</p>
                    {assistantAlerts.map((alert) => (
                      <p key={alert} className="text-xs text-[#101010] bg-[#B8D9F2]/40 px-3 py-2">
                        {alert}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex-1 max-h-[300px] overflow-y-auto space-y-2.5 pr-1">
                  {assistantSuggestions.map((sug) => {
                    const alreadyIn = activeTrip.items.some(
                      (i) => i.name.toLowerCase() === sug.name.toLowerCase()
                    );
                    return (
                      <div
                        key={sug.name}
                        className="p-3.5 border border-[#101010]/15 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-[#101010]">{sug.name}</p>
                          <p className="text-[11px] text-[#101010]/70 leading-snug">{sug.reason}</p>
                          <p className="font-mono text-[10px] text-[#101010]/55">
                            {sug.category} · {sug.weightGrams}g
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyIn}
                          onClick={() =>
                            addItem(sug.name, sug.category, sug.quantity, sug.weightGrams, true)
                          }
                          className={`min-h-[36px] px-3 text-[11px] font-bold shrink-0 transition-colors ${
                            alreadyIn
                              ? 'bg-[#B8D9F2]/50 text-[#101010]/50'
                              : 'bg-[#101010] text-[#FFFFFF] hover:bg-[#FFC5A8] hover:text-[#101010]'
                          }`}
                        >
                          {alreadyIn ? 'In Bag' : '+ Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
