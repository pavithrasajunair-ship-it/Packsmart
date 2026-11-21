import React, { useMemo } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CloudSun,
  Luggage,
  Shirt,
  Sparkles,
} from 'lucide-react';
import type { OutfitCombination, PackingList, WardrobeItem } from '../../types';
import { analyzeSuitcaseSpace, daysUntilDate } from '../../utils/packingEngine';
import heroSuitcaseImg from '../../assets/images/packsmart_hero_suitcase_ivory_1795262373429.jpg';

export type PlatformRoute =
  | 'home'
  | 'dashboard'
  | 'trip-planner'
  | 'smart-packing'
  | 'ai-outfit-studio'
  | 'digital-wardrobe';

interface HomePageProps {
  lists: PackingList[];
  wardrobe: WardrobeItem[];
  savedOutfits: OutfitCombination[];
  onNavigate: (route: PlatformRoute) => void;
  onOpenVault: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  lists,
  wardrobe,
  savedOutfits,
  onNavigate,
  onOpenVault,
}) => {
  const activeTrip = useMemo(
    () => lists.find((l) => !l.completed) || lists[0] || null,
    [lists]
  );

  const metrics = useMemo(
    () => (activeTrip ? analyzeSuitcaseSpace(activeTrip) : null),
    [activeTrip]
  );

  const packedCount = activeTrip ? activeTrip.items.filter((i) => i.packed).length : 0;
  const totalCount = activeTrip ? activeTrip.items.length : 0;
  const packedPct = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;
  const daysLeft = activeTrip ? daysUntilDate(activeTrip.startDate) : null;

  const modules = [
    {
      route: 'smart-packing' as PlatformRoute,
      icon: Luggage,
      accentBg: 'bg-[#B9D8EF]',
      title: 'Smart Packing',
      description:
        'Organize every item by category, track suitcase volume and weight, and get tailored essentials.',
      stat:
        activeTrip && metrics
          ? `${packedCount}/${totalCount} packed · ${metrics.totalVolumeLiters}L used`
          : '40L carry-on optimizer',
      cta: 'Open Smart Packing',
    },
    {
      route: 'ai-outfit-studio' as PlatformRoute,
      icon: Sparkles,
      accentBg: 'bg-[#D8C9EC]',
      title: 'AI Outfit Studio',
      description:
        'Upload photos of clothes you own and generate non-repeating, weather-ready daily looks.',
      stat: `${wardrobe.length} owned pieces · ${savedOutfits.length} saved looks`,
      cta: 'Open AI Outfit Studio',
    },
    {
      route: 'trip-planner' as PlatformRoute,
      icon: Calendar,
      accentBg: 'bg-[#F5BDA5]',
      title: 'Trip Planner',
      description:
        'Plan destinations, fetch live weather forecasts, and follow a calm countdown timeline.',
      stat: activeTrip
        ? `${activeTrip.destination || activeTrip.title}`
        : `${lists.length} active itineraries`,
      cta: 'Open Trip Planner',
    },
    {
      route: 'digital-wardrobe' as PlatformRoute,
      icon: Shirt,
      accentBg: 'bg-[#F7F4EF]',
      title: 'Digital Wardrobe',
      description:
        'Catalog your real tops, bottoms, dresses, shoes, and outerwear with AI vision tagging.',
      stat: `${wardrobe.filter((w) => w.photoId).length} photo-scanned items`,
      cta: 'Browse Wardrobe',
    },
  ];

  return (
    <div className="bg-[#F7F4EF] text-[#171717]">
      {/* ==================== BALANCED SPLIT-LAYOUT HERO ==================== */}
      <section className="border-b border-[#171717]/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* LEFT: Clean Editorial Typography & Two Balanced CTAs */}
            <div className="lg:col-span-6 space-y-6">
              <p className="text-xs font-medium tracking-wide text-[#171717]/65">
                Intelligent Travel Preparation
              </p>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-[3.5rem] font-medium leading-[1.08] tracking-tight text-[#171717] max-w-xl">
                Pack less stress. Travel with confidence.
              </h1>

              <p className="text-base text-[#171717]/75 leading-relaxed max-w-lg">
                PackSmart brings together trip planning, live weather forecasts, suitcase space management, and AI outfit styling from your actual wardrobe in one calm workspace.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="h-11 px-6 rounded-lg bg-[#171717] text-[#FFFFFF] text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#171717]/88 transition-colors duration-150 whitespace-nowrap"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('ai-outfit-studio')}
                  className="h-11 px-6 rounded-lg bg-[#FFFFFF] border border-[#171717]/20 text-[#171717] text-sm font-medium inline-flex items-center justify-center gap-2 hover:border-[#171717] transition-colors duration-150 whitespace-nowrap"
                >
                  <span>Try AI Outfit Studio</span>
                </button>
              </div>
            </div>

            {/* RIGHT: Properly Contained Suitcase Product Visual (Zero Overlaps) */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden border border-[#171717]/10 bg-[#FFFFFF]">
                <img
                  src={heroSuitcaseImg}
                  alt="Matte black carry-on suitcase beside folded ivory sweater and leather passport holder"
                  referrerPolicy="no-referrer"
                  className="w-full aspect-[4/3] object-cover block"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== UNIFORM 4-MODULE PLATFORM OVERVIEW ==================== */}
      <section className="py-14 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <p className="text-xs font-medium text-[#171717]/60">Platform Workspace</p>
              <h2 className="font-serif text-3xl sm:text-4xl font-medium text-[#171717]">
                Everything organized before you depart
              </h2>
            </div>
            <p className="text-sm text-[#171717]/70 max-w-sm">
              Four connected tools designed to reduce overpacking and keep every travel detail in sync.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.route}
                  className="rounded-xl bg-[#FFFFFF] border border-[#171717]/10 p-6 flex flex-col justify-between gap-6 transition-colors duration-150 hover:border-[#171717]/30"
                >
                  <div className="space-y-4">
                    <div
                      className={`w-10 h-10 rounded-lg ${mod.accentBg} border border-[#171717]/10 flex items-center justify-center text-[#171717]`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-serif text-2xl font-medium text-[#171717]">
                        {mod.title}
                      </h3>
                      <p className="text-sm text-[#171717]/70 leading-relaxed">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#171717]/10 space-y-3">
                    <p className="text-xs font-medium text-[#171717]/60 tabular-nums truncate">
                      {mod.stat}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate(mod.route)}
                      className="text-sm font-medium text-[#171717] inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity duration-150"
                    >
                      <span>{mod.cta}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== LIVE WORKSPACE SNAPSHOT ==================== */}
      <section className="pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#171717]/10 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <p className="text-xs font-medium text-[#171717]/60">Active Journey Summary</p>
              <h2 className="font-serif text-3xl font-medium text-[#171717]">
                {activeTrip ? activeTrip.title : 'Ready for your next journey'}
              </h2>
              <p className="text-sm text-[#171717]/70 max-w-xl leading-relaxed">
                {activeTrip
                  ? `${activeTrip.destination || activeTrip.tripType} · ${activeTrip.startDate} to ${activeTrip.endDate}. Jump straight into your dashboard to check live weather, complete your timeline, or finish packing.`
                  : 'Create your first itinerary to generate smart packing lists, live weather tips, and wardrobe combinations.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="h-10 px-5 rounded-lg bg-[#171717] text-[#FFFFFF] text-sm font-medium hover:bg-[#171717]/88 transition-colors duration-150"
                >
                  Go to Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('trip-planner')}
                  className="h-10 px-5 rounded-lg bg-[#F7F4EF] border border-[#171717]/15 text-[#171717] text-sm font-medium hover:border-[#171717] transition-colors duration-150"
                >
                  Plan a New Trip
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl bg-[#B9D8EF]/30 border border-[#171717]/10 p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-medium text-[#171717]/70">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#171717]" />
                  <span>Packing Readiness</span>
                </span>
                <span className="tabular-nums font-semibold text-[#171717]">{packedPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#FFFFFF] overflow-hidden">
                <div
                  className="h-full bg-[#171717] rounded-full transition-all duration-300"
                  style={{ width: `${packedPct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#171717]/10 text-left tabular-nums">
                <div>
                  <p className="text-xs text-[#171717]/60">Departure</p>
                  <p className="text-sm font-semibold text-[#171717] mt-0.5">
                    {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days` : 'Ready'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#171717]/60">Suitcase</p>
                  <p className="text-sm font-semibold text-[#171717] mt-0.5">
                    {metrics ? `${metrics.totalVolumeLiters}L / ${metrics.capacityLiters}L` : '40L'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#171717]/60">Forecast</p>
                  <p className="text-sm font-semibold text-[#171717] mt-0.5 inline-flex items-center gap-1">
                    <CloudSun className="w-3.5 h-3.5" />
                    <span>
                      {activeTrip?.weather
                        ? `${activeTrip.weather.summary.avgHigh}°C`
                        : 'Live API'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== QUIET EDITORIAL FOOTER ==================== */}
      <footer className="border-t border-[#171717]/10 bg-[#FFFFFF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[#171717]/70">
          <div className="space-y-0.5">
            <p className="font-serif text-lg font-semibold text-[#171717]">PackSmart</p>
            <p className="text-xs text-[#171717]/60">
              Pack less stress. Travel with confidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="hover:text-[#171717] transition-colors"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onNavigate('trip-planner')}
              className="hover:text-[#171717] transition-colors"
            >
              Trip Planner
            </button>
            <button
              type="button"
              onClick={() => onNavigate('smart-packing')}
              className="hover:text-[#171717] transition-colors"
            >
              Smart Packing
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ai-outfit-studio')}
              className="hover:text-[#171717] transition-colors"
            >
              AI Outfit Studio
            </button>
            <button
              type="button"
              onClick={() => onNavigate('digital-wardrobe')}
              className="hover:text-[#171717] transition-colors"
            >
              Digital Wardrobe
            </button>
            <button
              type="button"
              onClick={onOpenVault}
              className="hover:text-[#171717] transition-colors"
            >
              Document Vault
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
