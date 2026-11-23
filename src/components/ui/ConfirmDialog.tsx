import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
  onCancel,
}) => {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title}>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="w-10 h-10 rounded-2xl bg-[#E6DFD266] dark:bg-[#FBFAF80f] text-[#0A0A0A] dark:text-[#E6DFD2] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <p className="text-sm text-[#0A0A0Acc] dark:text-[#FBFAF8a8] leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[46px] rounded-2xl bg-[#FBFAF8] dark:bg-[#0B3B40] border border-[#0A0A0A1f] dark:border-[#FBFAF824] text-sm font-semibold text-[#0A0A0Acc] dark:text-[#FBFAF8a8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[46px] rounded-2xl text-sm font-semibold text-white ${
              destructive
                ? 'bg-[#E6DFD2] hover:bg-[#E6DFD2]'
                : 'bg-[#0B3B40] dark:bg-[#D5DCD9] dark:text-[#0A0A0A]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
