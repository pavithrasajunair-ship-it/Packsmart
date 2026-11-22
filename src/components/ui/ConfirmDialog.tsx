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
            <div className="w-10 h-10 rounded-2xl bg-[#FFC5A866] dark:bg-[#FFFFFF0f] text-[#101010] dark:text-[#FFC5A8] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <p className="text-sm text-[#101010cc] dark:text-[#FFFFFFa8] leading-relaxed">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[46px] rounded-2xl bg-[#FFFFFF] dark:bg-[#101010] border border-[#1010101f] dark:border-[#FFFFFF24] text-sm font-semibold text-[#101010cc] dark:text-[#FFFFFFa8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[46px] rounded-2xl text-sm font-semibold text-white ${
              destructive
                ? 'bg-[#FFC5A8] hover:bg-[#FFC5A8]'
                : 'bg-[#101010] dark:bg-[#D9C9F2] dark:text-[#101010]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
