import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0A0A0A]/55 backdrop-blur-xs"
          />

          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-[#FBFAF80f] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#0A0A0A1f] dark:border-[#FBFAF824] overflow-hidden"
          >
            {/* Mobile drag handle */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-[#0A0A0A14] dark:bg-[#FBFAF80f]" />
            </div>

            <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-4 border-b border-[#0A0A0A1f] dark:border-[#FBFAF824]">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#0A0A0A] dark:text-[#FBFAF8] truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-[#0A0A0Ab2] dark:text-[#FBFAF8a8] mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-full text-[#0A0A0Ab2] hover:text-[#0A0A0A] dark:text-[#FBFAF8a8] dark:hover:text-white hover:bg-[#FBFAF8] dark:hover:bg-[#FBFAF80f] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>

            {footer && (
              <div className="px-5 py-3.5 pb-safe border-t border-[#0A0A0A1f] dark:border-[#FBFAF824] bg-[#FBFAF8] dark:bg-[#0B3B40]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
