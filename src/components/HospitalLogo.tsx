import React, { useState } from 'react';

export const HOSPITAL_LOGO_SRC = '/src/assets/images/hospital_original_logo_1795348907128.jpg';

interface HospitalLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
};

export const HospitalLogo: React.FC<HospitalLogoProps> = ({ size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 shadow-sm ring-1 ring-slate-200/80 dark:ring-white/20 ${SIZE_CLASSES[size]} ${className}`}
    >
      {!imgError ? (
        <img
          src={HOSPITAL_LOGO_SRC}
          alt="Hospital Management Information System Official Seal"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="h-full w-full rounded-full"
          role="img"
          aria-label="Hospital Medical Cross Crest"
        >
          <circle cx="32" cy="32" r="30" fill="#FFFFFF" stroke="#0B1F3A" strokeWidth="3.5" />
          <circle cx="32" cy="32" r="25" fill="none" stroke="#D4AF37" strokeWidth="1" />
          <path
            d="M27 16h10v11h11v10H37v11H27V37H16V27h11V16z"
            fill="#DC2626"
          />
          <path
            d="M14 32h9l3-7 4 14 4-11 3 4h13"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
};
