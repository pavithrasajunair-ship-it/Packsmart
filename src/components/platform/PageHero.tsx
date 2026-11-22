import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Counter } from './HomeExtras';
import { Suitcase3DCanvas, type SuitcaseFinish } from '../editorial/Suitcase3DCanvas';

export interface HeroStat {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
}

const TILE_COLOURS = ['#FFFFFF', '#FFFFFF', '#FFFFFF'];

/**
 * A big colour-blocked banner at the top of each workspace page: a punchy line,
 * three live numbers that count up, and a visual that tilts toward the pointer.
 */
export const PageHero: React.FC<{
  surface: string;
  tagline: string;
  stats: HeroStat[];
  children: React.ReactNode;
}> = ({ surface, tagline, stats, children }) => {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 90, damping: 16 });
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 90, damping: 16 });

  return (
    <div
      className="relative rounded-[2rem] overflow-hidden p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      style={{ backgroundColor: surface }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <div className="lg:col-span-7 space-y-7 relative z-10">
        <h2 className="text-3xl sm:text-5xl font-bold leading-[1.04] tracking-[-0.045em] text-[#101010] max-w-xl">
          {tagline}
        </h2>
        <dl className="grid grid-cols-3 gap-3">
          {stats.slice(0, 3).map((st, i) => (
            <div key={st.label} className="rounded-2xl p-4" style={{ backgroundColor: TILE_COLOURS[i] }}>
              <dd className="text-3xl sm:text-4xl font-bold tracking-[-0.04em] tabular-nums text-[#101010]">
                <Counter value={st.value} decimals={st.decimals} />
                {st.suffix && <span className="text-base font-semibold">{st.suffix}</span>}
              </dd>
              <dt className="text-xs sm:text-sm font-medium text-[#101010]/70 mt-0.5">{st.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="lg:col-span-5 relative" style={{ perspective: 1000 }}>
        <motion.div
          style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }}
          className="relative h-[240px] sm:h-[300px]"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
};

/** The 3D suitcase, turning slowly with the page scroll. */
export const SuitcaseVisual: React.FC<{ finish?: SuitcaseFinish }> = ({ finish = 'noir' }) => {
  const progress = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      progress.current = (window.scrollY / Math.max(1, window.innerHeight)) % 1;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <Suitcase3DCanvas finish={finish} scrollProgressRef={progress} />;
};

/** Three destination photos fanned out; hover opens the fan. */
export const PhotoFan: React.FC<{ images: string[] }> = ({ images }) => {
  const spread = [-14, 0, 14];
  const shift = [-70, 0, 70];
  return (
    <motion.div initial="rest" whileHover="open" animate="rest" className="absolute inset-0 flex items-center justify-center">
      {images.slice(0, 3).map((src, i) => (
        <motion.img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          variants={{
            rest: { rotate: spread[i] * 0.6, x: shift[i] * 0.45, y: i === 1 ? -8 : 6 },
            open: { rotate: spread[i], x: shift[i], y: i === 1 ? -18 : 10 },
          }}
          transition={{ type: 'spring', stiffness: 160, damping: 18 }}
          className="absolute w-[46%] aspect-[3/4] object-cover rounded-2xl border-4 border-[#FFFFFF] shadow-[0_20px_40px_-20px_rgba(16,16,16,0.5)]"
          style={{ zIndex: i === 1 ? 3 : 2 }}
        />
      ))}
    </motion.div>
  );
};

/** Floating colour dots: the real colours of the clothes in the wardrobe. */
export const SwatchCloud: React.FC<{ colours: string[] }> = ({ colours }) => {
  const list = colours.length > 0 ? colours.slice(0, 16) : ['#B8D9F2', '#D9C9F2', '#FFC5A8', '#FFFFFF', '#101010'];
  return (
    <div className="absolute inset-0">
      {list.map((c, i) => {
        const size = 44 + ((i * 29) % 56);
        const left = ((i * 37) % 82) + 2;
        const top = ((i * 53) % 74) + 2;
        return (
          <motion.span
            key={`${c}-${i}`}
            className="absolute rounded-full border-2 border-[#FFFFFF]/80 shadow-[0_14px_30px_-16px_rgba(16,16,16,0.5)]"
            style={{ width: size, height: size, left: `${left}%`, top: `${top}%`, backgroundColor: c }}
            animate={{ y: [0, i % 2 ? -16 : 16, 0] }}
            transition={{ duration: 4 + (i % 5), repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
            whileHover={{ scale: 1.25 }}
          />
        );
      })}
    </div>
  );
};

/** A big ring that fills to the packed percentage. */
export const ProgressVisual: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 88;
  const c = 2 * Math.PI * r;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-[240px] h-[240px]">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90" role="img" aria-label={`${pct} percent packed`}>
          <circle cx="100" cy="100" r={r} fill="none" stroke="#FFFFFF" strokeWidth="14" />
          <motion.circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="#101010"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - pct / 100) }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-6xl font-bold tracking-[-0.05em] tabular-nums">
            <Counter value={pct} />
            <span className="text-3xl">%</span>
          </span>
          <span className="text-sm font-medium text-[#101010]/70">packed</span>
        </div>
      </div>
    </div>
  );
};
