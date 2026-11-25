import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CloudSun,
  Luggage,
  Shirt,
  Sparkles,
} from 'lucide-react';
import type { OutfitCombination, PackingList, WardrobeItem } from '../../types';
import { analyzeSuitcaseSpace, daysUntilDate } from '../../utils/packingEngine';
import { PackingCanvas } from './PackingCanvas';
import { LineRevealText, MagneticButton, prefersReducedMotion } from '../editorial/MotionPrimitives';
import { CapsuleCalculator, DepartureBoard } from './HomeExtras';
import { PackingStorySection } from '../editorial/PackingStorySection';
import {
  HorizontalGallerySection,
  type EditorialBlueprint,
} from '../editorial/HorizontalGallerySection';

gsap.registerPlugin(ScrollTrigger);

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

interface DeckModule {
  route: PlatformRoute;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  stat: string;
  cta: string;
  features: string[];
  surface: string;
  ink: string;
}

/** A big line of words that slides sideways as the page scrolls past it. */
const ScrollMarquee: React.FC<{ words: string[]; reverse?: boolean }> = ({ words, reverse }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const row = rowRef.current;
    if (!wrap || !row || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        row,
        { xPercent: reverse ? -34 : 0 },
        {
          xPercent: reverse ? 0 : -34,
          ease: 'none',
          scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        }
      );
    }, wrap);
    return () => ctx.revert();
  }, [reverse]);

  const line = [...words, ...words, ...words];
  return (
    <div ref={wrapRef} aria-hidden="true" className="relative overflow-hidden py-4 sm:py-5 select-none">
      <div
        ref={rowRef}
        className="flex w-max items-center gap-5 sm:gap-8 text-[clamp(1rem,2vw,1.6rem)] leading-none font-semibold tracking-[-0.02em] text-[#0A0A0A] will-change-transform"
      >
        {line.map((w, i) => (
          <React.Fragment key={`${w}-${i}`}>
            <span>{w}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]/40 shrink-0" />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

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

  /* ------------------------------------------------------------------ */
  /* Scene 1: hero. The suitcase is the single memorable object.         */
  /* ------------------------------------------------------------------ */
  const heroRef = useRef<HTMLElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const caseWrapRef = useRef<HTMLDivElement | null>(null);
  const parallaxRef = useRef<HTMLDivElement | null>(null);
  const captionRef = useRef<HTMLParagraphElement | null>(null);
  const suitcaseScroll = useRef(0);
  const quickX = useRef<((v: number) => void) | null>(null);
  const quickY = useRef<((v: number) => void) | null>(null);

  // Layout effect: the hero's pin must exist before the pinned sections below it measure themselves.
  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!hero || prefersReducedMotion()) return;

    if (parallaxRef.current) {
      quickX.current = gsap.quickTo(parallaxRef.current, 'x', { duration: 0.8, ease: 'power3' });
      quickY.current = gsap.quickTo(parallaxRef.current, 'y', { duration: 0.8, ease: 'power3' });
    }

    const mm = gsap.matchMedia();

    // Desktop: the hero pins and the scene transforms while you scroll through it.
    mm.add('(min-width: 1024px)', () => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: '+=120%',
          pin: true,
          scrub: 1.2,
          anticipatePin: 1,
          refreshPriority: 10,
          onUpdate: (self) => {
            suitcaseScroll.current = self.progress;
          },
        },
      });
      tl.to(headRef.current, { yPercent: -22, opacity: 0, ease: 'power2.in' }, 0.05)
        .to(caseWrapRef.current, { xPercent: -46, scale: 1.18, ease: 'power2.inOut' }, 0)
        .fromTo(captionRef.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, ease: 'power2.out' }, 0.55);
      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        suitcaseScroll.current = 0;
      };
    });

    // Phones and tablets: no pin, the suitcase simply turns as the hero leaves.
    mm.add('(max-width: 1023px)', () => {
      const st = ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          suitcaseScroll.current = self.progress;
        },
      });
      if (captionRef.current) gsap.set(captionRef.current, { opacity: 1, y: 0 });
      return () => st.kill();
    });

    const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 700);
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);

    return () => {
      window.clearTimeout(refresh);
      window.removeEventListener('load', onLoad);
      mm.revert();
    };
  }, []);

  const handleHeroMove = (e: React.PointerEvent<HTMLElement>) => {
    const hero = heroRef.current;
    if (!hero || !quickX.current || !quickY.current) return;
    const r = hero.getBoundingClientRect();
    quickX.current(((e.clientX - r.left) / r.width - 0.5) * -30);
    quickY.current(((e.clientY - r.top) / r.height - 0.5) * -18);
  };

  /* ------------------------------------------------------------------ */
  /* Scene 3: spatial deck. Browse the four tools in 3D, no scrolling.   */
  /* ------------------------------------------------------------------ */
  const modules: DeckModule[] = [
    {
      route: 'smart-packing',
      icon: Luggage,
      title: 'Smart Packing',
      description:
        'Every item sorted by category, with suitcase volume and weight tracked as you pack.',
      stat:
        activeTrip && metrics
          ? `${packedCount} of ${totalCount} packed, ${metrics.totalVolumeLiters}L used`
          : '40L carry-on optimizer',
      cta: 'Open Smart Packing',
      features: ['Suitcase volume tracking','Weight and allowance checks','Checklist by category'],
      surface: '#0B3B40',
      ink: '#FBFAF8',
    },
    {
      route: 'ai-outfit-studio',
      icon: Sparkles,
      title: 'AI Outfit Studio',
      description:
        'Upload clothes you own and get weather-ready looks that never repeat across the trip.',
      stat: `${wardrobe.length} pieces owned, ${savedOutfits.length} looks saved`,
      cta: 'Open AI Outfit Studio',
      features: ['Weather-ready looks','No repeated outfits','Built from clothes you own'],
      surface: '#FBFAF8',
      ink: '#0A0A0A',
    },
    {
      route: 'trip-planner',
      icon: Calendar,
      title: 'Trip Planner',
      description:
        'Pick a destination, pull a live forecast and follow a calm countdown to departure.',
      stat: activeTrip
        ? activeTrip.destination || activeTrip.title
        : `${lists.length} itineraries`,
      cta: 'Open Trip Planner',
      features: ['Live destination forecast','Departure countdown','Saved itineraries'],
      surface: '#0A0A0A',
      ink: '#FBFAF8',
    },
    {
      route: 'digital-wardrobe',
      icon: Shirt,
      title: 'Digital Wardrobe',
      description:
        'Catalogue your tops, bottoms, dresses, shoes and outerwear with AI tagging from a photo.',
      stat: `${wardrobe.filter((w) => w.photoId).length} items scanned from photos`,
      cta: 'Browse Wardrobe',
      features: ['AI tagging from a photo','Tops to outerwear','Search and filters'],
      surface: '#CFDCDA',
      ink: '#0A0A0A',
    },
  ];

  const [active, setActive] = useState(0);
  const [spread, setSpread] = useState(230);
  const count = modules.length;
  const go = (delta: number) => setActive((a) => (a + delta + count) % count);

  useEffect(() => {
    const onResize = () => setSpread(window.innerWidth < 640 ? 118 : window.innerWidth < 1024 ? 190 : 250);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const tiltY = useSpring(useTransform(mx, [-0.5, 0.5], [-7, 7]), { stiffness: 90, damping: 18 });
  const tiltX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 90, damping: 18 });

  const handleDeckMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleDeckLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const current = modules[active];

  // Click the front card to open its detail; any move to another card closes it.
  const [expanded, setExpanded] = useState(false);
  const dragMoved = useRef(false);
  useEffect(() => {
    setExpanded(false);
  }, [active]);

  // Light follows the pointer across a card, and the card leans toward it.
  const handleCardMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / Math.max(1, r.width);
    const py = (e.clientY - r.top) / Math.max(1, r.height);
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    el.style.setProperty('--spot', '1');
  };
  const handleCardLeave = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty('--spot', '0');
  };

  /* ------------------------------------------------------------------ */
  /* Scene 5: readiness ring counts up when it scrolls into view.        */
  /* ------------------------------------------------------------------ */
  const ringRef = useRef<SVGCircleElement | null>(null);
  const ringTextRef = useRef<HTMLSpanElement | null>(null);
  const summaryRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const section = summaryRef.current;
    const ring = ringRef.current;
    const text = ringTextRef.current;
    if (!section || !ring || !text) return;
    const circumference = 2 * Math.PI * 88;
    ring.style.strokeDasharray = `${circumference}`;

    if (prefersReducedMotion()) {
      ring.style.strokeDashoffset = `${circumference * (1 - packedPct / 100)}`;
      text.textContent = `${packedPct}`;
      return;
    }

    ring.style.strokeDashoffset = `${circumference}`;
    text.textContent = '0';
    const counter = { v: 0 };
    const ctx = gsap.context(() => {
      gsap.to(ring, {
        strokeDashoffset: circumference * (1 - packedPct / 100),
        duration: 1.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 70%', once: true },
      });
      gsap.to(counter, {
        v: packedPct,
        duration: 1.6,
        ease: 'power3.out',
        onUpdate: () => {
          text.textContent = `${Math.round(counter.v)}`;
        },
        scrollTrigger: { trigger: section, start: 'top 70%', once: true },
      });
    }, section);
    return () => ctx.revert();
  }, [packedPct]);

  /* ------------------------------------------------------------------ */
  /* Whole-page choreography: the sky shifts colour, the deck pins and    */
  /* advances with scroll, the summary columns drift at different speeds. */
  /* ------------------------------------------------------------------ */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const skyRef = useRef<HTMLDivElement | null>(null);
  const deckRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const sky = skyRef.current;
    if (!root || !sky || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
      });
      tl.to(sky, { backgroundColor: '#E2E8E5', duration: 1 })
        .to(sky, { backgroundColor: '#ECE9E3', duration: 1 })
        .to(sky, { backgroundColor: '#DCE5E2', duration: 1 })
        .to(sky, { backgroundColor: '#ECE9E3', duration: 1 });
    }, root);
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    const deck = deckRef.current;
    if (!deck || prefersReducedMotion()) return;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      const st = ScrollTrigger.create({
        trigger: deck,
        start: 'top top',
        end: '+=320%',
        pin: true,
        anticipatePin: 1,
        refreshPriority: 4.5,
        onUpdate: (self) => {
          setActive(Math.min(count - 1, Math.floor(self.progress * count)));
        },
      });
      return () => st.kill();
    });
    return () => mm.revert();
  }, [count]);

  useEffect(() => {
    const section = summaryRef.current;
    if (!section || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((el) => {
        const speed = Number(el.dataset.speed || 0);
        gsap.fromTo(
          el,
          { y: -speed * 60 },
          {
            y: speed * 60,
            ease: 'none',
            scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true },
          }
        );
      });
    }, section);
    return () => ctx.revert();
  }, []);

  const handleBlueprint = (bp: EditorialBlueprint) => {
    if (bp.kind === 'wardrobe_jump') onNavigate('ai-outfit-studio');
    else if (bp.kind === 'suitcase_jump') onNavigate('smart-packing');
    else if (bp.kind === 'vault_jump') onOpenVault();
    else onNavigate('trip-planner');
  };

  return (
    <div ref={rootRef} className="relative text-[#0A0A0A]">
      {/* One continuous sky behind every scene: dawn powder, dusk lavender, sunset peach. */}
      <div
        ref={skyRef}
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none bg-[#BCD2CF]"
        style={{ backgroundImage: 'radial-gradient(70% 55% at 75% 15%, rgba(255,255,255,0.65), rgba(255,255,255,0) 70%)' }}
      />
      <div className="relative z-10">
      {/* ==================== SCENE 1: HERO, PINNED ON DESKTOP ==================== */}
      <section
        ref={heroRef}
        onPointerMove={handleHeroMove}
        aria-label="PackSmart introduction"
        className="relative min-h-[100svh] overflow-hidden flex items-center bg-[#0B3B40] text-[#FBFAF8]"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(55% 60% at 72% 48%, rgba(251,250,248,0.10), rgba(251,250,248,0) 70%)' }}
        />
        <div className="relative w-full max-w-[1320px] mx-auto px-6 sm:px-10 pt-24 pb-20 lg:pt-20 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          <div ref={headRef} className="lg:col-span-6 relative z-10 space-y-8">
            <LineRevealText
              as="h1"
              trigger="mount"
              className="text-[clamp(2.7rem,6.6vw,6rem)] leading-[0.98] tracking-[-0.045em] text-[#FBFAF8]"
              lines={['Pack less stress.', 'Travel with', 'confidence.']}
            />
            <p className="max-w-md text-base sm:text-lg leading-relaxed text-[#FBFAF8]/75">
              Plan the trip, read the forecast, fit the suitcase and style every day from clothes you already own.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <MagneticButton
                onClick={() => onNavigate('dashboard')}
                cursorLabel="Go"
                className="h-12 px-7 rounded-full bg-[#FBFAF8] text-[#0A0A0A] text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>Open dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </MagneticButton>
              <button
                type="button"
                onClick={() => onNavigate('ai-outfit-studio')}
                className="h-12 px-7 rounded-full border border-[#FBFAF8]/35 text-sm font-medium text-[#FBFAF8] hover:bg-[#FBFAF8]/10 transition-colors whitespace-nowrap"
              >
                Try AI Outfit Studio
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div ref={caseWrapRef} className="will-change-transform">
              <div ref={parallaxRef} className="h-[46vh] sm:h-[54vh] lg:h-[72vh]">
                <PackingCanvas scrollProgressRef={suitcaseScroll} />
              </div>
            </div>
            <p
              ref={captionRef}
              className="absolute left-0 right-0 bottom-0 text-center text-sm text-[#FBFAF8]/75 lg:opacity-0"
            >
              Open it up and everything has its place.
            </p>
          </div>
        </div>

        <span aria-hidden="true" className="hidden lg:block absolute left-1/2 bottom-6 w-px h-10 bg-[#FBFAF8]/20 overflow-hidden">
          <span className="block w-full h-full bg-[#FBFAF8] ps-scroll-cue" />
        </span>
      </section>

      <ScrollMarquee words={['Plan', 'Pack', 'Style', 'Go']} />

      {/* ==================== SCENE 2: PACKING STORY, PINNED ==================== */}
      <PackingStorySection onOpenSuitcaseOptimizer={() => onNavigate('smart-packing')} />

      {/* ==================== SCENE 3: SPATIAL DECK ==================== */}
      <section
        ref={deckRef}
        aria-label="Browse the four PackSmart tools"
        className="relative text-[#0A0A0A] min-h-screen flex items-center overflow-hidden"
      >
        <div className="w-full max-w-[1320px] mx-auto px-6 sm:px-10 py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
          <div className="lg:col-span-5 space-y-7 relative z-10">
            <LineRevealText
              as="h2"
              className="font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.02] tracking-[-0.04em]"
              lines={['Four tools.', 'One calm trip.']}
            />
            <div className="min-h-[188px]" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.route}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  <h3 className="font-serif text-3xl">{current.title}</h3>
                  <p className="max-w-md text-base leading-relaxed text-[#0A0A0A]/75">
                    {current.description}
                  </p>
                  <p className="text-sm font-medium tabular-nums">{current.stat}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate(current.route)}
                    className="h-11 px-6 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#0A0A0A]/85 transition-colors"
                  >
                    <span>{current.cta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="hidden lg:block text-sm text-[#0A0A0A]/70">Scroll to move through the tools, or drag the cards.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous tool"
                className="w-11 h-11 rounded-full border border-[#0A0A0A]/30 flex items-center justify-center hover:bg-[#FBFAF8]/60 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next tool"
                className="w-11 h-11 rounded-full border border-[#0A0A0A]/30 flex items-center justify-center hover:bg-[#FBFAF8]/60 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 pl-2">
                {modules.map((m, i) => (
                  <button
                    key={m.route}
                    type="button"
                    aria-label={`Show ${m.title}`}
                    aria-current={i === active}
                    onClick={() => setActive(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === active ? 'w-8 bg-[#0B3B40]' : 'w-2 bg-[#0A0A0A]/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            className="lg:col-span-7 ps-stage"
            onPointerMove={handleDeckMove}
            onPointerLeave={handleDeckLeave}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') go(1);
              if (e.key === 'ArrowLeft') go(-1);
            }}
          >
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              dragSnapToOrigin
              onDragStart={() => {
                dragMoved.current = true;
              }}
              onDragEnd={(_, info) => {
                window.setTimeout(() => {
                  dragMoved.current = false;
                }, 60);
                if (info.offset.x < -50) go(1);
                else if (info.offset.x > 50) go(-1);
              }}
              style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}
              className="grid place-items-center h-[400px] sm:h-[480px] touch-pan-y cursor-grab active:cursor-grabbing"
            >
              {modules.map((m, i) => {
                let off = i - active;
                if (off > count / 2) off -= count;
                if (off < -count / 2) off += count;
                const abs = Math.abs(off);
                const Icon = m.icon;
                return (
                  <motion.div
                    key={m.route}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      off === 0
                        ? `${m.title}, selected. ${expanded ? 'Press to close details' : 'Press to open details'}`
                        : `Show ${m.title}`
                    }
                    aria-expanded={off === 0 ? expanded : undefined}
                    onClick={() => {
                      if (dragMoved.current) return;
                      if (off === 0) setExpanded((v) => !v);
                      else setActive(i);
                    }}
                    onPointerMove={handleCardMove}
                    onPointerLeave={handleCardLeave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (off === 0) setExpanded((v) => !v);
                        else setActive(i);
                      } else if (e.key === 'Escape' && expanded) {
                        setExpanded(false);
                      }
                    }}
                    animate={{
                      x: off * spread,
                      z: -abs * 170,
                      rotateY: off * -24,
                      scale: off === 0 ? 1 : 0.88,
                      opacity: abs > 1 ? 0.3 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 130, damping: 20, mass: 0.9 }}
                    style={{
                      zIndex: 10 - abs,
                      backgroundColor: m.surface,
                      color: m.ink,
                      gridArea: '1 / 1',
                    }}
                    className="ps-card relative overflow-hidden w-[min(72vw,330px)] h-[360px] sm:h-[430px] rounded-[28px] p-7 flex flex-col justify-between gap-6 border border-[#0A0A0A]/15 outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                      style={{
                        opacity: 'var(--spot, 0)',
                        backgroundImage: `radial-gradient(260px circle at var(--mx, 50%) var(--my, 40%), ${
                          m.ink === '#FBFAF8' ? 'rgba(251,250,248,0.20)' : 'rgba(11,59,64,0.14)'
                        }, rgba(0,0,0,0) 65%)`,
                      }}
                    />
                    <Icon className="w-7 h-7" />
                    <ul className="space-y-2.5 text-sm font-medium">
                      {m.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="space-y-3">
                      <h3 className="font-serif text-[2.1rem] leading-[1.02]">{m.title}</h3>
                      <p className="text-sm tabular-nums" style={{ opacity: 0.75 }}>
                        {m.stat}
                      </p>
                      {off === 0 && (
                        <p className="text-xs font-semibold" style={{ opacity: 0.7 }}>
                          {expanded ? 'Press to close' : 'Press for details'}
                        </p>
                      )}
                    </div>
                    <AnimatePresence>
                      {off === 0 && expanded && (
                        <motion.div
                          key="detail"
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 24 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute inset-0 p-7 flex flex-col justify-between gap-4"
                          style={{ backgroundColor: m.surface, color: m.ink }}
                        >
                          <div className="space-y-3">
                            <h3 className="font-serif text-[1.8rem] leading-[1.05]">{m.title}</h3>
                            <p className="text-sm leading-relaxed" style={{ opacity: 0.85 }}>
                              {m.description}
                            </p>
                            <ul className="space-y-1.5 text-sm font-medium">
                              {m.features.map((f) => (
                                <li key={f} className="flex items-center gap-2.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                            <p className="text-sm font-semibold tabular-nums">{m.stat}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate(m.route);
                            }}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-11 px-6 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 self-start border"
                            style={{
                              backgroundColor: m.ink,
                              color: m.surface,
                              borderColor: m.ink,
                            }}
                          >
                            <span>{m.cta}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ==================== SCENE 4: HORIZONTAL JOURNEYS, PINNED ==================== */}
      <HorizontalGallerySection onSelectBlueprint={handleBlueprint} />

      <ScrollMarquee words={['Forecast', 'Fit', 'Outfits', 'Documents']} reverse />

      {/* ==================== SCENE 5: DEPARTURE BOARD AND CAPSULE CALCULATOR ==================== */}
      <DepartureBoard lists={lists} onNavigate={onNavigate} />
      <CapsuleCalculator onOpenSmartPacking={() => onNavigate('smart-packing')} />

      {/* ==================== SCENE 6: LIVE JOURNEY ==================== */}
      <section ref={summaryRef} className="relative py-24 sm:py-32 overflow-hidden">
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div data-speed="0.5" className="lg:col-span-7 space-y-7">
            <LineRevealText
              as="h2"
              className="font-serif text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.02] tracking-[-0.04em]"
              lines={
                activeTrip
                  ? [activeTrip.title]
                  : ['Ready for your', 'next journey']
              }
            />
            <p className="max-w-xl text-base leading-relaxed text-[#0A0A0A]/75">
              {activeTrip
                ? `${activeTrip.destination || activeTrip.tripType}, ${activeTrip.startDate} to ${activeTrip.endDate}. Check the live weather, finish the timeline or zip the suitcase.`
                : 'Create your first itinerary to generate a packing list, a live forecast and wardrobe combinations.'}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <MagneticButton
                onClick={() => onNavigate('dashboard')}
                cursorLabel="Go"
                className="h-12 px-7 rounded-full bg-[#0B3B40] text-[#FBFAF8] text-sm font-medium whitespace-nowrap"
              >
                Go to dashboard
              </MagneticButton>
              <button
                type="button"
                onClick={() => onNavigate('trip-planner')}
                className="h-12 px-7 rounded-full border border-[#0A0A0A]/30 text-sm font-medium hover:bg-[#D5DCD9]/50 transition-colors whitespace-nowrap"
              >
                Plan a new trip
              </button>
            </div>
          </div>

          <div data-speed="-0.5" className="lg:col-span-5 flex flex-col items-center gap-6">
            <div className="relative w-[220px] h-[220px] sm:w-[260px] sm:h-[260px]">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90" role="img" aria-label={`Packing readiness ${packedPct} percent`}>
                <circle cx="100" cy="100" r="88" fill="none" stroke="#0B3B40" strokeOpacity="0.14" strokeWidth="10" />
                <circle
                  ref={ringRef}
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="#0B3B40"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif text-6xl tabular-nums">
                  <span ref={ringTextRef} />
                  <span className="text-3xl">%</span>
                </span>
                <span className="text-sm text-[#0A0A0A]/65">packed</span>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-center tabular-nums">
              <div>
                <dt className="text-xs text-[#0A0A0A]/60">Departure</dt>
                <dd className="text-sm font-semibold mt-0.5">
                  {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days` : 'Ready'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#0A0A0A]/60">Suitcase</dt>
                <dd className="text-sm font-semibold mt-0.5">
                  {metrics ? `${metrics.totalVolumeLiters}L / ${metrics.capacityLiters}L` : '40L'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#0A0A0A]/60">Forecast</dt>
                <dd className="text-sm font-semibold mt-0.5 inline-flex items-center gap-1">
                  <CloudSun className="w-3.5 h-3.5" />
                  <span>{activeTrip?.weather ? `${activeTrip.weather.summary.avgHigh}°C` : 'Live API'}</span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="relative bg-[#0A0A0A] text-[#FBFAF8]">
        <div className="max-w-[1320px] mx-auto px-6 sm:px-10 py-12 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div className="space-y-1">
            <p className="font-serif text-4xl">PackSmart</p>
            <p className="text-sm text-[#FBFAF8]/70">Pack less stress. Travel with confidence.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {(
              [
                ['dashboard', 'Dashboard'],
                ['trip-planner', 'Trip Planner'],
                ['smart-packing', 'Smart Packing'],
                ['ai-outfit-studio', 'AI Outfit Studio'],
                ['digital-wardrobe', 'Digital Wardrobe'],
              ] as Array<[PlatformRoute, string]>
            ).map(([route, label]) => (
              <button
                key={route}
                type="button"
                onClick={() => onNavigate(route)}
                className="text-[#FBFAF8]/75 hover:text-[#FBFAF8] underline-offset-4 hover:underline transition-colors"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenVault}
              className="text-[#FBFAF8]/75 hover:text-[#FBFAF8] underline-offset-4 hover:underline transition-colors"
            >
              Document Vault
            </button>
          </nav>
        </div>
      </footer>
      </div>
    </div>
  );
};
