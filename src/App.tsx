import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Home,
  ShieldCheck,
  Shirt,
  User,
  WifiOff,
} from 'lucide-react';
import type {
  AIMissingPieceSuggestion,
  AppState,
  DayOutfitPlan,
  DocumentRecord,
  OutfitCombination,
  PackingItem,
  PackingList,
  PackingMode,
  PackingTemplate,
  TabId,
  UserAccount,
  WardrobeItem,
  WeatherReport,
} from './types';
import {
  ASSETS,
  createStarterDocuments,
  createStarterLists,
  createStarterReminders,
  INITIAL_PERSONAL_ESSENTIALS,
  INITIAL_SAVED_OUTFITS,
  INITIAL_TEMPLATES,
  INITIAL_WARDROBE,
} from './data/templates';
import {
  createDefaultBeforeLeaveTasks,
  estimateItemVolumeLiters,
  extractMemoryInsights,
  generateSmartTimeline,
} from './utils/packingEngine';
import {
  deleteWardrobePhoto,
  getAllWardrobePhotos,
  loadAppState,
  parseShareableListHash,
  saveAppState,
  saveWardrobePhoto,
  uid,
} from './utils/storage';
import { triggerHaptic } from './utils/haptics';
import { BrandLogo } from './components/ui/BrandLogo';
import { SplashScreen } from './screens/SplashScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ListsScreen } from './screens/ListsScreen';
import { CreateListScreen } from './screens/CreateListScreen';
import { DetailSubTab, ListDetailScreen } from './screens/ListDetailScreen';
import { WardrobeScreen } from './screens/WardrobeScreen';
import { EssentialsScreen } from './screens/EssentialsScreen';
import { AIAssistantScreen } from './screens/AIAssistantScreen';
import { HistoryInsightsScreen } from './screens/HistoryInsightsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PlatformShell } from './components/platform/PlatformShell';

function createDefaultUser(): UserAccount {
  return {
    id: 'local-default-user',
    name: 'Pavithra',
    email: 'traveller@packsmart.local',
    initials: 'PA',
    createdAt: new Date().toISOString(),
    mode: 'local',
  };
}

function createInitialState(): AppState {
  const defaultUser = createDefaultUser();
  return {
    hasCompletedOnboarding: true,
    user: defaultUser,
    accounts: [],
    lists: createStarterLists(defaultUser.name),
    wardrobe: INITIAL_WARDROBE,
    savedOutfits: INITIAL_SAVED_OUTFITS,
    templates: INITIAL_TEMPLATES,
    documents: createStarterDocuments(),
    reminders: createStarterReminders(),
    personalEssentials: INITIAL_PERSONAL_ESSENTIALS,
    preferences: {
      weightUnit: 'kg',
      currency: '₹',
      defaultAllowanceKg: 15,
      darkMode: false,
      hapticsEnabled: true,
      notificationsEnabled: false,
      rememberEssentials: true,
    },
    aiMessages: [],
    sampleDataBannerDismissed: false,
    lastSavedAt: new Date().toISOString(),
  };
}

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [surfaceMode, setSurfaceMode] = useState<'editorial' | 'workspace'>('editorial');
  const [state, setState] = useState<AppState>(() => {
    const saved = loadAppState();
    if (!saved) return createInitialState();
    return {
      ...createInitialState(),
      ...saved,
      hasCompletedOnboarding: true,
      user: saved.user || createDefaultUser(),
      wardrobe: saved.wardrobe || INITIAL_WARDROBE,
      savedOutfits: saved.savedOutfits || INITIAL_SAVED_OUTFITS,
      preferences: {
        ...createInitialState().preferences,
        ...(saved.preferences || {}),
      },
    };
  });

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [createOverlayMode, setCreateOverlayMode] = useState<PackingMode | null>(null);
  const [openListState, setOpenListState] = useState<{ id: string; subTab: DetailSubTab } | null>(null);
  const [openOverlay, setOpenOverlay] = useState<
    null | { type: 'ai'; listId?: string } | { type: 'history' }
  >(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [aiConfigured, setAiConfigured] = useState<boolean>(false);
  const [sharedImportNotice, setSharedImportNotice] = useState<string>('');
  const [wardrobePhotos, setWardrobePhotos] = useState<Record<string, string>>({});

  const memoryInsights = useMemo(() => extractMemoryInsights(state.lists), [state.lists]);
  const hasSampleData = useMemo(
    () =>
      state.lists.some((l) => l.isSampleData) ||
      state.documents.some((d) => d.isSampleData),
    [state.lists, state.documents]
  );

  // Persist app state automatically to localStorage
  useEffect(() => {
    saveAppState({ ...state, lastSavedAt: new Date().toISOString() });
  }, [state]);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (state.preferences.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.preferences.darkMode]);

  // Track real online / offline state & server health capabilities
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    fetch('/api/health')
      .then((r) => r.json())
      .then((d: { aiConfigured?: boolean }) => {
        setAiConfigured(Boolean(d.aiConfigured));
      })
      .catch(() => setAiConfigured(false));

    getAllWardrobePhotos()
      .then((photos) => setWardrobePhotos(photos))
      .catch(() => {
        // IndexedDB unavailable in restricted browsing mode
      });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Import shared group list if opened via a #share=... invite link
  useEffect(() => {
    const parsed = parseShareableListHash(window.location.hash);
    if (!parsed || !parsed.title) return;
    const startDate = parsed.startDate || new Date().toISOString().slice(0, 10);
    const endDate = parsed.endDate || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const imported: PackingList = {
      id: uid('shared'),
      title: parsed.title,
      mode: parsed.mode || 'Travel',
      tripType: 'Vacation',
      destination: parsed.destination || '',
      coverImage: ASSETS.kerala,
      startDate,
      endDate,
      travellers: parsed.travellers || 2,
      purpose: 'Shared Group Packing',
      travelMethod: 'Flight',
      accommodation: 'Hotel',
      weatherPreference: 'Auto (Live Weather)',
      laundryAvailable: false,
      activities: [],
      preference: 'Balanced',
      customCategories: [],
      items: (parsed.items || []).map((it, idx) => ({
        ...it,
        volumeLiters: it.volumeLiters || estimateItemVolumeLiters(it.category, it.weightGrams),
        priority: it.priority || 'Helpful',
        order: idx,
      })),
      deletedItems: [],
      weather: null,
      luggageType: 'Carry-On Spinner (40L)',
      luggageCapacityLiters: 40,
      baggageAllowanceKg: 15,
      bagWeightKg: 2.5,
      dayOutfits: [],
      beforeLeaveTasks: createDefaultBeforeLeaveTasks(),
      timelineTasks: generateSmartTimeline(startDate, parsed.destination || '', 'Vacation', 'Flight'),
      shoppingBudget: 5000,
      shoppingItems: [],
      isShared: true,
      shareCode: parsed.shareCode,
      groupMembers: parsed.groupMembers || [],
      groupActivity: [
        {
          id: uid('act'),
          memberName: 'Shared Invite',
          action: `imported "${parsed.title}"`,
          timestamp: new Date().toISOString(),
        },
      ],
      groupSuggestions: [],
      allowMemberEdits: true,
      postTripMemory: null,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, lists: [imported, ...prev.lists] }));
    setSharedImportNotice(`Imported shared group trip "${imported.title}".`);
    window.history.replaceState(null, '', window.location.pathname);
    window.setTimeout(() => setSharedImportNotice(''), 5000);
  }, []);

  const updateList = (updated: PackingList) => {
    setState((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => (l.id === updated.id ? updated : l)),
    }));
  };

  const handleClearSampleData = () => {
    setState((prev) => ({
      ...prev,
      lists: prev.lists.filter((l) => !l.isSampleData),
      documents: prev.documents.filter((d) => !d.isSampleData),
      sampleDataBannerDismissed: true,
    }));
    setOpenListState(null);
    triggerHaptic('medium', state.preferences.hapticsEnabled);
  };

  const handleAddItemToList = (listId: string, item: PackingItem): boolean => {
    const target = state.lists.find((l) => l.id === listId);
    if (!target) return false;
    if (target.items.some((i) => i.name.trim().toLowerCase() === item.name.trim().toLowerCase())) {
      return false;
    }
    updateList({
      ...target,
      items: [...target.items, item],
      updatedAt: new Date().toISOString(),
    });
    triggerHaptic('success', state.preferences.hapticsEnabled);
    return true;
  };

  const handleSyncWardrobeToTrip = (tripId: string, items: PackingItem[]): number => {
    const target = state.lists.find((l) => l.id === tripId);
    if (!target) return 0;
    const existing = new Set(target.items.map((i) => i.name.trim().toLowerCase()));
    const fresh = items
      .filter((it) => !existing.has(it.name.trim().toLowerCase()))
      .map((it, idx) => ({ ...it, order: target.items.length + idx }));
    if (fresh.length === 0) return 0;
    updateList({
      ...target,
      items: [...target.items, ...fresh],
      updatedAt: new Date().toISOString(),
    });
    triggerHaptic('success', state.preferences.hapticsEnabled);
    return fresh.length;
  };

  const handleUpdateTripDayOutfits = (tripId: string, dayOutfits: DayOutfitPlan[]) => {
    const target = state.lists.find((l) => l.id === tripId);
    if (!target) return;
    updateList({ ...target, dayOutfits });
    triggerHaptic('success', state.preferences.hapticsEnabled);
  };

  const handleSaveWardrobePhoto = async (photoId: string, dataUrl: string): Promise<void> => {
    setWardrobePhotos((prev) => ({ ...prev, [photoId]: dataUrl }));
    try {
      await saveWardrobePhoto(photoId, dataUrl);
    } catch {
      // Keep in-memory photo even if IndexedDB storage quota is restricted
    }
  };

  const handleDeleteWardrobeItem = (itemId: string) => {
    const target = state.wardrobe.find((w) => w.id === itemId);
    if (target?.photoId) {
      const pid = target.photoId;
      setWardrobePhotos((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      deleteWardrobePhoto(pid).catch(() => {});
    }
    setState((prev) => ({
      ...prev,
      wardrobe: prev.wardrobe.filter((w) => w.id !== itemId),
    }));
  };

  const handleAddMissingPieceToShopping = (
    tripId: string,
    suggestion: AIMissingPieceSuggestion
  ): boolean => {
    const target = state.lists.find((l) => l.id === tripId);
    if (!target) return false;
    const exists = target.shoppingItems.some(
      (s) => s.name.trim().toLowerCase() === suggestion.name.trim().toLowerCase()
    );
    if (exists) return false;

    const newItem = {
      id: uid('shop'),
      name: `${suggestion.name} (${suggestion.colorSuggestion})`,
      category: suggestion.category === 'Footwear' ? 'Footwear' : suggestion.category === 'Accessories' ? 'Accessories' : 'Clothing',
      estimatedPrice: 0,
      priority: 'High' as const,
      status: 'To Buy' as const,
      purchased: false,
      notes: `Unlocks +${suggestion.unlockedCombosCount} AI outfits — ${suggestion.impactSummary}`,
    };

    updateList({
      ...target,
      shoppingItems: [newItem, ...target.shoppingItems],
      updatedAt: new Date().toISOString(),
    });
    triggerHaptic('success', state.preferences.hapticsEnabled);
    return true;
  };

  const handleDuplicateList = (listId: string) => {
    const src = state.lists.find((l) => l.id === listId);
    if (!src) return;
    const copy: PackingList = {
      ...src,
      id: uid('trip'),
      title: `${src.title} (Copy)`,
      isSampleData: false,
      completed: false,
      completedAt: undefined,
      postTripMemory: null,
      items: src.items.map((i) => ({ ...i, id: uid('item'), packed: false, packedBy: undefined })),
      beforeLeaveTasks: createDefaultBeforeLeaveTasks(),
      timelineTasks: (src.timelineTasks || []).map((t) => ({ ...t, id: uid('tl'), completed: false })),
      deletedItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState((prev) => ({ ...prev, lists: [copy, ...prev.lists] }));
    setOpenOverlay(null);
    setOpenListState({ id: copy.id, subTab: 'checklist' });
    triggerHaptic('success', state.preferences.hapticsEnabled);
  };

  const handleCreateFromTemplate = (tpl: PackingTemplate) => {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + Math.max(1, tpl.defaultDays - 1));
    const startStr = today.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const userName = state.user?.name || 'Traveller';
    const userInitials = state.user?.initials || 'PS';
    const tripType =
      tpl.mode === 'Work' ? 'Business' : tpl.mode === 'College' ? 'College' : 'Vacation';

    const created: PackingList = {
      id: uid('trip'),
      title: tpl.title,
      mode: tpl.mode,
      tripType,
      subMode: tpl.title,
      destination: '',
      coverImage: tpl.coverImage,
      startDate: startStr,
      endDate: endStr,
      travellers: 1,
      purpose: tpl.description,
      travelMethod: tpl.mode === 'Travel' ? 'Flight' : 'Local',
      accommodation: tpl.mode === 'College' ? 'Hostel' : 'Hotel',
      weatherPreference: 'Auto (Live Weather)',
      laundryAvailable: false,
      activities: [],
      preference: 'Balanced',
      customCategories: [],
      items: tpl.items.map((seed, idx) => ({
        id: uid('item'),
        name: seed.name,
        category: seed.category,
        quantity: seed.quantity,
        packed: false,
        weightGrams: seed.weightGrams,
        volumeLiters: seed.volumeLiters || estimateItemVolumeLiters(seed.category, seed.weightGrams),
        priority: seed.essential ? 'Essential' : 'Helpful',
        essential: seed.essential,
        notes: seed.notes,
        order: idx,
      })),
      deletedItems: [],
      weather: null,
      luggageType: 'Carry-On Spinner (40L)',
      luggageCapacityLiters: 40,
      baggageAllowanceKg: tpl.defaultAllowanceKg,
      bagWeightKg: tpl.mode === 'Travel' ? 2.5 : 0.9,
      dayOutfits: [],
      beforeLeaveTasks: createDefaultBeforeLeaveTasks(),
      timelineTasks: generateSmartTimeline(startStr, '', tripType, tpl.mode === 'Travel' ? 'Flight' : 'Local'),
      shoppingBudget: 3000,
      shoppingItems: [],
      isShared: false,
      shareCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      allowMemberEdits: true,
      groupMembers: [
        { id: 'm-owner', name: userName, role: 'Owner', initials: userInitials, color: '#D9C9F2' },
      ],
      groupActivity: [],
      groupSuggestions: [],
      postTripMemory: null,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setState((prev) => ({ ...prev, lists: [created, ...prev.lists] }));
    setOpenListState({ id: created.id, subTab: 'checklist' });
    triggerHaptic('success', state.preferences.hapticsEnabled);
  };

  const handleSaveListAsTemplate = (list: PackingList) => {
    const newTpl: PackingTemplate = {
      id: uid('tpl'),
      title: `${list.title} Template`,
      mode: list.mode,
      description: `Saved from your ${list.title} checklist (${list.items.length} items).`,
      defaultDays: 3,
      defaultAllowanceKg: list.baggageAllowanceKg,
      coverImage: list.coverImage,
      isCustom: true,
      items: list.items.map((i) => ({
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        weightGrams: i.weightGrams,
        volumeLiters: i.volumeLiters,
        essential: i.essential,
        notes: i.notes,
      })),
    };
    setState((prev) => ({ ...prev, templates: [newTpl, ...prev.templates] }));
    setOpenOverlay(null);
    setActiveTab('essentials');
    triggerHaptic('success', state.preferences.hapticsEnabled);
  };

  const handleCreateSpatialList = (created: PackingList) => {
    setState((prev) => ({ ...prev, lists: [created, ...prev.lists] }));
    triggerHaptic('success', state.preferences.hapticsEnabled);
  };

  // Optional replay overlays (only if user explicitly triggers from Profile)
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }
  if (!state.hasCompletedOnboarding) {
    return (
      <OnboardingScreen
        onFinish={() => setState((prev) => ({ ...prev, hasCompletedOnboarding: true }))}
      />
    );
  }
  if (!state.user) {
    return (
      <AuthScreen
        existingAccounts={state.accounts}
        onAuthenticate={(account: UserAccount, newRecord) => {
          setState((prev) => ({
            ...prev,
            user: account,
            accounts: newRecord ? [...prev.accounts, newRecord] : prev.accounts,
          }));
        }}
      />
    );
  }

  // Unified Luxury Editorial × Minimal SaaS Travel Platform (Default Experience)
  if (surfaceMode === 'editorial') {
    return (
      <PlatformShell
        user={state.user}
        lists={state.lists}
        wardrobe={state.wardrobe}
        wardrobePhotos={wardrobePhotos}
        savedOutfits={state.savedOutfits}
        documents={state.documents}
        personalEssentials={state.personalEssentials}
        memoryInsights={memoryInsights}
        defaultAllowanceKg={state.preferences.defaultAllowanceKg}
        isOnline={isOnline}
        aiConfigured={aiConfigured}
        onEnterClassicWorkspace={(tab = 'essentials') => {
          setSurfaceMode('workspace');
          setOpenListState(null);
          setOpenOverlay(null);
          setCreateOverlayMode(null);
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenClassicTrip={(tripId, subTab = 'checklist') => {
          setSurfaceMode('workspace');
          setActiveTab('trips');
          setOpenListState({ id: tripId, subTab });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onCreateList={handleCreateSpatialList}
        onUpdateList={updateList}
        onAddWardrobeItem={(item: WardrobeItem) =>
          setState((prev) => ({ ...prev, wardrobe: [item, ...prev.wardrobe] }))
        }
        onSaveWardrobePhoto={handleSaveWardrobePhoto}
        onDeleteWardrobeItem={handleDeleteWardrobeItem}
        onSaveOutfit={(outfit: OutfitCombination) =>
          setState((prev) => ({ ...prev, savedOutfits: [outfit, ...prev.savedOutfits] }))
        }
        onToggleFavoriteOutfit={(outfitId: string) =>
          setState((prev) => ({
            ...prev,
            savedOutfits: prev.savedOutfits.map((o) =>
              o.id === outfitId ? { ...o, isFavorite: !o.isFavorite } : o
            ),
          }))
        }
        onUpdateTripDayOutfits={handleUpdateTripDayOutfits}
        onSyncWardrobeToTrip={handleSyncWardrobeToTrip}
        onAddMissingPieceToShopping={handleAddMissingPieceToShopping}
        onSaveWeather={(listId: string, weather: WeatherReport) => {
          setState((prev) => ({
            ...prev,
            lists: prev.lists.map((l) => (l.id === listId ? { ...l, weather } : l)),
          }));
        }}
      />
    );
  }

  const activeDetailList = openListState
    ? state.lists.find((l) => l.id === openListState.id) || null
    : null;

  const navigateTab = (tab: TabId) => {
    triggerHaptic('light', state.preferences.hapticsEnabled);
    setOpenListState(null);
    setOpenOverlay(null);
    setCreateOverlayMode(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#171717] flex flex-col font-sans">
      {/* Minimal Editorial Workspace Top Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-30 h-16 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#171717]/10">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => {
              setSurfaceMode('editorial');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 min-h-[44px] whitespace-nowrap shrink-0"
          >
            <BrandLogo size={28} />
            <span className="font-serif font-semibold text-xl tracking-tight text-[#171717]">
              PackSmart
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#171717]/65">
            <button
              type="button"
              onClick={() => {
                setSurfaceMode('editorial');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-[#171717] transition-colors whitespace-nowrap"
            >
              Platform Home
            </button>
            <button
              type="button"
              onClick={() => navigateTab('trips')}
              className={`hover:text-[#171717] transition-colors whitespace-nowrap ${
                activeTab === 'trips' ? 'text-[#171717] underline underline-offset-4' : ''
              }`}
            >
              My Trips
            </button>
            <button
              type="button"
              onClick={() => navigateTab('wardrobe')}
              className={`hover:text-[#171717] transition-colors whitespace-nowrap ${
                activeTab === 'wardrobe' ? 'text-[#171717] underline underline-offset-4' : ''
              }`}
            >
              AI Outfit Studio
            </button>
            <button
              type="button"
              onClick={() => navigateTab('essentials')}
              className={`hover:text-[#171717] transition-colors whitespace-nowrap ${
                activeTab === 'essentials' ? 'text-[#171717] underline underline-offset-4' : ''
              }`}
            >
              Document Vault
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {!isOnline && (
              <span className="text-xs font-medium text-[#171717] bg-[#FFC5A8] rounded-md px-2.5 py-1 flex items-center gap-1 whitespace-nowrap">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSurfaceMode('editorial');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="md:hidden h-9 px-3 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717] whitespace-nowrap"
            >
              Platform
            </button>
            <button
              type="button"
              onClick={() => navigateTab('profile')}
              aria-label="Open Profile"
              className="w-9 h-9 rounded-lg bg-[#171717] text-[#FFFFFF] text-xs font-semibold flex items-center justify-center shrink-0"
            >
              {state.user.initials}
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Content Canvas */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-24">
        {sharedImportNotice && (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#B8D9F266] dark:bg-[#101010] text-[#101010] dark:text-[#FFFFFF] text-xs font-semibold">
            {sharedImportNotice}
          </div>
        )}

        {createOverlayMode ? (
          <CreateListScreen
            initialMode={createOverlayMode}
            user={state.user}
            wardrobe={state.wardrobe}
            personalEssentials={state.personalEssentials}
            memoryInsights={memoryInsights}
            defaultAllowanceKg={state.preferences.defaultAllowanceKg}
            isOnline={isOnline}
            aiConfigured={aiConfigured}
            onCreated={(newList) => {
              setState((prev) => ({ ...prev, lists: [newList, ...prev.lists] }));
              setCreateOverlayMode(null);
              setActiveTab('trips');
              setOpenListState({ id: newList.id, subTab: 'checklist' });
              triggerHaptic('success', state.preferences.hapticsEnabled);
            }}
            onCancel={() => setCreateOverlayMode(null)}
          />
        ) : openOverlay?.type === 'ai' ? (
          <AIAssistantScreen
            lists={state.lists}
            initialListId={openOverlay.listId}
            messages={state.aiMessages}
            isOnline={isOnline}
            aiConfigured={aiConfigured}
            onBack={() => setOpenOverlay(null)}
            onSaveMessages={(aiMessages) => setState((prev) => ({ ...prev, aiMessages }))}
            onAddItemToList={handleAddItemToList}
          />
        ) : openOverlay?.type === 'history' ? (
          <HistoryInsightsScreen
            lists={state.lists}
            onBack={() => setOpenOverlay(null)}
            onOpenList={(id, subTab = 'checklist') => {
              setOpenOverlay(null);
              setOpenListState({ id, subTab });
            }}
            onDuplicateList={handleDuplicateList}
            onSaveAsTemplate={handleSaveListAsTemplate}
          />
        ) : activeDetailList ? (
          <ListDetailScreen
            list={activeDetailList}
            initialSubTab={openListState?.subTab || 'checklist'}
            preferences={state.preferences}
            currentUserName={state.user.name}
            isOnline={isOnline}
            memoryInsights={memoryInsights}
            onBack={() => setOpenListState(null)}
            onUpdateList={updateList}
            onOpenAI={(listId) => setOpenOverlay({ type: 'ai', listId })}
            onOpenWardrobe={() => navigateTab('wardrobe')}
          />
        ) : activeTab === 'home' ? (
          <HomeScreen
            user={state.user}
            lists={state.lists}
            reminders={state.reminders}
            documents={state.documents}
            isOnline={isOnline}
            hasSampleData={hasSampleData}
            sampleBannerDismissed={state.sampleDataBannerDismissed}
            onDismissSampleBanner={() =>
              setState((prev) => ({ ...prev, sampleDataBannerDismissed: true }))
            }
            onClearSampleData={handleClearSampleData}
            onOpenList={(id, subTab = 'checklist') => setOpenListState({ id, subTab })}
            onCreateTrip={() => setCreateOverlayMode('Travel')}
            onOpenWardrobe={() => navigateTab('wardrobe')}
            onOpenEssentials={() => navigateTab('essentials')}
            onOpenAI={(listId) => setOpenOverlay({ type: 'ai', listId })}
            onOpenHistory={() => setOpenOverlay({ type: 'history' })}
            onToggleReminder={(remId) =>
              setState((prev) => ({
                ...prev,
                reminders: prev.reminders.map((r) =>
                  r.id === remId ? { ...r, completed: !r.completed } : r
                ),
              }))
            }
            onSaveWeather={(listId: string, weather: WeatherReport) => {
              setState((prev) => ({
                ...prev,
                lists: prev.lists.map((l) => (l.id === listId ? { ...l, weather } : l)),
              }));
            }}
          />
        ) : activeTab === 'trips' ? (
          <ListsScreen
            lists={state.lists}
            documents={state.documents}
            onOpenList={(id, subTab = 'checklist') => setOpenListState({ id, subTab })}
            onDuplicateList={handleDuplicateList}
            onDeleteList={(id) =>
              setState((prev) => ({ ...prev, lists: prev.lists.filter((l) => l.id !== id) }))
            }
            onOpenCreate={() => setCreateOverlayMode('Travel')}
            onOpenHistory={() => setOpenOverlay({ type: 'history' })}
          />
        ) : activeTab === 'wardrobe' ? (
          <WardrobeScreen
            wardrobe={state.wardrobe}
            wardrobePhotos={wardrobePhotos}
            savedOutfits={state.savedOutfits}
            trips={state.lists}
            isOnline={isOnline}
            aiConfigured={aiConfigured}
            onAddWardrobeItem={(item: WardrobeItem) =>
              setState((prev) => ({ ...prev, wardrobe: [item, ...prev.wardrobe] }))
            }
            onSaveWardrobePhoto={handleSaveWardrobePhoto}
            onDeleteWardrobeItem={handleDeleteWardrobeItem}
            onSaveOutfit={(outfit: OutfitCombination) =>
              setState((prev) => ({ ...prev, savedOutfits: [outfit, ...prev.savedOutfits] }))
            }
            onToggleFavoriteOutfit={(outfitId: string) =>
              setState((prev) => ({
                ...prev,
                savedOutfits: prev.savedOutfits.map((o) =>
                  o.id === outfitId ? { ...o, isFavorite: !o.isFavorite } : o
                ),
              }))
            }
            onDeleteOutfit={(outfitId: string) =>
              setState((prev) => ({
                ...prev,
                savedOutfits: prev.savedOutfits.filter((o) => o.id !== outfitId),
              }))
            }
            onUpdateTripDayOutfits={handleUpdateTripDayOutfits}
            onSyncWardrobeToTrip={handleSyncWardrobeToTrip}
            onAddMissingPieceToShopping={handleAddMissingPieceToShopping}
            onSaveWeather={(listId: string, weather: WeatherReport) => {
              setState((prev) => ({
                ...prev,
                lists: prev.lists.map((l) => (l.id === listId ? { ...l, weather } : l)),
              }));
            }}
          />
        ) : activeTab === 'essentials' ? (
          <EssentialsScreen
            documents={state.documents}
            trips={state.lists}
            templates={state.templates}
            personalEssentials={state.personalEssentials}
            preferences={state.preferences}
            onSetVaultPinHash={(hash) =>
              setState((prev) => ({
                ...prev,
                preferences: { ...prev.preferences, vaultPinHash: hash },
              }))
            }
            onAddDocument={(doc: DocumentRecord) =>
              setState((prev) => ({ ...prev, documents: [doc, ...prev.documents] }))
            }
            onDeleteDocument={(docId) =>
              setState((prev) => ({
                ...prev,
                documents: prev.documents.filter((d) => d.id !== docId),
              }))
            }
            onUpdateTrip={updateList}
            onOpenTrip={(tripId, subTab = 'checklist') => setOpenListState({ id: tripId, subTab })}
            onCreateFromTemplate={handleCreateFromTemplate}
            onUpdateEssentials={(personalEssentials) =>
              setState((prev) => ({ ...prev, personalEssentials }))
            }
          />
        ) : (
          <ProfileScreen
            user={state.user}
            preferences={state.preferences}
            reminders={state.reminders}
            isOnline={isOnline}
            aiConfigured={aiConfigured}
            hasSampleData={hasSampleData}
            fullState={state}
            onUpdateUser={(user) => setState((prev) => ({ ...prev, user }))}
            onUpdatePreferences={(preferences) => setState((prev) => ({ ...prev, preferences }))}
            onUpdateReminders={(reminders) => setState((prev) => ({ ...prev, reminders }))}
            onOpenAI={() => setOpenOverlay({ type: 'ai' })}
            onOpenHistory={() => setOpenOverlay({ type: 'history' })}
            onClearSampleData={handleClearSampleData}
            onImportBackup={(restored) => setState({ ...restored, hasCompletedOnboarding: true })}
            onReplayOnboarding={() =>
              setState((prev) => ({ ...prev, hasCompletedOnboarding: false }))
            }
            onSignOut={() => setState((prev) => ({ ...prev, user: null }))}
          />
        )}
      </main>

      {/* Fixed 5-Tab Workspace Navigation Bar */}
      <nav
        aria-label="Primary workspace navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-sm border-t border-[#171717]/10 pb-safe"
      >
        <div className="max-w-xl mx-auto grid grid-cols-5 items-center h-16 px-1">
          {[
            { id: 'home' as TabId, label: 'Home', icon: Home },
            { id: 'trips' as TabId, label: 'My Trips', icon: Briefcase },
            { id: 'wardrobe' as TabId, label: 'Wardrobe', icon: Shirt },
            { id: 'essentials' as TabId, label: 'Vault', icon: ShieldCheck },
            { id: 'profile' as TabId, label: 'Profile', icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive =
              !openListState && !openOverlay && !createOverlayMode && activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigateTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center min-h-[48px] transition-colors ${
                  isActive
                    ? 'text-[#171717]'
                    : 'text-[#171717]/50 hover:text-[#171717]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.7]'}`} />
                <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
