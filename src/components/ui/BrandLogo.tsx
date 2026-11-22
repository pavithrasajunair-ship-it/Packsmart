import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 28, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect width="40" height="40" rx="10" fill="#171717" />
    <path
      d="M15.5 13V11.2C15.5 10.1 16.4 9.2 17.5 9.2H22.5C23.6 9.2 24.5 10.1 24.5 11.2V13"
      stroke="#B8D9F2"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <rect x="10" y="13" width="20" height="17" rx="3.5" fill="#FFFFFF" />
    <line x1="15.5" y1="13" x2="15.5" y2="30" stroke="#171717" strokeWidth="1.5" />
    <line x1="24.5" y1="13" x2="24.5" y2="30" stroke="#171717" strokeWidth="1.5" />
    <rect x="17.5" y="19" width="5" height="5" rx="1.2" fill="#FFC5A8" />
  </svg>
);
