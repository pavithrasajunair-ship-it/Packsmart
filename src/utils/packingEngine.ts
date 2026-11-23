import type {
  AccommodationType,
  AISuggestedItem,
  BeforeLeaveTask,
  DayOutfitPlan,
  DocumentRecord,
  OutfitCombination,
  PackingItem,
  PackingList,
  PackingMode,
  PackingPreference,
  PersonalEssential,
  TimelineStage,
  TimelineTask,
  TravelMethod,
  TripType,
  WardrobeItem,
  WeatherPreference,
  WeatherReport,
} from '../types';
import { TIMELINE_STAGE_META } from '../types';
import { uid } from './storage';

export interface SmartGeneratorInput {
  mode: PackingMode;
  tripType?: TripType;
  subMode?: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellers: number;
  purpose: string;
  travelMethod: TravelMethod;
  accommodation: AccommodationType;
  weatherPreference?: WeatherPreference;
  specialRequirements?: string;
  laundryAvailable: boolean;
  activities: string[];
  preference: PackingPreference;
  weather?: WeatherReport | null;
  personalEssentials?: PersonalEssential[];
  includePersonalEssentials?: boolean;
  memoryInsights?: MemoryLearningInsights;
}

export interface MemoryLearningInsights {
  frequentlyForgotten: Array<{ name: string; count: number }>;
  frequentlyUnused: Array<{ name: string; count: number }>;
  wishedItems: Array<{ name: string; count: number }>;
  lostItems: Array<{ name: string; count: number }>;
  totalReviews: number;
}

export function calculateTripDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 3;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, Math.min(60, Number.isNaN(diff) ? 3 : diff));
}

export function daysUntilDate(dateStr: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function addDaysToDateStr(dateStr: string, offsetDays: number): string {
  const base = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(base.getTime())) return new Date().toISOString().slice(0, 10);
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

export function estimateItemVolumeLiters(category: string, weightGrams: number): number {
  const cat = category.toLowerCase();
  if (cat.includes('footwear')) return 4.2;
  if (cat.includes('clothing')) return Math.max(0.4, Math.min(3.2, Number((weightGrams / 160).toFixed(1))));
  if (cat.includes('electronic')) return Math.max(0.3, Math.min(2.8, Number((weightGrams / 420).toFixed(1))));
  if (cat.includes('toiletr')) return Math.max(0.3, Math.min(2.0, Number((weightGrams / 280).toFixed(1))));
  if (cat.includes('document')) return 0.15;
  if (cat.includes('medicine')) return 0.45;
  if (cat.includes('accessor')) return 0.7;
  return Math.max(0.3, Math.min(3.5, Number((weightGrams / 350).toFixed(1))));
}

/**
 * Post-Trip Memory Learning Engine:
 * Learns from completed post-trip reviews to prioritize forgotten items and flag unused items.
 */
export function extractMemoryInsights(lists: PackingList[]): MemoryLearningInsights {
  const forgotMap = new Map<string, number>();
  const unusedMap = new Map<string, number>();
  const wishedMap = new Map<string, number>();
  const lostMap = new Map<string, number>();
  let totalReviews = 0;

  const bump = (map: Map<string, number>, raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    const existingKey = Array.from(map.keys()).find((k) => k.toLowerCase() === clean.toLowerCase());
    const key = existingKey || clean;
    map.set(key, (map.get(key) || 0) + 1);
  };

  for (const list of lists) {
    const mem = list.postTripMemory;
    if (!mem) continue;
    totalReviews += 1;
    mem.forgotItems.forEach((x) => bump(forgotMap, x));
    mem.unusedItems.forEach((x) => bump(unusedMap, x));
    mem.wishedItems.forEach((x) => bump(wishedMap, x));
    mem.lostItems.forEach((x) => bump(lostMap, x));
  }

  const toSorted = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  return {
    frequentlyForgotten: toSorted(forgotMap),
    frequentlyUnused: toSorted(unusedMap),
    wishedItems: toSorted(wishedMap),
    lostItems: toSorted(lostMap),
    totalReviews,
  };
}

/**
 * Before You Leave Mode Default Checklist (All 7 required items)
 */
export function createDefaultBeforeLeaveTasks(): BeforeLeaveTask[] {
  return [
    { id: uid('byl'), title: 'Switch off lights, fans and appliances', important: true, completed: false, category: 'Home Safety' },
    { id: uid('byl'), title: 'Lock all doors and windows', important: true, completed: false, category: 'Home Safety' },
    { id: uid('byl'), title: 'Turn off gas stove and check water taps', important: true, completed: false, category: 'Home Safety' },
    { id: uid('byl'), title: 'Collect keys, wallet and travel documents', important: true, completed: false, category: 'Documents & Keys' },
    { id: uid('byl'), title: 'Check tickets, boarding passes and accommodation details', important: true, completed: false, category: 'Documents & Keys' },
    { id: uid('byl'), title: 'Charge phone, earbuds and power bank to 100%', important: true, completed: false, category: 'Devices & Luggage' },
    { id: uid('byl'), title: 'Check luggage tags, zippers and personal belongings', important: false, completed: false, category: 'Devices & Luggage' },
  ];
}

/**
 * Smart Trip Timeline Generator across all 5 preparation stages
 */
export function generateSmartTimeline(
  startDate: string,
  destination: string,
  tripType: TripType,
  travelMethod: TravelMethod
): TimelineTask[] {
  const destLabel = destination || 'your destination';
  const seed: Array<{ stage: TimelineStage; title: string; notes?: string }> = [
    {
      stage: 'one_week',
      title: `Verify passport, ID & bookings for ${destLabel}`,
      notes: 'Check document expiry dates in Essentials > Document Radar.',
    },
    {
      stage: 'one_week',
      title: 'Review Last-Minute Shopping Radar & order missing essentials',
      notes: 'Avoid airport markups on toiletries, adapters, or sunscreen.',
    },
    {
      stage: 'three_days',
      title: `Check live weather forecast for ${destLabel} & finalize outfits`,
      notes: 'Lock in your capsule wardrobe combos to reduce suitcase bulk.',
    },
    {
      stage: 'three_days',
      title: 'Wash trip clothing & confirm laundry/prescription refills',
    },
    {
      stage: 'one_day',
      title:
        travelMethod === 'Flight'
          ? 'Complete online flight check-in & download offline boarding pass'
          : 'Confirm transit schedule & download offline route maps',
    },
    {
      stage: 'one_day',
      title: 'Pack suitcase & verify capacity in Suitcase Optimizer',
      notes: 'Keep chargers, medications, and documents in your cabin bag.',
    },
    {
      stage: 'departure_morning',
      title: 'Run Before You Leave Mode home-safety & essentials check',
      notes: 'Lights, gas, taps, locks, keys, wallet, charged devices.',
    },
    {
      stage: 'departure_morning',
      title: tripType === 'Business' ? 'Verify laptop, presentation deck & badge' : 'Weigh bags & head out with buffer time',
    },
    {
      stage: 'arrival_day',
      title: `Confirm local transit & check-in details at ${destLabel}`,
    },
    {
      stage: 'arrival_day',
      title: 'Hang wrinkle-prone outfits & set up charging station',
    },
  ];

  return seed.map((s) => ({
    id: uid('tl'),
    stage: s.stage,
    title: s.title,
    dueDate: addDaysToDateStr(startDate, TIMELINE_STAGE_META[s.stage].offsetDays),
    completed: false,
    notes: s.notes,
  }));
}

/**
 * Smart Suitcase Space Optimizer Engine
 */
export interface SuitcaseAnalysis {
  totalVolumeLiters: number;
  capacityLiters: number;
  volumePercent: number;
  isVolumeOverloaded: boolean;
  totalWeightKg: number;
  allowanceKg: number;
  isWeightOverloaded: boolean;
  compartments: Array<{
    category: string;
    volumeLiters: number;
    percentOfBag: number;
    weightKg: number;
    color: string;
  }>;
  removableSuggestions: Array<{
    item: PackingItem;
    spaceSavedLiters: number;
    reason: string;
  }>;
  spaceSavingAlternatives: Array<{
    title: string;
    detail: string;
    savingsEstimate: string;
  }>;
  packingTechniques: Array<{
    technique: string;
    bestFor: string;
    howTo: string;
  }>;
}

const COMPARTMENT_COLORS: Record<string, string> = {
  Clothing: '#D5DCD9',
  Footwear: '#0A0A0A',
  Electronics: '#BCD2CF',
  Toiletries: '#BCD2CF',
  Accessories: '#E6DFD2',
  'Medicines & First Aid': '#E6DFD2',
  Documents: '#0A0A0A',
  Miscellaneous: '#D5DCD9',
};

export function analyzeSuitcaseSpace(
  list: PackingList,
  memoryInsights?: MemoryLearningInsights
): SuitcaseAnalysis {
  const capacityLiters = Math.max(10, list.luggageCapacityLiters || 40);
  const catMap = new Map<string, { vol: number; grams: number }>();

  let totalVolumeLiters = 0;
  let itemsGrams = 0;

  for (const item of list.items) {
    const unitVol = item.volumeLiters > 0 ? item.volumeLiters : estimateItemVolumeLiters(item.category, item.weightGrams);
    const vol = unitVol * item.quantity;
    const grams = item.weightGrams * item.quantity;
    totalVolumeLiters += vol;
    itemsGrams += grams;
    const curr = catMap.get(item.category) || { vol: 0, grams: 0 };
    curr.vol += vol;
    curr.grams += grams;
    catMap.set(item.category, curr);
  }

  const totalWeightKg = Number((itemsGrams / 1000 + (list.bagWeightKg || 0)).toFixed(2));
  const volumePercent = Math.round((totalVolumeLiters / capacityLiters) * 100);
  const isVolumeOverloaded = totalVolumeLiters > capacityLiters;
  const isWeightOverloaded = totalWeightKg > list.baggageAllowanceKg;

  const compartments = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      volumeLiters: Number(data.vol.toFixed(1)),
      percentOfBag: Math.round((data.vol / Math.max(capacityLiters, totalVolumeLiters)) * 100),
      weightKg: Number((data.grams / 1000).toFixed(2)),
      color: COMPARTMENT_COLORS[category] || '#D5DCD9',
    }))
    .sort((a, b) => b.volumeLiters - a.volumeLiters);

  const unusedSet = new Set(
    (memoryInsights?.frequentlyUnused || []).map((u) => u.name.toLowerCase())
  );

  // Suggest removable / trimmable items based on priority, quantity, bulk, and past unused memory
  const removableSuggestions = list.items
    .map((item) => {
      const unitVol = item.volumeLiters > 0 ? item.volumeLiters : estimateItemVolumeLiters(item.category, item.weightGrams);
      const totalVol = unitVol * item.quantity;
      const wasUnusedBefore =
        Boolean(item.memoryUnusedWarning) ||
        Array.from(unusedSet).some((u) => item.name.toLowerCase().includes(u) || u.includes(item.name.toLowerCase()));

      let score = 0;
      let reason = '';

      if (wasUnusedBefore) {
        score += 50;
        reason = 'Previously carried and left unused in your Post-Trip Memory.';
      } else if (item.priority === 'Optional') {
        score += 35;
        reason = `Marked optional and takes ${totalVol.toFixed(1)}L of suitcase space.`;
      } else if (item.quantity >= 4 && item.category === 'Clothing') {
        score += 28;
        reason = `High quantity (×${item.quantity}). Trimming 1–2 pieces or reusing outfits saves space.`;
      } else if (item.category === 'Footwear' && item.quantity >= 2) {
        score += 30;
        reason = 'Multiple footwear pairs consume significant volume. Wear the bulkiest pair in transit.';
      } else if (!item.essential && totalVol >= 2.2) {
        score += 20;
        reason = `Bulky non-essential item (${totalVol.toFixed(1)}L). Consider a compact alternative.`;
      }

      return { item, score, spaceSavedLiters: Number(totalVol.toFixed(1)), reason };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ item, spaceSavedLiters, reason }) => ({ item, spaceSavedLiters, reason }));

  const spaceSavingAlternatives = [
    {
      title: 'Swap full-size toiletries for solid bars & 100ml pods',
      detail: 'Solid shampoo/cleanser bars eliminate liquid leaks and cut toiletry bulk in half.',
      savingsEstimate: 'Saves ~1.4L & 350g',
    },
    {
      title: 'Wear your heaviest shoes & outerwear during transit',
      detail: 'Keeping jackets and sneakers on your body frees the largest rigid block in your bag.',
      savingsEstimate: 'Saves ~5.5L & 1.2kg',
    },
    {
      title: 'Use one 65W multi-port GaN charger instead of separate bricks',
      detail: 'Charges laptop, phone, and earbuds together with a single compact plug.',
      savingsEstimate: 'Saves ~0.8L & 260g',
    },
  ];

  const packingTechniques = [
    {
      technique: 'Ranger Roll Method',
      bestFor: 'T-shirts, activewear, casual trousers & underwear',
      howTo: 'Fold bottom hem 5 cm inside-out, fold sides inward to a narrow strip, roll tightly from collar, then tuck into the cuff.',
    },
    {
      technique: 'Clown-Car Shoe Stuffing',
      bestFor: 'Packed sneakers, boots & sandals',
      howTo: 'Tuck rolled socks, charger cables, and small pouches inside shoes placed heel-to-toe along the suitcase wheel edge.',
    },
    {
      technique: 'Structured Bundle Fold',
      bestFor: 'Blazers, linen shirts & dresses',
      howTo: 'Wrap wrinkle-prone pieces flat around a soft central packing cube so fabric curves gently without sharp creases.',
    },
    {
      technique: 'Weight-at-the-Wheels Base Layer',
      bestFor: 'Toiletry bags, shoes & power bricks',
      howTo: 'Anchor heaviest items near the rolling wheels so the suitcase stays stable and avoids crushing folded tops.',
    },
  ];

  return {
    totalVolumeLiters: Number(totalVolumeLiters.toFixed(1)),
    capacityLiters,
    volumePercent,
    isVolumeOverloaded,
    totalWeightKg,
    allowanceKg: list.baggageAllowanceKg,
    isWeightOverloaded,
    compartments,
    removableSuggestions,
    spaceSavingAlternatives,
    packingTechniques,
  };
}

/**
 * Intelligent Outfit Combination Generator:
 * Builds multiple capsule-wardrobe outfit combos reusing core bottoms, outerwear, and footwear.
 */
export function generateCapsuleOutfitPlan(
  wardrobe: WardrobeItem[],
  startDate: string,
  days: number,
  weather: WeatherReport | null | undefined,
  activities: string[]
): {
  dayPlans: DayOutfitPlan[];
  combinations: OutfitCombination[];
  uniqueItemIds: string[];
  reusedPiecesCount: number;
  litersSaved: number;
  gramsSaved: number;
} {
  const avgHigh = weather?.summary.avgHigh ?? 24;
  const avgLow = weather?.summary.avgLow ?? 17;
  const isWarm = avgHigh >= 26;
  const isCool = avgLow <= 15;
  const needsFormal = activities.some((a) => /business|formal|dining|meeting/i.test(a));

  const filterByWeather = (items: WardrobeItem[]) => {
    const matched = items.filter((it) => {
      if (isWarm && it.warmth === 'Cool & Cold') return false;
      if (isCool && it.warmth === 'Warm Weather') return false;
      return true;
    });
    return matched.length > 0 ? matched : items;
  };

  const tops = filterByWeather(wardrobe.filter((w) => w.category === 'Tops'));
  const bottoms = filterByWeather(wardrobe.filter((w) => w.category === 'Bottoms'));
  const dresses = filterByWeather(wardrobe.filter((w) => w.category === 'Dresses'));
  const footwear = filterByWeather(wardrobe.filter((w) => w.category === 'Footwear'));
  const outerwear = wardrobe.filter((w) => w.category === 'Outerwear');
  const accessories = wardrobe.filter((w) => w.category === 'Accessories');

  const safeDays = Math.max(1, Math.min(10, days));
  const dayPlans: DayOutfitPlan[] = [];
  const combinations: OutfitCombination[] = [];
  const usageCounts = new Map<string, number>();

  const coreBottoms = bottoms.slice(0, Math.min(2, bottoms.length));
  const coreShoes = footwear.slice(0, Math.min(2, footwear.length));
  const coreOuter = (isCool || needsFormal) && outerwear.length > 0 ? outerwear[0] : null;
  const coreAcc = accessories[0] || null;

  for (let d = 0; d < safeDays; d++) {
    const date = addDaysToDateStr(startDate, d);
    const useDress = dresses.length > 0 && d % 3 === 2;
    const ids: string[] = [];
    let outfitName = `Day ${d + 1} Capsule Look`;
    const act = activities[d % Math.max(1, activities.length)] || 'City & Leisure';

    if (useDress) {
      const dress = dresses[d % dresses.length];
      ids.push(dress.id);
      outfitName = `${dress.colorName} ${dress.name}`;
    } else {
      const top = tops[d % Math.max(1, tops.length)];
      const bottom = coreBottoms[d % Math.max(1, coreBottoms.length)];
      if (top) ids.push(top.id);
      if (bottom) ids.push(bottom.id);
      outfitName = top && bottom ? `${top.name} + ${bottom.name}` : top?.name || `Day ${d + 1} Outfit`;
    }

    const shoe = coreShoes[d % Math.max(1, coreShoes.length)];
    if (shoe) ids.push(shoe.id);
    if (coreOuter) ids.push(coreOuter.id);
    if (coreAcc) ids.push(coreAcc.id);

    ids.forEach((id) => usageCounts.set(id, (usageCounts.get(id) || 0) + 1));

    dayPlans.push({
      dayIndex: d + 1,
      date,
      label: `Day ${d + 1}`,
      outfitName,
      itemIds: ids,
      activity: act,
    });

    combinations.push({
      id: uid('combo'),
      name: outfitName,
      itemIds: ids,
      occasion: act,
      weatherFit: isWarm ? 'Warm & Breathable' : isCool ? 'Layered & Cozy' : 'All-Season Versatile',
      isFavorite: false,
      createdAt: new Date().toISOString(),
    });
  }

  const uniqueItemIds = Array.from(usageCounts.keys());
  const reusedEntries = Array.from(usageCounts.entries()).filter(([, count]) => count > 1);
  const reusedPiecesCount = reusedEntries.length;

  let litersSaved = 0;
  let gramsSaved = 0;
  for (const [id, count] of reusedEntries) {
    const piece = wardrobe.find((w) => w.id === id);
    if (piece) {
      litersSaved += piece.volumeLiters * (count - 1);
      gramsSaved += piece.weightGrams * (count - 1);
    }
  }

  return {
    dayPlans,
    combinations,
    uniqueItemIds,
    reusedPiecesCount,
    litersSaved: Number(litersSaved.toFixed(1)),
    gramsSaved: Math.round(gramsSaved),
  };
}

/**
 * Document Expiry Radar Urgency & Trip Readiness Evaluator
 */
export type DocumentUrgency = 'Critical' | 'Expiring Soon' | 'Watchlist' | 'Ready';

export function evaluateDocumentUrgency(doc: DocumentRecord): {
  urgency: DocumentUrgency;
  daysLeft: number | null;
  statusText: string;
} {
  if (!doc.expiryDate) {
    return { urgency: 'Ready', daysLeft: null, statusText: 'No expiry set' };
  }
  const daysLeft = daysUntilDate(doc.expiryDate);
  if (daysLeft < 0) {
    return { urgency: 'Critical', daysLeft, statusText: `Expired ${Math.abs(daysLeft)}d ago` };
  }
  if (daysLeft <= 14) {
    return { urgency: 'Critical', daysLeft, statusText: `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` };
  }
  if (daysLeft <= Math.max(30, doc.reminderDaysBefore)) {
    return { urgency: 'Expiring Soon', daysLeft, statusText: `Expires in ${daysLeft} days` };
  }
  if (daysLeft <= 180) {
    return { urgency: 'Watchlist', daysLeft, statusText: `Valid (${daysLeft} days left)` };
  }
  return { urgency: 'Ready', daysLeft, statusText: `Valid until ${doc.expiryDate}` };
}

export function evaluateTripDocumentReadiness(
  trip: PackingList,
  documents: DocumentRecord[]
): {
  ready: boolean;
  label: string;
  issues: string[];
} {
  const issues: string[] = [];
  const isFlight = trip.travelMethod === 'Flight';
  const passport = documents.find((d) => d.type === 'Passport');

  for (const doc of documents) {
    if (!doc.expiryDate) continue;
    const left = daysUntilDate(doc.expiryDate);
    if (left < 0) {
      issues.push(`${doc.title} is expired.`);
    } else if (doc.expiryDate <= trip.endDate) {
      issues.push(`${doc.title} expires before your return date (${trip.endDate}).`);
    }
  }

  if (isFlight && passport?.expiryDate) {
    const leftAtReturn = Math.round(
      (new Date(passport.expiryDate).getTime() - new Date(trip.endDate).getTime()) / 86400000
    );
    if (leftAtReturn < 180) {
      issues.push('Passport has under 6 months validity past return date (required for many international flights).');
    }
  }

  if (issues.length === 0) {
    return {
      ready: true,
      label: 'Documents Ready',
      issues: [],
    };
  }
  return {
    ready: false,
    label: `${issues.length} Document Alert${issues.length === 1 ? '' : 's'}`,
    issues,
  };
}

/**
 * Smart Quantity Calculator
 */
export function calculateSmartClothingQuantities(
  days: number,
  laundryAvailable: boolean,
  preference: PackingPreference,
  travellers: number
) {
  const effectiveCycle = laundryAvailable ? Math.min(days, 5) : Math.min(days, 10);
  const styleFactor = preference === 'Minimalist' ? 0.8 : preference === 'Comfort' ? 1.2 : 1;

  const topsPerPerson = Math.max(1, Math.min(10, Math.ceil(effectiveCycle * styleFactor)));
  const bottomsPerPerson = Math.max(1, Math.min(5, Math.ceil((effectiveCycle / 2.6) * styleFactor)));
  const underwearPerPerson = Math.max(1, Math.min(12, effectiveCycle + (preference === 'Minimalist' ? 0 : 1)));
  const socksPerPerson = Math.max(1, Math.min(10, effectiveCycle));
  const sleepwearPerPerson = days >= 5 && !laundryAvailable ? 2 : 1;

  return {
    effectiveCycle,
    tops: topsPerPerson * travellers,
    bottoms: bottomsPerPerson * travellers,
    underwear: underwearPerPerson * travellers,
    socks: socksPerPerson * travellers,
    sleepwear: sleepwearPerPerson * travellers,
    note: laundryAvailable
      ? `Sized for a ${effectiveCycle}-day laundry cycle (${days} total days, ${travellers} traveller${travellers > 1 ? 's' : ''}).`
      : `Sized for ${days} day${days > 1 ? 's' : ''} without laundry (${preference.toLowerCase()} style).`,
  };
}

export function generateSmartPackingItems(input: SmartGeneratorInput): PackingItem[] {
  const days = calculateTripDays(input.startDate, input.endDate);
  const travellers = Math.max(1, input.travellers || 1);
  const qty = calculateSmartClothingQuantities(days, input.laundryAvailable, input.preference, travellers);

  const forgottenPatterns = input.memoryInsights?.frequentlyForgotten || [];
  const unusedPatterns = input.memoryInsights?.frequentlyUnused || [];

  const itemsMap = new Map<string, Omit<PackingItem, 'id' | 'order'>>();

  const addItem = (
    item: Omit<PackingItem, 'id' | 'order' | 'packed' | 'volumeLiters' | 'priority'> & {
      packed?: boolean;
      volumeLiters?: number;
      priority?: PackingItem['priority'];
    }
  ) => {
    const key = item.name.trim().toLowerCase();
    if (!key) return;

    const matchForgot = forgottenPatterns.find(
      (f) => key.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(key)
    );
    const matchUnused = unusedPatterns.find(
      (u) => key.includes(u.name.toLowerCase()) || u.name.toLowerCase().includes(key)
    );

    const priority: PackingItem['priority'] =
      matchForgot || item.essential ? 'Essential' : item.priority || 'Helpful';
    const volumeLiters =
      item.volumeLiters ?? estimateItemVolumeLiters(item.category, item.weightGrams);

    if (itemsMap.has(key)) {
      const existing = itemsMap.get(key)!;
      itemsMap.set(key, {
        ...existing,
        quantity: Math.max(existing.quantity, item.quantity),
        weatherRecommended: existing.weatherRecommended || item.weatherRecommended,
        essential: existing.essential || item.essential || Boolean(matchForgot),
        priority: existing.priority === 'Essential' || priority === 'Essential' ? 'Essential' : existing.priority,
      });
      return;
    }

    itemsMap.set(key, {
      ...item,
      packed: item.packed ?? false,
      volumeLiters,
      priority,
      essential: item.essential || Boolean(matchForgot),
      memoryPriorityReason: matchForgot
        ? `Prioritized because you forgot "${matchForgot.name}" on ${matchForgot.count} past trip${matchForgot.count > 1 ? 's' : ''}.`
        : undefined,
      memoryUnusedWarning: matchUnused
        ? `Heads up: you packed "${matchUnused.name}" previously and didn't use it.`
        : undefined,
    });
  };

  if (input.mode === 'Emergency') {
    [
      { name: 'Bottled drinking water (2L)', category: 'Miscellaneous', quantity: 2 * travellers, weightGrams: 1000, volumeLiters: 2.2, essential: true },
      { name: 'Non-perishable energy bars', category: 'Miscellaneous', quantity: 6 * travellers, weightGrams: 80, volumeLiters: 0.3, essential: true },
      { name: 'LED flashlight & spare batteries', category: 'Electronics', quantity: 1, weightGrams: 240, volumeLiters: 0.5, essential: true },
      { name: 'High-capacity power bank (20,000mAh)', category: 'Electronics', quantity: 1, weightGrams: 420, volumeLiters: 0.6, essential: true },
      { name: 'First-aid kit & bandages', category: 'Medicines & First Aid', quantity: 1, weightGrams: 450, volumeLiters: 1.4, essential: true },
      { name: 'Waterproof pouch with ID & insurance copies', category: 'Documents', quantity: 1, weightGrams: 120, volumeLiters: 0.2, essential: true },
      { name: 'Thermal emergency blanket', category: 'Clothing', quantity: travellers, weightGrams: 90, volumeLiters: 0.4, essential: true },
      { name: 'Sturdy walking shoes', category: 'Footwear', quantity: 1, weightGrams: 720, volumeLiters: 4.4, essential: true },
    ].forEach(addItem);
  } else if (input.mode === 'College' || input.tripType === 'College') {
    [
      { name: 'College ID card & admission folder', category: 'Documents', quantity: 1, weightGrams: 80, volumeLiters: 0.3, essential: true },
      { name: 'Laptop, charger & surge protector', category: 'Electronics', quantity: 1, weightGrams: 1850, volumeLiters: 2.8, essential: true },
      { name: 'Everyday campus tops', category: 'Clothing', quantity: qty.tops, weightGrams: 180, volumeLiters: 1.0, essential: true },
      { name: 'Comfortable jeans & joggers', category: 'Clothing', quantity: qty.bottoms, weightGrams: 480, volumeLiters: 2.0, essential: true },
      { name: 'Undergarments & socks', category: 'Clothing', quantity: qty.underwear, weightGrams: 55, volumeLiters: 0.35, essential: true },
      { name: 'Notebooks & stationery pouch', category: 'Miscellaneous', quantity: 1, weightGrams: 420, volumeLiters: 1.5, essential: true },
      { name: 'Shower caddy, bath towel & toiletries', category: 'Toiletries', quantity: 1, weightGrams: 680, volumeLiters: 2.6, essential: true },
      { name: 'Campus sneakers & hostel flip-flops', category: 'Footwear', quantity: 2, weightGrams: 620, volumeLiters: 3.8, essential: true },
    ].forEach(addItem);
  } else if (input.mode === 'Work' || input.tripType === 'Business') {
    [
      { name: 'Laptop & protective sleeve', category: 'Electronics', quantity: 1, weightGrams: 1450, volumeLiters: 2.4, essential: true },
      { name: 'Laptop charger & USB-C hub', category: 'Electronics', quantity: 1, weightGrams: 340, volumeLiters: 0.7, essential: true },
      { name: 'Phone charger & braided cable', category: 'Electronics', quantity: 1, weightGrams: 130, volumeLiters: 0.3, essential: true },
      { name: 'Office badge & business cards', category: 'Documents', quantity: 1, weightGrams: 40, volumeLiters: 0.15, essential: true },
      { name: 'Smart formal shirts / blouses', category: 'Clothing', quantity: Math.min(5, days), weightGrams: 220, volumeLiters: 1.2, essential: true },
      { name: 'Tailored trousers & blazer', category: 'Clothing', quantity: Math.min(2, Math.ceil(days / 2)), weightGrams: 580, volumeLiters: 2.6, essential: true },
      { name: 'Polished work footwear', category: 'Footwear', quantity: 1, weightGrams: 760, volumeLiters: 4.2, essential: true },
      { name: 'Compact grooming & toiletries kit', category: 'Toiletries', quantity: 1, weightGrams: 240, volumeLiters: 1.1, essential: true },
    ].forEach(addItem);
  } else {
    addItem({ name: 'Tops / T-shirts', category: 'Clothing', quantity: qty.tops, weightGrams: 170, volumeLiters: 0.9, essential: true, notes: qty.note });
    addItem({ name: 'Bottoms / trousers / shorts', category: 'Clothing', quantity: qty.bottoms, weightGrams: 420, volumeLiters: 1.9, essential: true });
    addItem({ name: 'Undergarments', category: 'Clothing', quantity: qty.underwear, weightGrams: 45, volumeLiters: 0.25, essential: true });
    addItem({ name: 'Socks (pairs)', category: 'Clothing', quantity: qty.socks, weightGrams: 50, volumeLiters: 0.25, essential: true });
    addItem({ name: 'Sleepwear set', category: 'Clothing', quantity: qty.sleepwear, weightGrams: 240, volumeLiters: 1.1, priority: 'Helpful' });
    addItem({ name: 'Toothbrush, toothpaste & toiletries pouch', category: 'Toiletries', quantity: travellers, weightGrams: 240, volumeLiters: 1.3, essential: true });
    addItem({ name: 'Phone charger & braided cable', category: 'Electronics', quantity: travellers, weightGrams: 130, volumeLiters: 0.35, essential: true });
    addItem({ name: 'Portable power bank', category: 'Electronics', quantity: 1, weightGrams: 250, volumeLiters: 0.45, essential: true });
    addItem({ name: 'Passport / Government ID', category: 'Documents', quantity: travellers, weightGrams: 50, volumeLiters: 0.15, essential: true });
    addItem({ name: 'Tickets & hotel booking confirmations', category: 'Documents', quantity: 1, weightGrams: 20, volumeLiters: 0.1, essential: true });
    addItem({ name: 'Personal prescriptions & first-aid pouch', category: 'Medicines & First Aid', quantity: 1, weightGrams: 160, volumeLiters: 0.6, essential: true });
    addItem({ name: 'Comfortable walking shoes', category: 'Footwear', quantity: travellers, weightGrams: 680, volumeLiters: 4.2, essential: true });
    addItem({ name: 'Daypack or crossbody bag', category: 'Accessories', quantity: 1, weightGrams: 350, volumeLiters: 1.8, priority: 'Optional' });
  }

  // Weather preference (when live weather unavailable)
  if (input.weatherPreference === 'Rainy / Monsoon') {
    addItem({ name: 'Compact travel umbrella', category: 'Accessories', quantity: 1, weightGrams: 260, volumeLiters: 0.9, essential: true, weatherRecommended: true });
    addItem({ name: 'Packable waterproof rain jacket', category: 'Clothing', quantity: 1, weightGrams: 340, volumeLiters: 1.8, essential: true, weatherRecommended: true });
  } else if (input.weatherPreference === 'Cold & Winter') {
    addItem({ name: 'Insulated winter coat', category: 'Clothing', quantity: 1, weightGrams: 920, volumeLiters: 5.5, essential: true, weatherRecommended: true });
    addItem({ name: 'Thermal base layers', category: 'Clothing', quantity: 2, weightGrams: 260, volumeLiters: 1.3, essential: true, weatherRecommended: true });
  } else if (input.weatherPreference === 'Warm & Sunny') {
    addItem({ name: 'SPF 50 sunscreen', category: 'Toiletries', quantity: 1, weightGrams: 120, volumeLiters: 0.4, essential: true, weatherRecommended: true });
    addItem({ name: 'Polarized sunglasses', category: 'Accessories', quantity: 1, weightGrams: 45, volumeLiters: 0.3, essential: true, weatherRecommended: true });
  }

  // Special requirements parsing
  const special = (input.specialRequirements || '').toLowerCase();
  if (special.includes('baby') || special.includes('kid') || input.tripType === 'Family') {
    addItem({ name: 'Family snacks, wet wipes & spare pouch', category: 'Miscellaneous', quantity: 1, weightGrams: 420, volumeLiters: 2.0, essential: true });
  }
  if (special.includes('camera') || special.includes('drone')) {
    addItem({ name: 'Camera gear, spare batteries & SD cards', category: 'Electronics', quantity: 1, weightGrams: 820, volumeLiters: 2.6, essential: true });
  }

  // Activities
  const acts = input.activities.map((a) => a.toLowerCase());
  if (acts.some((a) => a.includes('beach') || a.includes('swim'))) {
    addItem({ name: 'Swimwear', category: 'Clothing', quantity: 2, weightGrams: 180, volumeLiters: 0.7, essential: true });
    addItem({ name: 'Quick-dry beach towel', category: 'Accessories', quantity: 1, weightGrams: 310, volumeLiters: 1.5, priority: 'Helpful' });
    addItem({ name: 'Sandals / flip-flops', category: 'Footwear', quantity: 1, weightGrams: 290, volumeLiters: 2.2, priority: 'Helpful' });
  }
  if (acts.some((a) => a.includes('hik') || a.includes('trek') || a.includes('adventure'))) {
    addItem({ name: 'Trail hiking shoes', category: 'Footwear', quantity: 1, weightGrams: 920, volumeLiters: 4.8, essential: true });
    addItem({ name: 'Electrolyte hydration packets', category: 'Medicines & First Aid', quantity: 4, weightGrams: 25, volumeLiters: 0.2, priority: 'Helpful' });
  }
  if (acts.some((a) => a.includes('formal') || a.includes('business') || a.includes('dining'))) {
    addItem({ name: 'Smart evening / formal outfit', category: 'Clothing', quantity: 1, weightGrams: 560, volumeLiters: 2.4, priority: 'Helpful' });
  }

  // Live weather recommendations
  if (input.weather && input.weather.recommendations.length > 0) {
    for (const rec of input.weather.recommendations) {
      addItem({
        name: rec.name,
        category: rec.category,
        quantity: rec.quantity,
        weightGrams: rec.weightGrams,
        notes: rec.reason,
        weatherRecommended: true,
        essential: true,
      });
    }
  }

  // Inject frequently forgotten items from Post-Trip Memory directly as high-priority items!
  for (const forgot of forgottenPatterns.slice(0, 3)) {
    const alreadyPresent = Array.from(itemsMap.keys()).some(
      (k) => k.includes(forgot.name.toLowerCase()) || forgot.name.toLowerCase().includes(k)
    );
    if (!alreadyPresent) {
      addItem({
        name: forgot.name,
        category: /charger|adapter|cable|earbud|battery/i.test(forgot.name)
          ? 'Electronics'
          : /medicine|sunscreen|brush/i.test(forgot.name)
          ? 'Toiletries'
          : 'Miscellaneous',
        quantity: 1,
        weightGrams: 140,
        volumeLiters: 0.4,
        essential: true,
        notes: `Auto-prioritized from your Post-Trip Memory (forgotten ${forgot.count}× before).`,
      });
    }
  }

  // Personal Essentials
  if (input.includePersonalEssentials && input.personalEssentials) {
    for (const pe of input.personalEssentials) {
      if (pe.autoInclude) {
        addItem({
          name: pe.name,
          category: pe.category,
          quantity: pe.quantity,
          weightGrams: pe.weightGrams,
          volumeLiters: pe.volumeLiters,
          essential: true,
          notes: 'From Reusable Personal Essentials',
        });
      }
    }
  }

  return Array.from(itemsMap.values()).map((item, idx) => ({
    ...item,
    id: uid('item'),
    order: idx,
  }));
}

export function generateOfflineAssistantAdvice(
  question: string,
  activeList?: PackingList | null
): {
  reply: string;
  suggestedItems: AISuggestedItem[];
  forgottenAlerts: string[];
} {
  const q = question.toLowerCase();
  const existingNames = new Set((activeList?.items || []).map((i) => i.name.trim().toLowerCase()));
  const filterDupes = (items: AISuggestedItem[]) =>
    items.filter((i) => !existingNames.has(i.name.trim().toLowerCase()));

  if (q.includes('kerala') || q.includes('tropical') || q.includes('coastal') || q.includes('beach')) {
    return {
      reply:
        'For a tropical coastal trip, build a breathable linen/cotton capsule wardrobe, pack quick-dry rain readiness, and keep mosquito protection handy for evenings.',
      suggestedItems: filterDupes([
        { name: 'Breathable linen tops', category: 'Clothing', quantity: 4, weightGrams: 160, reason: 'Keeps you cool in warm humidity.' },
        { name: 'Mosquito repellent spray', category: 'Medicines & First Aid', quantity: 1, weightGrams: 95, reason: 'Essential near coastal backwaters at dusk.' },
        { name: 'Compact windproof umbrella', category: 'Accessories', quantity: 1, weightGrams: 260, reason: 'Handles sudden tropical showers.' },
        { name: 'Waterproof dry pouch', category: 'Electronics', quantity: 1, weightGrams: 90, reason: 'Protects phone and cards during boat rides.' },
      ]),
      forgottenAlerts: [
        'Motion-sickness tablets for boat or hill-road rides',
        'Zip-lock bags for damp swimwear',
      ],
    };
  }

  if (q.includes('monsoon') || q.includes('rain')) {
    return {
      reply:
        'For monsoon travel, skip heavy denim and pack quick-dry synthetic layers, a seam-sealed rain shell, waterproof shoe protection, and zip pouches for electronics.',
      suggestedItems: filterDupes([
        { name: 'Seam-sealed packable rain jacket', category: 'Clothing', quantity: 1, weightGrams: 340, reason: 'Better than umbrellas in gusty rain.' },
        { name: 'Backpack waterproof rain cover', category: 'Accessories', quantity: 1, weightGrams: 90, reason: 'Keeps devices dry during commutes.' },
        { name: 'Quick-dry synthetic trousers', category: 'Clothing', quantity: 2, weightGrams: 310, reason: 'Dries overnight indoors.' },
      ]),
      forgottenAlerts: ['Spare dry socks in a sealed pouch', 'Microfiber quick-dry towel'],
    };
  }

  if (q.includes('outfit') || q.includes('capsule') || q.includes('space') || q.includes('minimalist')) {
    return {
      reply:
        'To slash suitcase space, limit shoes to 2 versatile pairs (wearing the heavier pair on the plane), reuse 2 neutral bottoms across 4 tops, and use compression cubes with ranger-rolled tees.',
      suggestedItems: filterDupes([
        { name: 'Compression packing cubes (set of 3)', category: 'Accessories', quantity: 1, weightGrams: 210, reason: 'Compresses folded clothes by up to 30%.' },
        { name: '65W multi-port GaN travel charger', category: 'Electronics', quantity: 1, weightGrams: 120, reason: 'Replaces separate laptop and phone bricks.' },
        { name: 'Travel laundry detergent sheets', category: 'Miscellaneous', quantity: 1, weightGrams: 50, reason: 'Lets you pack half as many tops.' },
      ]),
      forgottenAlerts: ['Foldable laundry bag for worn clothes', 'Luggage scale or weight check before airport'],
    };
  }

  const unpackedEssentials = (activeList?.items || [])
    .filter((i) => !i.packed && (i.essential || i.priority === 'Essential'))
    .slice(0, 4)
    .map((i) => `${i.name} (${i.category}) is still unpacked in "${activeList?.title}"`);

  return {
    reply: activeList
      ? `Reviewing "${activeList.title}" (${activeList.destination || activeList.tripType}), focus on power adapters, offline travel documents, and space-saving organizers so nothing delays departure morning.`
      : 'Across trips, travellers most frequently forget phone chargers, universal adapters, prescription meds, and offline copies of bookings.',
    suggestedItems: filterDupes([
      { name: 'Universal travel plug adapter', category: 'Electronics', quantity: 1, weightGrams: 155, reason: 'Most commonly forgotten travel essential.' },
      { name: 'Compact first-aid & pain relief tin', category: 'Medicines & First Aid', quantity: 1, weightGrams: 110, reason: 'Saves late-night pharmacy runs.' },
      { name: 'Foldable laundry & shoe pouch', category: 'Accessories', quantity: 1, weightGrams: 85, reason: 'Keeps clean outfits fresh.' },
    ]),
    forgottenAlerts:
      unpackedEssentials.length > 0
        ? unpackedEssentials
        : ['Phone charger, power bank & earbuds', 'Passport / photo ID & house keys'],
  };
}

export function computePackingInsights(lists: PackingList[]) {
  const totalLists = lists.length;
  const completedLists = lists.filter((l) => l.completed).length;

  let totalItems = 0;
  let totalPacked = 0;
  const categoryStats = new Map<string, { total: number; packed: number }>();
  const unpackedFrequency = new Map<string, number>();

  for (const list of lists) {
    for (const item of list.items) {
      totalItems += 1;
      if (item.packed) totalPacked += 1;
      const cat = categoryStats.get(item.category) || { total: 0, packed: 0 };
      cat.total += 1;
      if (item.packed) cat.packed += 1;
      categoryStats.set(item.category, cat);

      if (!item.packed) {
        unpackedFrequency.set(item.name, (unpackedFrequency.get(item.name) || 0) + 1);
      }
    }
  }

  const overallCompletion = totalItems > 0 ? Math.round((totalPacked / totalItems) * 100) : 0;

  const incompleteCategories = Array.from(categoryStats.entries())
    .map(([category, stat]) => ({
      category,
      total: stat.total,
      packed: stat.packed,
      unpacked: stat.total - stat.packed,
      rate: stat.total > 0 ? Math.round((stat.packed / stat.total) * 100) : 100,
    }))
    .filter((c) => c.unpacked > 0)
    .sort((a, b) => a.rate - b.rate);

  const commonlyForgotten = Array.from(unpackedFrequency.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const listTrend = lists.slice(0, 6).map((l) => {
    const pct = l.items.length > 0 ? Math.round((l.items.filter((i) => i.packed).length / l.items.length) * 100) : 0;
    const totalWeightKg = Number(
      (l.items.reduce((acc, i) => acc + i.weightGrams * i.quantity, 0) / 1000 + (l.bagWeightKg || 0)).toFixed(1)
    );
    return {
      id: l.id,
      title: l.title,
      completion: pct,
      totalWeightKg,
      allowanceKg: l.baggageAllowanceKg,
      completed: l.completed,
    };
  });

  return {
    totalLists,
    completedLists,
    totalItems,
    totalPacked,
    overallCompletion,
    incompleteCategories,
    commonlyForgotten,
    listTrend,
  };
}
