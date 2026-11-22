import React from 'react';

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  trackClassName?: string;
  progressColor?: string;
  labelClassName?: string;
  showLabel?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percent,
  size = 56,
  strokeWidth = 5,
  trackClassName = 'stroke-[#1010101f] dark:stroke-[#FFFFFF24]',
  progressColor,
  labelClassName = 'text-xs font-semibold text-[#101010] dark:text-[#FFFFFF]',
  showLabel = true,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    progressColor || (clamped === 100 ? '#B8D9F2' : clamped >= 50 ? '#B8D9F2' : '#D9C9F2');

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {showLabel && (
        <span className={`absolute font-mono tabular-nums ${labelClassName}`}>{clamped}%</span>
      )}
    </div>
  );
};
