import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import type { PackingList } from '../../types';
import { daysUntilDate } from '../../utils/packingEngine';
import { LineRevealText, prefersReducedMotion } from '../editorial/MotionPrimitives';
import type { PlatformRoute } from './HomePage';

gsap.registerPlugin(ScrollTrigger);

/* ====================================================================== */
/* Departure board: your real trips on a split-flap display                 */
/* ====================================================================== */

const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function pad(text: string, length: number): string[] {
  return text.toUpperCase().slice(0, length).padEnd(length, ' ').split('');
}

const FlapCells: React.FC<{ text: string; length: number }> = ({ text, length }) => (
  <span className="inline-flex gap-[3px]" aria-label={text}>
    {pad(text, length).map((ch, i) => (
      <span
        key={i}
        data-flap={ch}
        aria-hidden="true"
        className="inline-flex items-center justify-center w-[0.78em] h-[1.25em] rounded-[3px] bg-[#FFFFFF]/10 text-[#FFFFFF] font-semibold tabular-nums"
      >
        {ch === ' ' ? ' ' : ch}
      </span>
    ))}
  </span>
);

interface BoardRow {
  id: string;
  destination: string;
  date: string;
  status: string;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

export const DepartureBoard: React.FC<{
  lists: PackingList[];
  onNavigate: (route: PlatformRoute) => void;
}> = ({ lists, onNavigate }) => {
  const boardRef = useRef<HTMLDivElement | null>(null);

  const rows: BoardRow[] = useMemo(
    () =>
      [...lists]
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5)
        .map((l) => {
          const total = l.items.length;
          const packed = l.items.filter((i) => i.packed).length;
          const left = daysUntilDate(l.startDate);
          let status = 'PACKING';
          if (l.completed) status = 'LANDED';
          else if (total > 0 && packed === total) status = 'BOARDING';
          else if (left < 0) status = 'DEPARTED';
          return {
            id: l.id,
            destination: l.destination || l.title,
            date: shortDate(l.startDate),
            status,
          };
        }),
    [lists]
  );

  // Cells start blank, then every flap cycles through letters and lands on its character.
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board || prefersReducedMotion()) return;
    const cells: HTMLElement[] = Array.from(board.querySelectorAll<HTMLElement>('[data-flap]'));
    cells.forEach((el) => {
      el.textContent = ' ';
    });
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: board,
        start: 'top 80%',
        once: true,
        onEnter: () => {
          cells.forEach((el, i) => {
            const target = el.dataset.flap || ' ';
            const state = { v: 0 };
            gsap.to(state, {
              v: 1,
              duration: 0.7 + Math.random() * 0.9,
              delay: (i % 26) * 0.03,
              ease: 'steps(9)',
              onUpdate: () => {
                el.textContent = state.v >= 1 ? (target === ' ' ? ' ' : target) : FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
              },
              onComplete: () => {
                el.textContent = target === ' ' ? ' ' : target;
              },
            });
          });
        },
      });
    }, board);
    return () => {
      ctx.revert();
      cells.forEach((el) => {
        const t = el.dataset.flap || ' ';
        el.textContent = t === ' ' ? ' ' : t;
      });
    };
  }, [rows]);

  return (
    <section aria-label="Departures" className="py-16 sm:py-24">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 space-y-8">
        <LineRevealText
          as="h2"
          className="text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.04] tracking-[-0.04em] text-[#101010]"
          lines={['Your trips,', 'on the departure board.']}
        />
        <div ref={boardRef} className="rounded-3xl bg-[#101010] text-[#FFFFFF] p-5 sm:p-8 shadow-[0_30px_80px_-40px_rgba(16,16,16,0.6)]">
          <div className="flex items-center justify-between pb-4 mb-3 border-b border-[#FFFFFF]/15 text-sm text-[#FFFFFF]/70">
            <span>Destination</span>
            <span className="hidden sm:inline">Departs</span>
            <span>Status</span>
          </div>

          {rows.length === 0 ? (
            <div className="py-10 text-center space-y-4">
              <p className="text-lg font-semibold">No flights yet</p>
              <button
                type="button"
                onClick={() => onNavigate('trip-planner')}
                className="h-11 px-6 rounded-full bg-[#FFC5A8] text-[#101010] text-sm font-semibold"
              >
                Plan your first trip
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#FFFFFF]/10 text-[clamp(0.8rem,2.5vw,1.45rem)]">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('trip-planner')}
                    className="w-full flex items-center justify-between gap-3 py-3.5 text-left hover:bg-[#FFFFFF]/[0.04] transition-colors rounded-lg px-1"
                    aria-label={`${r.destination}, ${r.status.toLowerCase()}. Open Trip Planner`}
                  >
                    <FlapCells text={r.destination} length={10} />
                    <span className="hidden sm:inline-flex">
                      <FlapCells text={r.date} length={6} />
                    </span>
                    <span className={r.status === 'BOARDING' ? 'text-[#FFC5A8]' : 'text-[#B8D9F2]'}>
                      <FlapCells text={r.status} length={8} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

/* ====================================================================== */
/* Capsule calculator: how much to pack for this trip, live                 */
/* ====================================================================== */

type Climate = 'cool' | 'mild' | 'warm';

const CLIMATES: Array<{ id: Climate; label: string }> = [
  { id: 'cool', label: 'Cool' },
  { id: 'mild', label: 'Mild' },
  { id: 'warm', label: 'Warm' },
];

const CARRY_ON_LITRES = 40;

interface CapsuleLine {
  key: string;
  label: string;
  count: number;
  litres: number;
}

function buildCapsule(days: number, climate: Climate, laundry: boolean): CapsuleLine[] {
  // With laundry (or on long trips) you re-wear and wash, so outfits stop growing past a week.
  const cycle = laundry || days > 8 ? Math.min(days, 6) : days;
  const tops = Math.max(2, cycle);
  const bottoms = Math.max(1, Math.ceil(cycle / 2.5)) + (climate === 'cool' ? 1 : 0);
  const layers = climate === 'cool' ? 3 : climate === 'mild' ? 2 : 1;
  const shoes = days > 9 ? 3 : 2;
  const essentials = Math.min(days, 7) + 1;
  return [
    { key: 'tops', label: 'Tops', count: tops, litres: tops * 0.8 },
    { key: 'bottoms', label: 'Bottoms', count: bottoms, litres: bottoms * 1.5 },
    { key: 'layers', label: 'Layers', count: layers, litres: layers * 2.0 },
    { key: 'shoes', label: 'Shoes', count: shoes, litres: shoes * 2.6 },
    { key: 'essentials', label: 'Underwear and socks', count: essentials * 2, litres: essentials * 2 * 0.12 },
    { key: 'kit', label: 'Toiletries and tech', count: 2, litres: 4.5 },
  ];
}

export const Counter: React.FC<{ value: number; decimals?: number; className?: string }> = ({
  value,
  decimals = 0,
  className,
}) => {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
};

export const CapsuleCalculator: React.FC<{ onOpenSmartPacking: () => void }> = ({
  onOpenSmartPacking,
}) => {
  const [days, setDays] = useState(5);
  const [climate, setClimate] = useState<Climate>('mild');
  const [laundry, setLaundry] = useState(false);

  const lines = useMemo(() => buildCapsule(days, climate, laundry), [days, climate, laundry]);
  const litres = lines.reduce((sum, l) => sum + l.litres, 0);
  const pct = Math.min(100, (litres / CARRY_ON_LITRES) * 100);
  const over = litres > CARRY_ON_LITRES;

  return (
    <section aria-label="Capsule calculator" className="py-16 sm:py-24">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-5 space-y-8">
          <LineRevealText
            as="h2"
            className="text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.04] tracking-[-0.04em] text-[#101010]"
            lines={['How much', 'do you really need?']}
          />

          <div className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="trip-days" className="flex items-baseline justify-between text-sm font-medium">
                <span>Trip length</span>
                <span className="text-2xl font-bold tabular-nums">
                  <Counter value={days} /> <span className="text-sm font-medium">days</span>
                </span>
              </label>
              <input
                id="trip-days"
                type="range"
                min={2}
                max={21}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full accent-[#101010]"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Weather</p>
              <div role="radiogroup" aria-label="Weather" className="flex gap-2">
                {CLIMATES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={climate === c.id}
                    onClick={() => setClimate(c.id)}
                    className={`h-10 px-5 rounded-full text-sm font-medium transition-colors ${
                      climate === c.id
                        ? 'bg-[#101010] text-[#FFFFFF]'
                        : 'bg-[#FFFFFF]/70 text-[#101010] hover:bg-[#FFFFFF]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={laundry}
              onClick={() => setLaundry((v) => !v)}
              className="flex items-center gap-3 text-sm font-medium"
            >
              <span
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  laundry ? 'bg-[#101010]' : 'bg-[#101010]/25'
                }`}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  className={`absolute top-1 w-4 h-4 rounded-full bg-[#FFFFFF] ${laundry ? 'right-1' : 'left-1'}`}
                />
              </span>
              <span>I can do laundry on the trip</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-3xl bg-[#FFFFFF]/70 p-6 sm:p-8 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-[#101010]/70">Carry-on space used</p>
                <p className="text-4xl sm:text-5xl font-bold tracking-[-0.04em] tabular-nums">
                  <Counter value={litres} decimals={1} />
                  <span className="text-lg font-medium text-[#101010]/70"> / {CARRY_ON_LITRES} L</span>
                </p>
              </div>
              <p className={`text-sm font-semibold ${over ? 'text-[#101010]' : 'text-[#101010]/70'}`} aria-live="polite">
                {over ? `Over by ${(litres - CARRY_ON_LITRES).toFixed(1)} L: try laundry` : 'Fits a carry-on'}
              </p>
            </div>

            <div className="h-3 rounded-full bg-[#101010]/10 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${over ? 'bg-[#FFC5A8]' : 'bg-[#101010]'}`}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>

            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {lines.map((l, i) => (
                <li
                  key={l.key}
                  className="rounded-2xl p-4 space-y-1"
                  style={{ backgroundColor: ['#B8D9F2', '#D9C9F2', '#FFC5A8'][i % 3] }}
                >
                  <p className="text-3xl font-bold tabular-nums tracking-[-0.03em]">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={l.count}
                        initial={{ y: 14, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -14, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="inline-block"
                      >
                        {l.count}
                      </motion.span>
                    </AnimatePresence>
                  </p>
                  <p className="text-sm font-medium leading-snug">{l.label}</p>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onOpenSmartPacking}
            className="h-12 px-7 rounded-full bg-[#101010] text-[#FFFFFF] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#101010]/85 transition-colors"
          >
            <span>Build this list in Smart Packing</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
