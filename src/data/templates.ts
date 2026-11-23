import type {
  DocumentRecord,
  OutfitCombination,
  PackingList,
  PackingTemplate,
  PersonalEssential,
  ReminderItem,
  WardrobeItem,
} from '../types';
import {
  createDefaultBeforeLeaveTasks,
  generateSmartTimeline,
} from '../utils/packingEngine';

export const ASSETS = {
  onboardingLuggage: '/src/assets/images/packsmart_onboarding_luggage_1795234501369.jpg',
  kerala: '/src/assets/images/dest_coastal_kerala_1795234501755.jpg',
  tokyo: '/src/assets/images/dest_alpine_tokyo_1795234500989.jpg',
  campus: '/src/assets/images/dest_college_campus_1795234501508.jpg',
  vault: '/src/assets/images/vault_passport_docs_1795234501293.jpg',
  wardrobe: '/src/assets/images/wardrobe_capsule_outfits_1795236976031.jpg',
  suitcase: '/src/assets/images/suitcase_space_optimizer_1795236975480.jpg',
};

function offsetDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export const INITIAL_WARDROBE: WardrobeItem[] = [
  // Tops
  { id: 'w-top-1', name: 'Soft Lavender Linen Shirt', category: 'Tops', colorName: 'Lavender', colorHex: '#C5BCFF', warmth: 'Warm Weather', activities: ['Sightseeing', 'Dining', 'Beach'], weightGrams: 185, volumeLiters: 0.9, reusableDays: 2 },
  { id: 'w-top-2', name: 'Crisp Off-White Cotton Tee', category: 'Tops', colorName: 'Warm White', colorHex: '#F2EFE8', warmth: 'All-Season', activities: ['Sightseeing', 'Travel', 'Casual'], weightGrams: 155, volumeLiters: 0.7, reusableDays: 2 },
  { id: 'w-top-3', name: 'Midnight Navy Merino Knit', category: 'Tops', colorName: 'Midnight Navy', colorHex: '#182247', warmth: 'Cool & Cold', activities: ['Business', 'Dining', 'City'], weightGrams: 270, volumeLiters: 1.4, reusableDays: 3 },
  { id: 'w-top-4', name: 'Muted Teal Breathable Polo', category: 'Tops', colorName: 'Muted Teal', colorHex: '#0F968C', warmth: 'Warm Weather', activities: ['Resort', 'Sightseeing', 'Adventure'], weightGrams: 175, volumeLiters: 0.85, reusableDays: 2 },
  // Bottoms
  { id: 'w-bot-1', name: 'Sand Tailored Chino Trousers', category: 'Bottoms', colorName: 'Warm Sand', colorHex: '#D8CDB8', warmth: 'All-Season', activities: ['Sightseeing', 'Business', 'Dining'], weightGrams: 390, volumeLiters: 1.8, reusableDays: 3 },
  { id: 'w-bot-2', name: 'Charcoal Stretch Travel Pants', category: 'Bottoms', colorName: 'Charcoal', colorHex: '#2E3448', warmth: 'All-Season', activities: ['Travel', 'Business', 'Adventure'], weightGrams: 360, volumeLiters: 1.6, reusableDays: 3 },
  { id: 'w-bot-3', name: 'Breezy Linen Resort Shorts', category: 'Bottoms', colorName: 'Oatmeal', colorHex: '#E5DEC9', warmth: 'Warm Weather', activities: ['Beach', 'Resort', 'Sightseeing'], weightGrams: 210, volumeLiters: 0.95, reusableDays: 2 },
  // Dresses
  { id: 'w-drs-1', name: 'Sage Midi Linen Sundress', category: 'Dresses', colorName: 'Muted Teal', colorHex: '#4FA39A', warmth: 'Warm Weather', activities: ['Dining', 'Beach', 'Sightseeing'], weightGrams: 290, volumeLiters: 1.3, reusableDays: 2 },
  { id: 'w-drs-2', name: 'Midnight Wrap Evening Dress', category: 'Dresses', colorName: 'Midnight Navy', colorHex: '#162044', warmth: 'All-Season', activities: ['Dining', 'Business', 'Event'], weightGrams: 340, volumeLiters: 1.5, reusableDays: 2 },
  // Footwear
  { id: 'w-ft-1', name: 'Minimalist White Leather Sneakers', category: 'Footwear', colorName: 'Ivory', colorHex: '#EFECE6', warmth: 'All-Season', activities: ['Sightseeing', 'Travel', 'Casual'], weightGrams: 680, volumeLiters: 4.2, reusableDays: 7 },
  { id: 'w-ft-2', name: 'Easy Slip-On Coastal Sandals', category: 'Footwear', colorName: 'Tan', colorHex: '#B6895B', warmth: 'Warm Weather', activities: ['Beach', 'Resort', 'Sightseeing'], weightGrams: 320, volumeLiters: 2.1, reusableDays: 7 },
  // Outerwear
  { id: 'w-out-1', name: 'Midnight Unstructured Travel Blazer', category: 'Outerwear', colorName: 'Midnight Navy', colorHex: '#111834', warmth: 'All-Season', activities: ['Business', 'Dining', 'City'], weightGrams: 580, volumeLiters: 2.8, reusableDays: 5 },
  { id: 'w-out-2', name: 'Muted Teal Packable Rain Shell', category: 'Outerwear', colorName: 'Muted Teal', colorHex: '#257B75', warmth: 'All-Season', activities: ['Adventure', 'Rain', 'Sightseeing'], weightGrams: 310, volumeLiters: 1.5, reusableDays: 7 },
  // Accessories
  { id: 'w-acc-1', name: 'Tortoiseshell Polarized Sunglasses', category: 'Accessories', colorName: 'Amber', colorHex: '#7A5438', warmth: 'Warm Weather', activities: ['Beach', 'Sightseeing', 'Driving'], weightGrams: 45, volumeLiters: 0.3, reusableDays: 7 },
  { id: 'w-acc-2', name: 'Soft Woven Travel Scarf', category: 'Accessories', colorName: 'Soft Lavender', colorHex: '#B8ADFA', warmth: 'All-Season', activities: ['Flight', 'Dining', 'Cool Evening'], weightGrams: 120, volumeLiters: 0.6, reusableDays: 5 },
];

export const INITIAL_SAVED_OUTFITS: OutfitCombination[] = [
  {
    id: 'outfit-coastal-1',
    name: 'Backwaters Sunset Casual',
    itemIds: ['w-top-1', 'w-bot-1', 'w-ft-2', 'w-acc-1'],
    occasion: 'Coastal Sightseeing & Dinner',
    weatherFit: 'Warm & Breathable',
    isFavorite: true,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'outfit-exec-1',
    name: 'Smart Transit to Boardroom',
    itemIds: ['w-top-2', 'w-bot-2', 'w-out-1', 'w-ft-1'],
    occasion: 'Business & Flight',
    weatherFit: 'All-Season Layered',
    isFavorite: true,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
];

export const INITIAL_TEMPLATES: PackingTemplate[] = [
  {
    id: 'tpl-travel-weekend',
    title: 'Weekend Getaway',
    mode: 'Travel',
    description: 'Compact 2–3 day carry-on pack for effortless short escapes.',
    defaultDays: 3,
    defaultAllowanceKg: 7,
    coverImage: ASSETS.kerala,
    items: [
      { name: 'Casual tops / tees', category: 'Clothing', quantity: 3, weightGrams: 170, volumeLiters: 0.85, essential: true },
      { name: 'Versatile trousers / jeans', category: 'Clothing', quantity: 1, weightGrams: 420, volumeLiters: 1.8, essential: true },
      { name: 'Undergarments & socks', category: 'Clothing', quantity: 3, weightGrams: 50, volumeLiters: 0.3, essential: true },
      { name: 'Travel toiletries pouch', category: 'Toiletries', quantity: 1, weightGrams: 280, volumeLiters: 1.2, essential: true },
      { name: 'Phone charger & power bank', category: 'Electronics', quantity: 1, weightGrams: 340, volumeLiters: 0.6, essential: true },
      { name: 'Photo ID & booking pass', category: 'Documents', quantity: 1, weightGrams: 40, volumeLiters: 0.15, essential: true },
      { name: 'Comfortable sneakers', category: 'Footwear', quantity: 1, weightGrams: 680, volumeLiters: 4.2, essential: true },
    ],
  },
  {
    id: 'tpl-travel-intl',
    title: 'International Travel',
    mode: 'Travel',
    description: 'Passport, visa, universal adapter, and long-haul cabin comfort.',
    defaultDays: 8,
    defaultAllowanceKg: 23,
    coverImage: ASSETS.tokyo,
    items: [
      { name: 'Passport (6+ months validity)', category: 'Documents', quantity: 1, weightGrams: 55, volumeLiters: 0.15, essential: true },
      { name: 'Visa & travel insurance documents', category: 'Documents', quantity: 1, weightGrams: 45, volumeLiters: 0.15, essential: true },
      { name: 'Universal plug adapter', category: 'Electronics', quantity: 1, weightGrams: 165, volumeLiters: 0.4, essential: true },
      { name: 'Noise-cancelling headphones', category: 'Electronics', quantity: 1, weightGrams: 260, volumeLiters: 1.4 },
      { name: 'TSA-compliant 100ml liquids bag', category: 'Toiletries', quantity: 1, weightGrams: 360, volumeLiters: 1.1, essential: true },
      { name: 'Layered capsule outfits', category: 'Clothing', quantity: 5, weightGrams: 240, volumeLiters: 1.3, essential: true },
    ],
  },
  {
    id: 'tpl-travel-business',
    title: 'Business Trip',
    mode: 'Travel',
    description: 'Wrinkle-smart workwear, presentation tech, and client essentials.',
    defaultDays: 3,
    defaultAllowanceKg: 10,
    coverImage: ASSETS.tokyo,
    items: [
      { name: 'Tailored blazer & formal trousers', category: 'Clothing', quantity: 2, weightGrams: 600, volumeLiters: 2.6, essential: true },
      { name: 'Crisp button-down shirts', category: 'Clothing', quantity: 3, weightGrams: 210, volumeLiters: 1.1, essential: true },
      { name: 'Laptop, charger & USB-C hub', category: 'Electronics', quantity: 1, weightGrams: 1680, volumeLiters: 2.6, essential: true },
      { name: 'Polished dress footwear', category: 'Footwear', quantity: 1, weightGrams: 760, volumeLiters: 4.2, essential: true },
    ],
  },
  {
    id: 'tpl-college-hostel',
    title: 'Hostel Shifting',
    mode: 'College',
    description: 'Complete move-in checklist for dorm bedding, study desk, and care.',
    defaultDays: 30,
    defaultAllowanceKg: 25,
    coverImage: ASSETS.campus,
    items: [
      { name: 'Bedsheets, pillow covers & blanket', category: 'Miscellaneous', quantity: 2, weightGrams: 1400, volumeLiters: 6.5, essential: true },
      { name: 'Extension cord with surge protector', category: 'Electronics', quantity: 1, weightGrams: 420, volumeLiters: 1.2, essential: true },
      { name: 'Wardrobe padlocks (x2)', category: 'Accessories', quantity: 2, weightGrams: 140, volumeLiters: 0.3, essential: true },
      { name: 'Shower caddy & towels', category: 'Toiletries', quantity: 1, weightGrams: 780, volumeLiters: 3.2, essential: true },
      { name: 'Admission folder & college ID', category: 'Documents', quantity: 1, weightGrams: 160, volumeLiters: 0.4, essential: true },
    ],
  },
  {
    id: 'tpl-everyday-gym',
    title: 'Gym & Daily Carry',
    mode: 'Everyday',
    description: 'Ready-to-grab workout and everyday commuter essentials.',
    defaultDays: 1,
    defaultAllowanceKg: 5,
    coverImage: ASSETS.campus,
    items: [
      { name: 'Workout tee & shorts', category: 'Clothing', quantity: 1, weightGrams: 260, volumeLiters: 1.2, essential: true },
      { name: 'Training shoes & socks', category: 'Footwear', quantity: 1, weightGrams: 640, volumeLiters: 4.0, essential: true },
      { name: 'Refillable water bottle', category: 'Miscellaneous', quantity: 1, weightGrams: 280, volumeLiters: 0.9, essential: true },
      { name: 'Wireless earbuds', category: 'Electronics', quantity: 1, weightGrams: 60, volumeLiters: 0.2 },
    ],
  },
  {
    id: 'tpl-emergency-gobag',
    title: '72-Hour Emergency Go-Bag',
    mode: 'Emergency',
    description: 'Grab-and-go essentials for sudden weather or power disruptions.',
    defaultDays: 3,
    defaultAllowanceKg: 12,
    coverImage: ASSETS.vault,
    items: [
      { name: 'Drinking water (3L sealed)', category: 'Miscellaneous', quantity: 1, weightGrams: 3000, volumeLiters: 3.2, essential: true },
      { name: 'First-aid kit & 7-day medications', category: 'Medicines & First Aid', quantity: 1, weightGrams: 520, volumeLiters: 1.8, essential: true },
      { name: 'Flashlight & 20,000mAh power bank', category: 'Electronics', quantity: 1, weightGrams: 680, volumeLiters: 1.2, essential: true },
      { name: 'Waterproof ID & insurance copies pouch', category: 'Documents', quantity: 1, weightGrams: 120, volumeLiters: 0.25, essential: true },
    ],
  },
];

export const INITIAL_PERSONAL_ESSENTIALS: PersonalEssential[] = [
  { id: 'pe-1', name: 'Phone charger & braided USB-C cable', category: 'Electronics', quantity: 1, weightGrams: 135, volumeLiters: 0.35, autoInclude: true },
  { id: 'pe-2', name: 'Portable 10,000mAh power bank', category: 'Electronics', quantity: 1, weightGrams: 220, volumeLiters: 0.45, autoInclude: true },
  { id: 'pe-3', name: 'Wireless earbuds', category: 'Electronics', quantity: 1, weightGrams: 55, volumeLiters: 0.2, autoInclude: true },
  { id: 'pe-4', name: 'Reusable insulated water bottle', category: 'Miscellaneous', quantity: 1, weightGrams: 290, volumeLiters: 0.9, autoInclude: true },
  { id: 'pe-5', name: 'Lip balm & compact hand sanitizer', category: 'Toiletries', quantity: 1, weightGrams: 85, volumeLiters: 0.25, autoInclude: true },
];

export function createStarterLists(userName: string): PackingList[] {
  const ownerInitials =
    userName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'PS';

  const keralaStart = offsetDate(2);
  const keralaEnd = offsetDate(6);
  const tokyoStart = offsetDate(18);
  const tokyoEnd = offsetDate(23);

  return [
    {
      id: 'list-kerala-escape',
      title: 'Kerala Backwaters Escape',
      mode: 'Travel',
      tripType: 'Vacation',
      subMode: 'Beach & Coastal',
      destination: 'Kochi, India',
      coverImage: ASSETS.kerala,
      startDate: keralaStart,
      endDate: keralaEnd,
      travellers: 2,
      purpose: 'Coastal relaxation & houseboat cruise',
      travelMethod: 'Flight',
      accommodation: 'Resort',
      weatherPreference: 'Auto (Live Weather)',
      specialRequirements: 'Photography gear & houseboat evening wear',
      laundryAvailable: false,
      activities: ['Beach & Swimming', 'Photography', 'City Sightseeing'],
      preference: 'Balanced',
      customCategories: [],
      luggageType: 'Carry-On Spinner (40L)',
      luggageCapacityLiters: 40,
      baggageAllowanceKg: 15,
      bagWeightKg: 2.5,
      shoppingBudget: 6500,
      isShared: true,
      shareCode: 'KRL526',
      allowMemberEdits: true,
      isSampleData: true,
      completed: false,
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      beforeLeaveTasks: createDefaultBeforeLeaveTasks().map((t, idx) =>
        idx === 4 ? { ...t, completed: true } : t
      ),
      timelineTasks: generateSmartTimeline(keralaStart, 'Kochi, India', 'Vacation', 'Flight').map(
        (t, idx) => (idx < 3 ? { ...t, completed: true } : t)
      ),
      dayOutfits: [
        {
          dayIndex: 1,
          date: keralaStart,
          label: 'Day 1',
          outfitName: 'Arrival & Fort Kochi Walk',
          itemIds: ['w-top-2', 'w-bot-1', 'w-ft-1', 'w-acc-1'],
          activity: 'Flight & Sightseeing',
        },
        {
          dayIndex: 2,
          date: offsetDate(3),
          label: 'Day 2',
          outfitName: 'Backwaters Sunset Casual',
          itemIds: ['w-top-1', 'w-bot-3', 'w-ft-2', 'w-acc-1'],
          activity: 'Houseboat Cruise',
        },
        {
          dayIndex: 3,
          date: offsetDate(4),
          label: 'Day 3',
          outfitName: 'Coastal Cafe & Gallery',
          itemIds: ['w-drs-1', 'w-ft-2', 'w-acc-2'],
          activity: 'Beach & Dining',
        },
      ],
      groupMembers: [
        { id: 'm-owner', name: userName, role: 'Owner', initials: ownerInitials, color: '#0B3B40' },
        { id: 'm-arjun', name: 'Arjun Nair', role: 'Editor', initials: 'AN', color: '#3A6E72' },
        { id: 'm-meera', name: 'Meera Menon', role: 'Editor', initials: 'MM', color: '#0A0A0A' },
      ],
      groupActivity: [
        { id: 'act-1', memberName: 'Arjun Nair', action: 'packed Polarized sunglasses', timestamp: new Date(Date.now() - 3600000 * 3).toISOString() },
        { id: 'act-2', memberName: 'Meera Menon', action: 'claimed shared Mosquito repellent & first-aid', timestamp: new Date(Date.now() - 3600000 * 5).toISOString() },
      ],
      groupSuggestions: [
        {
          id: 'sug-1',
          suggestedBy: 'Meera Menon',
          itemName: 'Waterproof phone pouch',
          category: 'Electronics',
          quantity: 2,
          reason: 'Great for the Alleppey shikara boat ride!',
          status: 'pending',
        },
      ],
      shoppingItems: [
        { id: 'shop-1', name: 'Reef-safe SPF 50 sunscreen', category: 'Toiletries', estimatedPrice: 680, priority: 'High', status: 'Purchased', purchased: true, addedToPackingList: true },
        { id: 'shop-2', name: 'Compact windproof travel umbrella', category: 'Accessories', estimatedPrice: 950, priority: 'Urgent', status: 'To Buy', purchased: false },
        { id: 'shop-3', name: 'Natural mosquito repellent spray', category: 'Medicines & First Aid', estimatedPrice: 340, priority: 'Urgent', status: 'To Buy', purchased: false },
        { id: 'shop-4', name: 'Spare luggage tag', category: 'Accessories', estimatedPrice: 250, priority: 'Normal', status: 'No Longer Needed', purchased: false },
      ],
      items: [
        { id: 'i-1', name: 'Breathable linen & cotton tops', category: 'Clothing', quantity: 4, packed: true, weightGrams: 170, volumeLiters: 0.9, priority: 'Essential', essential: true, assignedTo: 'm-owner', packedBy: userName, order: 0 },
        { id: 'i-2', name: 'Tailored trousers & resort shorts', category: 'Clothing', quantity: 3, packed: true, weightGrams: 340, volumeLiters: 1.7, priority: 'Essential', essential: true, assignedTo: 'm-owner', packedBy: userName, order: 1 },
        { id: 'i-3', name: 'Swimwear set', category: 'Clothing', quantity: 2, packed: true, weightGrams: 170, volumeLiters: 0.6, priority: 'Helpful', assignedTo: 'm-meera', packedBy: 'Meera Menon', order: 2 },
        { id: 'i-4', name: 'Phone charger & braided cable', category: 'Electronics', quantity: 2, packed: false, weightGrams: 135, volumeLiters: 0.35, priority: 'Essential', essential: true, memoryPriorityReason: 'Prioritized from your Coorg Post-Trip Memory (forgotten previously).', notes: 'Keep in cabin bag', assignedTo: 'm-owner', order: 3 },
        { id: 'i-5', name: 'Mirrorless camera & extra lens', category: 'Electronics', quantity: 1, packed: true, weightGrams: 780, volumeLiters: 3.1, priority: 'Optional', isSharedEssential: true, assignedTo: 'm-arjun', packedBy: 'Arjun Nair', order: 4 },
        { id: 'i-6', name: 'Portable 10,000mAh power bank', category: 'Electronics', quantity: 1, packed: false, weightGrams: 230, volumeLiters: 0.45, priority: 'Essential', essential: true, isSharedEssential: true, assignedTo: 'm-arjun', order: 5 },
        { id: 'i-7', name: 'Flight boarding passes & resort voucher', category: 'Documents', quantity: 1, packed: true, weightGrams: 20, volumeLiters: 0.1, priority: 'Essential', essential: true, assignedTo: 'm-owner', packedBy: userName, order: 6 },
        { id: 'i-8', name: 'Photo ID cards', category: 'Documents', quantity: 2, packed: false, weightGrams: 35, volumeLiters: 0.15, priority: 'Essential', essential: true, assignedTo: 'm-owner', order: 7 },
        { id: 'i-9', name: 'SPF 50 broad-spectrum sunscreen', category: 'Toiletries', quantity: 1, packed: true, weightGrams: 125, volumeLiters: 0.4, priority: 'Essential', essential: true, isSharedEssential: true, weatherRecommended: true, assignedTo: 'm-meera', packedBy: 'Meera Menon', order: 8 },
        { id: 'i-10', name: 'Daily toiletries & skincare pouch', category: 'Toiletries', quantity: 2, packed: false, weightGrams: 290, volumeLiters: 1.4, priority: 'Essential', essential: true, order: 9 },
        { id: 'i-11', name: 'Mosquito repellent & first-aid kit', category: 'Medicines & First Aid', quantity: 1, packed: false, weightGrams: 190, volumeLiters: 0.7, priority: 'Essential', essential: true, isSharedEssential: true, weatherRecommended: true, assignedTo: 'm-meera', order: 10 },
        { id: 'i-12', name: 'Polarized sunglasses', category: 'Accessories', quantity: 2, packed: true, weightGrams: 45, volumeLiters: 0.3, priority: 'Helpful', assignedTo: 'm-arjun', packedBy: 'Arjun Nair', order: 11 },
        { id: 'i-13', name: 'Minimalist walking sneakers', category: 'Footwear', quantity: 1, packed: true, weightGrams: 680, volumeLiters: 4.2, priority: 'Essential', essential: true, assignedTo: 'm-owner', packedBy: userName, order: 12 },
        { id: 'i-14', name: 'Coastal slip-on sandals', category: 'Footwear', quantity: 1, packed: true, weightGrams: 320, volumeLiters: 2.1, priority: 'Helpful', assignedTo: 'm-owner', packedBy: userName, order: 13 },
        { id: 'i-15', name: 'Heavy denim jacket', category: 'Clothing', quantity: 1, packed: false, weightGrams: 740, volumeLiters: 3.4, priority: 'Optional', memoryUnusedWarning: 'You carried a heavy denim jacket on your Coorg trip and never wore it.', order: 14 },
      ],
      deletedItems: [],
      weather: null,
      postTripMemory: null,
    },
    {
      id: 'list-tokyo-summit',
      title: 'Tokyo Design Summit',
      mode: 'Work',
      tripType: 'Business',
      subMode: 'International Conference',
      destination: 'Tokyo, Japan',
      coverImage: ASSETS.tokyo,
      startDate: tokyoStart,
      endDate: tokyoEnd,
      travellers: 1,
      purpose: 'International design conference & client meetings',
      travelMethod: 'Flight',
      accommodation: 'Hotel',
      weatherPreference: 'Mild & Layered',
      laundryAvailable: true,
      activities: ['Business Meetings', 'City Sightseeing', 'Formal Dining'],
      preference: 'Minimalist',
      customCategories: [],
      luggageType: 'Carry-On Spinner (40L)',
      luggageCapacityLiters: 40,
      baggageAllowanceKg: 10,
      bagWeightKg: 2.5,
      shoppingBudget: 12000,
      isShared: false,
      allowMemberEdits: true,
      isSampleData: true,
      completed: false,
      createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      beforeLeaveTasks: createDefaultBeforeLeaveTasks(),
      timelineTasks: generateSmartTimeline(tokyoStart, 'Tokyo, Japan', 'Business', 'Flight'),
      dayOutfits: [
        {
          dayIndex: 1,
          date: tokyoStart,
          label: 'Day 1',
          outfitName: 'Smart Transit to Boardroom',
          itemIds: ['w-top-2', 'w-bot-2', 'w-out-1', 'w-ft-1'],
          activity: 'Flight & Keynote',
        },
      ],
      groupMembers: [
        { id: 'm-owner', name: userName, role: 'Owner', initials: ownerInitials, color: '#0B3B40' },
      ],
      groupActivity: [],
      groupSuggestions: [],
      shoppingItems: [
        { id: 'shop-tk-1', name: 'Type-A Japan plug adapter', category: 'Electronics', estimatedPrice: 890, priority: 'High', status: 'To Buy', purchased: false },
        { id: 'shop-tk-2', name: 'Merino crew knit', category: 'Clothing', estimatedPrice: 4200, priority: 'Normal', status: 'To Buy', purchased: false },
      ],
      items: [
        { id: 'tk-1', name: 'Passport & Japan eVisa confirmation', category: 'Documents', quantity: 1, packed: true, weightGrams: 60, volumeLiters: 0.15, priority: 'Essential', essential: true, order: 0 },
        { id: 'tk-2', name: 'Laptop, 65W GaN charger & USB-C hub', category: 'Electronics', quantity: 1, packed: false, weightGrams: 1620, volumeLiters: 2.6, priority: 'Essential', essential: true, order: 1 },
        { id: 'tk-3', name: 'Tailored dark blazer & 2 trousers', category: 'Clothing', quantity: 1, packed: false, weightGrams: 1120, volumeLiters: 4.5, priority: 'Essential', essential: true, order: 2 },
        { id: 'tk-4', name: 'Crisp shirts (laundry cycle)', category: 'Clothing', quantity: 4, packed: false, weightGrams: 210, volumeLiters: 1.0, priority: 'Essential', essential: true, order: 3 },
        { id: 'tk-5', name: 'All-day leather walking sneakers', category: 'Footwear', quantity: 1, packed: false, weightGrams: 740, volumeLiters: 4.2, priority: 'Essential', essential: true, order: 4 },
      ],
      deletedItems: [],
      weather: null,
      postTripMemory: null,
    },
    {
      id: 'list-coorg-history',
      title: 'Coorg Coffee Estate Weekend',
      mode: 'Travel',
      tripType: 'Adventure',
      subMode: 'Weekend Getaway',
      destination: 'Madikeri, India',
      coverImage: ASSETS.campus,
      startDate: offsetDate(-22),
      endDate: offsetDate(-20),
      travellers: 2,
      purpose: 'Misty hill retreat',
      travelMethod: 'Car',
      accommodation: 'Resort',
      weatherPreference: 'Mild & Layered',
      laundryAvailable: false,
      activities: ['Hiking & Trekking', 'Photography'],
      preference: 'Balanced',
      customCategories: [],
      luggageType: 'Weekender Duffel (50L)',
      luggageCapacityLiters: 50,
      baggageAllowanceKg: 15,
      bagWeightKg: 1.4,
      shoppingBudget: 3000,
      isShared: false,
      allowMemberEdits: true,
      isSampleData: true,
      completed: true,
      completedAt: offsetDate(-19),
      createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 19 * 86400000).toISOString(),
      beforeLeaveTasks: createDefaultBeforeLeaveTasks().map((t) => ({ ...t, completed: true })),
      timelineTasks: generateSmartTimeline(offsetDate(-22), 'Madikeri, India', 'Adventure', 'Car').map((t) => ({ ...t, completed: true })),
      dayOutfits: [],
      groupMembers: [
        { id: 'm-owner', name: userName, role: 'Owner', initials: ownerInitials, color: '#0B3B40' },
      ],
      groupActivity: [],
      groupSuggestions: [],
      shoppingItems: [
        { id: 'shop-cg-1', name: 'Woolen trail socks', category: 'Clothing', estimatedPrice: 450, priority: 'Normal', status: 'Purchased', purchased: true },
      ],
      items: [
        { id: 'cg-1', name: 'Warm fleece pullover', category: 'Clothing', quantity: 2, packed: true, weightGrams: 390, volumeLiters: 2.2, priority: 'Essential', essential: true, order: 0 },
        { id: 'cg-2', name: 'Waterproof trail shoes', category: 'Footwear', quantity: 2, packed: true, weightGrams: 840, volumeLiters: 4.5, priority: 'Essential', essential: true, order: 1 },
        { id: 'cg-3', name: 'Driving licence & car documents', category: 'Documents', quantity: 1, packed: true, weightGrams: 45, volumeLiters: 0.15, priority: 'Essential', essential: true, order: 2 },
        { id: 'cg-4', name: 'Compact umbrella', category: 'Accessories', quantity: 1, packed: true, weightGrams: 260, volumeLiters: 0.9, priority: 'Essential', weatherRecommended: true, order: 3 },
      ],
      deletedItems: [],
      weather: null,
      postTripMemory: {
        completedAt: offsetDate(-19),
        forgotItems: ['Phone charger', 'Lip balm'],
        unusedItems: ['Heavy denim jacket', 'Extra dress shoes'],
        wishedItems: ['Packable rain poncho'],
        lostItems: ['Lens cap'],
        packDifferentlyNote: 'Pack lighter breathable layers and double-check bedside chargers before checkout.',
        tripRating: 5,
      },
    },
  ];
}

export function createStarterDocuments(): DocumentRecord[] {
  return [
    {
      id: 'doc-passport',
      title: 'International Passport',
      type: 'Passport',
      folder: 'Passports & Visas',
      documentNumber: 'Z5••••21',
      issueDate: offsetDate(-1200),
      expiryDate: offsetDate(540),
      reminderDaysBefore: 180,
      notes: 'Keep digital copy offline before international departures.',
      isSampleData: true,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    },
    {
      id: 'doc-dl',
      title: 'Smart Card Driving Licence',
      type: 'Driving Licence',
      folder: 'ID & Licences',
      documentNumber: 'KL••••84',
      issueDate: offsetDate(-1800),
      expiryDate: offsetDate(12),
      reminderDaysBefore: 45,
      notes: 'Urgent renewal recommended before your next road trip.',
      isSampleData: true,
      createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
    },
    {
      id: 'doc-insurance',
      title: 'Annual Multi-Trip Travel Insurance',
      type: 'Travel Insurance',
      folder: 'Insurance & Medical',
      documentNumber: 'PO••••10',
      issueDate: offsetDate(-250),
      expiryDate: offsetDate(28),
      reminderDaysBefore: 30,
      notes: 'Covers medical evacuation, baggage delay, and flight disruption.',
      isSampleData: true,
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    },
    {
      id: 'doc-national-id',
      title: 'National Identity Card',
      type: 'National ID',
      folder: 'ID & Licences',
      documentNumber: 'IN••••92',
      issueDate: offsetDate(-2200),
      expiryDate: offsetDate(1400),
      reminderDaysBefore: 90,
      notes: 'Accepted for domestic flights and hotel check-ins.',
      isSampleData: true,
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
  ];
}

export function createStarterReminders(): ReminderItem[] {
  return [
    {
      id: 'rem-1',
      title: 'Run Before You Leave Mode check before Kochi flight',
      listId: 'list-kerala-escape',
      dueDate: offsetDate(2),
      category: 'Departure',
      completed: false,
    },
    {
      id: 'rem-2',
      title: 'Renew Driving Licence (expires in 12 days)',
      dueDate: offsetDate(5),
      category: 'Document',
      completed: false,
    },
    {
      id: 'rem-3',
      title: 'Pick up travel umbrella & mosquito spray from Shopping Radar',
      listId: 'list-kerala-escape',
      dueDate: offsetDate(1),
      category: 'Essentials',
      completed: false,
    },
  ];
}
