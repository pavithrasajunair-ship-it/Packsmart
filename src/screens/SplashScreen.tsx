import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { BrandLogo } from '../components/ui/BrandLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 1450);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onComplete();
      }}
      aria-label="Skip splash screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#111834] text-white px-6 cursor-pointer select-none"
    >
      <motion.div
        initial={{ scale: 0.82, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center"
      >
        <div className="p-3 rounded-3xl bg-white/8 border border-white/12 shadow-2xl mb-6">
          <BrandLogo size={76} />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          PackSmart
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 0.85, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
          className="mt-2.5 text-sm sm:text-base text-[#D1C9FF] max-w-xs"
        >
          Pack less stress. Travel with confidence.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.35 }}
        className="absolute bottom-12 w-36 h-1 rounded-full bg-white/15 overflow-hidden"
      >
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '0%' }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          className="h-full w-full bg-[#34D399] rounded-full"
        />
      </motion.div>
    </div>
  );
};
