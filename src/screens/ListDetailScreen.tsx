import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bell,
  Brain,
  CalendarClock,
  Check,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Copy,
  DoorClosed,
  Droplets,
  Edit3,
  FolderPlus,
  Layers,
  Loader2,
  Luggage,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserPlus,
  Users,
  Wind,
} from 'lucide-react';
import type {
  BeforeLeaveTask,
  GroupMember,
  LuggageType,
  PackingItem,
  PackingList,
  PostTripMemory,
  ShoppingItem,
  ShoppingPriority,
  ShoppingStatus,
  TimelineStage,
  TimelineTask,
  UserPreferences,
  WeatherReport,
} from '../types';
import {
  LUGGAGE_PRESETS,
  STANDARD_CATEGORIES,
  TIMELINE_STAGE_META,
} from '../types';
import {
  addDaysToDateStr,
  analyzeSuitcaseSpace,
  daysUntilDate,
  estimateItemVolumeLiters,
  type MemoryLearningInsights,
} from '../utils/packingEngine';
import { ASSETS } from '../data/templates';
import { ProgressRing } from '../components/ui/ProgressRing';
import { BottomSheet } from '../components/ui/BottomSheet';
import { SafeImage } from '../components/ui/SafeImage';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import {
  createShareableListLink,
  requestAppNotificationPermission,
  sendAppNotification,
  uid,
} from '../utils/storage';
import { triggerHaptic } from '../utils/haptics';

export type DetailSubTab =
  | 'checklist'
  | 'suitcase'
  | 'timeline'
  | 'before_leave'
  | 'weather'
  | 'group'
  | 'shopping'
  | 'memory';

interface ListDetailScreenProps {
  list: PackingList;
  initialSubTab?: DetailSubTab;
  preferences: UserPreferences;
  currentUserName: string;
  isOnline: boolean;
  memoryInsights: MemoryLearningInsights;
  onBack: () => void;
  onUpdateList: (updated: PackingList) => void;
  onOpenAI: (listId: string) => void;
  onOpenWardrobe: () => void;
}

const MEMBER_COLORS = ['#6E5DE7', '#0F968C', '#F59E0B', '#EC4899', '#3B82F6', '#14B8A6'];
const TIMELINE_STAGE_ORDER: TimelineStage[] = [
  'one_week',
  'three_days',
  'one_day',
  'departure_morning',
  'arrival_day',
];

export const ListDetailScreen: React.FC<ListDetailScreenProps> = ({
  list,
  initialSubTab = 'checklist',
  preferences,
  currentUserName,
  isOnline,
  memoryInsights,
  onBack,
  onUpdateList,
  onOpenAI,
  onOpenWardrobe,
}) => {
  const [subTab, setSubTab] = useState<DetailSubTab>(initialSubTab);

  // Checklist states
  const [search, setSearch] = useState('');
  const [packFilter, setPackFilter] = useState<'all' | 'unpacked' | 'packed'>('all');
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackingItem | null>(null);
  const [deletedDrawerOpen, setDeletedDrawerOpen] = useState(false);
  const [customCatOpen, setCustomCatOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [undoToast, setUndoToast] = useState<{ item: PackingItem } | null>(null);

  // Add/Edit item form states
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<string>('Clothing');
  const [itemQty, setItemQty] = useState(1);
  const [itemWeight, setItemWeight] = useState(200);
  const [itemVolume, setItemVolume] = useState(0.9);
  const [itemPriority, setItemPriority] = useState<PackingItem['priority']>('Helpful');
  const [itemNotes, setItemNotes] = useState('');
  const [itemAssignedTo, setItemAssignedTo] = useState('');
  const [itemSharedEssential, setItemSharedEssential] = useState(false);
  const [itemFormError, setItemFormError] = useState('');

  // Timeline states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStage, setNewTaskStage] = useState<TimelineStage>('three_days');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [editingTimelineTask, setEditingTimelineTask] = useState<TimelineTask | null>(null);

  // Before You Leave states
  const [newBylTitle, setNewBylTitle] = useState('');
  const [newBylCategory, setNewBylCategory] = useState<BeforeLeaveTask['category']>('Home Safety');
  const [newBylImportant, setNewBylImportant] = useState(true);
  const [bylNotice, setBylNotice] = useState('');
  const [confirmCompleteAllByl, setConfirmCompleteAllByl] = useState(false);

  // Weather states
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherCityInput, setWeatherCityInput] = useState(list.destination || '');

  // Group states
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'Editor' | 'Viewer'>('Editor');
  const [copiedLink, setCopiedLink] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'all' | 'completed' | 'pending' | 'unassigned'>('all');
  const [groupAddName, setGroupAddName] = useState('');
  const [groupAddAssignee, setGroupAddAssignee] = useState(list.groupMembers[0]?.id || '');
  const [groupAddShared, setGroupAddShared] = useState(true);
  const [groupDuplicateWarn, setGroupDuplicateWarn] = useState('');
  const [activeMemberActor, setActiveMemberActor] = useState(currentUserName);

  // Shopping Radar states
  const [shopName, setShopName] = useState('');
  const [shopPrice, setShopPrice] = useState('');
  const [shopCat, setShopCat] = useState<string>('Toiletries');
  const [shopPriority, setShopPriority] = useState<ShoppingPriority>('High');
  const [shopScanNotice, setShopScanNotice] = useState('');

  // Post-Trip Memory form states
  const [memForgotInput, setMemForgotInput] = useState(
    (list.postTripMemory?.forgotItems || []).join(', ')
  );
  const [memUnusedInput, setMemUnusedInput] = useState(
    (list.postTripMemory?.unusedItems || []).join(', ')
  );
  const [memWishedInput, setMemWishedInput] = useState(
    (list.postTripMemory?.wishedItems || []).join(', ')
  );
  const [memLostInput, setMemLostInput] = useState(
    (list.postTripMemory?.lostItems || []).join(', ')
  );
  const [memNote, setMemNote] = useState(list.postTripMemory?.packDifferentlyNote || '');
  const [memRating, setMemRating] = useState<1 | 2 | 3 | 4 | 5>(
    list.postTripMemory?.tripRating || 4
  );
  const [memSavedBanner, setMemSavedBanner] = useState('');

  const allCategories = useMemo(
    () => Array.from(new Set([...STANDARD_CATEGORIES, ...list.customCategories])),
    [list.customCategories]
  );

  const daysUntilDeparture = useMemo(() => daysUntilDate(list.startDate), [list.startDate]);
  const packedCount = useMemo(() => list.items.filter((i) => i.packed).length, [list.items]);
  const totalCount = list.items.length;
  const completionPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  const suitcaseAnalysis = useMemo(
    () => analyzeSuitcaseSpace(list, memoryInsights),
    [list, memoryInsights]
  );

  const formatWeight = (kg: number) => {
    if (preferences.weightUnit === 'lb') {
      return `${(kg * 2.20462).toFixed(1)} lb`;
    }
    return `${kg.toFixed(1)} kg`;
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...list.items]
      .sort((a, b) => a.order - b.order)
      .filter((i) => {
        if (packFilter === 'packed' && !i.packed) return false;
        if (packFilter === 'unpacked' && i.packed) return false;
        if (q) {
          return (
            i.name.toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q) ||
            (i.notes || '').toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [list.items, search, packFilter]);

  const groupedCategories = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const item of filteredItems) {
      const arr = map.get(item.category) || [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return Array.from(map.entries());
  }, [filteredItems]);

  const bylDoneCount = useMemo(
    () => (list.beforeLeaveTasks || []).filter((t) => t.completed).length,
    [list.beforeLeaveTasks]
  );
  const bylTotalCount = (list.beforeLeaveTasks || []).length;
  const bylPct = bylTotalCount > 0 ? Math.round((bylDoneCount / bylTotalCount) * 100) : 0;

  const timelineDoneCount = useMemo(
    () => (list.timelineTasks || []).filter((t) => t.completed).length,
    [list.timelineTasks]
  );
  const timelineTotalCount = (list.timelineTasks || []).length;

  // Shopping metrics
  const toBuyShopItems = useMemo(
    () => list.shoppingItems.filter((s) => s.status === 'To Buy'),
    [list.shoppingItems]
  );
  const totalEstimatedShop = useMemo(
    () =>
      list.shoppingItems
        .filter((s) => s.status !== 'No Longer Needed')
        .reduce((s, i) => s + i.estimatedPrice, 0),
    [list.shoppingItems]
  );
  const totalPurchasedShop = useMemo(
    () =>
      list.shoppingItems
        .filter((s) => s.status === 'Purchased')
        .reduce((s, i) => s + i.estimatedPrice, 0),
    [list.shoppingItems]
  );
  const remainingBudget = list.shoppingBudget - totalPurchasedShop;

  // Group filtered items
  const groupFilteredItems = useMemo(() => {
    return list.items.filter((item) => {
      if (groupFilter === 'completed') return item.packed;
      if (groupFilter === 'pending') return !item.packed && Boolean(item.assignedTo);
      if (groupFilter === 'unassigned') return !item.assignedTo;
      return true;
    });
  }, [list.items, groupFilter]);

  const commitUpdate = (patch: Partial<PackingList>, activityText?: string, actorName?: string) => {
    const nextActivity = activityText
      ? [
          {
            id: uid('act'),
            memberName: actorName || currentUserName,
            action: activityText,
            timestamp: new Date().toISOString(),
          },
          ...list.groupActivity,
        ].slice(0, 30)
      : list.groupActivity;

    onUpdateList({
      ...list,
      ...patch,
      groupActivity: nextActivity,
      updatedAt: new Date().toISOString(),
    });
  };

  // ==================== CHECKLIST HANDLERS ====================
  const toggleItemPacked = (itemId: string, actor?: string) => {
    const target = list.items.find((i) => i.id === itemId);
    if (!target) return;
    const nextPacked = !target.packed;
    const by = actor || currentUserName;
    triggerHaptic(nextPacked ? 'success' : 'light', preferences.hapticsEnabled);
    const updatedItems = list.items.map((i) =>
      i.id === itemId ? { ...i, packed: nextPacked, packedBy: nextPacked ? by : undefined } : i
    );
    commitUpdate(
      { items: updatedItems },
      nextPacked ? `packed ${target.name}` : `unpacked ${target.name}`,
      by
    );
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    triggerHaptic('light', preferences.hapticsEnabled);
    const updatedItems = list.items.map((i) =>
      i.id === itemId ? { ...i, quantity: Math.max(1, Math.min(99, i.quantity + delta)) } : i
    );
    commitUpdate({ items: updatedItems });
  };

  const reorderItem = (itemId: string, direction: -1 | 1) => {
    const target = list.items.find((i) => i.id === itemId);
    if (!target) return;
    const sameCat = [...list.items]
      .filter((i) => i.category === target.category)
      .sort((a, b) => a.order - b.order);
    const idx = sameCat.findIndex((i) => i.id === itemId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sameCat.length) return;

    const a = sameCat[idx];
    const b = sameCat[swapIdx];
    const updatedItems = list.items.map((i) => {
      if (i.id === a.id) return { ...i, order: b.order };
      if (i.id === b.id) return { ...i, order: a.order };
      return i;
    });
    triggerHaptic('light', preferences.hapticsEnabled);
    commitUpdate({ items: updatedItems });
  };

  const deleteItem = (itemId: string) => {
    const target = list.items.find((i) => i.id === itemId);
    if (!target) return;
    triggerHaptic('medium', preferences.hapticsEnabled);
    commitUpdate(
      {
        items: list.items.filter((i) => i.id !== itemId),
        deletedItems: [
          { item: target, deletedAt: new Date().toISOString() },
          ...list.deletedItems,
        ].slice(0, 25),
      },
      `removed ${target.name}`
    );
    setUndoToast({ item: target });
    window.setTimeout(() => {
      setUndoToast((curr) => (curr?.item.id === target.id ? null : curr));
    }, 5000);
  };

  const restoreDeletedItem = (deletedItem: PackingItem) => {
    const exists = list.items.some(
      (i) => i.name.trim().toLowerCase() === deletedItem.name.trim().toLowerCase()
    );
    const restored: PackingItem = exists
      ? { ...deletedItem, id: uid('item'), name: `${deletedItem.name} (Restored)`, order: list.items.length }
      : { ...deletedItem, order: list.items.length };

    commitUpdate(
      {
        items: [...list.items, restored],
        deletedItems: list.deletedItems.filter((d) => d.item.id !== deletedItem.id),
      },
      `restored ${deletedItem.name}`
    );
    setUndoToast(null);
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategory(allCategories[0]);
    setItemQty(1);
    setItemWeight(200);
    setItemVolume(0.9);
    setItemPriority('Helpful');
    setItemNotes('');
    setItemAssignedTo('');
    setItemSharedEssential(false);
    setItemFormError('');
    setAddItemOpen(true);
  };

  const openEditSheet = (item: PackingItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemQty(item.quantity);
    setItemWeight(item.weightGrams);
    setItemVolume(item.volumeLiters || estimateItemVolumeLiters(item.category, item.weightGrams));
    setItemPriority(item.priority || 'Helpful');
    setItemNotes(item.notes || '');
    setItemAssignedTo(item.assignedTo || '');
    setItemSharedEssential(Boolean(item.isSharedEssential));
    setItemFormError('');
    setAddItemOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = itemName.trim();
    if (!clean) {
      setItemFormError('Please enter an item name.');
      return;
    }

    const duplicate = list.items.find(
      (i) => i.name.trim().toLowerCase() === clean.toLowerCase() && i.id !== editingItem?.id
    );
    if (duplicate) {
      setItemFormError(`"${duplicate.name}" is already in this list. Adjust its quantity instead.`);
      return;
    }

    if (editingItem) {
      const updated = list.items.map((i) =>
        i.id === editingItem.id
          ? {
              ...i,
              name: clean,
              category: itemCategory,
              quantity: Math.max(1, itemQty),
              weightGrams: Math.max(0, itemWeight),
              volumeLiters: Math.max(0.1, Number(itemVolume) || 0.5),
              priority: itemPriority,
              essential: itemPriority === 'Essential',
              isSharedEssential: itemSharedEssential,
              notes: itemNotes.trim() || undefined,
              assignedTo: itemAssignedTo || undefined,
            }
          : i
      );
      commitUpdate({ items: updated }, `updated ${clean}`);
    } else {
      const nextItem: PackingItem = {
        id: uid('item'),
        name: clean,
        category: itemCategory,
        quantity: Math.max(1, itemQty),
        packed: false,
        weightGrams: Math.max(0, itemWeight),
        volumeLiters: Math.max(0.1, Number(itemVolume) || estimateItemVolumeLiters(itemCategory, itemWeight)),
        priority: itemPriority,
        essential: itemPriority === 'Essential',
        isSharedEssential: itemSharedEssential,
        notes: itemNotes.trim() || undefined,
        assignedTo: itemAssignedTo || undefined,
        order: list.items.length,
      };
      commitUpdate({ items: [...list.items, nextItem] }, `added ${clean}`);
    }
    triggerHaptic('success', preferences.hapticsEnabled);
    setAddItemOpen(false);
  };

  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) return;
    if (!allCategories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      commitUpdate({ customCategories: [...list.customCategories, clean] });
    }
    setNewCategoryName('');
    setCustomCatOpen(false);
  };

  // ==================== SUITCASE OPTIMIZER HANDLERS ====================
  const handleSelectLuggagePreset = (type: LuggageType) => {
    const preset = LUGGAGE_PRESETS.find((p) => p.type === type);
    if (!preset) return;
    triggerHaptic('light', preferences.hapticsEnabled);
    commitUpdate({
      luggageType: preset.type,
      luggageCapacityLiters: preset.capacityLiters,
      baggageAllowanceKg: preset.defaultAllowanceKg,
      bagWeightKg: preset.emptyWeightKg,
    });
  };

  // ==================== TIMELINE HANDLERS ====================
  const handleAddTimelineTask = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTaskTitle.trim();
    if (!clean) return;
    const dueDate = addDaysToDateStr(list.startDate, TIMELINE_STAGE_META[newTaskStage].offsetDays);
    const task: TimelineTask = {
      id: uid('tl'),
      stage: newTaskStage,
      title: clean,
      dueDate,
      completed: false,
      notes: newTaskNotes.trim() || undefined,
    };
    commitUpdate({ timelineTasks: [...(list.timelineTasks || []), task] });
    setNewTaskTitle('');
    setNewTaskNotes('');
    triggerHaptic('success', preferences.hapticsEnabled);
  };

  const handleToggleTimelineTask = (taskId: string) => {
    triggerHaptic('light', preferences.hapticsEnabled);
    commitUpdate({
      timelineTasks: (list.timelineTasks || []).map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
    });
  };

  const handleSaveTimelineEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimelineTask || !editingTimelineTask.title.trim()) return;
    commitUpdate({
      timelineTasks: (list.timelineTasks || []).map((t) =>
        t.id === editingTimelineTask.id ? editingTimelineTask : t
      ),
    });
    setEditingTimelineTask(null);
  };

  // ==================== BEFORE YOU LEAVE HANDLERS ====================
  const handleToggleByl = (taskId: string) => {
    triggerHaptic('success', preferences.hapticsEnabled);
    commitUpdate({
      beforeLeaveTasks: (list.beforeLeaveTasks || []).map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      ),
    });
  };

  const handleAddBylTask = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBylTitle.trim();
    if (!clean) return;
    const task: BeforeLeaveTask = {
      id: uid('byl'),
      title: clean,
      category: newBylCategory,
      important: newBylImportant,
      completed: false,
    };
    commitUpdate({ beforeLeaveTasks: [...(list.beforeLeaveTasks || []), task] });
    setNewBylTitle('');
  };

  const handleSendDepartureReminder = async () => {
    const remaining = (list.beforeLeaveTasks || []).filter((t) => !t.completed);
    const perm = await requestAppNotificationPermission();
    if (perm === 'granted') {
      sendAppNotification(
        `Before You Leave: ${list.title}`,
        remaining.length > 0
          ? `${remaining.length} departure safety checks left (${remaining[0].title}).`
          : 'All home safety & departure checks are complete. Safe travels!'
      );
      setBylNotice('Departure reminder notification sent to this device.');
    } else {
      setBylNotice(
        'Browser notifications are blocked or unsupported here. Departure alerts remain highlighted inside PackSmart.'
      );
    }
    window.setTimeout(() => setBylNotice(''), 4500);
  };

  // ==================== WEATHER HANDLERS ====================
  const handleFetchWeather = async () => {
    const city = weatherCityInput.trim() || list.destination;
    if (!city) {
      setWeatherError('Enter a destination city to fetch live weather.');
      return;
    }
    if (!isOnline) {
      setWeatherError('You are offline. Live weather updates when your connection returns.');
      return;
    }
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const qs = new URLSearchParams({
        city,
        startDate: list.startDate,
        endDate: list.endDate,
      });
      const res = await fetch(`/api/weather?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setWeatherError(data.error || 'Weather forecast unavailable.');
      } else {
        commitUpdate({
          destination: city,
          weather: data as WeatherReport,
        });
      }
    } catch {
      setWeatherError('Network failure while retrieving live forecast.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const addWeatherRecToList = (rec: {
    name: string;
    category: string;
    quantity: number;
    weightGrams: number;
    reason: string;
  }) => {
    if (list.items.some((i) => i.name.trim().toLowerCase() === rec.name.trim().toLowerCase())) {
      return;
    }
    const nextItem: PackingItem = {
      id: uid('w-item'),
      name: rec.name,
      category: rec.category,
      quantity: rec.quantity,
      packed: false,
      weightGrams: rec.weightGrams,
      volumeLiters: estimateItemVolumeLiters(rec.category, rec.weightGrams),
      priority: 'Essential',
      essential: true,
      notes: rec.reason,
      weatherRecommended: true,
      order: list.items.length,
    };
    triggerHaptic('success', preferences.hapticsEnabled);
    commitUpdate({ items: [...list.items, nextItem] }, `added weather item ${rec.name}`);
  };

  // ==================== GROUP PACKING HANDLERS ====================
  const handleCopyShareLink = async () => {
    const link = createShareableListLink(list);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard fallback silently handled
    }
    setCopiedLink(true);
    if (!list.isShared) {
      commitUpdate({ isShared: true }, 'enabled shared group packing');
    }
    window.setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMemberName.trim();
    if (!clean) return;
    if (list.groupMembers.some((m) => m.name.toLowerCase() === clean.toLowerCase())) return;
    const member: GroupMember = {
      id: uid('mem'),
      name: clean,
      role: newMemberRole,
      initials: clean
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
      color: MEMBER_COLORS[list.groupMembers.length % MEMBER_COLORS.length],
    };
    commitUpdate(
      { isShared: true, groupMembers: [...list.groupMembers, member] },
      `invited ${clean} (${newMemberRole})`
    );
    setNewMemberName('');
  };

  const handleGroupAssignSharedItem = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = groupAddName.trim();
    if (!clean) return;

    // Duplicate purchase prevention!
    const existing = list.items.find(
      (i) =>
        i.name.trim().toLowerCase() === clean.toLowerCase() ||
        i.name.trim().toLowerCase().includes(clean.toLowerCase()) ||
        clean.toLowerCase().includes(i.name.trim().toLowerCase())
    );
    if (existing) {
      const owner = list.groupMembers.find((m) => m.id === existing.assignedTo);
      setGroupDuplicateWarn(
        owner
          ? `Duplicate prevented: "${existing.name}" is already assigned to ${owner.name}${existing.packed ? ' (packed)' : ''}.`
          : `Duplicate prevented: "${existing.name}" is already in the shared list — assign it below instead of buying twice.`
      );
      return;
    }

    setGroupDuplicateWarn('');
    const newItem: PackingItem = {
      id: uid('grp-it'),
      name: clean,
      category: 'Miscellaneous',
      quantity: 1,
      packed: false,
      weightGrams: 220,
      volumeLiters: 0.8,
      priority: 'Essential',
      essential: true,
      isSharedEssential: groupAddShared,
      assignedTo: groupAddAssignee || undefined,
      order: list.items.length,
    };
    const assigneeName = list.groupMembers.find((m) => m.id === groupAddAssignee)?.name;
    commitUpdate(
      { isShared: true, items: [...list.items, newItem] },
      assigneeName ? `assigned shared item ${clean} to ${assigneeName}` : `added shared item ${clean}`,
      activeMemberActor
    );
    setGroupAddName('');
    triggerHaptic('success', preferences.hapticsEnabled);
  };

  // ==================== SHOPPING RADAR HANDLERS ====================
  const handleAddShoppingItem = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = shopName.trim();
    const price = Math.max(0, Number(shopPrice) || 0);
    if (!clean) return;
    const newShop: ShoppingItem = {
      id: uid('shop'),
      name: clean,
      category: shopCat,
      estimatedPrice: price,
      priority: shopPriority,
      status: 'To Buy',
      purchased: false,
    };
    commitUpdate({ shoppingItems: [newShop, ...list.shoppingItems] });
    setShopName('');
    setShopPrice('');
    triggerHaptic('light', preferences.hapticsEnabled);
  };

  const handleScanMissingIntoShopping = () => {
    const existingShopNames = new Set(list.shoppingItems.map((s) => s.name.trim().toLowerCase()));
    const candidates = list.items.filter(
      (it) =>
        !it.packed &&
        !existingShopNames.has(it.name.trim().toLowerCase()) &&
        ['Toiletries', 'Medicines & First Aid', 'Electronics', 'Accessories', 'Miscellaneous'].includes(
          it.category
        )
    );
    if (candidates.length === 0) {
      setShopScanNotice('All unpacked consumable & gear items are already tracked in your Shopping Radar.');
      window.setTimeout(() => setShopScanNotice(''), 3500);
      return;
    }

    const urgentClose = daysUntilDeparture <= 3;
    const created: ShoppingItem[] = candidates.slice(0, 5).map((c) => ({
      id: uid('shop'),
      name: c.name,
      category: c.category,
      estimatedPrice: c.category === 'Electronics' ? 950 : c.category === 'Toiletries' ? 350 : 450,
      priority: urgentClose || c.priority === 'Essential' ? 'Urgent' : 'High',
      status: 'To Buy',
      purchased: false,
      notes: 'Auto-detected as unpacked on your checklist',
    }));

    commitUpdate({ shoppingItems: [...created, ...list.shoppingItems] });
    setShopScanNotice(`Pulled ${created.length} unpacked item${created.length === 1 ? '' : 's'} into Shopping Radar.`);
    triggerHaptic('success', preferences.hapticsEnabled);
    window.setTimeout(() => setShopScanNotice(''), 4000);
  };

  const updateShoppingStatus = (shopId: string, status: ShoppingStatus) => {
    triggerHaptic('light', preferences.hapticsEnabled);
    commitUpdate({
      shoppingItems: list.shoppingItems.map((s) =>
        s.id === shopId ? { ...s, status, purchased: status === 'Purchased' } : s
      ),
    });
  };

  const promoteShopToChecklist = (shop: ShoppingItem) => {
    const exists = list.items.some(
      (i) => i.name.trim().toLowerCase() === shop.name.trim().toLowerCase()
    );
    const nextItems = exists
      ? list.items.map((i) =>
          i.name.trim().toLowerCase() === shop.name.trim().toLowerCase()
            ? { ...i, packed: true }
            : i
        )
      : [
          ...list.items,
          {
            id: uid('item'),
            name: shop.name,
            category: shop.category,
            quantity: 1,
            packed: true,
            weightGrams: 180,
            volumeLiters: estimateItemVolumeLiters(shop.category, 180),
            priority: 'Helpful' as const,
            notes: 'Purchased via Last-Minute Shopping Radar',
            order: list.items.length,
          },
        ];
    commitUpdate(
      {
        items: nextItems,
        shoppingItems: list.shoppingItems.map((s) =>
          s.id === shop.id
            ? { ...s, status: 'Purchased' as ShoppingStatus, purchased: true, addedToPackingList: true }
            : s
        ),
      },
      `purchased & packed ${shop.name}`
    );
    triggerHaptic('success', preferences.hapticsEnabled);
  };

  // ==================== POST-TRIP MEMORY HANDLER ====================
  const handleSaveMemory = (e: React.FormEvent) => {
    e.preventDefault();
    const parseCSV = (raw: string) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const memory: PostTripMemory = {
      completedAt: new Date().toISOString().slice(0, 10),
      forgotItems: parseCSV(memForgotInput),
      unusedItems: parseCSV(memUnusedInput),
      wishedItems: parseCSV(memWishedInput),
      lostItems: parseCSV(memLostInput),
      packDifferentlyNote: memNote.trim(),
      tripRating: memRating,
    };

    commitUpdate({
      postTripMemory: memory,
      completed: true,
      completedAt: list.completedAt || new Date().toISOString().slice(0, 10),
    });
    triggerHaptic('success', preferences.hapticsEnabled);
    setMemSavedBanner(
      'Post-Trip Memory saved! PackSmart will automatically prioritize your forgotten items and warn you about unused bulk on future trips.'
    );
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Compact Hero Header */}
      <div className="rounded-3xl overflow-hidden bg-[#111834] text-white border border-[#222B52]">
        <div className="relative h-32 sm:h-36">
          <SafeImage
            src={list.coverImage}
            alt={list.title}
            className="w-full h-full object-cover"
            fallbackLabel={list.destination || list.title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111834] via-[#111834]/55 to-[#111834]/20" />

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to trips"
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-[#111834]/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-[#111834]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAI(list.id)}
                className="min-h-[40px] px-3 rounded-xl bg-[#6E5DE7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  commitUpdate(
                    {
                      completed: !list.completed,
                      completedAt: !list.completed ? new Date().toISOString().slice(0, 10) : undefined,
                    },
                    !list.completed ? 'marked trip as completed' : 'reopened trip'
                  )
                }
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  list.completed
                    ? 'bg-[#0F968C] text-white'
                    : 'bg-white/15 backdrop-blur-md text-white hover:bg-white/25'
                }`}
              >
                {list.completed ? 'Completed' : 'Mark Done'}
              </button>
            </div>
          </div>

          <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-[#D1C9FF]">
                {list.tripType} · {list.destination || 'Local'} · {list.startDate}
                {list.isSampleData ? ' · Sample' : ''}
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-extrabold truncate">
                {list.title}
              </h1>
            </div>
            <ProgressRing
              percent={completionPct}
              size={50}
              strokeWidth={4.5}
              progressColor="#2AB5A8"
              trackClassName="stroke-white/20"
              labelClassName="text-[11px] font-bold text-white"
            />
          </div>
        </div>

        {/* 8-Module Connected Sub-Navigation Strip */}
        <div className="px-3 py-2.5 bg-[#0D1329] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'checklist', label: `Pack (${packedCount}/${totalCount})`, icon: CheckCircle2 },
            {
              id: 'suitcase',
              label: `Suitcase (${suitcaseAnalysis.volumePercent}%)`,
              icon: Luggage,
              alert: suitcaseAnalysis.isVolumeOverloaded || suitcaseAnalysis.isWeightOverloaded,
            },
            {
              id: 'timeline',
              label: `Timeline (${timelineDoneCount}/${timelineTotalCount})`,
              icon: CalendarClock,
            },
            {
              id: 'before_leave',
              label: `Before Leave (${bylDoneCount}/${bylTotalCount})`,
              icon: DoorClosed,
            },
            { id: 'weather', label: 'Weather', icon: CloudSun },
            { id: 'group', label: `Group (${list.groupMembers.length})`, icon: Users },
            {
              id: 'shopping',
              label: `Shopping (${toBuyShopItems.length})`,
              icon: ShoppingBag,
              alert: toBuyShopItems.some((s) => s.priority === 'Urgent'),
            },
            { id: 'memory', label: 'Memory', icon: Brain },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as DetailSubTab)}
                className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-white text-[#111834]'
                    : tab.alert
                    ? 'text-[#FCD34D] hover:bg-white/10'
                    : 'text-[#B5BCE0] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="tabular-nums">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Undo Delete Toast */}
      {undoToast && (
        <div className="p-3.5 rounded-2xl bg-[#111834] text-white flex items-center justify-between gap-3 shadow-lg">
          <span className="text-xs font-medium truncate">Removed "{undoToast.item.name}"</span>
          <button
            type="button"
            onClick={() => restoreDeletedItem(undoToast.item)}
            className="min-h-[36px] px-3 rounded-xl bg-[#2AB5A8] text-[#0B1726] text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
        </div>
      )}

      {/* ==================== TAB 1: PACKING CHECKLIST ==================== */}
      {subTab === 'checklist' && (
        <div className="space-y-4">
          {/* Quick link to Trip Outfit Plan */}
          <div className="p-3.5 rounded-2xl bg-[#F4F2FF] dark:bg-[#191F40] border border-[#E2DCFF] dark:border-[#2C3566] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Shirt className="w-4 h-4 text-[#5645D2] dark:text-[#A799FF] shrink-0" />
              <p className="text-xs text-[#353C54] dark:text-[#D5DBEE] truncate">
                <span className="font-bold text-[#111834] dark:text-white">
                  {list.dayOutfits?.length || 0} Day Outfits Planned
                </span>{' '}
                · Open Wardrobe Studio to mix & sync clothing
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenWardrobe}
              className="min-h-[36px] px-3 rounded-xl bg-white dark:bg-[#131A33] text-[#5645D2] dark:text-[#BDB2FF] text-xs font-semibold shrink-0"
            >
              Outfits
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#848BA6] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items or notes..."
                aria-label="Search checklist items"
                className="w-full min-h-[44px] pl-10 pr-4 rounded-2xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] text-sm text-[#111834] dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openAddSheet}
                className="flex-1 sm:flex-none min-h-[44px] px-4 rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Item</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomCatOpen(true)}
                aria-label="Create custom category"
                className="min-h-[44px] px-3.5 rounded-2xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] text-xs font-semibold text-[#111834] dark:text-[#F4F3EF] flex items-center gap-1.5 whitespace-nowrap"
              >
                <FolderPlus className="w-4 h-4 text-[#5645D2] dark:text-[#A799FF]" />
                <span className="hidden sm:inline">Category</span>
              </button>
              {list.deletedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDeletedDrawerOpen(true)}
                  className="min-h-[44px] px-3.5 rounded-2xl bg-[#F4F2FF] dark:bg-[#1B2344] text-[#5645D2] dark:text-[#BDB2FF] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore ({list.deletedItems.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="inline-flex p-1 rounded-xl bg-[#EDEAE3] dark:bg-[#12182F]">
            {[
              { id: 'all', label: `All (${totalCount})` },
              { id: 'unpacked', label: `Unpacked (${totalCount - packedCount})` },
              { id: 'packed', label: `Packed (${packedCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPackFilter(f.id as typeof packFilter)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-all tabular-nums ${
                  packFilter === f.id
                    ? 'bg-white dark:bg-[#1D264A] text-[#111834] dark:text-white shadow-xs'
                    : 'text-[#646B84] dark:text-[#9AA3C2]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Categorized Checklist */}
          {groupedCategories.length > 0 ? (
            <div className="space-y-4">
              {groupedCategories.map(([category, items]) => {
                const catPacked = items.filter((i) => i.packed).length;
                return (
                  <section
                    key={category}
                    className="bg-white dark:bg-[#131A33] rounded-3xl border border-[#E6E2DA] dark:border-[#242E52] overflow-hidden"
                  >
                    <div className="px-5 py-3.5 bg-[#FAF9F7] dark:bg-[#10162C] border-b border-[#EFECE6] dark:border-[#202948] flex items-center justify-between">
                      <h2 className="font-display font-bold text-sm text-[#111834] dark:text-white">
                        {category}
                      </h2>
                      <span className="font-mono text-xs text-[#646B84] dark:text-[#9AA3C2] tabular-nums">
                        {catPacked}/{items.length} packed
                      </span>
                    </div>

                    <div className="divide-y divide-[#F2EFE9] dark:divide-[#1E2747]">
                      {items.map((item, idx) => {
                        const assignee = list.groupMembers.find((m) => m.id === item.assignedTo);
                        const vol = (
                          (item.volumeLiters || estimateItemVolumeLiters(item.category, item.weightGrams)) *
                          item.quantity
                        ).toFixed(1);
                        return (
                          <div
                            key={item.id}
                            className={`px-4 py-3 flex items-start sm:items-center justify-between gap-3 transition-colors ${
                              item.packed ? 'bg-[#F6FBF9] dark:bg-[#102022]/40' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => toggleItemPacked(item.id)}
                                aria-label={item.packed ? `Uncheck ${item.name}` : `Check ${item.name}`}
                                className="min-h-[44px] min-w-[44px] -ml-2 -my-1.5 flex items-center justify-center shrink-0"
                              >
                                <span
                                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    item.packed
                                      ? 'bg-[#0F968C] border-[#0F968C] text-white scale-105'
                                      : 'border-[#C8C3B8] dark:border-[#394575] bg-white dark:bg-[#0D1326]'
                                  }`}
                                >
                                  {item.packed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </span>
                              </button>

                              <div className="min-w-0 flex-1 pt-0.5">
                                <p
                                  className={`text-sm font-semibold leading-snug ${
                                    item.packed
                                      ? 'line-through text-[#8B91A8] dark:text-[#6C7596]'
                                      : 'text-[#111834] dark:text-white'
                                  }`}
                                >
                                  {item.name}
                                </p>
                                <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                  <span className="font-mono tabular-nums">
                                    {vol}L · {Math.round((item.weightGrams * item.quantity) / 10) / 100} kg
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={
                                      item.priority === 'Essential'
                                        ? 'text-[#0F968C] dark:text-[#2AB5A8] font-semibold'
                                        : ''
                                    }
                                  >
                                    {item.priority}
                                  </span>
                                  {item.weatherRecommended && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-[#5645D2] dark:text-[#A799FF] font-medium">Weather pick</span>
                                    </>
                                  )}
                                  {assignee && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>Owner: {assignee.name.split(' ')[0]}</span>
                                    </>
                                  )}
                                </p>
                                {item.memoryPriorityReason && (
                                  <p className="text-[11px] font-medium text-[#5645D2] dark:text-[#BDB2FF] mt-1">
                                    Memory boost: {item.memoryPriorityReason}
                                  </p>
                                )}
                                {item.memoryUnusedWarning && (
                                  <p className="text-[11px] font-medium text-[#B45309] dark:text-[#FBBF24] mt-1">
                                    {item.memoryUnusedWarning}
                                  </p>
                                )}
                                {item.notes && (
                                  <p className="text-xs text-[#7D849E] dark:text-[#8891B2] mt-1 italic">
                                    {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Quantity & Item Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="flex items-center bg-[#F4F2EE] dark:bg-[#0D1326] rounded-xl p-0.5">
                                <button
                                  type="button"
                                  onClick={() => adjustQuantity(item.id, -1)}
                                  aria-label={`Decrease quantity of ${item.name}`}
                                  className="w-8 h-8 flex items-center justify-center text-sm font-bold text-[#505770] dark:text-[#B4BCD9]"
                                >
                                  −
                                </button>
                                <span className="w-6 text-center font-mono text-xs font-bold tabular-nums text-[#111834] dark:text-white">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustQuantity(item.id, 1)}
                                  aria-label={`Increase quantity of ${item.name}`}
                                  className="w-8 h-8 flex items-center justify-center text-sm font-bold text-[#505770] dark:text-[#B4BCD9]"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => reorderItem(item.id, -1)}
                                disabled={idx === 0}
                                aria-label={`Move ${item.name} up`}
                                className="hidden sm:flex min-h-[36px] min-w-[30px] items-center justify-center rounded-lg text-[#9399B2] hover:text-[#111834] disabled:opacity-30"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => reorderItem(item.id, 1)}
                                disabled={idx === items.length - 1}
                                aria-label={`Move ${item.name} down`}
                                className="hidden sm:flex min-h-[36px] min-w-[30px] items-center justify-center rounded-lg text-[#9399B2] hover:text-[#111834] disabled:opacity-30"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditSheet(item)}
                                aria-label={`Edit ${item.name}`}
                                className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-xl text-[#7D849E] hover:text-[#5645D2]"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteItem(item.id)}
                                aria-label={`Delete ${item.name}`}
                                className="min-h-[40px] min-w-[36px] flex items-center justify-center rounded-xl text-[#7D849E] hover:text-[#DC2626]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] p-8 text-center">
              <p className="font-display font-bold text-base text-[#111834] dark:text-white">
                {packFilter === 'unpacked' && totalCount > 0 ? 'Every item is packed!' : 'No items match this view'}
              </p>
              <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1">
                {packFilter === 'unpacked' && totalCount > 0
                  ? 'You are ready to travel with confidence.'
                  : 'Add custom items or adjust your filter.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SMART SUITCASE SPACE OPTIMIZER ==================== */}
      {subTab === 'suitcase' && (
        <div className="space-y-4">
          {/* Visual Suitcase Capacity Card */}
          <div className="rounded-3xl overflow-hidden bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52]">
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-4 relative min-h-[160px] bg-[#111834]">
                <SafeImage
                  src={ASSETS.suitcase}
                  alt="Organized suitcase space layout"
                  className="w-full h-full object-cover"
                  fallbackLabel="Suitcase Space"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111834]/90 via-[#111834]/30 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-[11px] font-semibold text-[#D1C9FF]">Selected Luggage</p>
                  <p className="font-display font-bold text-base leading-tight">{list.luggageType}</p>
                </div>
              </div>

              <div className="md:col-span-8 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-[#111834] dark:text-white">
                      Smart Suitcase Space Optimizer
                    </h2>
                    <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">
                      Visual compartment volume & estimated baggage weight
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] text-[#646B84] dark:text-[#9AA3C2]">Space Used</p>
                      <p
                        className={`font-mono text-base font-bold tabular-nums ${
                          suitcaseAnalysis.isVolumeOverloaded
                            ? 'text-[#DC2626] dark:text-[#F87171]'
                            : 'text-[#0F968C] dark:text-[#2AB5A8]'
                        }`}
                      >
                        {suitcaseAnalysis.totalVolumeLiters}L / {suitcaseAnalysis.capacityLiters}L
                      </p>
                    </div>
                    <ProgressRing
                      percent={Math.min(100, suitcaseAnalysis.volumePercent)}
                      size={52}
                      strokeWidth={5}
                      progressColor={suitcaseAnalysis.isVolumeOverloaded ? '#DC2626' : '#6E5DE7'}
                    />
                  </div>
                </div>

                {/* Luggage Preset Selector */}
                <div>
                  <label className="block text-xs font-semibold text-[#646B84] dark:text-[#9AA3C2] mb-2">
                    Switch Luggage Type & Capacity
                  </label>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {LUGGAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.type}
                        type="button"
                        onClick={() => handleSelectLuggagePreset(preset.type)}
                        className={`min-h-[42px] px-3 py-1.5 rounded-xl text-left text-xs shrink-0 border transition-colors ${
                          list.luggageType === preset.type
                            ? 'bg-[#111834] dark:bg-[#6E5DE7] border-[#111834] dark:border-[#6E5DE7] text-white font-semibold'
                            : 'bg-[#FAF9F7] dark:bg-[#0D1326] border-[#E6E2DA] dark:border-[#242E52] text-[#505770] dark:text-[#B4BCD9]'
                        }`}
                      >
                        <p className="whitespace-nowrap">{preset.type}</p>
                        <p className="text-[10px] opacity-75 font-mono">
                          {preset.defaultAllowanceKg}kg limit · {preset.dimensions}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overload Alert Banner */}
                {(suitcaseAnalysis.isVolumeOverloaded || suitcaseAnalysis.isWeightOverloaded) && (
                  <div className="p-3.5 rounded-2xl bg-[#FEF2F2] dark:bg-[#3A1620] border border-[#FECACA] dark:border-[#6B2130] flex items-start gap-2.5 text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Luggage Overload Detected</p>
                      <p className="mt-0.5">
                        {suitcaseAnalysis.isVolumeOverloaded
                          ? `Estimated volume exceeds ${list.luggageCapacityLiters}L by ${(
                              suitcaseAnalysis.totalVolumeLiters - suitcaseAnalysis.capacityLiters
                            ).toFixed(1)}L. `
                          : ''}
                        {suitcaseAnalysis.isWeightOverloaded
                          ? `Weight (${formatWeight(suitcaseAnalysis.totalWeightKg)}) exceeds your ${formatWeight(
                              suitcaseAnalysis.allowanceKg
                            )} limit.`
                          : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Visual Suitcase Compartment Fill Diagram */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#111834] dark:text-white">
                      Visual Suitcase Fill Map
                    </span>
                    <span className="font-mono tabular-nums text-[#646B84] dark:text-[#9AA3C2]">
                      Est. Weight: {formatWeight(suitcaseAnalysis.totalWeightKg)} /{' '}
                      {formatWeight(suitcaseAnalysis.allowanceKg)}
                    </span>
                  </div>

                  {/* Proportional suitcase shell */}
                  <div className="p-2 rounded-2xl border-2 border-[#111834]/20 dark:border-[#394575] bg-[#FAF9F7] dark:bg-[#0D1326]">
                    <div className="h-10 rounded-xl overflow-hidden flex gap-0.5 bg-[#EAE6DE] dark:bg-[#1B2344]">
                      {suitcaseAnalysis.compartments.map((comp) => (
                        <div
                          key={comp.category}
                          title={`${comp.category}: ${comp.volumeLiters}L (${comp.weightKg}kg)`}
                          style={{
                            width: `${Math.max(4, comp.percentOfBag)}%`,
                            backgroundColor: comp.color,
                          }}
                          className="h-full flex items-center justify-center text-[10px] font-bold text-white px-1 overflow-hidden"
                        >
                          {comp.percentOfBag >= 13 ? comp.category.split(' ')[0] : ''}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Compartment breakdown legend */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {suitcaseAnalysis.compartments.map((comp) => (
                      <div
                        key={comp.category}
                        className="p-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#EFECE6] dark:border-[#202948]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: comp.color }}
                          />
                          <span className="text-[11px] font-semibold text-[#111834] dark:text-white truncate">
                            {comp.category}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-[#646B84] dark:text-[#9AA3C2] tabular-nums mt-1">
                          {comp.volumeLiters}L · {comp.weightKg}kg
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items You Can Remove or Trim */}
          <div className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-3">
            <h3 className="font-display text-base font-bold text-[#111834] dark:text-white">
              Smart Space-Saving Trim Suggestions
            </h3>
            {suitcaseAnalysis.removableSuggestions.length === 0 ? (
              <p className="text-xs text-[#0F968C] dark:text-[#2AB5A8]">
                Your suitcase is tightly optimized — no obvious low-priority bulk detected.
              </p>
            ) : (
              <div className="divide-y divide-[#F0EDE7] dark:divide-[#202948]">
                {suitcaseAnalysis.removableSuggestions.map((sug) => (
                  <div
                    key={sug.item.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111834] dark:text-white truncate">
                        {sug.item.name}{' '}
                        <span className="font-mono text-xs text-[#5645D2] dark:text-[#A799FF]">
                          ({sug.spaceSavedLiters}L · ×{sug.item.quantity})
                        </span>
                      </p>
                      <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5">{sug.reason}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sug.item.quantity > 1 && (
                        <button
                          type="button"
                          onClick={() => adjustQuantity(sug.item.id, -1)}
                          className="min-h-[38px] px-3 rounded-xl bg-[#F4F2FF] dark:bg-[#1B2344] text-[#5645D2] dark:text-[#BDB2FF] text-xs font-semibold whitespace-nowrap"
                        >
                          Trim −1
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteItem(sug.item.id)}
                        className="min-h-[38px] px-3 rounded-xl bg-[#FEF2F2] dark:bg-[#3A1620] text-[#DC2626] dark:text-[#FCA5A5] text-xs font-semibold whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Space-Saving Alternatives & Folding/Rolling Techniques */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-3">
              <h3 className="font-display text-base font-bold text-[#111834] dark:text-white">
                Space-Saving Alternatives
              </h3>
              <div className="space-y-3">
                {suitcaseAnalysis.spaceSavingAlternatives.map((alt) => (
                  <div
                    key={alt.title}
                    className="p-3.5 rounded-2xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#EFECE6] dark:border-[#202948]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-[#111834] dark:text-white">{alt.title}</p>
                      <span className="font-mono text-[11px] font-semibold text-[#0F968C] dark:text-[#2AB5A8] shrink-0">
                        {alt.savingsEstimate}
                      </span>
                    </div>
                    <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1">{alt.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#5645D2] dark:text-[#A799FF]" />
                <h3 className="font-display text-base font-bold text-[#111834] dark:text-white">
                  Rolling, Folding & Organizing Techniques
                </h3>
              </div>
              <div className="space-y-3">
                {suitcaseAnalysis.packingTechniques.map((tech) => (
                  <div
                    key={tech.technique}
                    className="p-3.5 rounded-2xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#EFECE6] dark:border-[#202948]"
                  >
                    <p className="text-xs font-bold text-[#111834] dark:text-white">{tech.technique}</p>
                    <p className="text-[11px] font-medium text-[#5645D2] dark:text-[#A799FF] mt-0.5">
                      Best for: {tech.bestFor}
                    </p>
                    <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1 leading-relaxed">
                      {tech.howTo}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: SMART TRIP TIMELINE ==================== */}
      {subTab === 'timeline' && (
        <div className="space-y-4">
          {/* Clean Countdown Calendar Header */}
          <div className="rounded-3xl bg-[#111834] text-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#2AB5A8]">Smart Trip Timeline</p>
                <h2 className="font-display text-xl font-extrabold mt-0.5">
                  {daysUntilDeparture < 0
                    ? 'Trip Underway'
                    : daysUntilDeparture === 0
                    ? 'Departure Day Today'
                    : `${daysUntilDeparture} Day${daysUntilDeparture === 1 ? '' : 's'} Until Departure`}
                </h2>
                <p className="text-xs text-white/75 mt-0.5">
                  {list.startDate} to {list.endDate} · {timelineDoneCount}/{timelineTotalCount} milestones completed
                </p>
              </div>
              <ProgressRing
                percent={
                  timelineTotalCount > 0 ? Math.round((timelineDoneCount / timelineTotalCount) * 100) : 0
                }
                size={54}
                strokeWidth={5}
                progressColor="#2AB5A8"
                trackClassName="stroke-white/20"
                labelClassName="text-xs font-bold text-white"
              />
            </div>

            {/* Horizontal 5-Stage Calendar Strip */}
            <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-white/10">
              {TIMELINE_STAGE_ORDER.map((stage) => {
                const meta = TIMELINE_STAGE_META[stage];
                const stageTasks = (list.timelineTasks || []).filter((t) => t.stage === stage);
                const stageDone = stageTasks.filter((t) => t.completed).length;
                const stageDate = addDaysToDateStr(list.startDate, meta.offsetDays);
                return (
                  <div
                    key={stage}
                    className="p-2 rounded-xl bg-white/10 text-center"
                  >
                    <p className="text-[10px] font-semibold text-[#D1C9FF] truncate">{meta.shortLabel}</p>
                    <p className="font-mono text-xs font-bold mt-0.5 tabular-nums">{stageDate.slice(5)}</p>
                    <p className="font-mono text-[10px] text-[#2AB5A8] tabular-nums mt-0.5">
                      {stageDone}/{stageTasks.length}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Custom Timeline Task */}
          <form
            onSubmit={handleAddTimelineTask}
            className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52] grid grid-cols-1 sm:grid-cols-12 gap-2.5"
          >
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add preparation task (e.g., Download offline maps)"
              className="sm:col-span-5 min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
            />
            <select
              value={newTaskStage}
              onChange={(e) => setNewTaskStage(e.target.value as TimelineStage)}
              className="sm:col-span-4 min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs text-[#111834] dark:text-white"
            >
              {TIMELINE_STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {TIMELINE_STAGE_META[stage].label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="sm:col-span-3 min-h-[44px] rounded-xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
          </form>

          {/* Grouped Timeline Stages */}
          <div className="space-y-4">
            {TIMELINE_STAGE_ORDER.map((stage) => {
              const meta = TIMELINE_STAGE_META[stage];
              const stageTasks = (list.timelineTasks || []).filter((t) => t.stage === stage);
              const stageDate = addDaysToDateStr(list.startDate, meta.offsetDays);

              return (
                <section
                  key={stage}
                  className="bg-white dark:bg-[#131A33] rounded-3xl border border-[#E6E2DA] dark:border-[#242E52] overflow-hidden"
                >
                  <div className="px-5 py-3.5 bg-[#FAF9F7] dark:bg-[#10162C] border-b border-[#EFECE6] dark:border-[#202948] flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-sm text-[#111834] dark:text-white">
                        {meta.label}
                      </h3>
                      <p className="font-mono text-[11px] text-[#646B84] dark:text-[#9AA3C2]">
                        Target date: {stageDate}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-[#5645D2] dark:text-[#A799FF] tabular-nums">
                      {stageTasks.filter((t) => t.completed).length}/{stageTasks.length}
                    </span>
                  </div>

                  {stageTasks.length === 0 ? (
                    <p className="p-4 text-xs text-[#646B84] dark:text-[#9AA3C2]">
                      No tasks scheduled for this stage.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#F2EFE9] dark:divide-[#1E2747]">
                      {stageTasks.map((task) => (
                        <div
                          key={task.id}
                          className="px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleTimelineTask(task.id)}
                            className="flex items-start gap-3 min-w-0 flex-1 text-left"
                          >
                            <span
                              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                                task.completed
                                  ? 'bg-[#0F968C] border-[#0F968C] text-white'
                                  : 'border-[#C8C3B8] dark:border-[#394575]'
                              }`}
                            >
                              {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </span>
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-semibold ${
                                  task.completed
                                    ? 'line-through text-[#8B91A8]'
                                    : 'text-[#111834] dark:text-white'
                                }`}
                              >
                                {task.title}
                              </p>
                              <p className="text-[11px] text-[#646B84] dark:text-[#9AA3C2] mt-0.5">
                                Due {task.dueDate}
                                {task.notes ? ` · ${task.notes}` : ''}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingTimelineTask(task)}
                              aria-label="Edit or reschedule task"
                              className="min-h-[38px] min-w-[36px] flex items-center justify-center text-[#7D849E] hover:text-[#5645D2]"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                commitUpdate({
                                  timelineTasks: (list.timelineTasks || []).filter(
                                    (t) => t.id !== task.id
                                  ),
                                })
                              }
                              aria-label="Delete timeline task"
                              className="min-h-[38px] min-w-[36px] flex items-center justify-center text-[#7D849E] hover:text-[#DC2626]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 4: BEFORE YOU LEAVE MODE ==================== */}
      {subTab === 'before_leave' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#111834] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <ProgressRing
                percent={bylPct}
                size={60}
                strokeWidth={5}
                progressColor="#2AB5A8"
                trackClassName="stroke-white/20"
                labelClassName="text-xs font-bold text-white"
              />
              <div>
                <p className="text-xs font-semibold text-[#2AB5A8]">
                  {daysUntilDeparture <= 2
                    ? 'Active Departure Mode · Final Checks'
                    : 'Departure Safety & Essentials Checklist'}
                </p>
                <h2 className="font-display text-xl font-extrabold">Before You Leave Mode</h2>
                <p className="text-xs text-white/75 mt-0.5 tabular-nums">
                  {bylDoneCount}/{bylTotalCount} completed · Lock up home & grab essentials calmly
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSendDepartureReminder}
                className="min-h-[42px] px-3.5 rounded-xl bg-white/15 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Bell className="w-4 h-4 text-[#2AB5A8]" />
                <span>Send Reminder</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmCompleteAllByl(true)}
                disabled={bylDoneCount === bylTotalCount && bylTotalCount > 0}
                className="min-h-[42px] px-4 rounded-xl bg-[#2AB5A8] text-[#0B1726] text-xs font-bold disabled:opacity-50"
              >
                Mark All Completed
              </button>
            </div>
          </div>

          {bylNotice && (
            <div className="p-3.5 rounded-2xl bg-[#EEF9F7] dark:bg-[#102928] text-[#0C7A72] dark:text-[#2AB5A8] text-xs font-medium">
              {bylNotice}
            </div>
          )}

          {/* Add Custom Departure Check */}
          <form
            onSubmit={handleAddBylTask}
            className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52] grid grid-cols-1 sm:grid-cols-12 gap-2.5"
          >
            <input
              type="text"
              value={newBylTitle}
              onChange={(e) => setNewBylTitle(e.target.value)}
              placeholder="Add custom check (e.g., Water indoor plants, Set AC off)"
              className="sm:col-span-6 min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
            />
            <select
              value={newBylCategory}
              onChange={(e) => setNewBylCategory(e.target.value as BeforeLeaveTask['category'])}
              className="sm:col-span-3 min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs text-[#111834] dark:text-white"
            >
              <option value="Home Safety">Home Safety</option>
              <option value="Documents & Keys">Documents & Keys</option>
              <option value="Devices & Luggage">Devices & Luggage</option>
              <option value="Custom">Custom</option>
            </select>
            <button
              type="submit"
              className="sm:col-span-3 min-h-[44px] rounded-xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Check</span>
            </button>
          </form>

          {/* Before You Leave Checklist Cards */}
          <div className="bg-white dark:bg-[#131A33] rounded-3xl border border-[#E6E2DA] dark:border-[#242E52] divide-y divide-[#F0EDE7] dark:divide-[#202948] overflow-hidden">
            {(list.beforeLeaveTasks || []).map((task) => (
              <div
                key={task.id}
                className={`p-4 flex items-center justify-between gap-3 ${
                  task.completed
                    ? 'bg-[#F5FBF9] dark:bg-[#102424]/40'
                    : task.important
                    ? 'bg-[#FFFDF5] dark:bg-[#1C1E36]'
                    : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleByl(task.id)}
                  className="flex items-start gap-3 min-w-0 flex-1 text-left"
                >
                  <span
                    className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                      task.completed
                        ? 'bg-[#0F968C] border-[#0F968C] text-white'
                        : 'border-[#C8C3B8] dark:border-[#394575]'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        task.completed
                          ? 'line-through text-[#8B91A8]'
                          : 'text-[#111834] dark:text-white'
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5">
                      {task.category}
                      {task.important && !task.completed ? ' · Important Safety Check' : ''}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      commitUpdate({
                        beforeLeaveTasks: (list.beforeLeaveTasks || []).map((t) =>
                          t.id === task.id ? { ...t, important: !t.important } : t
                        ),
                      })
                    }
                    aria-label="Toggle important"
                    className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl ${
                      task.important ? 'text-[#D97706]' : 'text-[#9399B2]'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${task.important ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitUpdate({
                        beforeLeaveTasks: (list.beforeLeaveTasks || []).filter(
                          (t) => t.id !== task.id
                        ),
                      })
                    }
                    aria-label="Remove check"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#9399B2] hover:text-[#DC2626]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 5: LIVE WEATHER ==================== */}
      {subTab === 'weather' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-4">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={weatherCityInput}
                onChange={(e) => setWeatherCityInput(e.target.value)}
                placeholder="Destination city (e.g., Kochi, Tokyo, Zurich)"
                className="flex-1 min-h-[44px] px-4 rounded-2xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              />
              <button
                type="button"
                onClick={handleFetchWeather}
                disabled={weatherLoading}
                className="min-h-[44px] px-5 rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {weatherLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>{list.weather ? 'Refresh Live Forecast' : 'Fetch Live Forecast'}</span>
              </button>
            </div>

            {weatherError && (
              <p role="alert" className="text-xs font-medium text-[#DC2626] dark:text-[#F87171] bg-[#FEF2F2] dark:bg-[#3A1620] px-3.5 py-2.5 rounded-xl">
                {weatherError}
              </p>
            )}

            {list.weather ? (
              <>
                <div className="rounded-2xl bg-[#111834] text-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-[#2AB5A8]">
                        {list.weather.source === 'live_forecast'
                          ? 'Actual Live Meteorological Forecast · Open-Meteo'
                          : 'Current Weather Preview · Trip dates beyond 16-day live window'}
                      </p>
                      <h2 className="font-display text-xl font-bold mt-1">{list.weather.locationName}</h2>
                      <p className="text-xs text-white/75 mt-1 max-w-xl">{list.weather.note}</p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <p className="text-3xl font-bold">
                        {list.weather.summary.avgHigh}°
                        <span className="text-lg text-white/60">/{list.weather.summary.avgLow}°C</span>
                      </p>
                      <p className="text-xs text-[#D1C9FF] mt-0.5">{list.weather.summary.primaryCondition}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10 text-xs">
                    <div className="flex items-center gap-2">
                      <CloudRain className="w-4 h-4 text-[#A799FF]" />
                      <span className="font-mono tabular-nums">{list.weather.summary.maxRainChance}% max rain</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-[#2AB5A8]" />
                      <span className="font-mono tabular-nums">{list.weather.summary.avgHumidity}% humidity</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-[#FCD34D]" />
                      <span className="font-mono tabular-nums">
                        {list.weather.current ? `${list.weather.current.windSpeed} km/h now` : 'Live wind'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {list.weather.days.slice(0, 10).map((day) => (
                    <div
                      key={day.date}
                      className="p-3.5 rounded-2xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E6E2DA] dark:border-[#242E52] space-y-1.5"
                    >
                      <p className="text-xs font-semibold text-[#111834] dark:text-white font-mono">
                        {day.date.slice(5)}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-[#5645D2] dark:text-[#A799FF]">
                        {day.precipProb >= 40 ? <CloudRain className="w-4 h-4" /> : <Sun className="w-4 h-4 text-[#F59E0B]" />}
                        <span className="truncate">{day.condition}</span>
                      </div>
                      <p className="font-mono text-sm font-bold text-[#111834] dark:text-white tabular-nums">
                        {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°C
                      </p>
                      <p className="text-[11px] text-[#646B84] dark:text-[#9AA3C2] font-mono tabular-nums">
                        Rain {Math.round(day.precipProb)}%
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-6 rounded-2xl bg-[#FAF9F7] dark:bg-[#0D1326] text-center">
                <CloudSun className="w-8 h-8 text-[#6E5DE7] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#111834] dark:text-white">
                  No weather forecast loaded yet
                </p>
                <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1">
                  Enter a city above to fetch live Open-Meteo conditions and tailored gear picks.
                </p>
              </div>
            )}
          </div>

          {list.weather && list.weather.recommendations.length > 0 && (
            <div className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52]">
              <h3 className="font-display text-base font-bold text-[#111834] dark:text-white mb-3">
                Weather-Matched Packing Gear
              </h3>
              <div className="divide-y divide-[#F0EDE7] dark:divide-[#202948]">
                {list.weather.recommendations.map((rec) => {
                  const inList = list.items.some(
                    (i) => i.name.trim().toLowerCase() === rec.name.trim().toLowerCase()
                  );
                  return (
                    <div key={rec.name} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111834] dark:text-white truncate">{rec.name}</p>
                        <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5">{rec.reason}</p>
                      </div>
                      <button
                        type="button"
                        disabled={inList}
                        onClick={() => addWeatherRecToList(rec)}
                        className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                          inList
                            ? 'bg-[#EEF9F7] dark:bg-[#102928] text-[#0F968C] dark:text-[#2AB5A8]'
                            : 'bg-[#111834] dark:bg-[#6E5DE7] text-white'
                        }`}
                      >
                        {inList ? 'In Checklist' : '+ Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 6: GROUP PACKING – WHO'S CARRYING WHAT? ==================== */}
      {subTab === 'group' && (
        <div className="space-y-4">
          {/* Shared Trip Progress Dashboard & Invite Link */}
          <div className="rounded-3xl bg-[#111834] text-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#D1C9FF]">Group Packing · Who's Carrying What?</p>
                <h2 className="font-display text-xl font-extrabold mt-0.5">
                  Shared Trip Progress Dashboard
                </h2>
                <p className="text-xs text-white/75 mt-0.5 tabular-nums">
                  {list.items.filter((i) => i.packed).length} completed ·{' '}
                  {list.items.filter((i) => !i.packed && i.assignedTo).length} pending ·{' '}
                  {list.items.filter((i) => !i.assignedTo).length} unassigned
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="min-h-[42px] px-4 rounded-xl bg-[#2AB5A8] text-[#0B1726] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? 'Invite Link Copied' : 'Share Invite Link'}</span>
              </button>
            </div>

            {/* Per-member progress bars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
              {list.groupMembers.map((member) => {
                const assigned = list.items.filter((i) => i.assignedTo === member.id);
                const done = assigned.filter((i) => i.packed).length;
                const pct = assigned.length > 0 ? Math.round((done / assigned.length) * 100) : 0;
                return (
                  <div key={member.id} className="p-3 rounded-2xl bg-white/10 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                          style={{ backgroundColor: member.color }}
                        >
                          {member.initials}
                        </span>
                        <span className="text-xs font-bold truncate">{member.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#2AB5A8] tabular-nums">
                        {done}/{assigned.length}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                      <div className="h-full bg-[#2AB5A8] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invite Participant & Add Shared Item with Duplicate Prevention */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form
              onSubmit={handleAddMember}
              className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52] space-y-2.5"
            >
              <p className="text-xs font-bold text-[#111834] dark:text-white flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#5645D2] dark:text-[#A799FF]" />
                <span>Add Trip Participant</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Participant name"
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as 'Editor' | 'Viewer')}
                  className="min-h-[42px] px-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs text-[#111834] dark:text-white"
                >
                  <option value="Editor">Editor</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold"
                >
                  Add
                </button>
              </div>
            </form>

            <form
              onSubmit={handleGroupAssignSharedItem}
              className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52] space-y-2.5"
            >
              <p className="text-xs font-bold text-[#111834] dark:text-white">
                Assign Shared Essential (Duplicate-Protected)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={groupAddName}
                  onChange={(e) => {
                    setGroupAddName(e.target.value);
                    setGroupDuplicateWarn('');
                  }}
                  placeholder="e.g., First-aid kit, Power strip, Speaker"
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
                />
                <select
                  value={groupAddAssignee}
                  onChange={(e) => setGroupAddAssignee(e.target.value)}
                  className="min-h-[42px] px-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs text-[#111834] dark:text-white"
                >
                  <option value="">Unassigned</option>
                  {list.groupMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-xl bg-[#0F968C] text-white text-xs font-semibold"
                >
                  Assign
                </button>
              </div>
              {groupDuplicateWarn && (
                <p role="alert" className="text-xs font-semibold text-[#B45309] dark:text-[#FBBF24]">
                  {groupDuplicateWarn}
                </p>
              )}
            </form>
          </div>

          {/* Acting As Member Selector + Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex p-1 rounded-xl bg-[#EDEAE3] dark:bg-[#12182F]">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Pending' },
                { id: 'unassigned', label: 'Unassigned' },
                { id: 'completed', label: 'Completed' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGroupFilter(f.id as typeof groupFilter)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold ${
                    groupFilter === f.id
                      ? 'bg-white dark:bg-[#1D264A] text-[#111834] dark:text-white shadow-xs'
                      : 'text-[#646B84] dark:text-[#9AA3C2]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#646B84] dark:text-[#9AA3C2]">Update as:</span>
              <select
                value={activeMemberActor}
                onChange={(e) => setActiveMemberActor(e.target.value)}
                className="min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-[#131A33] border border-[#E6E2DA] dark:border-[#242E52] text-xs font-semibold text-[#111834] dark:text-white"
              >
                {list.groupMembers.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignment Matrix */}
          <div className="bg-white dark:bg-[#131A33] rounded-3xl border border-[#E6E2DA] dark:border-[#242E52] divide-y divide-[#F0EDE7] dark:divide-[#202948] overflow-hidden">
            {groupFilteredItems.map((item) => (
              <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleItemPacked(item.id, activeMemberActor)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      item.packed
                        ? 'bg-[#0F968C] border-[#0F968C] text-white'
                        : 'border-[#C8C3B8] dark:border-[#394575]'
                    }`}
                  >
                    {item.packed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        item.packed ? 'line-through text-[#8B91A8]' : 'text-[#111834] dark:text-white'
                      }`}
                    >
                      {item.name}
                    </p>
                    <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">
                      {item.category}
                      {item.isSharedEssential ? ' · Shared Essential' : ''}
                      {item.packed && item.packedBy ? ` · Packed by ${item.packedBy}` : ''}
                    </p>
                  </div>
                </button>

                <select
                  value={item.assignedTo || ''}
                  aria-label={`Assign ${item.name}`}
                  onChange={(e) => {
                    const memberId = e.target.value || undefined;
                    const memberName = list.groupMembers.find((m) => m.id === memberId)?.name;
                    commitUpdate(
                      {
                        items: list.items.map((i) =>
                          i.id === item.id ? { ...i, assignedTo: memberId } : i
                        ),
                      },
                      memberName ? `assigned ${item.name} to ${memberName}` : `unassigned ${item.name}`,
                      activeMemberActor
                    );
                  }}
                  className="min-h-[38px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs font-semibold text-[#111834] dark:text-white"
                >
                  <option value="">Unassigned</option>
                  {list.groupMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 7: LAST-MINUTE SHOPPING RADAR ==================== */}
      {subTab === 'shopping' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#111834] text-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#FCD34D]">
                {daysUntilDeparture <= 3
                  ? `Urgent Window · ${Math.max(0, daysUntilDeparture)}d to Departure`
                  : 'Last-Minute Shopping Radar'}
              </p>
              <h2 className="font-display text-xl font-extrabold mt-0.5">
                {toBuyShopItems.length} Item{toBuyShopItems.length === 1 ? '' : 's'} Left to Buy
              </h2>
              <p className="font-mono text-xs text-white/75 tabular-nums mt-1">
                Est. Total: {preferences.currency}
                {totalEstimatedShop} · Spent: {preferences.currency}
                {totalPurchasedShop} · Budget left: {preferences.currency}
                {remainingBudget}
              </p>
            </div>
            <button
              type="button"
              onClick={handleScanMissingIntoShopping}
              className="min-h-[44px] px-4 rounded-xl bg-[#2AB5A8] text-[#0B1726] text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span>Scan Missing Checklist Items</span>
            </button>
          </div>

          {shopScanNotice && (
            <div className="p-3.5 rounded-2xl bg-[#EEF9F7] dark:bg-[#102928] text-[#0C7A72] dark:text-[#2AB5A8] text-xs font-medium">
              {shopScanNotice}
            </div>
          )}

          {/* Add Shopping Item Form */}
          <form
            onSubmit={handleAddShoppingItem}
            className="bg-white dark:bg-[#131A33] rounded-3xl p-4 border border-[#E6E2DA] dark:border-[#242E52] grid grid-cols-1 sm:grid-cols-12 gap-2.5"
          >
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Item to purchase (e.g., Universal adapter, SPF 50)"
              className="sm:col-span-5 min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
            />
            <input
              type="number"
              min={0}
              value={shopPrice}
              onChange={(e) => setShopPrice(e.target.value)}
              placeholder={`Est. ${preferences.currency}`}
              className="sm:col-span-2 min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm font-mono text-[#111834] dark:text-white"
            />
            <select
              value={shopPriority}
              onChange={(e) => setShopPriority(e.target.value as ShoppingPriority)}
              className="sm:col-span-2 min-h-[44px] px-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs text-[#111834] dark:text-white"
            >
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
            </select>
            <button
              type="submit"
              className="sm:col-span-3 min-h-[44px] rounded-xl bg-[#111834] dark:bg-[#6E5DE7] text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Radar</span>
            </button>
          </form>

          {/* Shopping List */}
          <div className="bg-white dark:bg-[#131A33] rounded-3xl border border-[#E6E2DA] dark:border-[#242E52] divide-y divide-[#F0EDE7] dark:divide-[#202948] overflow-hidden">
            {list.shoppingItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-bold text-[#111834] dark:text-white">
                  No last-minute purchases needed yet
                </p>
                <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-1">
                  Tap "Scan Missing Checklist Items" above or add any travel essentials you still need to pick up.
                </p>
              </div>
            ) : (
              list.shoppingItems.map((shop) => {
                const isUrgent = shop.status === 'To Buy' && (shop.priority === 'Urgent' || daysUntilDeparture <= 2);
                return (
                  <div
                    key={shop.id}
                    className={`p-4 flex flex-wrap items-center justify-between gap-3 ${
                      isUrgent ? 'bg-[#FFFBEB] dark:bg-[#292112]/40' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold ${
                          shop.status === 'Purchased' || shop.status === 'No Longer Needed'
                            ? 'line-through text-[#8B91A8]'
                            : 'text-[#111834] dark:text-white'
                        }`}
                      >
                        {shop.name}
                      </p>
                      <p className="text-xs text-[#646B84] dark:text-[#9AA3C2] mt-0.5 font-mono tabular-nums">
                        {shop.category} · {preferences.currency}
                        {shop.estimatedPrice} ·{' '}
                        <span className={isUrgent ? 'text-[#B45309] dark:text-[#FBBF24] font-bold' : ''}>
                          {shop.priority}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={shop.status}
                        aria-label={`Status for ${shop.name}`}
                        onChange={(e) => updateShoppingStatus(shop.id, e.target.value as ShoppingStatus)}
                        className="min-h-[38px] px-2.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs font-semibold text-[#111834] dark:text-white"
                      >
                        <option value="To Buy">To Buy</option>
                        <option value="Purchased">Purchased</option>
                        <option value="No Longer Needed">No Longer Needed</option>
                      </select>

                      {!shop.addedToPackingList && shop.status !== 'No Longer Needed' && (
                        <button
                          type="button"
                          onClick={() => promoteShopToChecklist(shop)}
                          className="min-h-[38px] px-3 rounded-xl bg-[#0F968C] text-white text-xs font-semibold whitespace-nowrap"
                        >
                          Bought & Pack
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          commitUpdate({
                            shoppingItems: list.shoppingItems.filter((s) => s.id !== shop.id),
                          })
                        }
                        aria-label={`Delete ${shop.name}`}
                        className="min-h-[38px] min-w-[36px] flex items-center justify-center text-[#9399B2] hover:text-[#DC2626]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 8: POST-TRIP MEMORY ==================== */}
      {subTab === 'memory' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#111834] text-white p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#D1C9FF]">
              <Brain className="w-4 h-4 text-[#2AB5A8]" />
              <span>Post-Trip Memory Learning System</span>
            </div>
            <h2 className="font-display text-xl font-extrabold mt-1">
              Teach PackSmart from this trip
            </h2>
            <p className="text-xs text-white/75 mt-1 leading-relaxed">
              Record what you forgot, what stayed untouched in your bag, and what you wished you had packed. PackSmart automatically prioritizes your forgotten items and flags unused bulk in future trips.
            </p>
          </div>

          {memSavedBanner && (
            <div className="p-4 rounded-2xl bg-[#EEF9F7] dark:bg-[#102928] text-[#0C7A72] dark:text-[#2AB5A8] text-xs font-semibold">
              {memSavedBanner}
            </div>
          )}

          <form
            onSubmit={handleSaveMemory}
            className="bg-white dark:bg-[#131A33] rounded-3xl p-5 border border-[#E6E2DA] dark:border-[#242E52] space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-[#111834] dark:text-white mb-1.5">
                Items you forgot to pack (comma-separated)
              </label>
              <input
                type="text"
                value={memForgotInput}
                onChange={(e) => setMemForgotInput(e.target.value)}
                placeholder="e.g., Portable power bank, Universal travel adapter, Lip balm"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111834] dark:text-white mb-1.5">
                Items you carried but never used (comma-separated)
              </label>
              <input
                type="text"
                value={memUnusedInput}
                onChange={(e) => setMemUnusedInput(e.target.value)}
                placeholder="e.g., Extra pair of heavy jeans, Spare formal blazer"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#111834] dark:text-white mb-1.5">
                  Items you wished you had packed
                </label>
                <input
                  type="text"
                  value={memWishedInput}
                  onChange={(e) => setMemWishedInput(e.target.value)}
                  placeholder="e.g., Compact umbrella, Earplugs"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111834] dark:text-white mb-1.5">
                  Items lost or misplaced
                </label>
                <input
                  type="text"
                  value={memLostInput}
                  onChange={(e) => setMemLostInput(e.target.value)}
                  placeholder="e.g., Sunglasses pouch, Hairbrush"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111834] dark:text-white mb-1.5">
                What would you pack differently next time?
              </label>
              <textarea
                rows={3}
                value={memNote}
                onChange={(e) => setMemNote(e.target.value)}
                placeholder="e.g., Stick to 2 pairs of shoes and pack quick-dry fabrics instead of heavy cotton."
                className="w-full p-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111834] dark:text-white mb-2">
                How smooth was your packing preparation? ({memRating}/5)
              </label>
              <div className="flex items-center gap-2">
                {([1, 2, 3, 4, 5] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMemRating(r)}
                    className={`min-h-[42px] min-w-[42px] rounded-xl border flex items-center justify-center ${
                      r <= memRating
                        ? 'bg-[#FFFBEB] dark:bg-[#332712] border-[#F59E0B] text-[#D97706]'
                        : 'bg-[#FAF9F7] dark:bg-[#0D1326] border-[#E2DDD4] dark:border-[#28335C] text-[#9399B2]'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${r <= memRating ? 'fill-current' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Brain className="w-4 h-4" />
              <span>Save Post-Trip Memory & Apply to Future Trips</span>
            </button>
          </form>
        </div>
      )}

      {/* ==================== MODALS & BOTTOM SHEETS ==================== */}
      <BottomSheet
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        title={editingItem ? 'Edit Packing Item' : 'Add Packing Item'}
        subtitle="Track volume, weight, priority, and group assignment"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {itemFormError && (
            <p role="alert" className="text-xs font-medium text-[#DC2626] bg-[#FEF2F2] p-3 rounded-xl">
              {itemFormError}
            </p>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
              Item Name
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Packable rain shell"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                Category
              </label>
              <select
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                Priority
              </label>
              <select
                value={itemPriority}
                onChange={(e) => setItemPriority(e.target.value as PackingItem['priority'])}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              >
                <option value="Essential">Essential</option>
                <option value="Helpful">Helpful</option>
                <option value="Optional">Optional</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                Qty
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={itemQty}
                onChange={(e) => setItemQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm font-mono text-[#111834] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                Weight (g)
              </label>
              <input
                type="number"
                min={0}
                value={itemWeight}
                onChange={(e) => setItemWeight(Math.max(0, Number(e.target.value) || 0))}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm font-mono text-[#111834] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                Space (L)
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                value={itemVolume}
                onChange={(e) => setItemVolume(Math.max(0.1, Number(e.target.value) || 0.5))}
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm font-mono text-[#111834] dark:text-white"
              />
            </div>
          </div>

          {list.groupMembers.length > 0 && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                  Assign To
                </label>
                <select
                  value={itemAssignedTo}
                  onChange={(e) => setItemAssignedTo(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs text-[#111834] dark:text-white"
                >
                  <option value="">Unassigned</option>
                  {list.groupMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] flex items-center justify-between text-xs font-semibold text-[#111834] dark:text-white cursor-pointer">
                <span>Shared Essential</span>
                <input
                  type="checkbox"
                  checked={itemSharedEssential}
                  onChange={(e) => setItemSharedEssential(e.target.checked)}
                  className="w-4 h-4 accent-[#0F968C]"
                />
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
              Notes (optional)
            </label>
            <input
              type="text"
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              placeholder="e.g., Pack inside outer sleeve"
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white font-semibold text-sm"
          >
            {editingItem ? 'Save Changes' : 'Add to Checklist'}
          </button>
        </form>
      </BottomSheet>

      {/* Custom Category Sheet */}
      <BottomSheet
        open={customCatOpen}
        onClose={() => setCustomCatOpen(false)}
        title="Create Custom Category"
      >
        <form onSubmit={handleAddCustomCategory} className="space-y-4">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g., Photography Gear, Baby Care, Cycling"
            className="w-full min-h-[46px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
          />
          <button
            type="submit"
            className="w-full min-h-[46px] rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white font-semibold text-sm"
          >
            Create Category
          </button>
        </form>
      </BottomSheet>

      {/* Restore Deleted Items Sheet */}
      <BottomSheet
        open={deletedDrawerOpen}
        onClose={() => setDeletedDrawerOpen(false)}
        title="Restore Deleted Items"
      >
        <div className="divide-y divide-[#F0EDE7] dark:divide-[#202948]">
          {list.deletedItems.map((entry) => (
            <div key={entry.item.id + entry.deletedAt} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111834] dark:text-white truncate">
                  {entry.item.name}
                </p>
                <p className="text-xs text-[#646B84] dark:text-[#9AA3C2]">
                  {entry.item.category} · Qty {entry.item.quantity}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restoreDeletedItem(entry.item)}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#EEF9F7] dark:bg-[#102928] text-[#0F968C] dark:text-[#2AB5A8] text-xs font-semibold"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Edit / Reschedule Timeline Task Sheet */}
      <BottomSheet
        open={Boolean(editingTimelineTask)}
        onClose={() => setEditingTimelineTask(null)}
        title="Edit & Reschedule Timeline Task"
      >
        {editingTimelineTask && (
          <form onSubmit={handleSaveTimelineEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                Task Title
              </label>
              <input
                type="text"
                value={editingTimelineTask.title}
                onChange={(e) =>
                  setEditingTimelineTask({ ...editingTimelineTask, title: e.target.value })
                }
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm text-[#111834] dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                  Stage
                </label>
                <select
                  value={editingTimelineTask.stage}
                  onChange={(e) => {
                    const nextStage = e.target.value as TimelineStage;
                    setEditingTimelineTask({
                      ...editingTimelineTask,
                      stage: nextStage,
                      dueDate: addDaysToDateStr(
                        list.startDate,
                        TIMELINE_STAGE_META[nextStage].offsetDays
                      ),
                    });
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs text-[#111834] dark:text-white"
                >
                  {TIMELINE_STAGE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {TIMELINE_STAGE_META[s].shortLabel}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#474E68] dark:text-[#B4BCD9] mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editingTimelineTask.dueDate}
                  onChange={(e) =>
                    setEditingTimelineTask({ ...editingTimelineTask, dueDate: e.target.value })
                  }
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-xs font-mono text-[#111834] dark:text-white"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full min-h-[46px] rounded-2xl bg-[#111834] dark:bg-[#6E5DE7] text-white font-semibold text-sm"
            >
              Save Changes
            </button>
          </form>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmCompleteAllByl}
        title="Mark entire departure checklist complete?"
        description="Confirm that lights, gas, water taps, doors, documents, keys, and charged devices have all been verified before you leave."
        confirmLabel="Mark All Done"
        destructive={false}
        onConfirm={() => {
          commitUpdate({
            beforeLeaveTasks: (list.beforeLeaveTasks || []).map((t) => ({ ...t, completed: true })),
          });
          setConfirmCompleteAllByl(false);
          triggerHaptic('success', preferences.hapticsEnabled);
        }}
        onCancel={() => setConfirmCompleteAllByl(false)}
      />
    </div>
  );
};
