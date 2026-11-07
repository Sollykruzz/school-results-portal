import React, { useState, useEffect, useMemo } from 'react';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import dominionLogoAsset from '../assets/images/school-logo.png';

interface SchoolLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showBadge?: boolean;
  useImageOnly?: boolean;
  src?: string;
  customSrc?: string;
  alt?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 'md',
  showBadge = false,
  src,
  customSrc,
  alt
}) => {
  const [activeConfig, setActiveConfig] = useState(() => getActiveSchoolConfig());
  
  // Resolve the best source given props and active branding configuration
  const resolveEffectiveSource = (config = activeConfig, propSrc = src, overrideSrc = customSrc) => {
    if (overrideSrc) return overrideSrc;
    if (propSrc && propSrc !== '' && !propSrc.includes('supreme') && !propSrc.includes('erca')) {
      return propSrc;
    }
    // If settings has a specific custom logo, honor it unless it refers to legacy school
    if (config?.logoUrl && config.logoUrl !== '' && !config.logoUrl.includes('supreme') && !config.logoUrl.includes('erca')) {
      return config.logoUrl;
    }
    return dominionLogoAsset || '/school-logo.png';
  };

  const [imgSrc, setImgSrc] = useState(() => resolveEffectiveSource(activeConfig, src, customSrc));
  const [hasFailedAll, setHasFailedAll] = useState(false);

  // Listen to live branding updates across the app (dispatched when admin saves settings)
  useEffect(() => {
    const handleBrandingUpdate = (e: any) => {
      const updated = e.detail || getActiveSchoolConfig();
      setActiveConfig(updated);
      const nextSrc = resolveEffectiveSource(updated, src, customSrc);
      setImgSrc(nextSrc);
      setHasFailedAll(false);
    };

    window.addEventListener('school_branding_updated', handleBrandingUpdate);
    return () => window.removeEventListener('school_branding_updated', handleBrandingUpdate);
  }, [src, customSrc]);

  // Sync if source prop, customSrc, or activeConfig.logoUrl changes
  useEffect(() => {
    const nextSrc = resolveEffectiveSource(activeConfig, src, customSrc);
    setImgSrc(nextSrc);
    setHasFailedAll(false);
  }, [src, customSrc, activeConfig.logoUrl]);

  const sizeClasses = {
    xs: 'w-10 h-10',
    sm: 'w-14 h-14 sm:w-16 sm:h-16',
    md: 'w-20 h-20 sm:w-24 sm:h-24',
    lg: 'w-32 h-32 sm:w-40 sm:h-40',
    xl: 'w-44 h-44 sm:w-52 sm:h-52',
    '2xl': 'w-64 h-64 sm:w-72 sm:h-72'
  };

  const hasExplicitDimensions = className.includes('w-') || className.includes('h-');
  const containerClasses = hasExplicitDimensions ? '' : (sizeClasses[size] || sizeClasses.md);
  const schoolLabel = alt || `${activeConfig.schoolName || 'Dominion Group Of Schools'} Official Logo`;

  // Fallback institutional monogram initials
  const initials = useMemo(() => {
    return (activeConfig.acronym || activeConfig.shortName || activeConfig.schoolName.split(' ').map(w => w[0]).join('') || 'DGS').slice(0, 4).toUpperCase();
  }, [activeConfig.acronym, activeConfig.shortName, activeConfig.schoolName]);

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 bg-transparent ${containerClasses} ${className}`}>
      {!hasFailedAll ? (
        <img
          key={imgSrc}
          src={imgSrc}
          alt={schoolLabel}
          onError={() => {
            // If a custom image fails, gracefully fall back to the standard school logo before failing to initials
            if (imgSrc !== '/school-logo.png' && imgSrc !== dominionLogoAsset) {
              setImgSrc(dominionLogoAsset || '/school-logo.png');
            } else {
              setHasFailedAll(true);
            }
          }}
          className="w-full h-full max-w-full max-h-full object-contain bg-transparent select-none"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-800 bg-transparent p-0.5">
          <span className="font-serif font-black text-center tracking-tighter leading-none text-xs sm:text-sm md:text-base">
            {initials}
          </span>
        </div>
      )}

      {showBadge && (
        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
      )}
    </div>
  );
};


