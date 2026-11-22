import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  Luggage,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  AISuggestedItem,
  PackingItem,
  PackingList,
} from '../../types';
import { LUGGAGE_PRESETS } from '../../types';
import {
  analyzeSuitcaseSpace,
  estimateItemVolumeLiters,
  generateOfflineAssistantAdvice,
  MemoryLearningInsights,
} from '../../utils/packingEngine';
import { uid } from '../../utils/storage';
import { OpenSuitcase3D, type SuitcaseCameraView } from '../spatial/OpenSuitcase3D';

interface SmartPackingViewProps {
  lists: PackingList[];
  selectedTripId: string | null;
  memoryInsights: MemoryLearningInsights;
  isOnline: boolean;
  aiConfigured: boolean;
  onSelectTrip: (tripId: string) => void;
  onUpdateList: (updated: PackingList) => void;
  onOpenClassicTripSubTab: (
    tripId: string,
    subTab: 'checklist' | 'suitcase' | 'before_leave' | 'group'
  ) => void;
}

const CATEGORIES = [
  'All',
  'Clothing',
  'Footwear',
  'Electronics',
  'Toiletries',
  'Accessories',
  'Documents',
  'Medicines & First Aid',
];

const QUICK_PROMPTS = [
  'What am I missing for this trip?',
  'How do I save suitcase space?',
  'Suggest weather-ready essentials',
  'Check carry-on liquids & electronics',
];

interface AssistantTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestedItems?: AISuggestedItem[];
  forgottenAlerts?: string[];
}

export const SmartPackingView: React.FC<SmartPackingViewProps> = ({
  lists,
  selectedTripId,
  memoryInsights,
  isOnline,
  aiConfigured,
  onSelectTrip,
  onUpdateList,
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

  const analysis = useMemo(
    () => (activeTrip ? analyzeSuitcaseSpace(activeTrip, memoryInsights) : null),
    [activeTrip, memoryInsights]
  );

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Clothing');
  const [newItemQty, setNewItemQty] = useState(1);

  // Intelligent Packing Assistant state
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantTurns, setAssistantTurns] = useState<AssistantTurn[]>([]);
  const [addedFeedback, setAddedFeedback] = useState('');

  const filteredItems = useMemo(() => {
    if (!activeTrip) return [];
    if (selectedCategory === 'All') return activeTrip.items;
    return activeTrip.items.filter((i) => i.category === selectedCategory);
  }, [activeTrip, selectedCategory]);

  const packedCount = activeTrip ? activeTrip.items.filter((i) => i.packed).length : 0;
  const totalCount = activeTrip ? activeTrip.items.length : 0;
  const packedPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const missingCoreEssentials = useMemo(() => {
    if (!activeTrip) return [];
    const names = activeTrip.items.map((i) => i.name.toLowerCase());
    const checks = [
      { label: 'Phone charger & cable', match: ['charger', 'cable', 'usb'] },
      { label: 'Passport / Government ID', match: ['passport', 'id', 'licence'] },
      { label: 'Personal medication', match: ['medicine', 'medication', 'first aid'] },
      { label: 'Universal travel adapter', match: ['adapter', 'plug'] },
    ];
    return checks.filter((c) => !c.match.some((kw) => names.some((n) => n.includes(kw))));
  }, [activeTrip]);

  const [cameraView, setCameraView] = useState<SuitcaseCameraView>('editorial');

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

  const handleDeleteItem = (itemId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      items: activeTrip.items.filter((it) => it.id !== itemId),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !newItemName.trim()) return;
    const weight =
      newItemCategory === 'Footwear'
        ? 620
        : newItemCategory === 'Electronics'
        ? 290
        : newItemCategory === 'Documents'
        ? 50
        : 220;
    const created: PackingItem = {
      id: uid('item'),
      name: newItemName.trim(),
      category: newItemCategory,
      quantity: Math.max(1, newItemQty),
      packed: false,
      weightGrams: weight,
      volumeLiters: estimateItemVolumeLiters(newItemCategory, weight),
      priority: 'Essential',
      essential: true,
      order: 0,
    };
    onUpdateList({
      ...activeTrip,
      items: [created, ...activeTrip.items],
      updatedAt: new Date().toISOString(),
    });
    setNewItemName('');
    setNewItemQty(1);
  };

  const handleAddSuggestedItem = (item: {
    name: string;
    category: string;
    quantity?: number;
    weightGrams?: number;
    reason?: string;
  }) => {
    if (!activeTrip) return;
    const exists = activeTrip.items.some(
      (i) => i.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );
    if (exists) {
      setAddedFeedback(`"${item.name}" is already in your checklist.`);
      window.setTimeout(() => setAddedFeedback(''), 2500);
      return;
    }
    const weight = item.weightGrams || 220;
    const created: PackingItem = {
      id: uid('item'),
      name: item.name,
      category: item.category || 'Miscellaneous',
      quantity: item.quantity || 1,
      packed: false,
      weightGrams: weight,
      volumeLiters: estimateItemVolumeLiters(item.category || 'Miscellaneous', weight),
      priority: 'Helpful',
      aiRecommended: true,
      notes: item.reason,
      order: activeTrip.items.length,
    };
    onUpdateList({
      ...activeTrip,
      items: [created, ...activeTrip.items],
      updatedAt: new Date().toISOString(),
    });
    setAddedFeedback(`Added "${item.name}" to ${activeTrip.title}.`);
    window.setTimeout(() => setAddedFeedback(''), 2500);
  };

  const handleChangeLuggagePreset = (presetType: string) => {
    if (!activeTrip) return;
    const preset = LUGGAGE_PRESETS.find((p) => p.type === presetType);
    if (!preset) return;
    onUpdateList({
      ...activeTrip,
      luggageType: preset.type,
      luggageCapacityLiters: preset.capacityLiters,
      baggageAllowanceKg: preset.defaultAllowanceKg,
      bagWeightKg: preset.emptyWeightKg,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAskAssistant = async (promptText: string) => {
    const query = promptText.trim();
    if (!query || !activeTrip || assistantBusy) return;

    const userTurn: AssistantTurn = {
      id: uid('msg'),
      role: 'user',
      content: query,
    };
    setAssistantTurns((prev) => [...prev, userTurn]);
    setAssistantInput('');
    setAssistantBusy(true);

    try {
      if (isOnline && aiConfigured) {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            tripContext: {
              title: activeTrip.title,
              destination: activeTrip.destination,
              startDate: activeTrip.startDate,
              endDate: activeTrip.endDate,
              tripType: activeTrip.tripType,
              weather: activeTrip.weather?.summary || null,
              items: activeTrip.items.map((i) => ({
                name: i.name,
                category: i.category,
                packed: i.packed,
              })),
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAssistantTurns((prev) => [
            ...prev,
            {
              id: uid('msg'),
              role: 'assistant',
              content: data.reply || 'Here are my tailored packing suggestions.',
              suggestedItems: data.suggestedItems || [],
              forgottenAlerts: data.forgottenAlerts || [],
            },
          ]);
          setAssistantBusy(false);
          return;
        }
      }

      const offline = generateOfflineAssistantAdvice(query, activeTrip);
      setAssistantTurns((prev) => [
        ...prev,
        {
          id: uid('msg'),
          role: 'assistant',
          content: offline.reply,
          suggestedItems: offline.suggestedItems,
          forgottenAlerts: offline.forgottenAlerts,
        },
      ]);
    } catch {
      const offline = generateOfflineAssistantAdvice(query, activeTrip);
      setAssistantTurns((prev) => [
        ...prev,
        {
          id: uid('msg'),
          role: 'assistant',
          content: offline.reply,
          suggestedItems: offline.suggestedItems,
          forgottenAlerts: offline.forgottenAlerts,
        },
      ]);
    } finally {
      setAssistantBusy(false);
    }
  };

  if (!activeTrip || !analysis) {
    return (
      <div className="bg-[#FFFFFF] min-h-[calc(100vh-4rem)] py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center rounded-3xl bg-[#FFFFFF] border border-[#171717]/10 p-10 space-y-3">
          <h1 className="font-serif text-3xl font-medium text-[#171717]">Smart Packing</h1>
          <p className="text-sm text-[#171717]/70">
            Create your first trip in the Trip Planner to start organizing luggage and checklists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-work relative min-h-[calc(100vh-4rem)] py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* ==================== HEADER ==================== */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div className="space-y-1">
            <p className="inline-flex h-7 items-center rounded-full bg-[#FFFFFF]/85 px-3.5 text-xs font-semibold text-[#101010]">Smart Packing</p>
            <h1 className="text-4xl sm:text-6xl font-bold leading-[1.02] tracking-[-0.045em] text-[#101010]">
              Suitcase &amp; Checklist
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Select trip"
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

            <select
              aria-label="Select luggage size"
              value={activeTrip.luggageType}
              onChange={(e) => handleChangeLuggagePreset(e.target.value)}
              className="h-10 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm font-medium text-[#171717]"
            >
              {LUGGAGE_PRESETS.map((preset) => (
                <option key={preset.type} value={preset.type}>
                  {preset.type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {addedFeedback && (
          <div className="rounded-lg bg-[#B8D9F2]/45 border border-[#171717]/15 px-4 py-3 text-sm font-medium text-[#171717]">
            {addedFeedback}
          </div>
        )}

        {/* ==================== SUITCASE METRICS ROW ==================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-[#FFFFFF] border border-[#171717]/10 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#101010]/75">Packing Completion</p>
              <span className="text-xs font-semibold text-[#171717] tabular-nums">
                {packedCount}/{totalCount}
              </span>
            </div>
            <p className="font-serif text-3xl font-medium text-[#171717] tabular-nums">
              {packedPct}%
            </p>
            <div className="h-2 rounded-full bg-[#101010]/10 overflow-hidden">
              <div
                className="h-full bg-[#171717] rounded-full transition-all duration-300"
                style={{ width: `${packedPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-[#FFFFFF] border border-[#171717]/10 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#101010]/75">Suitcase Volume</p>
              <span className="text-xs font-semibold text-[#171717] tabular-nums">
                {analysis.volumePercent}%
              </span>
            </div>
            <p className="font-serif text-3xl font-medium text-[#171717] tabular-nums">
              {analysis.totalVolumeLiters}L{' '}
              <span className="text-base font-sans text-[#101010]/75">
                / {analysis.capacityLiters}L
              </span>
            </p>
            <div className="h-2 rounded-full bg-[#101010]/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  analysis.isVolumeOverloaded ? 'bg-[#FFC5A8]' : 'bg-[#B8D9F2]'
                }`}
                style={{ width: `${Math.min(100, analysis.volumePercent)}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl bg-[#FFFFFF] border border-[#171717]/10 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#101010]/75">Estimated Weight</p>
              <span className="text-xs font-semibold text-[#171717] tabular-nums">
                {analysis.isWeightOverloaded ? 'Over limit' : 'Within limit'}
              </span>
            </div>
            <p className="font-serif text-3xl font-medium text-[#171717] tabular-nums">
              {analysis.totalWeightKg} kg{' '}
              <span className="text-base font-sans text-[#101010]/75">
                / {analysis.allowanceKg} kg
              </span>
            </p>
            <div className="h-2 rounded-full bg-[#101010]/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  analysis.isWeightOverloaded ? 'bg-[#FFC5A8]' : 'bg-[#D9C9F2]'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((analysis.totalWeightKg / Math.max(1, analysis.allowanceKg)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* ==================== OPEN SUITCASE, LIVE IN 3D ==================== */}
        <div className="rounded-3xl bg-[#D9C9F2] border border-[#101010]/10 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <div>
              <h2 className="font-serif text-2xl text-[#171717]">Your suitcase, open</h2>
              <p className="text-xs text-[#171717]/65 mt-0.5">
                Select a piece to drop it in or lift it out. Packed items settle into the case.
              </p>
            </div>
            <div role="radiogroup" aria-label="Camera angle" className="flex items-center gap-1.5">
              {(
                [
                  ['editorial', 'Angled'],
                  ['flatlay', 'Top down'],
                  ['low', 'Low'],
                ] as Array<[SuitcaseCameraView, string]>
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  role="radio"
                  aria-checked={cameraView === view}
                  onClick={() => setCameraView(view)}
                  className={`h-8 px-3.5 rounded-full text-xs font-medium transition-colors ${
                    cameraView === view
                      ? 'bg-[#101010] text-[#FFFFFF]'
                      : 'bg-[#FFFFFF]/70 text-[#101010] hover:bg-[#FFFFFF]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[340px] sm:h-[420px]">
            <OpenSuitcase3D
              items={activeTrip.items}
              cameraView={cameraView}
              onToggleItem={handleToggleItem}
            />
          </div>
        </div>

        {/* ==================== MAIN 12-COL LAYOUT ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLS: CHECKLIST & QUICK ADD */}
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-3xl bg-[#FFFFFF] border border-[#171717]/10 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl font-medium text-[#171717]">
                    Packing Checklist
                  </h2>
                  <p className="text-xs text-[#101010]/75 mt-0.5">
                    Tap any item to mark packed. Filter by category or add custom essentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenClassicTripSubTab(activeTrip.id, 'group')}
                  className="h-9 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717] hover:border-[#171717] transition-colors shrink-0"
                >
                  Group Packing
                </button>
              </div>

              {/* Add Item Form */}
              <form
                onSubmit={handleAddItem}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
              >
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Add an item (e.g., Merino cardigan, Power bank)..."
                  className="sm:col-span-6 h-10 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-[#171717] placeholder:text-[#171717]/45"
                />
                <select
                  aria-label="New item category"
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="sm:col-span-3 h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717]"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={20}
                  aria-label="Quantity"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(Math.max(1, Number(e.target.value) || 1))}
                  className="sm:col-span-1 h-10 px-2 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-sm text-center text-[#171717] tabular-nums"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 h-10 rounded-full bg-[#171717] text-[#FFFFFF] text-xs font-medium inline-flex items-center justify-center gap-1 hover:bg-[#171717]/88 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {/* Category Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-[#171717]/10 pb-3">
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`h-8 px-3 rounded-md text-xs font-medium transition-colors duration-150 ${
                        active
                          ? 'bg-[#171717] text-[#FFFFFF]'
                          : 'bg-[#FFFFFF] text-[#171717]/70 hover:text-[#171717]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Items List */}
              <div className="divide-y divide-[#171717]/8">
                {filteredItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[#101010]/75">
                    No items in this category yet.
                  </p>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item.id)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left"
                      >
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                            item.packed
                              ? 'bg-[#171717] border-[#171717] text-[#FFFFFF]'
                              : 'border-[#171717]/30 bg-[#FFFFFF]'
                          }`}
                        >
                          {item.packed && <Check className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-sm truncate ${
                              item.packed
                                ? 'line-through text-[#171717]/45'
                                : 'text-[#171717] font-medium'
                            }`}
                          >
                            {item.name}
                          </p>
                          <p className="text-xs text-[#101010]/75 tabular-nums">
                            {item.category} · Qty {item.quantity} · {item.volumeLiters}L
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        aria-label={`Remove ${item.name}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#171717]/45 hover:text-[#171717] hover:bg-[#FFFFFF] transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 5 COLS: COMPARTMENT BREAKDOWN + MISSING ESSENTIALS + ASSISTANT */}
          <div className="lg:col-span-5 space-y-5">
            {/* Missing Essentials Alert */}
            {missingCoreEssentials.length > 0 && (
              <div className="rounded-3xl bg-[#FFC5A8]/35 border border-[#171717]/12 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#171717]" />
                  <h3 className="text-sm font-semibold text-[#171717]">
                    Quick Essentials Check
                  </h3>
                </div>
                <p className="text-xs text-[#171717]/75">
                  A few high-priority travel items are not on this list yet:
                </p>
                <div className="space-y-2">
                  {missingCoreEssentials.map((ess) => (
                    <div
                      key={ess.label}
                      className="flex items-center justify-between gap-2 bg-[#FFFFFF]/80 rounded-lg px-3 py-2 border border-[#171717]/8"
                    >
                      <span className="text-xs font-medium text-[#171717]">{ess.label}</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleAddSuggestedItem({
                            name: ess.label,
                            category: ess.label.includes('Passport')
                              ? 'Documents'
                              : ess.label.includes('medication')
                              ? 'Medicines & First Aid'
                              : 'Electronics',
                          })
                        }
                        className="h-7 px-2.5 rounded-md bg-[#171717] text-[#FFFFFF] text-[11px] font-medium hover:bg-[#171717]/85 transition-colors shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suitcase Compartment Breakdown */}
            <div className="rounded-3xl bg-[#FFFFFF] border border-[#171717]/10 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#101010]/75">Space Optimizer</p>
                  <h3 className="font-serif text-xl font-medium text-[#171717]">
                    Compartment Allocation
                  </h3>
                </div>
                <Luggage className="w-4 h-4 text-[#101010]/75" />
              </div>

              <div className="space-y-3">
                {analysis.compartments.slice(0, 6).map((comp, idx) => {
                  const barTint =
                    idx % 3 === 0
                      ? 'bg-[#B8D9F2]'
                      : idx % 3 === 1
                      ? 'bg-[#D9C9F2]'
                      : 'bg-[#FFC5A8]';
                  return (
                    <div key={comp.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="font-medium text-[#171717]">{comp.category}</span>
                        <span className="text-[#171717]/65">
                          {comp.volumeLiters}L · {comp.weightKg} kg
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#101010]/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barTint}`}
                          style={{ width: `${Math.min(100, Math.max(6, comp.percentOfBag))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {analysis.spaceSavingAlternatives.length > 0 && (
                <div className="pt-3 border-t border-[#171717]/10 space-y-2">
                  <p className="text-xs font-medium text-[#101010]/75">Space-Saving Tips</p>
                  {analysis.spaceSavingAlternatives.slice(0, 2).map((tip) => (
                    <div
                      key={tip.title}
                      className="rounded-lg bg-[#FFFFFF] p-3 text-xs space-y-0.5"
                    >
                      <p className="font-semibold text-[#171717]">
                        {tip.title}{' '}
                        <span className="font-normal text-[#101010]/75">
                          ({tip.savingsEstimate})
                        </span>
                      </p>
                      <p className="text-[#171717]/70">{tip.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Packing Assistant */}
            <div className="rounded-3xl bg-[#B8D9F2]/25 border border-[#171717]/10 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#171717]" />
                <h3 className="font-serif text-xl font-medium text-[#171717]">
                  Packing Advisor
                </h3>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleAskAssistant(q)}
                    disabled={assistantBusy}
                    className="px-2.5 py-1.5 rounded-md bg-[#FFFFFF] border border-[#171717]/12 text-xs text-[#171717] hover:border-[#171717] transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {assistantTurns.length > 0 && (
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {assistantTurns.map((turn) => (
                    <div
                      key={turn.id}
                      className={`rounded-lg p-3 text-xs leading-relaxed space-y-2 ${
                        turn.role === 'user'
                          ? 'bg-[#171717] text-[#FFFFFF] ml-6'
                          : 'bg-[#FFFFFF] border border-[#171717]/10 text-[#171717]'
                      }`}
                    >
                      <p>{turn.content}</p>
                      {turn.suggestedItems && turn.suggestedItems.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {turn.suggestedItems.slice(0, 4).map((si) => (
                            <div
                              key={si.name}
                              className="flex items-center justify-between gap-2 bg-[#FFFFFF] rounded-md px-2.5 py-1.5"
                            >
                              <span className="font-medium text-[#171717] truncate">
                                {si.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddSuggestedItem(si)}
                                className="px-2 py-0.5 rounded bg-[#171717] text-[#FFFFFF] text-[11px] font-medium shrink-0"
                              >
                                + Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskAssistant(assistantInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  placeholder="Ask about gear, baggage limits, or climate..."
                  className="flex-1 h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs text-[#171717] placeholder:text-[#171717]/45"
                />
                <button
                  type="submit"
                  disabled={assistantBusy || !assistantInput.trim()}
                  aria-label="Send question"
                  className="h-10 w-10 rounded-full bg-[#171717] text-[#FFFFFF] flex items-center justify-center hover:bg-[#171717]/88 transition-colors disabled:opacity-50 shrink-0"
                >
                  {assistantBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
