import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ==================== 1. LINE-BY-LINE SPLIT-MASK TEXT REVEAL ====================
interface LineRevealTextProps {
  lines: Array<string | React.ReactNode>;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
  className?: string;
  lineClassName?: string;
  trigger?: 'mount' | 'scroll';
  delay?: number;
  stagger?: number;
}

export const LineRevealText: React.FC<LineRevealTextProps> = ({
  lines,
  as: Tag = 'h2',
  className = '',
  lineClassName = '',
  trigger = 'scroll',
  delay = 0.08,
  stagger = 0.11,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const innerLines = el.querySelectorAll<HTMLElement>('[data-reveal-line]');
      if (innerLines.length === 0) return;

      gsap.set(innerLines, {
        yPercent: 112,
        opacity: 0,
        clipPath: 'inset(0% 0% 100% 0%)',
      });

      const animVars: gsap.TweenVars = {
        yPercent: 0,
        opacity: 1,
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.95,
        ease: 'power4.out',
        stagger,
        delay: trigger === 'mount' ? delay : 0,
      };

      if (trigger === 'scroll') {
        animVars.scrollTrigger = {
          trigger: el,
          start: 'top 84%',
          once: true,
        };
      }

      gsap.to(innerLines, animVars);
    }, el);

    return () => ctx.revert();
  }, [trigger, delay, stagger]);

  return (
    <div ref={containerRef}>
      <Tag className={className}>
        {lines.map((line, idx) => (
          <span key={idx} className="line-mask pb-[0.06em]">
            <span data-reveal-line className={`block will-change-transform ${lineClassName}`}>
              {line}
            </span>
          </span>
        ))}
      </Tag>
    </div>
  );
};

// ==================== 2. MAGNETIC BUTTON ====================
interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  strength?: number;
  cursorLabel?: string;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = '',
  strength = 0.24,
  cursorLabel,
  onMouseMove,
  onMouseLeave,
  ...rest
}) => {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    onMouseMove?.(e);
    if (prefersReducedMotion() || !btnRef.current) return;
    if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
    setOffset({
      x: Math.max(-12, Math.min(12, dx)),
      y: Math.max(-8, Math.min(8, dy)),
    });
  };

  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    onMouseLeave?.(e);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <button
      ref={btnRef}
      data-cursor={cursorLabel || 'OPEN'}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition:
          offset.x === 0 && offset.y === 0
            ? 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={className}
      {...rest}
    >
      {children}
    </button>
  );
};

// ==================== 3. SUBTLE 3D TILT CARD ====================
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  cursorLabel?: string;
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  maxTilt = 5,
  cursorLabel,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, active: false });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion() || !ref.current) return;
    if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: -py * maxTilt * 2,
      ry: px * maxTilt * 2,
      active: true,
    });
  };

  const handleLeave = () => {
    setTilt({ rx: 0, ry: 0, active: false });
  };

  return (
    <div
      ref={ref}
      data-cursor={cursorLabel}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: tilt.active
          ? 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)'
          : 'transform 480ms cubic-bezier(0.16, 1, 0.3, 1)',
        transformStyle: 'preserve-3d',
      }}
      className={className}
    >
      {children}
    </div>
  );
};

// ==================== 4. EDITORIAL CUSTOM CURSOR (DESKTOP FINE POINTER ONLY) ====================
export const EditorialCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const [label, setLabel] = useState<string>('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (prefersReducedMotion()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const el = cursorRef.current;
    if (!el) return;

    let mouseX = -100;
    let mouseY = -100;
    let curX = -100;
    let curY = -100;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setVisible(true);
      const target = (e.target as HTMLElement | null)?.closest?.('[data-cursor]');
      const nextLabel = target?.getAttribute('data-cursor') || '';
      setLabel(nextLabel);
    };

    const onLeave = () => setVisible(false);

    const tick = () => {
      curX += (mouseX - curX) * 0.22;
      curY += (mouseY - curY) * 0.22;
      el.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  if (typeof window !== 'undefined' && prefersReducedMotion()) return null;

  return (
    <div
      ref={cursorRef}
      aria-hidden="true"
      className={`pointer-events-none fixed top-0 left-0 z-[80] hidden lg:flex items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`rounded-full flex items-center justify-center transition-all duration-200 border ${
          label
            ? 'w-14 h-14 bg-[#101010] border-[#FFC5A8] text-[#FFFFFF]'
            : 'w-3 h-3 bg-[#101010]/70 border-[#FFFFFF]/80'
        }`}
      >
        {label && (
          <span className="font-mono text-[9px] font-semibold tracking-[0.14em] uppercase">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};
