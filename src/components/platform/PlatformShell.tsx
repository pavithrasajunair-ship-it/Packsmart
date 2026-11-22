import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useScroll, useSpring } from 'motion/react';
import { Menu, ShieldCheck, WifiOff, X } from 'lucide-react';
import type {
  AIMissingPieceSuggestion,
  DayOutfitPlan,
  DocumentRecord,
  OutfitCombination,
  PackingItem,
  PackingList,
  PersonalEssential,
  TabId,
  UserAccount,
  WardrobeItem,
  WeatherReport,
} from '../../types';
import type { MemoryLearningInsights } from '../../utils/packingEngine';
import { BrandLogo } from '../ui/BrandLogo';
import { HomePage, PlatformRoute } from './HomePage';
import { DashboardView } from './DashboardView';
import { TripPlannerView } from './TripPlannerView';
import { SmartPackingView } from './SmartPackingView';
import { AIOutfitStudioPlatform } from './AIOutfitStudioPlatform';
import { DigitalWardrobeView } from './DigitalWardrobeView';
import { EditorialCursor, prefersReducedMotion } from '../editorial/MotionPrimitives';

gsap.registerPlugin(ScrollTrigger);

/** Colours the page transition sweeps through, in the order they cover the screen. */
const CURTAIN_COLOURS = ['#B8D9F2', '#D9C9F2', '#FFC5A8'];
/** The route swaps while the curtain fully covers the screen. */
const CURTAIN_SWAP_MS = 640;

interface PlatformShellProps {
  user: UserAccount;
  lists: PackingList[];
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  savedOutfits: OutfitCombination[];
  documents: DocumentRecord[];
  personalEssentials: PersonalEssential[];
  memoryInsights: MemoryLearningInsights;
  defaultAllowanceKg: number;
  isOnline: boolean;
  aiConfigured: boolean;
  onEnterClassicWorkspace: (tab?: TabId) => void;
  onOpenClassicTrip: (
    tripId: string,
    subTab?: 'checklist' | 'suitcase' | 'before_leave' | 'group'
  ) => void;
  onCreateList: (created: PackingList) => void;
  onUpdateList: (updated: PackingList) => void;
  onAddWardrobeItem: (item: WardrobeItem) => void;
  onSaveWardrobePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  onDeleteWardrobeItem: (itemId: string) => void;
  onSaveOutfit: (outfit: OutfitCombination) => void;
  onToggleFavoriteOutfit: (outfitId: string) => void;
  onUpdateTripDayOutfits: (tripId: string, dayOutfits: DayOutfitPlan[]) => void;
  onSyncWardrobeToTrip: (tripId: string, items: PackingItem[]) => number;
  onAddMissingPieceToShopping: (
    tripId: string,
    suggestion: AIMissingPieceSuggestion
  ) => boolean;
  onSaveWeather: (listId: string, weather: WeatherReport) => void;
}

const NAV_ITEMS: Array<{ route: PlatformRoute; label: string }> = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'trip-planner', label: 'Trip Planner' },
  { route: 'smart-packing', label: 'Smart Packing' },
  { route: 'ai-outfit-studio', label: 'AI Outfit Studio' },
  { route: 'digital-wardrobe', label: 'Wardrobe' },
];

export const PlatformShell: React.FC<PlatformShellProps> = ({
  user,
  lists,
  wardrobe,
  wardrobePhotos,
  savedOutfits,
  documents,
  personalEssentials,
  memoryInsights,
  defaultAllowanceKg,
  isOnline,
  aiConfigured,
  onEnterClassicWorkspace,
  onOpenClassicTrip,
  onCreateList,
  onUpdateList,
  onAddWardrobeItem,
  onSaveWardrobePhoto,
  onDeleteWardrobeItem,
  onSaveOutfit,
  onToggleFavoriteOutfit,
  onUpdateTripDayOutfits,
  onSyncWardrobeToTrip,
  onAddMissingPieceToShopping,
  onSaveWeather,
}) => {
  const [route, setRoute] = useState<PlatformRoute>('home');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(
    lists.find((l) => !l.completed)?.id || lists[0]?.id || null
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [curtain, setCurtain] = useState(0);
  const navTimer = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress } = useScroll();
  const progressX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  const navigateTo = (next: PlatformRoute) => {
    setMobileMenuOpen(false);
    if (next === route) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    if (navTimer.current !== null) window.clearTimeout(navTimer.current);
    if (prefersReducedMotion()) {
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    // Cinematic wipe: three colour panels sweep up, the route swaps underneath, they sweep away.
    setCurtain((c) => c + 1);
    navTimer.current = window.setTimeout(() => {
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'auto' });
      navTimer.current = null;
    }, CURTAIN_SWAP_MS);
  };

  useEffect(() => {
    return () => {
      if (navTimer.current !== null) window.clearTimeout(navTimer.current);
    };
  }, []);

  // Workspace views: their top-level blocks rise into place as they enter the viewport.
  useEffect(() => {
    const el = mainRef.current;
    if (!el || route === 'home' || prefersReducedMotion()) return;
    const blocks = Array.from(el.querySelectorAll<HTMLElement>(':scope > div > div > *'));
    if (blocks.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.set(blocks, { autoAlpha: 0, y: 36 });
      ScrollTrigger.batch(blocks, {
        start: 'top 92%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.85,
            ease: 'power3.out',
            stagger: 0.09,
            overwrite: true,
            clearProps: 'transform,opacity,visibility',
          }),
      });
    }, el);
    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => {
      window.clearTimeout(refresh);
      ctx.revert();
    };
  }, [route]);

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#171717] flex flex-col font-sans">
      <EditorialCursor />
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progressX }}
        className="fixed top-0 left-0 right-0 h-[3px] origin-left bg-[#101010] z-[60]"
      />
      {curtain > 0 && (
        <div key={curtain} aria-hidden="true" className="fixed inset-0 z-[90] pointer-events-none">
          {CURTAIN_COLOURS.map((colour, i) => (
            <motion.div
              key={colour}
              className="absolute inset-0"
              style={{ backgroundColor: colour }}
              initial={{ y: '100%' }}
              animate={{ y: ['100%', '0%', '0%', '-100%'] }}
              transition={{ duration: 1.05, times: [0, 0.45, 0.55, 1], ease: 'easeInOut', delay: i * 0.07 }}
            />
          ))}
        </div>
      )}
      {/* ==================== STICKY 3-ZONE TOP NAVIGATION ==================== */}
      <header className="sticky top-0 z-40 h-16 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#171717]/10">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity"
          >
            <BrandLogo size={28} />
            <span className="font-serif text-xl font-semibold tracking-tight text-[#171717]">
              PackSmart
            </span>
          </button>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-6"
          >
            {NAV_ITEMS.map((item) => {
              const active = route === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => navigateTo(item.route)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative text-sm whitespace-nowrap transition-colors duration-150 py-1 ${
                    active
                      ? 'text-[#171717] font-medium'
                      : 'text-[#171717]/65 hover:text-[#171717]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full bg-[#101010]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Right Utility CTA + Mobile Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!isOnline && (
              <span className="h-8 px-2.5 rounded-md bg-[#FFC5A8] text-[#171717] text-xs font-medium inline-flex items-center gap-1 whitespace-nowrap">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => onEnterClassicWorkspace('essentials')}
              className="hidden sm:inline-flex h-9 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 text-xs font-medium text-[#171717] items-center gap-1.5 hover:border-[#171717] transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Vault &amp; Tools</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden w-10 h-10 rounded-lg bg-[#FFFFFF] border border-[#171717]/15 flex items-center justify-center text-[#171717]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Clean Responsive Mobile / Tablet Navigation Panel */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#FFFFFF] border-b border-[#171717]/12 px-4 sm:px-6 py-4 space-y-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                route === 'home'
                  ? 'bg-[#171717] text-[#FFFFFF]'
                  : 'text-[#171717] hover:bg-[#FFFFFF]'
              }`}
            >
              Overview
            </button>
            {NAV_ITEMS.map((item) => {
              const active = route === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => navigateTo(item.route)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-[#171717] text-[#FFFFFF]'
                      : 'text-[#171717] hover:bg-[#FFFFFF]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <div className="pt-2 mt-2 border-t border-[#171717]/10">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onEnterClassicWorkspace('essentials');
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm font-medium bg-[#FFFFFF] text-[#171717] inline-flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Document Vault &amp; Classic Tools</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ==================== ACTIVE PLATFORM VIEW ==================== */}
      <main ref={mainRef} className="flex-1">
        {route === 'home' && (
          <HomePage
            lists={lists}
            wardrobe={wardrobe}
            savedOutfits={savedOutfits}
            onNavigate={navigateTo}
            onOpenVault={() => onEnterClassicWorkspace('essentials')}
          />
        )}

        {route === 'dashboard' && (
          <DashboardView
            user={user}
            lists={lists}
            selectedTripId={selectedTripId}
            wardrobe={wardrobe}
            wardrobePhotos={wardrobePhotos}
            savedOutfits={savedOutfits}
            documents={documents}
            isOnline={isOnline}
            onSelectTrip={setSelectedTripId}
            onUpdateList={onUpdateList}
            onSaveWeather={onSaveWeather}
            onNavigate={navigateTo}
            onOpenClassicTool={onEnterClassicWorkspace}
            onOpenClassicTripSubTab={onOpenClassicTrip}
          />
        )}

        {route === 'trip-planner' && (
          <TripPlannerView
            user={user}
            lists={lists}
            selectedTripId={selectedTripId}
            personalEssentials={personalEssentials}
            memoryInsights={memoryInsights}
            defaultAllowanceKg={defaultAllowanceKg}
            isOnline={isOnline}
            onSelectTrip={setSelectedTripId}
            onCreateList={onCreateList}
            onUpdateList={onUpdateList}
            onSaveWeather={onSaveWeather}
            onNavigate={navigateTo}
          />
        )}

        {route === 'smart-packing' && (
          <SmartPackingView
            lists={lists}
            selectedTripId={selectedTripId}
            memoryInsights={memoryInsights}
            isOnline={isOnline}
            aiConfigured={aiConfigured}
            onSelectTrip={setSelectedTripId}
            onUpdateList={onUpdateList}
            onOpenClassicTripSubTab={onOpenClassicTrip}
          />
        )}

        {route === 'ai-outfit-studio' && (
          <AIOutfitStudioPlatform
            lists={lists}
            selectedTripId={selectedTripId}
            wardrobe={wardrobe}
            wardrobePhotos={wardrobePhotos}
            savedOutfits={savedOutfits}
            isOnline={isOnline}
            aiConfigured={aiConfigured}
            onSelectTrip={setSelectedTripId}
            onAddWardrobeItem={onAddWardrobeItem}
            onSaveWardrobePhoto={onSaveWardrobePhoto}
            onSaveOutfit={onSaveOutfit}
            onToggleFavoriteOutfit={onToggleFavoriteOutfit}
            onUpdateTripDayOutfits={onUpdateTripDayOutfits}
            onSyncWardrobeToTrip={onSyncWardrobeToTrip}
            onAddMissingPieceToShopping={onAddMissingPieceToShopping}
          />
        )}

        {route === 'digital-wardrobe' && (
          <DigitalWardrobeView
            wardrobe={wardrobe}
            wardrobePhotos={wardrobePhotos}
            isOnline={isOnline}
            onAddWardrobeItem={onAddWardrobeItem}
            onSaveWardrobePhoto={onSaveWardrobePhoto}
            onDeleteWardrobeItem={onDeleteWardrobeItem}
            onNavigate={navigateTo}
          />
        )}
      </main>
    </div>
  );
};
