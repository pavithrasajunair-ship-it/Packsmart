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
            <div className="w-10 h-10 rounded-2xl bg-[#FEF2F2] dark:bg-[#3A1620] text-[#DC2626] dark:text-[#F87171] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <p className="text-sm text-[#505770] dark:text-[#B4BCD9] leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[46px] rounded-2xl bg-[#FAF9F7] dark:bg-[#0D1326] border border-[#E2DDD4] dark:border-[#28335C] text-sm font-semibold text-[#505770] dark:text-[#B4BCD9]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[46px] rounded-2xl text-sm font-semibold text-white ${
              destructive
                ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                : 'bg-[#111834] dark:bg-[#6E5DE7]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
