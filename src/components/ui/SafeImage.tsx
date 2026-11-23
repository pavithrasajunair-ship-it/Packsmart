import React, { useState } from 'react';
import { Compass } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0A0A0A] via-[#0A0A0A] to-[#0A0A0A] text-white/90 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Compass className="w-7 h-7 text-[#0A0A0A] mb-1.5" />
        {fallbackLabel && <span className="text-xs font-medium opacity-85">{fallbackLabel}</span>}
      </div>
    );
  }

  return (
    <img loading="lazy" decoding="async"
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
