import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
} from 'lucide-react';
import type {
  AIMissingPieceSuggestion,
  DayOutfitPlan,
  OutfitCombination,
  PackingItem,
  PackingList,
  PersonalEssential,
  TabId,
  UserAccount,
  WardrobeItem,
  WeatherReport,
} from '../../types';
import {
  analyzeSuitcaseSpace,
  daysUntilDate,
  MemoryLearningInsights,
} from '../../utils/packingEngine';
import {
  EditorialCursor,
  LineRevealText,
  MagneticButton,
  prefersReducedMotion,
} from '../editorial/MotionPrimitives';
import {
  SPATIAL_FINISHES,
  SpatialDestinationId,
  SpatialSuitcaseFinish,
  SpatialWorld3D,
} from './SpatialWorld3D';
import { SmartPackingStudio } from './SmartPackingStudio';
import { AIOutfitStudioView } from './AIOutfitStudioView';
import { TripPlannerStudio } from './TripPlannerStudio';
import { DigitalWardrobeStudio } from './DigitalWardrobeStudio';

import packingAtelierImg from '../../assets/images/spatial_packing_atelier_1795246615711.jpg';
import fashionStudioImg from '../../assets/images/spatial_fashion_studio_1795246612585.jpg';
import tripHorizonImg from '../../assets/images/spatial_trip_horizon_1795246613797.jpg';
import wardrobeGalleryImg from '../../assets/images/spatial_wardrobe_gallery_1795246613207.jpg';

type SpatialStage = 'hero' | 'hub' | SpatialDestinationId;

interface SpatialExperienceProps {
  user: UserAccount;
  lists: PackingList[];
  wardrobe: WardrobeItem[];
  wardrobePhotos: Record<string, string>;
  savedOutfits: OutfitCombination[];
  personalEssentials: PersonalEssential[];
  memoryInsights: MemoryLearningInsights;
  defaultAllowanceKg: number;
  isOnline: boolean;
  aiConfigured: boolean;
  onEnterClassicWorkspace: (tab?: TabId) => void;
  onOpenClassicTrip: (tripId: string, subTab?: 'checklist' | 'suitcase' | 'before_leave') => void;
  onCreateList: (created: PackingList) => void;
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
}

interface DestinationMeta {
  id: SpatialDestinationId;
  index: string;
  label: string;
  headline: string;
  description: string;
  ambientBg: '#B8D9F2' | '#D9C9F2' | '#FFC5A8' | '#101010';
  darkAmbient: boolean;
  image: string;
  actionLabel: string;
  positionClass: string;
}

export const SpatialExperience: React.FC<SpatialExperienceProps> = ({
  user,
  lists,
  wardrobe,
  wardrobePhotos,
  savedOutfits,
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
  const [stage, setStage] = useState<SpatialStage>('hero');
  const [zoomingTo, setZoomingTo] = useState<SpatialDestinationId | null>(null);
  const [hoveredDest, setHoveredDest] = useState<SpatialDestinationId | null>(null);
  const [mobileHubIndex, setMobileHubIndex] = useState<number>(0);
  const [finish, setFinish] = useState<SpatialSuitcaseFinish>('noir');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(lists[0]?.id || null);

  const touchStartXRef = useRef<number | null>(null);
  const wheelLockRef = useRef<number>(0);

  const activeTrip = useMemo(
    () => lists.find((l) => l.id === selectedTripId) || lists.find((l) => !l.completed) || lists[0] || null,
    [lists, selectedTripId]
  );

  const activeMetrics = useMemo(
    () => (activeTrip ? analyzeSuitcaseSpace(activeTrip) : null),
    [activeTrip]
  );

  const destinations: DestinationMeta[] = useMemo(() => {
    const packedCount = activeTrip ? activeTrip.items.filter((i) => i.packed).length : 0;
    const totalCount = activeTrip ? activeTrip.items.length : 0;
    const nextCountdown = activeTrip ? daysUntilDate(activeTrip.startDate) : null;

    return [
      {
        id: 'smart-packing',
        index: '01',
        label: 'SMART PACKING',
        headline: 'Interactive 3D Open Suitcase',
        description: activeTrip && activeMetrics
          ? `${packedCount}/${totalCount} packed · ${activeMetrics.totalVolumeLiters}L of ${activeMetrics.capacityLiters}L used`
          : 'Watch garments animate into your 40L cabin case as you pack.',
        ambientBg: '#B8D9F2',
        darkAmbient: false,
        image: packingAtelierImg,
        actionLabel: 'Open 3D Suitcase',
        positionClass: 'lg:top-24 lg:left-10',
      },
      {
        id: 'ai-outfit-studio',
        index: '02',
        label: 'AI OUTFIT STUDIO',
        headline: 'Owned-Wardrobe Vision Stylist',
        description: `${wardrobe.length} owned pieces ready · Zero-repeat looks with live click-to-swap`,
        ambientBg: '#D9C9F2',
        darkAmbient: false,
        image: fashionStudioImg,
        actionLabel: 'Enter Outfit Studio',
        positionClass: 'lg:top-24 lg:right-10',
      },
      {
        id: 'trip-planner',
        index: '03',
        label: 'TRIP PLANNER',
        headline: 'Spatial Itinerary & Weather',
        description: activeTrip
          ? `${activeTrip.destination || activeTrip.title} · ${nextCountdown !== null && nextCountdown >= 0 ? `In ${nextCountdown} days` : 'Ready to depart'}`
          : 'Live meteorological forecasts, timelines & before-you-leave calm.',
        ambientBg: '#FFC5A8',
        darkAmbient: false,
        image: tripHorizonImg,
        actionLabel: 'Open Trip Planner',
        positionClass: 'lg:bottom-10 lg:right-10',
      },
      {
        id: 'digital-wardrobe',
        index: '04',
        label: 'MY DIGITAL WARDROBE',
        headline: 'Floating Private Closet Archive',
        description: `${wardrobe.length} cataloged pieces · ${savedOutfits.length} saved looks`,
        ambientBg: '#101010',
        darkAmbient: true,
        image: wardrobeGalleryImg,
        actionLabel: 'Browse Wardrobe',
        positionClass: 'lg:bottom-10 lg:left-10',
      },
    ];
  }, [activeTrip, activeMetrics, wardrobe.length, savedOutfits.length]);

  // Smooth wheel / scroll gesture transition between Hero (Stage 0) and Spatial Hub (Stage 1)
  useEffect(() => {
    if (stage !== 'hero' && stage !== 'hub') return;

    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - wheelLockRef.current < 700) return;
      if (stage === 'hero' && e.deltaY > 36) {
        wheelLockRef.current = now;
        setStage('hub');
      } else if (stage === 'hub' && e.deltaY < -42 && window.scrollY <= 4) {
        wheelLockRef.current = now;
        setHoveredDest(null);
        setStage('hero');
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stage !== 'hero' && stage !== 'hub') {
        setStage('hub');
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [stage]);

  // Cinematic 3D Zoom-In Transition into any Destination Studio
  const enterDestination = (destId: SpatialDestinationId) => {
    if (prefersReducedMotion()) {
      setHoveredDest(null);
      setZoomingTo(null);
      setStage(destId);
      window.scrollTo({ top: 0 });
      return;
    }

    setHoveredDest(destId);
    setZoomingTo(destId);
    window.setTimeout(() => {
      setStage(destId);
      setZoomingTo(null);
      setHoveredDest(null);
      window.scrollTo({ top: 0 });
    }, 290);
  };

  const activeHoverMeta = useMemo(() => {
    if (stage === 'hub' && hoveredDest) {
      return destinations.find((d) => d.id === hoveredDest) || null;
    }
    return null;
  }, [stage, hoveredDest, destinations]);

  // Dynamic Spatial Hub Ambient Background (Strict 5-Color Palette)
  const spatialAmbientBg =
    stage === 'hero'
      ? '#B8D9F2'
      : activeHoverMeta
      ? activeHoverMeta.ambientBg
      : '#D9C9F2';

  const isSpatialDark = stage === 'hub' && Boolean(activeHoverMeta?.darkAmbient);
  const isInsideRoom = stage !== 'hero' && stage !== 'hub';

  const mobileDest = destinations[mobileHubIndex] || destinations[0];

  return (
    <div className="min-h-screen w-full relative selection:bg-[#101010] selection:text-[#FFFFFF]">
      <EditorialCursor />

      {/* ==================== PERSISTENT MINIMAL 3-ZONE SPATIAL HEADER ==================== */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 h-16 transition-colors duration-500 border-b ${
          isInsideRoom
            ? stage === 'digital-wardrobe'
              ? 'bg-[#101010]/95 text-[#FFFFFF] border-white/15'
              : 'bg-[#FFFFFF]/95 text-[#101010] border-[#101010]/12'
            : isSpatialDark
            ? 'bg-[#101010]/85 text-[#FFFFFF] border-white/15'
            : 'bg-transparent text-[#101010] border-[#101010]/10'
        }`}
      >
        <div className="max-w-[1440px] mx-auto h-full px-5 sm:px-8 flex items-center justify-between gap-6">
          {/* Zone 1: Single-Line Wordmark */}
          <button
            type="button"
            onClick={() => {
              setHoveredDest(null);
              setStage('hero');
              window.scrollTo({ top: 0 });
            }}
            className="font-editorial text-2xl font-semibold tracking-[0.06em] whitespace-nowrap shrink-0 min-h-[40px]"
          >
            PACKSMART
          </button>

          {/* Zone 2: Clean Single-Line Spatial Room Switchers */}
          <nav
            aria-label="Spatial destinations"
            className="hidden md:flex items-center gap-7 text-xs font-semibold tracking-tight"
          >
            {destinations.map((d) => {
              const active = stage === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => enterDestination(d.id)}
                  className={`min-h-[40px] whitespace-nowrap shrink-0 transition-opacity ${
                    active
                      ? 'underline underline-offset-8 decoration-2 font-bold opacity-100'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {d.label
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())
                    .replace('Ai ', 'AI ')}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Contextual Action */}
          <div className="shrink-0">
            {isInsideRoom ? (
              <button
                type="button"
                onClick={() => {
                  setStage('hub');
                  window.scrollTo({ top: 0 });
                }}
                className={`min-h-[40px] px-4 text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  stage === 'digital-wardrobe'
                    ? 'bg-[#FFFFFF] text-[#101010] hover:bg-[#FFC5A8]'
                    : 'bg-[#101010] text-[#FFFFFF] hover:bg-[#101010]/85'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Spatial Hub</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onEnterClassicWorkspace('essentials')}
                className={`min-h-[40px] px-4 text-xs font-bold transition-colors whitespace-nowrap shrink-0 border ${
                  isSpatialDark
                    ? 'border-white/30 text-[#FFFFFF] hover:bg-[#FFFFFF] hover:text-[#101010]'
                    : 'border-[#101010] text-[#101010] hover:bg-[#101010] hover:text-[#FFFFFF]'
                }`}
              >
                Vault &amp; Tools
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==================== SPATIAL 3D WORLD (HERO + SPATIAL BROWSING HUB) ==================== */}
      {!isInsideRoom && (
        <section
          style={{ backgroundColor: spatialAmbientBg }}
          className={`relative w-full min-h-screen lg:h-screen lg:overflow-hidden transition-colors duration-700 ${
            isSpatialDark ? 'text-[#FFFFFF]' : 'text-[#101010]'
          }`}
        >
          {/* Subtle Editorial Architectural Hairlines */}
          <div
            aria-hidden="true"
            className={`pointer-events-none hidden lg:block absolute inset-y-0 left-1/2 w-px transition-colors duration-500 ${
              isSpatialDark ? 'bg-white/10' : 'bg-[#101010]/8'
            }`}
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none hidden lg:block absolute inset-x-0 top-1/2 h-px transition-colors duration-500 ${
              isSpatialDark ? 'bg-white/10' : 'bg-[#101010]/8'
            }`}
          />

          {/* FULL-SCREEN INTERACTIVE 3D STAGE */}
          <div
            className={`relative lg:absolute lg:inset-0 w-full ${
              stage === 'hub' ? 'h-[42vh] lg:h-full' : 'h-[52vh] lg:h-full'
            } z-10`}
          >
            <SpatialWorld3D
              mode={zoomingTo ? 'zooming' : stage === 'hero' ? 'hero' : 'hub'}
              hoveredDestination={stage === 'hub' ? hoveredDest || mobileDest.id : null}
              finish={finish}
              onSelectObject={(destId) => {
                if (stage === 'hero') {
                  setStage('hub');
                  setHoveredDest(destId);
                } else {
                  enterDestination(destId);
                }
              }}
              className="w-full h-full"
            />
          </div>

          {/* ==================== STAGE 0: IMMERSIVE SPATIAL HERO OVERLAY ==================== */}
          <AnimatePresence mode="wait">
            {stage === 'hero' && (
              <motion.div
                key="hero-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative lg:absolute lg:inset-0 z-20 pointer-events-none flex flex-col justify-between px-6 sm:px-10 pt-4 pb-8 lg:pt-24 lg:pb-10 max-w-[1440px] mx-auto"
              >
                {/* Top Asymmetric Atelier Index */}
                <div className="flex items-start justify-between">
                  <div className="pointer-events-auto space-y-1">
                    <p className="font-mono text-[11px] tracking-[0.22em] text-[#101010]/65">
                      ATELIER EDITION · SPATIAL TRAVEL FASHION
                    </p>
                    <p className="font-editorial text-3xl sm:text-4xl tracking-[0.14em] text-[#101010]">
                      PACKSMART
                    </p>
                  </div>

                  {/* Subtle Shell Finish Switcher (Top-Right on Desktop, Zero Suitcase Occlusion) */}
                  <div className="hidden sm:flex pointer-events-auto items-center gap-1.5 bg-[#FFFFFF]/90 border border-[#101010]/15 px-2.5 py-1.5">
                    {(Object.keys(SPATIAL_FINISHES) as SpatialSuitcaseFinish[]).map((key) => {
                      const spec = SPATIAL_FINISHES[key];
                      const active = finish === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFinish(key)}
                          title={spec.label}
                          aria-label={`Set suitcase finish to ${spec.label}`}
                          className={`w-6 h-6 border transition-transform ${
                            active
                              ? 'border-[#101010] scale-110 ring-1 ring-[#101010]'
                              : 'border-[#101010]/25 hover:scale-105'
                          }`}
                          style={{ backgroundColor: spec.shellHex }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Bottom-Left Expressive Asymmetrical Editorial Headline & CTA */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mt-4 lg:mt-0">
                  <div className="lg:col-span-6 pointer-events-auto space-y-6">
                    <LineRevealText
                      as="h1"
                      trigger="mount"
                      delay={0.05}
                      stagger={0.13}
                      lines={[
                        'Your wardrobe.',
                        <span key="h2" className="pl-6 sm:pl-14 inline-block font-editorial italic font-normal">
                          Your journey.
                        </span>,
                        <span key="h3" className="block tracking-[-0.04em]">
                          Reimagined.
                        </span>,
                      ]}
                      className="font-display text-5xl sm:text-6xl lg:text-[4.85rem] font-extrabold leading-[0.94] tracking-[-0.03em] text-[#101010]"
                    />

                    <p className="text-sm sm:text-base text-[#101010]/75 max-w-md leading-relaxed">
                      Everything you need to travel smarter, dress better and pack lighter.
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <MagneticButton
                        type="button"
                        cursorLabel="ENTER"
                        onClick={() => setStage('hub')}
                        className="min-h-[54px] px-8 bg-[#101010] text-[#FFFFFF] text-xs font-bold tracking-[0.14em] inline-flex items-center gap-3 hover:bg-[#101010]/85 transition-colors whitespace-nowrap"
                      >
                        <span>EXPLORE YOUR EXPERIENCE</span>
                        <ArrowUpRight className="w-4 h-4 text-[#FFC5A8]" />
                      </MagneticButton>
                    </div>
                  </div>

                  {/* Subtle Scroll / Spatial Enter Cue on Bottom-Right */}
                  <div className="lg:col-span-6 flex lg:justify-end items-end">
                    <button
                      type="button"
                      onClick={() => setStage('hub')}
                      className="pointer-events-auto inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.16em] text-[#101010]/70 hover:text-[#101010] transition-colors min-h-[40px]"
                    >
                      <span>SCROLL OR ENTER SPATIAL HUB</span>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ==================== STAGE 1: SPATIAL BROWSING HUB ==================== */}
            {stage === 'hub' && (
              <motion.div
                key="hub-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative lg:absolute lg:inset-0 z-20 pointer-events-none"
              >
                {/* Center Quiet Spatial Orientation Cue (Desktop Top Center) */}
                <div className="hidden lg:flex flex-col items-center absolute top-20 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                  <p
                    className={`font-mono text-[10px] tracking-[0.22em] transition-colors ${
                      isSpatialDark ? 'text-[#FFC5A8]' : 'text-[#101010]/60'
                    }`}
                  >
                    SPATIAL BROWSING · SELECT A DESTINATION
                  </p>
                  <p className="font-editorial italic text-2xl mt-0.5">
                    {activeHoverMeta ? activeHoverMeta.headline : 'Orbit the suitcase to explore'}
                  </p>
                </div>

                {/* DESKTOP: 4 FLOATING INTERACTIVE DESTINATIONS AROUND THE CENTRAL 3D SUITCASE */}
                <div className="hidden lg:block">
                  {destinations.map((dest) => {
                    const isHovered = hoveredDest === dest.id;
                    const isDimmed = hoveredDest !== null && !isHovered;
                    return (
                      <motion.button
                        key={dest.id}
                        type="button"
                        onMouseEnter={() => setHoveredDest(dest.id)}
                        onMouseLeave={() => setHoveredDest(null)}
                        onFocus={() => setHoveredDest(dest.id)}
                        onBlur={() => setHoveredDest(null)}
                        onClick={() => enterDestination(dest.id)}
                        animate={{
                          scale: isHovered ? 1.04 : isDimmed ? 0.96 : 1,
                          opacity: isDimmed ? 0.62 : 1,
                          y: isHovered ? -6 : 0,
                        }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className={`pointer-events-auto absolute ${dest.positionClass} w-[330px] xl:w-[360px] text-left border transition-colors duration-300 overflow-hidden group ${
                          isHovered
                            ? 'bg-[#101010] text-[#FFFFFF] border-[#101010] shadow-2xl z-30'
                            : isSpatialDark
                            ? 'bg-white/10 text-[#FFFFFF] border-white/20'
                            : 'bg-[#FFFFFF]/95 text-[#101010] border-[#101010]/15 hover:border-[#101010]'
                        }`}
                      >
                        <div className="p-5 flex items-center gap-4">
                          {/* Expanding Editorial Visual Preview */}
                          <motion.div
                            animate={{
                              width: isHovered ? 96 : 68,
                              height: isHovered ? 96 : 68,
                            }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            className="shrink-0 overflow-hidden border border-current/15 bg-[#B8D9F2]/30"
                          >
                            <img loading="lazy" decoding="async"
                              src={dest.image}
                              alt={dest.label}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                          </motion.div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-mono text-[10px] tracking-[0.14em] ${
                                  isHovered
                                    ? 'text-[#FFC5A8]'
                                    : isSpatialDark
                                    ? 'text-[#D9C9F2]'
                                    : 'text-[#101010]/55'
                                }`}
                              >
                                {dest.index}. DESTINATION
                              </span>
                              <ArrowUpRight className="w-4 h-4 shrink-0" />
                            </div>
                            <h2 className="font-display text-sm font-extrabold tracking-[0.04em]">
                              {dest.label}
                            </h2>
                            <p
                              className={`font-editorial italic text-lg leading-tight ${
                                isHovered
                                  ? 'text-[#B8D9F2]'
                                  : isSpatialDark
                                  ? 'text-white/80'
                                  : 'text-[#101010]/75'
                              }`}
                            >
                              {dest.headline}
                            </p>
                          </div>
                        </div>

                        {/* Supporting Copy + Clear Enter Action Expanding on Hover */}
                        <motion.div
                          initial={false}
                          animate={{
                            height: isHovered ? 'auto' : 0,
                            opacity: isHovered ? 1 : 0,
                          }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden border-t border-white/15"
                        >
                          <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                            <p className="text-[11px] text-white/75 leading-snug">
                              {dest.description}
                            </p>
                            <span className="font-mono text-[10px] font-bold text-[#FFC5A8] whitespace-nowrap shrink-0">
                              ENTER →
                            </span>
                          </div>
                        </motion.div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* DESKTOP BOTTOM-CENTER QUIET RETURN & FINISH CONTROLS */}
                <div className="hidden lg:flex items-center gap-3 absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setHoveredDest(null);
                      setStage('hero');
                    }}
                    className={`min-h-[38px] px-4 font-mono text-[10px] tracking-[0.14em] border transition-colors ${
                      isSpatialDark
                        ? 'border-white/25 text-white/80 hover:bg-white hover:text-[#101010]'
                        : 'border-[#101010]/20 bg-[#FFFFFF]/85 text-[#101010] hover:bg-[#101010] hover:text-[#FFFFFF]'
                    }`}
                  >
                    ↑ HERO VIEW
                  </button>
                  <div className="flex items-center gap-1.5 bg-[#FFFFFF]/90 border border-[#101010]/15 px-2.5 py-1.5">
                    {(Object.keys(SPATIAL_FINISHES) as SpatialSuitcaseFinish[]).map((key) => {
                      const spec = SPATIAL_FINISHES[key];
                      const active = finish === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFinish(key)}
                          title={spec.label}
                          aria-label={`Suitcase finish ${spec.label}`}
                          className={`w-5 h-5 border ${
                            active ? 'border-[#101010] ring-1 ring-[#101010]' : 'border-[#101010]/25'
                          }`}
                          style={{ backgroundColor: spec.shellHex }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* MOBILE / TOUCH DEDICATED SPATIAL SWIPE BROWSER (< 1024px) */}
                <div
                  className="lg:hidden pointer-events-auto px-5 pb-8 pt-2 space-y-4"
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0].clientX;
                  }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null) return;
                    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (dx < -40) {
                      setMobileHubIndex((i) => (i + 1) % destinations.length);
                    } else if (dx > 40) {
                      setMobileHubIndex((i) => (i - 1 + destinations.length) % destinations.length);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] tracking-[0.16em] opacity-70 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5" />
                      <span>SWIPE SPATIAL DESTINATIONS</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Previous destination"
                        onClick={() =>
                          setMobileHubIndex((i) => (i - 1 + destinations.length) % destinations.length)
                        }
                        className="w-9 h-9 border border-current/25 flex items-center justify-center"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next destination"
                        onClick={() => setMobileHubIndex((i) => (i + 1) % destinations.length)}
                        className="w-9 h-9 border border-current/25 flex items-center justify-center"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Active Mobile Spatial Card */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={mobileDest.id}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -24 }}
                      transition={{ duration: 0.25 }}
                      className="bg-[#FFFFFF] text-[#101010] border border-[#101010] overflow-hidden"
                    >
                      <div className="grid grid-cols-12">
                        <div className="col-span-5 relative min-h-[168px]">
                          <img loading="lazy" decoding="async"
                            src={mobileDest.image}
                            alt={mobileDest.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="col-span-7 p-4 flex flex-col justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-mono text-[10px] text-[#101010]/60">
                              {mobileDest.index} / 04
                            </p>
                            <h2 className="font-display text-sm font-extrabold">
                              {mobileDest.label}
                            </h2>
                            <p className="font-editorial italic text-xl leading-tight">
                              {mobileDest.headline}
                            </p>
                            <p className="text-[11px] text-[#101010]/70 leading-snug pt-0.5">
                              {mobileDest.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => enterDestination(mobileDest.id)}
                            className="w-full min-h-[42px] bg-[#101010] text-[#FFFFFF] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                          >
                            <span>{mobileDest.actionLabel}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#FFC5A8]" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Compact Touch Destination Switcher Strip */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {destinations.map((d, idx) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setMobileHubIndex(idx)}
                        className={`min-h-[38px] px-1 font-mono text-[10px] border transition-colors truncate ${
                          idx === mobileHubIndex
                            ? 'bg-[#101010] border-[#101010] text-[#FFC5A8] font-bold'
                            : 'bg-[#FFFFFF]/80 border-[#101010]/20 text-[#101010]'
                        }`}
                      >
                        {d.index}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* ==================== STAGE 2: FOUR DEDICATED IMMERSIVE DESTINATIONS ==================== */}
      <AnimatePresence mode="wait">
        {stage === 'smart-packing' && (
          <motion.div
            key="room-smart-packing"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <SmartPackingStudio
              lists={lists}
              selectedTripId={selectedTripId}
              isOnline={isOnline}
              aiConfigured={aiConfigured}
              onSelectTrip={setSelectedTripId}
              onUpdateList={onUpdateList}
              onOpenTripPlanner={() => setStage('trip-planner')}
              onOpenOutfitStudio={() => setStage('ai-outfit-studio')}
              onOpenClassicDetail={(tripId, subTab) => onOpenClassicTrip(tripId, subTab)}
              onSaveWeather={onSaveWeather}
            />
          </motion.div>
        )}

        {stage === 'ai-outfit-studio' && (
          <motion.div
            key="room-ai-outfit-studio"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <AIOutfitStudioView
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
              onOpenSmartPacking={() => setStage('smart-packing')}
            />
          </motion.div>
        )}

        {stage === 'trip-planner' && (
          <motion.div
            key="room-trip-planner"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <TripPlannerStudio
              lists={lists}
              user={user}
              personalEssentials={personalEssentials}
              memoryInsights={memoryInsights}
              defaultAllowanceKg={defaultAllowanceKg}
              isOnline={isOnline}
              onCreateList={(created) => {
                onCreateList(created);
                setSelectedTripId(created.id);
              }}
              onUpdateList={onUpdateList}
              onSaveWeather={onSaveWeather}
              onOpenSmartPacking={(tripId) => {
                setSelectedTripId(tripId);
                setStage('smart-packing');
              }}
              onOpenOutfitStudio={() => setStage('ai-outfit-studio')}
            />
          </motion.div>
        )}

        {stage === 'digital-wardrobe' && (
          <motion.div
            key="room-digital-wardrobe"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <DigitalWardrobeStudio
              wardrobe={wardrobe}
              wardrobePhotos={wardrobePhotos}
              savedOutfits={savedOutfits}
              isOnline={isOnline}
              onAddWardrobeItem={onAddWardrobeItem}
              onSaveWardrobePhoto={onSaveWardrobePhoto}
              onDeleteWardrobeItem={onDeleteWardrobeItem}
              onOpenOutfitStudio={() => setStage('ai-outfit-studio')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
