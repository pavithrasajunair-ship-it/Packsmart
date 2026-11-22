import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CloudRain,
  CloudSun,
  Loader2,
  Luggage,
  Plus,
  Search,
  Sun,
} from 'lucide-react';
import type {
  AIMissingPieceSuggestion,
  DayOutfitPlan,
  OutfitCombination,
  PackingItem,
  PackingList,
  TabId,
  WardrobeItem,
  WeatherReport,
} from '../../types';
import { analyzeSuitcaseSpace, estimateItemVolumeLiters } from '../../utils/packingEngine';
import { uid } from '../../utils/storage';
import { AIOutfitMatcher } from '../AIOutfitMatcher';
import {
  EditorialCursor,
  LineRevealText,
  MagneticButton,
  TiltCard,
  prefersReducedMotion,
} from './MotionPrimitives';
import {
  SUITCASE_FINISHES,
  Suitcase3DCanvas,
  SuitcaseFinish,
} from './Suitcase3DCanvas';
import { PackingStorySection } from './PackingStorySection';
import {
  EditorialBlueprint,
  HorizontalGallerySection,
} from './HorizontalGallerySection';
import type { TripJumpTab } from '../../screens/HomeScreen';
import fashionCapsuleImg from '../../assets/images/editorial_fashion_capsule_1795242653258.jpg';
import packingFlatlayImg from '../../assets/images/editorial_packing_flatlay_1795242653043.jpg';

gsap.registerPlugin(ScrollTrigger);

interface EditorialExperienceProps {
  lists: PackingList[];
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  savedOutfits: OutfitCombination[];
  isOnline: boolean;
  aiConfigured: boolean;
  onEnterWorkspace: (tab?: TabId) => void;
  onOpenTrip: (tripId: string, subTab?: TripJumpTab) => void;
  onCreateTrip: () => void;
  onUpdateList: (updated: PackingList) => void;
  onAddWardrobeItem: (item: WardrobeItem) => void;
  onSaveWardrobePhoto: (photoId: string, dataUrl: string) => Promise<void>;
  onDeleteWardrobeItem: (itemId: string) => void;
  onSaveOutfit: (outfit: OutfitCombination) => void;
  onToggleFavoriteOutfit: (outfitId: string) => void;
  onUpdateTripDayOutfits: (tripId: string, dayOutfits: DayOutfitPlan[]) => void;
  onSyncWardrobeToTrip: (tripId: string, items: PackingItem[]) => number;
  onAddMissingPieceToShopping: (tripId: string, suggestion: AIMissingPieceSuggestion) => boolean;
  onSaveWeather: (tripId: string, weather: WeatherReport) => void;
  onLoadEditorialBlueprint: (blueprint: EditorialBlueprint) => void;
}

const WEATHER_CITIES = ['Kyoto', 'Paris', 'Amalfi', 'Kochi', 'Reykjavik'];

export const EditorialExperience: React.FC<EditorialExperienceProps> = ({
  lists,
  wardrobe,
  wardrobePhotos,
  savedOutfits,
  isOnline,
  aiConfigured,
  onEnterWorkspace,
  onOpenTrip,
  onCreateTrip,
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
  onLoadEditorialBlueprint,
}) => {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const heroSuitcaseScrollRef = useRef<number>(0);
  const wardrobeParallaxRef = useRef<HTMLDivElement | null>(null);
  const wardrobeSidewaysRef = useRef<HTMLDivElement | null>(null);
  const packingSidewaysRef = useRef<HTMLDivElement | null>(null);

  const [suitcaseFinish, setSuitcaseFinish] = useState<SuitcaseFinish>('noir');
  const [scrollPct, setScrollPct] = useState(0);
  const [navDarkSurface, setNavDarkSurface] = useState(false);

  // Interactive Smart Packing Demo (wired directly to user's real active PackSmart trip)
  const activeTrip = useMemo(
    () => lists.find((l) => !l.completed) || lists[0] || null,
    [lists]
  );
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemCat, setQuickItemCat] = useState<'Clothing' | 'Electronics' | 'Documents'>('Clothing');

  const activeTripMetrics = useMemo(
    () => (activeTrip ? analyzeSuitcaseSpace(activeTrip) : null),
    [activeTrip]
  );

  // Live Weather Destination Explorer (Act 6)
  const [weatherCity, setWeatherCity] = useState('Kyoto');
  const [weatherReport, setWeatherReport] = useState<WeatherReport | null>(null);
  const [weatherBusy, setWeatherBusy] = useState(false);
  const [weatherErr, setWeatherErr] = useState('');

  // Global scroll progress + Hero 3D scroll choreography + parallax layers
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      setScrollPct(p);

      // Drive 3D hero suitcase rotation across first ~125vh of scroll
      const heroSpan = Math.max(1, window.innerHeight * 1.25);
      heroSuitcaseScrollRef.current = Math.min(1, Math.max(0, window.scrollY / heroSpan));

      // Subtle top bar elevation once user scrolls past 40px
      setNavDarkSurface(window.scrollY > 40);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (prefersReducedMotion()) {
      return () => window.removeEventListener('scroll', onScroll);
    }

    const ctx = gsap.context(() => {
      // Parallax on Act 3 fashion editorial portrait + sideways title
      if (wardrobeParallaxRef.current) {
        gsap.fromTo(
          wardrobeParallaxRef.current,
          { yPercent: 8, clipPath: 'inset(10% 0% 10% 0%)' },
          {
            yPercent: -8,
            clipPath: 'inset(0% 0% 0% 0%)',
            ease: 'none',
            scrollTrigger: {
              trigger: wardrobeParallaxRef.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      }

      if (wardrobeSidewaysRef.current) {
        gsap.fromTo(
          wardrobeSidewaysRef.current,
          { yPercent: 18 },
          {
            yPercent: -18,
            ease: 'none',
            scrollTrigger: {
              trigger: '#ai-outfit-matcher',
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      }

      if (packingSidewaysRef.current) {
        gsap.fromTo(
          packingSidewaysRef.current,
          { yPercent: -12 },
          {
            yPercent: 14,
            ease: 'none',
            scrollTrigger: {
              trigger: '#smart-packing',
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      }
    }, pageRef);

    return () => {
      window.removeEventListener('scroll', onScroll);
      ctx.revert();
    };
  }, []);

  const fetchDestinationWeather = async (cityOverride?: string) => {
    const query = (cityOverride ?? weatherCity).trim();
    if (!query) return;
    if (!isOnline) {
      setWeatherErr('Connect to the internet to fetch live Open-Meteo forecasts.');
      return;
    }
    setWeatherBusy(true);
    setWeatherErr('');
    try {
      const start = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
      const params = new URLSearchParams({ city: query, startDate: start, endDate: end });
      const res = await fetch(`/api/weather?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setWeatherErr(data.error || 'Could not load forecast for this city.');
      } else {
        setWeatherReport(data as WeatherReport);
      }
    } catch {
      setWeatherErr('Weather service could not be reached right now.');
    } finally {
      setWeatherBusy(false);
    }
  };

  // Load initial Kyoto weather preview on mount if online
  useEffect(() => {
    if (isOnline && !weatherReport && !weatherBusy) {
      void fetchDestinationWeather('Kyoto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleToggleChecklistItem = (itemId: string) => {
    if (!activeTrip) return;
    onUpdateList({
      ...activeTrip,
      items: activeTrip.items.map((it) =>
        it.id === itemId ? { ...it, packed: !it.packed } : it
      ),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleQuickAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip || !quickItemName.trim()) return;
    const weight = quickItemCat === 'Clothing' ? 240 : quickItemCat === 'Electronics' ? 280 : 60;
    const newItem: PackingItem = {
      id: uid('item'),
      name: quickItemName.trim(),
      category: quickItemCat,
      quantity: 1,
      packed: false,
      weightGrams: weight,
      volumeLiters: estimateItemVolumeLiters(quickItemCat, weight),
      priority: 'Essential',
      essential: true,
      order: activeTrip.items.length,
    };
    onUpdateList({
      ...activeTrip,
      items: [newItem, ...activeTrip.items],
      updatedAt: new Date().toISOString(),
    });
    setQuickItemName('');
  };

  const scrollToSection = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  const handleBlueprintAction = (bp: EditorialBlueprint) => {
    if (bp.kind === 'wardrobe_jump') {
      scrollToSection('ai-outfit-matcher');
      return;
    }
    if (bp.kind === 'suitcase_jump') {
      if (activeTrip) {
        onOpenTrip(activeTrip.id, 'suitcase');
      } else {
        onEnterWorkspace('trips');
      }
      return;
    }
    if (bp.kind === 'vault_jump') {
      onEnterWorkspace('essentials');
      return;
    }
    onLoadEditorialBlueprint(bp);
  };

  return (
    <div ref={pageRef} className="min-h-screen bg-[#B8D9F2] text-[#101010] relative">
      <EditorialCursor />

      {/* ==================== 9. GLOBAL SCROLL PROGRESS BAR ==================== */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[#101010]/10 pointer-events-none"
      >
        <div
          className="h-full bg-[#101010] origin-left transition-transform duration-75"
          style={{ transform: `scaleX(${scrollPct})` }}
        />
      </div>

      {/* ==================== STRICT 3-ZONE TOP BAR CONTRACT ==================== */}
      <header
        className={`fixed top-[3px] left-0 right-0 z-40 transition-colors duration-300 border-b ${
          navDarkSurface
            ? 'bg-[#FFFFFF]/95 border-[#101010]/12'
            : 'bg-[#B8D9F2]/92 border-[#101010]/10'
        }`}
      >
        <div className="max-w-[1320px] mx-auto h-16 px-6 sm:px-10 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-lg font-extrabold tracking-tight text-[#101010] whitespace-nowrap shrink-0"
          >
            PackSmart
          </a>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav
            aria-label="Editorial story sections"
            className="hidden md:flex items-center gap-7 text-xs font-semibold tracking-tight text-[#101010]/80"
          >
            <button
              type="button"
              onClick={() => scrollToSection('packing-story')}
              className="hover:text-[#101010] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              Story
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('ai-outfit-matcher')}
              className="hover:text-[#101010] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              AI Matcher
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('curated-stories')}
              className="hover:text-[#101010] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              Lookbook
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('smart-packing')}
              className="hover:text-[#101010] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              Smart Packing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('weather-planning')}
              className="hover:text-[#101010] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              Weather
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <MagneticButton
              type="button"
              onClick={() => onEnterWorkspace('home')}
              cursorLabel="APP"
              className="min-h-[42px] px-5 bg-[#101010] text-[#FFFFFF] text-xs font-bold tracking-tight hover:bg-[#101010]/85 transition-colors whitespace-nowrap shrink-0"
            >
              Open Workspace
            </MagneticButton>
          </div>
        </div>
      </header>

      {/* ==================== ACT 1: CINEMATIC HERO WITH 3D SUITCASE (#B8D9F2) ==================== */}
      <section
        id="hero"
        ref={heroRef}
        className="relative bg-[#B8D9F2] text-[#101010] pt-24 pb-16 lg:pt-28 lg:pb-20 min-h-screen flex items-center overflow-hidden"
      >
        {/* Subtle Architectural Hairline Grid Accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[#101010]/8 hidden lg:block"
        />

        <div className="w-full max-w-[1320px] mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Hero Typography & Actions */}
          <div className="lg:col-span-6 space-y-8 relative z-10">
            <p className="font-mono text-xs tracking-[0.16em] text-[#101010]/70">
              01 / INTELLIGENT FASHION-TECH PACKING
            </p>

            <LineRevealText
              as="h1"
              trigger="mount"
              delay={0.08}
              stagger={0.12}
              lines={[
                'Pack less stress.',
                <span key="l2" className="font-editorial italic font-medium">
                  Travel with confidence.
                </span>,
              ]}
              className="font-display text-5xl sm:text-6xl lg:text-[4.65rem] font-extrabold leading-[0.98] tracking-[-0.03em] text-[#101010]"
            />

            <p className="text-base sm:text-lg text-[#101010]/75 max-w-lg leading-relaxed">
              Photograph your real wardrobe, let AI Vision match weather-ready outfits with zero repeats, and organize every liter into a calm carry-on.
            </p>

            {/* Primary & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <MagneticButton
                type="button"
                onClick={() => scrollToSection('ai-outfit-matcher')}
                cursorLabel="STYLE"
                className="min-h-[52px] px-7 bg-[#101010] text-[#FFFFFF] text-sm font-bold inline-flex items-center gap-2.5 hover:bg-[#101010]/85 transition-colors whitespace-nowrap"
              >
                <span>Try AI Outfit Matcher</span>
                <ArrowRight className="w-4 h-4 text-[#FFC5A8]" />
              </MagneticButton>

              <button
                type="button"
                onClick={onCreateTrip}
                className="min-h-[52px] px-6 border border-[#101010] text-[#101010] text-sm font-bold inline-flex items-center gap-2 hover:bg-[#FFFFFF] transition-colors whitespace-nowrap"
              >
                <span>Create New Trip</span>
              </button>
            </div>

            {/* Quiet Proof Metrics Strip */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[#101010]/15 max-w-md tabular-nums">
              <div>
                <p className="font-mono text-xl sm:text-2xl font-bold text-[#101010]">
                  {wardrobe.length}
                </p>
                <p className="text-xs text-[#101010]/65 mt-0.5">Closet pieces</p>
              </div>
              <div>
                <p className="font-mono text-xl sm:text-2xl font-bold text-[#101010]">
                  {lists.length}
                </p>
                <p className="text-xs text-[#101010]/65 mt-0.5">Active trips</p>
              </div>
              <div>
                <p className="font-mono text-xl sm:text-2xl font-bold text-[#101010]">40L</p>
                <p className="text-xs text-[#101010]/65 mt-0.5">Carry-on target</p>
              </div>
            </div>
          </div>

          {/* Right Anchored 3D Suitcase Centerpiece + Interactive Finish Selector */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="relative w-full h-[420px] sm:h-[520px] lg:h-[600px]">
              <Suitcase3DCanvas
                finish={suitcaseFinish}
                scrollProgressRef={heroSuitcaseScrollRef}
                className="w-full h-full"
              />
            </div>

            {/* Compact Palette Finish Switcher (Below 3D Canvas — Zero Occlusion) */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 px-4 py-2.5 bg-[#FFFFFF] border border-[#101010]/15">
              <span className="font-mono text-[11px] text-[#101010]/60 mr-1">
                Shell Finish
              </span>
              {(Object.keys(SUITCASE_FINISHES) as SuitcaseFinish[]).map((key) => {
                const spec = SUITCASE_FINISHES[key];
                const active = suitcaseFinish === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSuitcaseFinish(key)}
                    className={`min-h-[36px] px-2.5 flex items-center gap-2 text-xs font-semibold transition-colors border ${
                      active
                        ? 'border-[#101010] bg-[#101010] text-[#FFFFFF]'
                        : 'border-transparent text-[#101010]/80 hover:border-[#101010]/30'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 border border-[#101010]/30 shrink-0"
                      style={{ backgroundColor: spec.shellHex }}
                    />
                    <span className="whitespace-nowrap">{spec.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Subtle Bottom Scroll Cue */}
        <button
          type="button"
          onClick={() => scrollToSection('packing-story')}
          className="hidden lg:inline-flex items-center gap-2 absolute bottom-6 left-10 font-mono text-[11px] tracking-[0.14em] text-[#101010]/65 hover:text-[#101010] transition-colors"
        >
          <span>SCROLL TO PACK</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* ==================== ACT 2: PINNED SCROLL TRANSFORMATION (#101010) ==================== */}
      <PackingStorySection
        onOpenSuitcaseOptimizer={() =>
          activeTrip ? onOpenTrip(activeTrip.id, 'suitcase') : onEnterWorkspace('trips')
        }
      />

      {/* ==================== ACT 3: LIVE AI OUTFIT MATCHER STUDIO (#D9C9F2) ==================== */}
      <section
        id="ai-outfit-matcher"
        className="relative bg-[#D9C9F2] text-[#101010] py-20 sm:py-28 overflow-hidden border-t border-[#101010]/10"
      >
        {/* Oversized Sideways Editorial Typography */}
        <div
          ref={wardrobeSidewaysRef}
          aria-hidden="true"
          className="hidden xl:flex pointer-events-none select-none absolute right-5 top-40 vertical-editorial font-editorial italic text-[6rem] leading-none text-[#101010]/12"
        >
          Wardrobe Intelligence
        </div>

        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 space-y-14 relative z-10">
          {/* Editorial Asymmetric Prologue */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <p className="font-mono text-xs tracking-[0.16em] text-[#101010]/70">
                03 / AI OUTFIT MATCHER · LIVE VISION STUDIO
              </p>
              <LineRevealText
                as="h2"
                lines={[
                  'Styled strictly from',
                  <span key="i2" className="font-editorial italic font-medium">
                    the clothes you own.
                  </span>,
                ]}
                className="font-display text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold leading-[1.02] tracking-tight text-[#101010]"
              />
              <p className="text-base text-[#101010]/75 max-w-xl leading-relaxed">
                Upload real photos of your shirts, trousers, dresses, jackets, and shoes below. Gemini Vision identifies colors, patterns, fabrics, and warmth—then curates non-repeating trip looks and flags single missing staples that multiply your options.
              </p>

              <div className="grid grid-cols-3 gap-5 pt-4 border-t border-[#101010]/15 max-w-lg text-xs">
                <div>
                  <p className="font-bold text-[#101010]">Real Vision AI</p>
                  <p className="text-[#101010]/70 mt-0.5">Color, pattern &amp; fabric scan</p>
                </div>
                <div>
                  <p className="font-bold text-[#101010]">Zero Repeats</p>
                  <p className="text-[#101010]/70 mt-0.5">Maximum looks, minimum clothes</p>
                </div>
                <div>
                  <p className="font-bold text-[#101010]">1-Tap Suitcase Sync</p>
                  <p className="text-[#101010]/70 mt-0.5">Sends capsule straight to trip</p>
                </div>
              </div>
            </div>

            {/* Parallax Clipped Fashion Editorial Still Life */}
            <div className="lg:col-span-5">
              <div
                ref={wardrobeParallaxRef}
                className="relative aspect-[3/4] max-h-[480px] w-full overflow-hidden border border-[#101010]/15 bg-[#FFFFFF]"
              >
                <img decoding="async"
                  src={fashionCapsuleImg}
                  alt="Minimalist travel capsule wardrobe styled on a powder blue plinth"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 px-4 py-3 bg-[#101010]/85 text-[#FFFFFF] flex items-center justify-between text-xs font-mono">
                  <span>CAPSULE RATIO 4 : 9</span>
                  <span className="text-[#FFC5A8]">OWNED ONLY</span>
                </div>
              </div>
            </div>
          </div>

          {/* LIVE WORKING AI OUTFIT MATCHER */}
          <AIOutfitMatcher
            wardrobe={wardrobe}
            wardrobePhotos={wardrobePhotos}
            savedOutfits={savedOutfits}
            trips={lists}
            isOnline={isOnline}
            aiConfigured={aiConfigured}
            onAddWardrobeItem={onAddWardrobeItem}
            onSaveWardrobePhoto={onSaveWardrobePhoto}
            onDeleteWardrobeItem={onDeleteWardrobeItem}
            onSaveOutfit={onSaveOutfit}
            onToggleFavoriteOutfit={onToggleFavoriteOutfit}
            onUpdateTripDayOutfits={onUpdateTripDayOutfits}
            onSyncWardrobeToTrip={onSyncWardrobeToTrip}
            onAddMissingPieceToShopping={onAddMissingPieceToShopping}
            onSaveWeather={onSaveWeather}
          />
        </div>
      </section>

      {/* ==================== ACT 4: HORIZONTAL SCROLL STORYTELLING (#FFC5A8) ==================== */}
      <HorizontalGallerySection onSelectBlueprint={handleBlueprintAction} />

      {/* ==================== ACT 5: INTERACTIVE SMART PACKING STUDIO (#B8D9F2) ==================== */}
      <section
        id="smart-packing"
        className="relative bg-[#B8D9F2] text-[#101010] py-20 sm:py-28 overflow-hidden border-t border-[#101010]/10"
      >
        <div
          ref={packingSidewaysRef}
          aria-hidden="true"
          className="hidden xl:flex pointer-events-none select-none absolute right-5 top-1/2 -translate-y-1/2 vertical-editorial font-editorial italic text-[5.75rem] leading-none text-[#101010]/12"
        >
          Smart Packing
        </div>

        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 space-y-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7 space-y-4">
              <p className="font-mono text-xs tracking-[0.16em] text-[#101010]/70">
                05 / INTERACTIVE SMART PACKING
              </p>
              <LineRevealText
                as="h2"
                lines={['Every gram accounted.', 'Every essential calm.']}
                className="font-editorial text-4xl sm:text-5xl lg:text-[3.75rem] leading-[1.0] font-normal text-[#101010]"
              />
            </div>
            <div className="lg:col-span-5 flex lg:justify-end">
              <MagneticButton
                type="button"
                onClick={() =>
                  activeTrip ? onOpenTrip(activeTrip.id, 'checklist') : onCreateTrip()
                }
                cursorLabel="OPEN"
                className="min-h-[48px] px-6 bg-[#101010] text-[#FFFFFF] text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>
                  {activeTrip ? `Open ${activeTrip.title}` : 'Create Your First Trip'}
                </span>
                <ArrowUpRight className="w-4 h-4 text-[#FFC5A8]" />
              </MagneticButton>
            </div>
          </div>

          {activeTrip && activeTripMetrics ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left: Live Interactive Packing Checklist */}
              <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#101010]/15 p-6 sm:p-7 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#101010]/10 pb-4">
                    <div>
                      <p className="font-mono text-[11px] text-[#101010]/60">
                        LIVE ACTIVE TRIP · {activeTrip.destination || activeTrip.tripType}
                      </p>
                      <h3 className="font-display text-xl font-extrabold text-[#101010] mt-0.5">
                        {activeTrip.title}
                      </h3>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#101010] tabular-nums">
                      {activeTrip.items.filter((i) => i.packed).length} / {activeTrip.items.length} packed
                    </span>
                  </div>

                  {/* Quick Add Item Directly into Real Trip State */}
                  <form onSubmit={handleQuickAddItem} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={quickItemName}
                      onChange={(e) => setQuickItemName(e.target.value)}
                      placeholder="Add an item directly to this trip..."
                      className="sm:col-span-6 min-h-[44px] px-3.5 bg-[#FFFFFF] border border-[#101010]/25 text-sm text-[#101010]"
                    />
                    <select
                      aria-label="Item category"
                      value={quickItemCat}
                      onChange={(e) =>
                        setQuickItemCat(e.target.value as 'Clothing' | 'Electronics' | 'Documents')
                      }
                      className="sm:col-span-3 min-h-[44px] px-3 bg-[#FFFFFF] border border-[#101010]/25 text-xs font-semibold text-[#101010]"
                    >
                      <option value="Clothing">Clothing</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Documents">Documents</option>
                    </select>
                    <button
                      type="submit"
                      className="sm:col-span-3 min-h-[44px] px-4 bg-[#101010] text-[#FFFFFF] text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#101010]/85"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#FFC5A8]" />
                      <span>Add Item</span>
                    </button>
                  </form>

                  {/* Animated Interactive Checklist Rows */}
                  <div className="divide-y divide-[#101010]/10 max-h-[340px] overflow-y-auto pr-1">
                    {activeTrip.items.slice(0, 8).map((item) => (
                      <motion.button
                        key={item.id}
                        type="button"
                        layout
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleToggleChecklistItem(item.id)}
                        className="w-full py-3 flex items-center justify-between gap-3 text-left min-h-[48px] group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-5 h-5 border flex items-center justify-center shrink-0 transition-colors ${
                              item.packed
                                ? 'bg-[#101010] border-[#101010] text-[#FFC5A8]'
                                : 'border-[#101010]/40 bg-[#FFFFFF] group-hover:border-[#101010]'
                            }`}
                          >
                            {item.packed && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={`text-sm font-semibold truncate transition-opacity ${
                                item.packed
                                  ? 'line-through text-[#101010]/45'
                                  : 'text-[#101010]'
                              }`}
                            >
                              {item.name}
                            </p>
                            <p className="font-mono text-[11px] text-[#101010]/55">
                              {item.category} · ×{item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-[#101010]/65 shrink-0 tabular-nums">
                          {item.weightGrams * item.quantity}g · {item.volumeLiters}L
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#101010]/10 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenTrip(activeTrip.id, 'before_leave')}
                    className="text-xs font-bold text-[#101010] underline underline-offset-4 hover:opacity-75 min-h-[38px]"
                  >
                    Before You Leave Mode ({activeTrip.beforeLeaveTasks.filter((t) => t.completed).length}/
                    {activeTrip.beforeLeaveTasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenTrip(activeTrip.id, 'timeline')}
                    className="text-xs font-bold text-[#101010] underline underline-offset-4 hover:opacity-75 min-h-[38px]"
                  >
                    View Smart Timeline →
                  </button>
                </div>
              </div>

              {/* Right: Visual Suitcase Capacity & Editorial Flat-Lay */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                <TiltCard maxTilt={3} className="bg-[#101010] text-[#FFFFFF] p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Luggage className="w-4 h-4 text-[#FFC5A8]" />
                      <span className="font-mono text-xs text-[#B8D9F2]">
                        {activeTrip.luggageType}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#FFC5A8] tabular-nums">
                      {activeTripMetrics.volumePercent}% FULL
                    </span>
                  </div>

                  {/* Animated Spatial Capacity Bar */}
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={false}
                        animate={{ width: `${Math.min(100, activeTripMetrics.volumePercent)}%` }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full ${
                          activeTripMetrics.isVolumeOverloaded ? 'bg-[#FFC5A8]' : 'bg-[#B8D9F2]'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between font-mono text-xs text-white/75 tabular-nums">
                      <span>{activeTripMetrics.totalVolumeLiters}L used</span>
                      <span>{activeTripMetrics.capacityLiters}L capacity</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/15 tabular-nums">
                    <div>
                      <p className="font-mono text-[11px] text-white/55">Total Weight</p>
                      <p className="font-mono text-xl font-bold text-[#FFFFFF] mt-0.5">
                        {activeTripMetrics.totalWeightKg} kg
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] text-white/55">Allowance</p>
                      <p className="font-mono text-xl font-bold text-[#D9C9F2] mt-0.5">
                        {activeTrip.baggageAllowanceKg} kg
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenTrip(activeTrip.id, 'suitcase')}
                    className="w-full min-h-[44px] bg-[#FFC5A8] text-[#101010] text-xs font-bold hover:bg-[#FFFFFF] transition-colors"
                  >
                    Optimize Suitcase Space &amp; Folding Guide
                  </button>
                </TiltCard>

                <div className="flex-1 min-h-[200px] overflow-hidden border border-[#101010]/15 bg-[#D9C9F2]">
                  <img decoding="async"
                    src={packingFlatlayImg}
                    alt="Matte black carry-on neatly packed on lavender surface"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#FFFFFF] border border-[#101010]/15 p-10 text-center space-y-4">
              <p className="font-editorial text-2xl">Start your first packing list to track every liter.</p>
              <button
                type="button"
                onClick={onCreateTrip}
                className="min-h-[46px] px-6 bg-[#101010] text-[#FFFFFF] text-xs font-bold"
              >
                Create New Trip
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ==================== ACT 6: LIVE WEATHER INTELLIGENCE & FINAL CTA (#101010) ==================== */}
      <section
        id="weather-planning"
        className="bg-[#101010] text-[#FFFFFF] pt-20 sm:pt-28 pb-16 border-t border-white/10"
      >
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 space-y-24">
          {/* Interactive Live Weather Packing Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-5">
              <p className="font-mono text-xs tracking-[0.16em] text-[#B8D9F2]">
                06 / LIVE METEOROLOGICAL PACKING
              </p>
              <LineRevealText
                as="h2"
                lines={['Real weather.', 'Zero guesswork.']}
                className="font-editorial text-4xl sm:text-5xl leading-[1.02] font-normal text-[#FFFFFF]"
              />
              <p className="text-sm text-white/70 leading-relaxed max-w-md">
                Enter any destination worldwide. PackSmart queries live Open-Meteo forecasts and converts temperature swings, humidity, and rain probability into concrete packing calls.
              </p>

              {/* Live City Query Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void fetchDestinationWeather();
                }}
                className="flex gap-2 pt-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-white/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={weatherCity}
                    onChange={(e) => setWeatherCity(e.target.value)}
                    placeholder="Type any city (e.g., Tokyo, London)..."
                    className="w-full min-h-[46px] pl-10 pr-3 bg-white/[0.06] border border-white/20 text-sm text-[#FFFFFF] placeholder:text-white/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={weatherBusy || !isOnline}
                  className="min-h-[46px] px-5 bg-[#B8D9F2] text-[#101010] text-xs font-bold shrink-0 hover:bg-[#FFFFFF] transition-colors disabled:opacity-50"
                >
                  {weatherBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Forecast'}
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                {WEATHER_CITIES.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      setWeatherCity(city);
                      void fetchDestinationWeather(city);
                    }}
                    className={`min-h-[34px] px-3 font-mono text-xs border transition-colors ${
                      weatherCity.toLowerCase() === city.toLowerCase()
                        ? 'bg-[#D9C9F2] border-[#D9C9F2] text-[#101010] font-bold'
                        : 'border-white/20 text-white/75 hover:border-white/50'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Forecast Result Panel */}
            <div className="lg:col-span-7 bg-white/[0.04] border border-white/15 p-6 sm:p-8 space-y-6">
              {weatherBusy && !weatherReport ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#B8D9F2] mx-auto" />
                  <p className="font-mono text-xs text-white/65">
                    Fetching live forecast for {weatherCity}...
                  </p>
                </div>
              ) : weatherErr ? (
                <div className="p-4 bg-[#FFC5A8] text-[#101010] text-xs font-semibold">
                  {weatherErr}
                </div>
              ) : weatherReport ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/15 pb-5">
                    <div>
                      <p className="font-mono text-[11px] text-[#FFC5A8]">
                        LIVE OPEN-METEO FORECAST
                      </p>
                      <h3 className="font-editorial text-3xl font-medium text-[#FFFFFF] mt-1">
                        {weatherReport.shortLocation}
                      </h3>
                      <p className="text-xs text-white/65 mt-1">{weatherReport.note}</p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="flex items-center justify-end gap-2 text-2xl font-bold text-[#B8D9F2]">
                        {weatherReport.summary.maxRainChance >= 45 ? (
                          <CloudRain className="w-6 h-6 text-[#D9C9F2]" />
                        ) : (
                          <Sun className="w-6 h-6 text-[#FFC5A8]" />
                        )}
                        <span>
                          {weatherReport.summary.avgLow}°–{weatherReport.summary.avgHigh}°C
                        </span>
                      </div>
                      <p className="text-xs text-white/65 mt-1">
                        {weatherReport.summary.primaryCondition} · {weatherReport.summary.maxRainChance}% rain ·{' '}
                        {weatherReport.summary.avgHumidity}% humidity
                      </p>
                    </div>
                  </div>

                  {/* Weather-Driven Recommendations */}
                  <div className="space-y-3">
                    <p className="font-mono text-[11px] text-white/55">
                      RECOMMENDED FOR THIS FORECAST
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {weatherReport.recommendations.slice(0, 4).map((rec) => (
                        <div
                          key={rec.name}
                          className="p-3.5 bg-white/[0.04] border border-white/12 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[#FFFFFF]">{rec.name}</p>
                            <span className="font-mono text-[10px] text-[#B8D9F2]">
                              {rec.weightGrams}g
                            </span>
                          </div>
                          <p className="text-[11px] text-white/65 leading-snug">{rec.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-white/50 flex items-center gap-1.5">
                      <CloudSun className="w-3.5 h-3.5 text-[#D9C9F2]" />
                      <span>Updated {new Date(weatherReport.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    <button
                      type="button"
                      onClick={onCreateTrip}
                      className="min-h-[42px] px-5 bg-[#FFC5A8] text-[#101010] text-xs font-bold hover:bg-[#FFFFFF] transition-colors"
                    >
                      Build Trip for {weatherReport.shortLocation.split(',')[0]}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* ==================== FINAL EDITORIAL CALL TO ACTION ==================== */}
          <div className="border-t border-white/15 pt-16 sm:pt-20 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-8 space-y-4">
                <p className="font-mono text-xs tracking-[0.16em] text-[#D9C9F2]">
                  READY FOR DEPARTURE
                </p>
                <LineRevealText
                  as="h2"
                  lines={[
                    'Your next journey,',
                    <span key="end2" className="font-editorial italic text-[#FFC5A8]">
                      edited to perfection.
                    </span>,
                  ]}
                  className="font-display text-4xl sm:text-6xl lg:text-[4.5rem] font-extrabold leading-[0.98] tracking-tight text-[#FFFFFF]"
                />
              </div>

              <div className="lg:col-span-4 flex flex-col items-start lg:items-end gap-4">
                <MagneticButton
                  type="button"
                  onClick={() => onEnterWorkspace('home')}
                  cursorLabel="LAUNCH"
                  className="min-h-[56px] px-8 bg-[#FFFFFF] text-[#101010] text-sm font-bold inline-flex items-center gap-3 hover:bg-[#B8D9F2] transition-colors whitespace-nowrap"
                >
                  <span>Open Full PackSmart Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </MagneticButton>
                <p className="text-xs text-white/55 lg:text-right">
                  Trips · AI Outfit Matcher · Suitcase Optimizer · Document Vault · Before You Leave
                </p>
              </div>
            </div>

            {/* Quiet Minimal Footer */}
            <footer className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-white/55">
              <span className="font-display font-bold text-[#FFFFFF]">
                PackSmart — Pack less stress. Travel with confidence.
              </span>
              <div className="flex flex-wrap items-center gap-6">
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('trips')}
                  className="hover:text-[#FFFFFF] transition-colors"
                >
                  My Trips
                </button>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('wardrobe')}
                  className="hover:text-[#FFFFFF] transition-colors"
                >
                  Wardrobe Studio
                </button>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('essentials')}
                  className="hover:text-[#FFFFFF] transition-colors"
                >
                  Document Vault
                </button>
                <button
                  type="button"
                  onClick={() => onEnterWorkspace('profile')}
                  className="hover:text-[#FFFFFF] transition-colors"
                >
                  Profile &amp; Backup
                </button>
              </div>
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
};
