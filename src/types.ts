export type PackingMode = 'Travel' | 'College' | 'Work' | 'Everyday' | 'Emergency';

export type TripType = 'Vacation' | 'Business' | 'Adventure' | 'College' | 'Family' | 'Other';

export type TravelMethod = 'Flight' | 'Train' | 'Bus' | 'Car' | 'Local';

export type AccommodationType = 'Hotel' | 'Hostel' | 'Resort' | 'Camping' | 'Home / Family' | 'Not Applicable';

export type PackingPreference = 'Minimalist' | 'Balanced' | 'Comfort';

export type WeatherPreference = 'Auto (Live Weather)' | 'Warm & Sunny' | 'Rainy / Monsoon' | 'Mild & Layered' | 'Cold & Winter';

export type LuggageType =
  | 'Personal Backpack (24L)'
  | 'Carry-On Spinner (40L)'
  | 'Weekender Duffel (50L)'
  | 'Medium Check-In (68L)'
  | 'Large Check-In (95L)';

export const LUGGAGE_PRESETS: Array<{
  type: LuggageType;
  capacityLiters: number;
  defaultAllowanceKg: number;
  emptyWeightKg: number;
  dimensions: string;
}> = [
  { type: 'Personal Backpack (24L)', capacityLiters: 24, defaultAllowanceKg: 7, emptyWeightKg: 0.9, dimensions: '45 × 30 × 18 cm' },
  { type: 'Carry-On Spinner (40L)', capacityLiters: 40, defaultAllowanceKg: 10, emptyWeightKg: 2.5, dimensions: '55 × 35 × 23 cm' },
  { type: 'Weekender Duffel (50L)', capacityLiters: 50, defaultAllowanceKg: 15, emptyWeightKg: 1.4, dimensions: '56 × 32 × 28 cm' },
  { type: 'Medium Check-In (68L)', capacityLiters: 68, defaultAllowanceKg: 20, emptyWeightKg: 3.4, dimensions: '67 × 45 × 27 cm' },
  { type: 'Large Check-In (95L)', capacityLiters: 95, defaultAllowanceKg: 23, emptyWeightKg: 4.3, dimensions: '76 × 51 × 30 cm' },
];

export type StandardCategory =
  | 'Clothing'
  | 'Toiletries'
  | 'Electronics'
  | 'Documents'
  | 'Medicines & First Aid'
  | 'Accessories'
  | 'Footwear'
  | 'Miscellaneous';

export const STANDARD_CATEGORIES: StandardCategory[] = [
  'Clothing',
  'Toiletries',
  'Electronics',
  'Documents',
  'Medicines & First Aid',
  'Accessories',
  'Footwear',
  'Miscellaneous',
];

export type TabId = 'home' | 'trips' | 'wardrobe' | 'essentials' | 'profile';

export type WardrobeCategory =
  | 'Tops'
  | 'Bottoms'
  | 'Dresses'
  | 'Footwear'
  | 'Accessories'
  | 'Outerwear';

export const WARDROBE_CATEGORIES: WardrobeCategory[] = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Footwear',
  'Accessories',
  'Outerwear',
];

export interface WardrobeItem {
  id: string;
  name: string;
  category: WardrobeCategory;
  colorName: string;
  colorHex: string;
  secondaryColors?: string[];
  pattern?: string;
  style?: string;
  fabric?: string;
  warmth: 'Warm Weather' | 'All-Season' | 'Cool & Cold';
  activities: string[];
  weightGrams: number;
  volumeLiters: number;
  reusableDays: number;
  notes?: string;
  photoId?: string;
  aiDetected?: boolean;
}

export interface OutfitCombination {
  id: string;
  name: string;
  itemIds: string[];
  occasion: string;
  weatherFit: string;
  whyItWorks?: string;
  stylingTip?: string;
  aiGenerated?: boolean;
  isFavorite: boolean;
  createdAt: string;
}

export interface AIMatchedOutfit {
  id: string;
  dayIndex: number;
  date?: string;
  title: string;
  occasion: string;
  weatherFit: string;
  itemIds: string[];
  whyItWorks: string;
  stylingTip: string;
}

export interface AIMissingPieceSuggestion {
  name: string;
  category: WardrobeCategory;
  colorSuggestion: string;
  impactSummary: string;
  unlockedCombosCount: number;
}

export interface AIMatchSession {
  generatedAt: string;
  destination: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  weatherSummary: string;
  occasions: string[];
  capsuleSummary: string;
  outfits: AIMatchedOutfit[];
  missingPieces: AIMissingPieceSuggestion[];
  stats: {
    totalOutfits: number;
    uniquePiecesUsed: number;
    reusedPiecesCount: number;
  };
}

export interface DayOutfitPlan {
  dayIndex: number;
  date: string;
  label: string;
  outfitName: string;
  itemIds: string[];
  activity?: string;
  whyItWorks?: string;
}

export interface BeforeLeaveTask {
  id: string;
  title: string;
  important: boolean;
  completed: boolean;
  category: 'Home Safety' | 'Documents & Keys' | 'Devices & Luggage' | 'Custom';
}

export type TimelineStage =
  | 'one_week'
  | 'three_days'
  | 'one_day'
  | 'departure_morning'
  | 'arrival_day';

export const TIMELINE_STAGE_META: Record<
  TimelineStage,
  { label: string; shortLabel: string; offsetDays: number }
> = {
  one_week: { label: 'One Week Before Departure', shortLabel: '1 Week Out', offsetDays: -7 },
  three_days: { label: 'Three Days Before Departure', shortLabel: '3 Days Out', offsetDays: -3 },
  one_day: { label: 'One Day Before Departure', shortLabel: '1 Day Out', offsetDays: -1 },
  departure_morning: { label: 'Departure Morning', shortLabel: 'Departure', offsetDays: 0 },
  arrival_day: { label: 'Arrival Day', shortLabel: 'Arrival', offsetDays: 1 },
};

export interface TimelineTask {
  id: string;
  stage: TimelineStage;
  title: string;
  dueDate: string;
  completed: boolean;
  notes?: string;
}

export interface PostTripMemory {
  completedAt: string;
  forgotItems: string[];
  unusedItems: string[];
  wishedItems: string[];
  lostItems: string[];
  packDifferentlyNote: string;
  tripRating: 1 | 2 | 3 | 4 | 5;
}

export type DocumentFolder =
  | 'Passports & Visas'
  | 'ID & Licences'
  | 'Tickets & Bookings'
  | 'Insurance & Medical'
  | 'College & Work'
  | 'Other';

export type DocumentType =
  | 'Passport'
  | 'Visa'
  | 'National ID'
  | 'Driving Licence'
  | 'Travel Insurance'
  | 'Flight Ticket'
  | 'Hotel Booking'
  | 'College ID'
  | 'Other';

export interface PackingItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  packed: boolean;
  notes?: string;
  weightGrams: number;
  volumeLiters: number;
  priority: 'Essential' | 'Helpful' | 'Optional';
  essential?: boolean;
  isSharedEssential?: boolean;
  assignedTo?: string;
  packedBy?: string;
  weatherRecommended?: boolean;
  aiRecommended?: boolean;
  memoryPriorityReason?: string;
  memoryUnusedWarning?: string;
  order: number;
}

export interface DeletedItem {
  item: PackingItem;
  deletedAt: string;
}

export interface GroupMember {
  id: string;
  name: string;
  role: 'Owner' | 'Editor' | 'Viewer';
  initials: string;
  color: string;
}

export interface GroupActivity {
  id: string;
  memberName: string;
  action: string;
  timestamp: string;
}

export interface GroupSuggestion {
  id: string;
  suggestedBy: string;
  itemName: string;
  category: string;
  quantity: number;
  reason?: string;
  status: 'pending' | 'accepted' | 'dismissed';
}

export type ShoppingStatus = 'To Buy' | 'Purchased' | 'No Longer Needed';
export type ShoppingPriority = 'Urgent' | 'High' | 'Normal';

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  estimatedPrice: number;
  priority: ShoppingPriority;
  status: ShoppingStatus;
  purchased: boolean; // kept synced with status === 'Purchased'
  addedToPackingList?: boolean;
  notes?: string;
}

export interface WeatherDay {
  date: string;
  tempMax: number;
  tempMin: number;
  precipProb: number;
  precipSum: number;
  humidityMax: number;
  windMax: number;
  weatherCode: number;
  condition: string;
}

export interface WeatherRecommendation {
  name: string;
  category: string;
  quantity: number;
  weightGrams: number;
  reason: string;
}

export interface WeatherReport {
  locationName: string;
  shortLocation: string;
  latitude: number;
  longitude: number;
  source: 'live_forecast' | 'current_preview_only';
  note: string;
  fetchedAt: string;
  current: {
    temp: number;
    humidity: number;
    windSpeed: number;
    condition: string;
    weatherCode: number;
  } | null;
  summary: {
    avgHigh: number;
    avgLow: number;
    maxRainChance: number;
    avgHumidity: number;
    primaryCondition: string;
  };
  days: WeatherDay[];
  recommendations: WeatherRecommendation[];
}

export interface PackingList {
  id: string;
  title: string;
  mode: PackingMode;
  tripType: TripType;
  subMode?: string;
  destination: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  travellers: number;
  purpose: string;
  travelMethod: TravelMethod;
  accommodation: AccommodationType;
  weatherPreference: WeatherPreference;
  specialRequirements?: string;
  laundryAvailable: boolean;
  activities: string[];
  preference: PackingPreference;
  customCategories: string[];
  items: PackingItem[];
  deletedItems: DeletedItem[];
  weather?: WeatherReport | null;
  // Smart Suitcase Space Optimizer
  luggageType: LuggageType;
  luggageCapacityLiters: number;
  baggageAllowanceKg: number;
  bagWeightKg: number;
  // Outfits for this trip
  dayOutfits: DayOutfitPlan[];
  // Before You Leave Mode
  beforeLeaveTasks: BeforeLeaveTask[];
  // Smart Trip Timeline
  timelineTasks: TimelineTask[];
  // Budget & Last-Minute Shopping Radar
  shoppingBudget: number;
  shoppingItems: ShoppingItem[];
  // Group packing
  isShared: boolean;
  shareCode?: string;
  groupMembers: GroupMember[];
  groupActivity: GroupActivity[];
  groupSuggestions: GroupSuggestion[];
  allowMemberEdits: boolean;
  // Post-Trip Memory
  postTripMemory?: PostTripMemory | null;
  // Status & timestamps
  isSampleData?: boolean;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateItemSeed {
  name: string;
  category: string;
  quantity: number;
  weightGrams: number;
  volumeLiters?: number;
  essential?: boolean;
  notes?: string;
}

export interface PackingTemplate {
  id: string;
  title: string;
  mode: PackingMode;
  description: string;
  defaultDays: number;
  defaultAllowanceKg: number;
  coverImage: string;
  items: TemplateItemSeed[];
  isCustom?: boolean;
}

export interface DocumentRecord {
  id: string;
  title: string;
  type: DocumentType;
  folder: DocumentFolder;
  documentNumber?: string;
  encryptedRef?: string; // AES-GCM encrypted sensitive document number
  issueDate?: string;
  expiryDate?: string;
  reminderDaysBefore: number;
  notes?: string;
  fileId?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  isSampleData?: boolean;
  createdAt: string;
}

export interface ReminderItem {
  id: string;
  title: string;
  listId?: string;
  dueDate: string;
  category: 'Departure' | 'Document' | 'Essentials' | 'Custom';
  completed: boolean;
}

export interface PersonalEssential {
  id: string;
  name: string;
  category: string;
  quantity: number;
  weightGrams: number;
  volumeLiters?: number;
  autoInclude: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  initials: string;
  createdAt: string;
  mode: 'local';
}

export interface UserPreferences {
  weightUnit: 'kg' | 'lb';
  currency: '₹' | '$' | '€' | '£';
  defaultAllowanceKg: number;
  darkMode: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  rememberEssentials: boolean;
  vaultPinHash?: string;
}

export interface AISuggestedItem {
  name: string;
  category: string;
  quantity: number;
  weightGrams: number;
  reason: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'gemini' | 'offline_rules';
  suggestedItems?: AISuggestedItem[];
  forgottenAlerts?: string[];
  timestamp: string;
}

export interface AppState {
  hasCompletedOnboarding: boolean;
  user: UserAccount | null;
  accounts: Array<UserAccount & { passwordHash: string }>;
  lists: PackingList[];
  wardrobe: WardrobeItem[];
  savedOutfits: OutfitCombination[];
  templates: PackingTemplate[];
  documents: DocumentRecord[];
  reminders: ReminderItem[];
  personalEssentials: PersonalEssential[];
  preferences: UserPreferences;
  aiMessages: AIChatMessage[];
  sampleDataBannerDismissed?: boolean;
  lastSavedAt: string;
}
