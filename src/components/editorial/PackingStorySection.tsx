import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Check } from 'lucide-react';
import { LineRevealText, MagneticButton, prefersReducedMotion } from './MotionPrimitives';

gsap.registerPlugin(ScrollTrigger);

interface PackingStorySectionProps {
  onOpenSuitcaseOptimizer: () => void;
}

interface StoryGarment {
  id: string;
  name: string;
  category: string;
  spec: string;
  tone: '#BCD2CF' | '#D5DCD9' | '#E6DFD2' | '#FBFAF8';
  // Chaotic scattered position (% relative to suitcase stage)
  chaosX: number;
  chaosY: number;
  chaosRotate: number;
  // Organized compartment grid position
  slotCol: string;
}

const STORY_GARMENTS: StoryGarment[] = [
  {
    id: 'g1',
    name: 'Linen Overshirt',
    category: 'Tops · Rolled',
    spec: '210g · 0.8L',
    tone: '#BCD2CF',
    chaosX: -190,
    chaosY: -120,
    chaosRotate: -24,
    slotCol: 'col-span-6',
  },
  {
    id: 'g2',
    name: 'Cashmere Crew',
    category: 'Layer · Folded',
    spec: '310g · 1.4L',
    tone: '#D5DCD9',
    chaosX: 185,
    chaosY: -135,
    chaosRotate: 19,
    slotCol: 'col-span-6',
  },
  {
    id: 'g3',
    name: 'Pleated Trousers',
    category: 'Bottoms · 3× Reuse',
    spec: '360g · 1.5L',
    tone: '#FBFAF8',
    chaosX: -220,
    chaosY: 20,
    chaosRotate: 16,
    slotCol: 'col-span-7',
  },
  {
    id: 'g4',
    name: 'Silk Evening Scarf',
    category: 'Accent · Compact',
    spec: '70g · 0.2L',
    tone: '#E6DFD2',
    chaosX: 210,
    chaosY: -10,
    chaosRotate: -28,
    slotCol: 'col-span-5',
  },
  {
    id: 'g5',
    name: 'Leather Loafers',
    category: 'Footwear · Edge-fit',
    spec: '620g · 2.6L',
    tone: '#E6DFD2',
    chaosX: -165,
    chaosY: 145,
    chaosRotate: -14,
    slotCol: 'col-span-5',
  },
  {
    id: 'g6',
    name: 'Passport & Tech Kit',
    category: 'Essentials · Quick-access',
    spec: '390g · 0.9L',
    tone: '#BCD2CF',
    chaosX: 175,
    chaosY: 135,
    chaosRotate: 22,
    slotCol: 'col-span-7',
  },
];

const CHAPTERS = [
  {
    num: '01',
    title: 'Before PackSmart: Scattered guesses.',
    copy: 'Most travellers overpack by 42%—tossing duplicate tops, mismatched shoes, and heavy "just-in-case" layers into an overflowing check-in bag.',
    metricWeight: '16.4 kg',
    metricPieces: '19 items',
    metricStatus: 'Overweight · 118% capacity',
  },
  {
    num: '02',
    title: 'The Capsule Edit: Every piece earns its liters.',
    copy: 'PackSmart maps real weather forecasts against your uploaded wardrobe, automatically pairing versatile bottoms, outerwear, and footwear across days.',
    metricWeight: '10.2 kg',
    metricPieces: '11 pieces',
    metricStatus: 'Optimizing fold & roll layout',
  },
  {
    num: '03',
    title: 'Locked for Departure: Half the luggage, double the looks.',
    copy: 'Nine intentional pieces compress cleanly into a 40L cabin carry-on—yielding 14 distinct outfits with zero baggage fees and calm departure mornings.',
    metricWeight: '7.8 kg',
    metricPieces: '9 pieces · 14 looks',
    metricStatus: 'Cabin-ready · 68% capacity',
  },
];

export const PackingStorySection: React.FC<PackingStorySectionProps> = ({
  onOpenSuitcaseOptimizer,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const sidewaysRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDesktopPinned, setIsDesktopPinned] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || prefersReducedMotion()) return;

    const mm = gsap.matchMedia();

    mm.add('(min-width: 1024px)', () => {
      setIsDesktopPinned(true);

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: '+=190%',
        pin: true,
        refreshPriority: 6,
        scrub: 1.2,
        anticipatePin: 1,
        onUpdate: (self) => {
          setProgress(Math.round(self.progress * 100) / 100);
        },
      });

      if (sidewaysRef.current) {
        gsap.fromTo(
          sidewaysRef.current,
          { yPercent: 18, opacity: 0.25 },
          {
            yPercent: -18,
            opacity: 0.95,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      }

      return () => {
        st.kill();
        setIsDesktopPinned(false);
      };
    });

    return () => {
      mm.revert();
    };
  }, []);

  // Derive smooth packing interpolation (0 = chaotic scattered, 1 = precision organized)
  const organizeT = Math.min(1, Math.max(0, (progress - 0.08) / 0.72));
  // Smooth cubic ease
  const easedT = 1 - Math.pow(1 - organizeT, 3);

  const chapterIndex = progress < 0.34 ? 0 : progress < 0.72 ? 1 : 2;
  const activeChapter = CHAPTERS[chapterIndex];

  return (
    <section
      id="packing-story"
      ref={sectionRef}
      className="relative text-[#0A0A0A] min-h-screen flex items-center overflow-hidden"
    >
      <div className="w-full max-w-[1320px] mx-auto px-6 sm:px-10 py-20 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center relative z-10">
        {/* Left Editorial Narrative Column */}
        <div className="lg:col-span-5 space-y-8">
          <div className="space-y-4">
            <LineRevealText
              as="h2"
              lines={['From closet chaos', 'to 40-liter calm.']}
              className="text-4xl sm:text-5xl lg:text-[3.75rem] leading-[1.02] tracking-[-0.035em] text-[#0A0A0A]"
            />
          </div>

          {/* Interactive / Scroll-Driven Chapter Indicator */}
          <div className="space-y-5 border-t border-[#0A0A0A]/15 pt-6">
            <div className="flex items-center gap-3">
              {CHAPTERS.map((ch, idx) => (
                <button
                  key={ch.num}
                  type="button"
                  onClick={() => setProgress(idx === 0 ? 0.05 : idx === 1 ? 0.5 : 0.95)}
                  className={`min-h-[40px] px-3 font-mono text-xs transition-colors border-b-2 ${
                    chapterIndex === idx
                      ? 'border-[#0A0A0A] text-[#0A0A0A] font-semibold'
                      : 'border-transparent text-[#0A0A0A]/70 hover:text-[#0A0A0A]/80'
                  }`}
                >
                  {ch.num}
                </button>
              ))}
              <span className="ml-auto font-mono text-[11px] text-[#0A0A0A]/70 tabular-nums">
                {Math.round(easedT * 100)}% organized
              </span>
            </div>

            <div className="min-h-[120px] space-y-2.5">
              <h3 className="font-sans text-xl sm:text-2xl font-semibold text-[#0A0A0A]">
                {activeChapter.title}
              </h3>
              <p className="text-sm text-[#0A0A0A]/75 leading-relaxed max-w-md">
                {activeChapter.copy}
              </p>
            </div>

            {/* Live Quantified Packing Telemetry */}
            <div className="grid grid-cols-3 gap-4 border-t border-[#0A0A0A]/15 pt-5 tabular-nums">
              <div>
                <p className="font-mono text-[11px] text-[#0A0A0A]/70">Total Weight</p>
                <p className="font-mono text-lg sm:text-xl font-semibold text-[#0A0A0A] mt-1">
                  {activeChapter.metricWeight}
                </p>
              </div>
              <div>
                <p className="font-mono text-[11px] text-[#0A0A0A]/70">Capsule Count</p>
                <p className="font-mono text-lg sm:text-xl font-semibold text-[#0A0A0A] mt-1">
                  {activeChapter.metricPieces}
                </p>
              </div>
              <div>
                <p className="font-mono text-[11px] text-[#0A0A0A]/70">Status</p>
                <p className="text-xs font-semibold text-[#0A0A0A] mt-1.5 leading-snug">
                  {activeChapter.metricStatus}
                </p>
              </div>
            </div>

            {!isDesktopPinned && (
              <div className="pt-1">
                <label
                  htmlFor="packing-scrubber"
                  className="block font-mono text-[11px] text-[#0A0A0A]/75 mb-2"
                >
                  Drag to preview packing choreography
                </label>
                <input
                  id="packing-scrubber"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(progress * 100)}
                  onChange={(e) => setProgress(Number(e.target.value) / 100)}
                  className="w-full accent-[#0A0A0A]"
                />
              </div>
            )}

            <div className="pt-2">
              <MagneticButton
                type="button"
                onClick={onOpenSuitcaseOptimizer}
                cursorLabel="PACK"
                className="min-h-[48px] px-6 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-sm font-semibold inline-flex items-center gap-2.5 hover:bg-[#0A0A0A]/85 transition-colors"
              >
                <span>Open Suitcase Space Optimizer</span>
                <ArrowRight className="w-4 h-4" />
              </MagneticButton>
            </div>
          </div>
        </div>

        {/* Right Architectural Suitcase Choreography Stage */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[560px] p-5 sm:p-7 border border-[#0A0A0A]/25 bg-[#FBFAF8]/60 overflow-hidden rounded-2xl">
            {/* Suitcase Frame Header */}
            <div className="flex items-center justify-between border-b border-[#0A0A0A]/15 pb-3.5 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-[#0A0A0A]">40L CARRY-ON ARCHITECTURE</span>
              </div>
              <span className="font-mono text-xs text-[#0A0A0A]/70 tabular-nums">
                55 × 35 × 23 cm
              </span>
            </div>

            {/* Dynamic Garment Grid — flies from chaos coordinates into architectural precision */}
            <div className="grid grid-cols-12 gap-3 relative min-h-[320px]">
              {STORY_GARMENTS.map((garment, order) => {
                // Pieces lift in one after another and settle into place. No scatter.
                const startAt = (order / STORY_GARMENTS.length) * 0.7;
                const local = Math.min(1, Math.max(0, (organizeT - startAt) / 0.3));
                const eased = 1 - Math.pow(1 - local, 3);

                return (
                  <div
                    key={garment.id}
                    style={{
                      transform: `translate3d(0, ${(1 - eased) * 44}px, 0) scale(${0.96 + 0.04 * eased})`,
                      opacity: 0.12 + 0.88 * eased,
                      backgroundColor: garment.tone,
                      color: '#0A0A0A',
                    }}
                    className={`${garment.slotCol} p-4 flex flex-col justify-between min-h-[104px] will-change-transform border border-[#0A0A0A]/15 rounded-xl`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-[#0A0A0A]/75">
                        {garment.category}
                      </span>
                      {organizeT > 0.95 && (
                        <Check className="w-3.5 h-3.5 text-[#0A0A0A] shrink-0" />
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="text-base font-semibold leading-tight text-[#0A0A0A]">
                        {garment.name}
                      </p>
                      <p className="text-xs text-[#0A0A0A]/75 mt-0.5 tabular-nums">
                        {garment.spec}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Suitcase Compression Progress Track */}
            <div className="mt-6 pt-4 border-t border-[#0A0A0A]/15 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#0A0A0A]/75">Volume Fit</span>
                <span className="text-[#0A0A0A] font-semibold tabular-nums">
                  {easedT > 0.85 ? '27.2L / 40.0L · Optimal' : `${(47.2 - easedT * 20).toFixed(1)}L / 40.0L`}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#0A0A0A]/10 overflow-hidden">
                <div
                  className="h-full bg-[#0B3B40] transition-all duration-150"
                  style={{ width: `${Math.max(24, Math.min(100, 100 - easedT * 32))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
