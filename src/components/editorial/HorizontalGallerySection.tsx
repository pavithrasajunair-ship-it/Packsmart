import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight } from 'lucide-react';
import { LineRevealText, MagneticButton, TiltCard, prefersReducedMotion } from './MotionPrimitives';
import kyotoImg from '../../assets/images/editorial_destination_kyoto_1795242652961.jpg';
import amalfiImg from '../../assets/images/editorial_destination_amalfi_1795242652302.jpg';
import flatlayImg from '../../assets/images/editorial_packing_flatlay_1795242653043.jpg';
import fashionImg from '../../assets/images/editorial_fashion_capsule_1795242653258.jpg';
import vaultImg from '../../assets/images/vault_passport_docs_1795234501293.jpg';

gsap.registerPlugin(ScrollTrigger);

export interface EditorialBlueprint {
  id: string;
  chapter: string;
  title: string;
  subtitle: string;
  destination: string;
  days: number;
  climate: string;
  capsuleSpec: string;
  image: string;
  actionLabel: string;
  surface: '#FFFFFF' | '#B8D9F2' | '#D9C9F2' | '#101010';
  kind: 'trip_blueprint' | 'wardrobe_jump' | 'suitcase_jump' | 'vault_jump';
}

export const EDITORIAL_BLUEPRINTS: EditorialBlueprint[] = [
  {
    id: 'bp-kyoto',
    chapter: '01 / DESTINATION EDIT',
    title: 'Kyoto Autumn Layers',
    subtitle: 'Quiet morning walks, temple courtyards, and crisp evening transitions packed in one 40L cabin case.',
    destination: 'Kyoto, Japan',
    days: 6,
    climate: '11°–19°C · Crisp & Layered',
    capsuleSpec: '9 pieces · 12 outfits · 7.6 kg',
    image: kyotoImg,
    actionLabel: 'Load Kyoto Trip',
    surface: '#FFFFFF',
    kind: 'trip_blueprint',
  },
  {
    id: 'bp-amalfi',
    chapter: '02 / COASTAL CAPSULE',
    title: 'Amalfi Linen Edit',
    subtitle: 'Sunlit limestone terraces and effortless sea-breeze tailoring built around breathable linen and zero excess weight.',
    destination: 'Amalfi Coast, Italy',
    days: 5,
    climate: '24°–30°C · Warm & Sunny',
    capsuleSpec: '7 pieces · 10 outfits · 5.9 kg',
    image: amalfiImg,
    actionLabel: 'Load Amalfi Trip',
    surface: '#B8D9F2',
    kind: 'trip_blueprint',
  },
  {
    id: 'bp-carryon',
    chapter: '03 / SPATIAL ARCHITECTURE',
    title: 'The 40L Carry-On Formula',
    subtitle: 'Visual capacity mapping, rolling vs. folding volume math, and instant overweight alerts before you zip.',
    destination: 'Cabin Carry-On',
    days: 4,
    climate: 'All-Season Standard',
    capsuleSpec: 'Visual Liters · Weight Allowance',
    image: flatlayImg,
    actionLabel: 'Open Space Optimizer',
    surface: '#101010',
    kind: 'suitcase_jump',
  },
  {
    id: 'bp-wardrobe',
    chapter: '04 / AI VISION STYLING',
    title: 'Zero-Repeat Wardrobe AI',
    subtitle: 'Photograph clothes you actually own. Gemini Vision reads color, pattern, and fabric to style every trip day.',
    destination: 'Your Own Closet',
    days: 7,
    climate: 'Weather-Adaptive',
    capsuleSpec: 'Owned Clothes Only · Smart Gaps',
    image: fashionImg,
    actionLabel: 'Try AI Outfit Matcher',
    surface: '#D9C9F2',
    kind: 'wardrobe_jump',
  },
  {
    id: 'bp-vault',
    chapter: '05 / DEPARTURE CALM',
    title: 'Document Radar & Vault',
    subtitle: 'AES-GCM local encryption for passports, visas, and boarding passes paired with a Before-You-Leave safety checklist.',
    destination: 'Departure Security',
    days: 1,
    climate: 'Pre-Flight Readiness',
    capsuleSpec: 'Expiry Alerts · Private Vault',
    image: vaultImg,
    actionLabel: 'Open Document Radar',
    surface: '#FFFFFF',
    kind: 'vault_jump',
  },
];

interface HorizontalGallerySectionProps {
  onSelectBlueprint: (blueprint: EditorialBlueprint) => void;
}

export const HorizontalGallerySection: React.FC<HorizontalGallerySectionProps> = ({
  onSelectBlueprint,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const sidewaysRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track || prefersReducedMotion()) return;

    const mm = gsap.matchMedia();

    mm.add('(min-width: 1024px)', () => {
      const getScrollAmount = () => Math.max(0, track.scrollWidth - window.innerWidth + 120);

      const tween = gsap.to(track, {
        x: () => -getScrollAmount(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: () => `+=${Math.max(900, getScrollAmount() * 1.15)}`,
          pin: true,
        refreshPriority: 4,
          scrub: 0.85,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });

      if (sidewaysRef.current) {
        gsap.fromTo(
          sidewaysRef.current,
          { yPercent: 14 },
          {
            yPercent: -14,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      }

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });

    return () => {
      mm.revert();
    };
  }, []);

  return (
    <section
      id="curated-stories"
      ref={sectionRef}
      className="relative bg-[#FFC5A8] text-[#101010] overflow-hidden border-t border-[#101010]/10"
    >
      {/* Sideways Vertical Editorial Label */}
      <div
        ref={sidewaysRef}
        aria-hidden="true"
        className="hidden xl:flex pointer-events-none select-none absolute left-4 top-1/2 -translate-y-1/2 vertical-editorial font-editorial italic text-[5.25rem] leading-none text-[#101010]/12"
      >
        Curated Journeys
      </div>

      <div className="min-h-screen flex flex-col justify-center py-16 lg:py-12">
        {/* Section Header */}
        <div className="w-full max-w-[1320px] mx-auto px-6 sm:px-10 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <p className="font-mono text-xs tracking-[0.16em] text-[#101010]/70">
              04 / HORIZONTAL LOOKBOOK &amp; BLUEPRINTS
            </p>
            <LineRevealText
              as="h2"
              lines={['Destinations styled', 'before you depart.']}
              className="font-editorial text-4xl sm:text-5xl lg:text-[3.75rem] leading-[1.0] font-normal tracking-tight text-[#101010]"
            />
          </div>
          <p className="text-sm text-[#101010]/75 max-w-sm leading-relaxed">
            Scroll horizontally through real destination capsules and preparation blueprints—load any story straight into your live PackSmart workspace.
          </p>
        </div>

        {/* Horizontal Storytelling Track (GSAP-scrubbed on desktop, smooth touch scroll on mobile) */}
        <div
          ref={trackRef}
          className="flex gap-6 lg:gap-8 px-6 sm:px-10 lg:pl-20 overflow-x-auto lg:overflow-visible no-scrollbar will-change-transform snap-x snap-mandatory lg:snap-none"
        >
          {EDITORIAL_BLUEPRINTS.map((bp) => {
            const isDark = bp.surface === '#101010';
            return (
              <TiltCard
                key={bp.id}
                maxTilt={4}
                cursorLabel="EXPLORE"
                className="shrink-0 w-[86vw] sm:w-[460px] lg:w-[540px] snap-center"
              >
                <article
                  style={{ backgroundColor: bp.surface }}
                  className={`h-full border border-[#101010]/15 flex flex-col justify-between overflow-hidden group ${
                    isDark ? 'text-[#FFFFFF]' : 'text-[#101010]'
                  }`}
                >
                  {/* Large Editorial Photography Frame with Hover Zoom */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#101010]/10">
                    <img
                      src={bp.image}
                      alt={bp.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  </div>

                  {/* Editorial Card Copy */}
                  <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-3">
                      <div
                        className={`flex items-center justify-between gap-3 font-mono text-[11px] ${
                          isDark ? 'text-[#FFC5A8]' : 'text-[#101010]/60'
                        }`}
                      >
                        <span>{bp.chapter}</span>
                        <span>{bp.climate}</span>
                      </div>

                      <h3 className="font-editorial text-3xl sm:text-[2.15rem] leading-[1.08] font-medium">
                        {bp.title}
                      </h3>

                      <p
                        className={`text-sm leading-relaxed ${
                          isDark ? 'text-white/75' : 'text-[#101010]/75'
                        }`}
                      >
                        {bp.subtitle}
                      </p>
                    </div>

                    <div
                      className={`pt-4 border-t flex items-center justify-between gap-4 ${
                        isDark ? 'border-white/15' : 'border-[#101010]/12'
                      }`}
                    >
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          isDark ? 'text-[#B8D9F2]' : 'text-[#101010]/70'
                        }`}
                      >
                        {bp.capsuleSpec}
                      </span>

                      <MagneticButton
                        type="button"
                        onClick={() => onSelectBlueprint(bp)}
                        cursorLabel="LOAD"
                        className={`min-h-[42px] px-4 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                          isDark
                            ? 'bg-[#FFC5A8] text-[#101010] hover:bg-[#FFFFFF]'
                            : 'bg-[#101010] text-[#FFFFFF] hover:bg-[#101010]/85'
                        }`}
                      >
                        <span>{bp.actionLabel}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </MagneticButton>
                    </div>
                  </div>
                </article>
              </TiltCard>
            );
          })}
        </div>
      </div>
    </section>
  );
};
