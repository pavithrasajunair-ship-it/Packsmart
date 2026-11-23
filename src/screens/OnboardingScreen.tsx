import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Luggage, ShieldCheck, Shirt } from 'lucide-react';
import { ASSETS } from '../data/templates';
import { SafeImage } from '../components/ui/SafeImage';
import { BrandLogo } from '../components/ui/BrandLogo';

interface OnboardingScreenProps {
  onFinish: () => void;
}

const SLIDES = [
  {
    title: 'Plan outfits & pack lighter with confidence',
    description:
      'Build a digital capsule wardrobe, mix day-by-day trip outfits for real weather, and reuse versatile pieces to slash suitcase bulk.',
    image: ASSETS.wardrobe,
    alt: 'Neatly styled capsule travel wardrobe illustration',
    icon: Shirt,
    highlight: 'Intelligent Outfit Planner & Wardrobe Studio',
  },
  {
    title: 'Visual suitcase fit, smart timeline & home safety',
    description:
      'See exactly how your items fill your luggage, follow a calm countdown timeline from 1 week out to arrival, and run Before You Leave Mode.',
    image: ASSETS.suitcase,
    alt: 'Organized suitcase space optimizer illustration',
    icon: Luggage,
    highlight: 'Smart Suitcase Space Optimizer · Before You Leave Mode',
  },
  {
    title: 'Encrypted documents, group packing & trip memory',
    description:
      'Track passport & visa expiry alerts privately on your device, coordinate who carries what without duplicates, and learn from every trip.',
    image: ASSETS.vault,
    alt: 'Secure passport and travel document radar illustration',
    icon: ShieldCheck,
    highlight: 'Document Expiry Radar · Group Packing · Post-Trip Memory',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const current = SLIDES[step];
  const Icon = current.icon;

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FBFAF8] dark:bg-[#0B3B40] text-[#0A0A0A] dark:text-[#FBFAF8]">
      {/* Compact Top Bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={34} />
          <span className="font-display font-bold text-lg tracking-tight">PackSmart</span>
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="min-h-[44px] px-3 text-sm font-medium text-[#0A0A0Ab2] hover:text-[#0A0A0A] dark:text-[#FBFAF8a8] dark:hover:text-white transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center px-5 py-4 max-w-3xl w-full mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center"
          >
            <div className="rounded-3xl overflow-hidden bg-white dark:bg-[#FBFAF80f] border border-[#0A0A0A1f] dark:border-[#FBFAF824] shadow-sm aspect-[4/3]">
              <SafeImage
                src={current.image}
                alt={current.alt}
                className="w-full h-full object-cover"
                fallbackLabel="PackSmart"
              />
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0A0A0A] dark:text-[#D5DCD9]">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{current.highlight}</span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-[#0A0A0A] dark:text-white">
                {current.title}
              </h1>

              <p className="text-[15px] leading-relaxed text-[#0A0A0Acc] dark:text-[#FBFAF8a8]">
                {current.description}
              </p>

              <div className="pt-1 flex items-center gap-2 text-xs text-[#0A0A0A] dark:text-[#FBFAF8] font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Works offline anytime · Private encrypted vault</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Thumb-Zone Controls */}
      <div className="px-5 pt-4 pb-8 pb-safe max-w-3xl w-full mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2" role="tablist" aria-label="Onboarding steps">
            {SLIDES.map((s, idx) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setStep(idx)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  idx === step
                    ? 'w-7 bg-[#0B3B40] dark:bg-[#D5DCD9]'
                    : 'w-2 bg-[#0A0A0A14] dark:bg-[#FBFAF80f]'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="min-h-[48px] px-6 rounded-2xl bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A] text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-[#0A0A0A]/15 active:scale-[0.98] transition-transform whitespace-nowrap shrink-0"
          >
            <span>{step === SLIDES.length - 1 ? 'Get Started' : 'Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
