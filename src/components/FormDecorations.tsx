import React from 'react';

// Cute Cartoon Boy Avatar
export const BoyAvatar: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 40 40" className={`shrink-0 ${className}`} aria-hidden="true">
    {/* Hair */}
    <ellipse cx="20" cy="18" rx="15" ry="14" fill="#6A3B18" />
    <path d="M 6 18 Q 8 8 20 7 Q 32 8 34 18 Q 30 11 20 12 Q 10 11 6 18 Z" fill="#502A0E" />
    {/* Ears */}
    <circle cx="6" cy="20" r="3.5" fill="#FCD9B8" />
    <circle cx="34" cy="20" r="3.5" fill="#FCD9B8" />
    {/* Face */}
    <ellipse cx="20" cy="21" rx="12" ry="11" fill="#FDE2C8" />
    {/* Hair fringe */}
    <path d="M 8 16 Q 14 18 18 15 Q 24 19 32 15 Q 26 12 20 12 Q 13 12 8 16 Z" fill="#6A3B18" />
    {/* Eyes */}
    <circle cx="16" cy="20" r="1.8" fill="#1E293B" />
    <circle cx="16.5" cy="19.5" r="0.6" fill="#FFFFFF" />
    <circle cx="24" cy="20" r="1.8" fill="#1E293B" />
    <circle cx="24.5" cy="19.5" r="0.6" fill="#FFFFFF" />
    {/* Rosy Cheeks */}
    <circle cx="13" cy="23" r="2" fill="#F472B6" opacity="0.4" />
    <circle cx="27" cy="23" r="2" fill="#F472B6" opacity="0.4" />
    {/* Smile */}
    <path d="M 18 24 Q 20 26 22 24" fill="none" stroke="#6A3B18" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Cute Cartoon Girl Avatar
export const GirlAvatar: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 40 40" className={`shrink-0 ${className}`} aria-hidden="true">
    {/* Pigtails */}
    <circle cx="5" cy="14" r="5" fill="#713F12" />
    <circle cx="5" cy="14" r="2" fill="#F472B6" />
    <circle cx="35" cy="14" r="5" fill="#713F12" />
    <circle cx="35" cy="14" r="2" fill="#F472B6" />
    {/* Hair back */}
    <ellipse cx="20" cy="18" rx="14" ry="13" fill="#713F12" />
    {/* Ears */}
    <circle cx="7" cy="20" r="3" fill="#FCD9B8" />
    <circle cx="33" cy="20" r="3" fill="#FCD9B8" />
    {/* Face */}
    <ellipse cx="20" cy="21" rx="11" ry="10" fill="#FDE2C8" />
    {/* Bangs */}
    <path d="M 9 15 Q 15 19 20 16 Q 25 19 31 15 Q 26 12 20 12 Q 14 12 9 15 Z" fill="#713F12" />
    {/* Eyes */}
    <circle cx="16" cy="20" r="1.8" fill="#1E293B" />
    <circle cx="16.5" cy="19.5" r="0.6" fill="#FFFFFF" />
    <circle cx="24" cy="20" r="1.8" fill="#1E293B" />
    <circle cx="24.5" cy="19.5" r="0.6" fill="#FFFFFF" />
    {/* Rosy Cheeks */}
    <circle cx="13" cy="23" r="2.2" fill="#F472B6" opacity="0.45" />
    <circle cx="27" cy="23" r="2.2" fill="#F472B6" opacity="0.45" />
    {/* Smile */}
    <path d="M 18 24 Q 20 26 22 24" fill="none" stroke="#713F12" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Cute Star Avatar (for "Other" or headings)
export const StarAvatar: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
    <polygon
      points="16,2 20.5,11.5 30.5,12.5 23,19 25,29 16,24 7,29 9,19 1.5,12.5 11.5,11.5"
      fill="#FCD34D"
      stroke="#F59E0B"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Face */}
    <circle cx="13" cy="15" r="1.3" fill="#78350F" />
    <circle cx="19" cy="15" r="1.3" fill="#78350F" />
    <path d="M 14 18 Q 16 20 18 18" fill="none" stroke="#78350F" strokeWidth="1" strokeLinecap="round" />
    <circle cx="11" cy="17" r="1.2" fill="#F472B6" opacity="0.6" />
    <circle cx="21" cy="17" r="1.2" fill="#F472B6" opacity="0.6" />
  </svg>
);

// Cute Rainbow with Clouds for Section Header
export const CuteRainbow: React.FC<{ className?: string }> = ({ className = 'w-20 h-10' }) => (
  <svg viewBox="0 0 100 55" className={`shrink-0 ${className}`} aria-hidden="true">
    {/* Rainbow Arcs */}
    <path d="M 18 45 A 32 32 0 0 1 82 45" fill="none" stroke="#F87171" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M 23 45 A 27 27 0 0 1 77 45" fill="none" stroke="#FB923C" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M 28 45 A 22 22 0 0 1 72 45" fill="none" stroke="#FBBF24" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M 33 45 A 17 17 0 0 1 67 45" fill="none" stroke="#34D399" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M 38 45 A 12 12 0 0 1 62 45" fill="none" stroke="#60A5FA" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M 43 45 A 7 7 0 0 1 57 45" fill="none" stroke="#A78BFA" strokeWidth="4.5" strokeLinecap="round" />

    {/* Left Cloud */}
    <g fill="#FFFFFF" stroke="#BAE6FD" strokeWidth="1.2">
      <ellipse cx="18" cy="46" rx="10" ry="7" />
      <circle cx="14" cy="41" r="6" />
      <circle cx="21" cy="40" r="7" />
    </g>

    {/* Right Cloud */}
    <g fill="#FFFFFF" stroke="#BAE6FD" strokeWidth="1.2">
      <ellipse cx="82" cy="46" rx="10" ry="7" />
      <circle cx="78" cy="40" r="7" />
      <circle cx="86" cy="41" r="6" />
    </g>
  </svg>
);

// Sparkle Rays Accent
export const SparkleRays: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 20 20" className={`shrink-0 inline-block text-amber-400 ${className}`} aria-hidden="true">
    <line x1="2" y1="10" x2="8" y2="10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="5" y1="4" x2="10" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="10" y1="2" x2="10" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// Teddy Bear Peeking over Consent Box
export const ConsentTeddyBear: React.FC<{ className?: string }> = ({ className = 'w-16 h-12' }) => (
  <div className={`pointer-events-none select-none ${className}`} aria-hidden="true">
    <svg viewBox="0 0 90 60" className="w-full h-full overflow-visible">
      {/* Sparkle rays behind bear */}
      <g transform="translate(18, 12) rotate(-20)">
        <line x1="-8" y1="0" x2="-2" y2="0" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
        <line x1="-6" y1="-6" x2="-1" y2="-1" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="-8" x2="0" y2="-2" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="translate(74, 12) rotate(20)">
        <line x1="2" y1="0" x2="8" y2="0" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
        <line x1="1" y1="-6" x2="6" y2="-1" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="-8" x2="0" y2="-2" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Bear Ears */}
      <circle cx="28" cy="22" r="13" fill="#C58753" stroke="#9A6133" strokeWidth="1.5" />
      <circle cx="28" cy="22" r="7" fill="#E8BFA1" />

      <circle cx="62" cy="22" r="13" fill="#C58753" stroke="#9A6133" strokeWidth="1.5" />
      <circle cx="62" cy="22" r="7" fill="#E8BFA1" />

      {/* Bear Head */}
      <ellipse cx="45" cy="34" rx="24" ry="20" fill="#C58753" stroke="#9A6133" strokeWidth="1.5" />

      {/* Eyes */}
      <circle cx="37" cy="31" r="2.8" fill="#20150D" />
      <circle cx="37.8" cy="30" r="0.9" fill="#FFFFFF" />

      <circle cx="53" cy="31" r="2.8" fill="#20150D" />
      <circle cx="53.8" cy="30" r="0.9" fill="#FFFFFF" />

      {/* Muzzle */}
      <ellipse cx="45" cy="39" rx="10" ry="7.5" fill="#FCE6CF" />
      {/* Nose */}
      <ellipse cx="45" cy="36" rx="3" ry="2" fill="#2B190E" />
      {/* Smile */}
      <path d="M 42 39.5 Q 45 42.5 48 39.5" fill="none" stroke="#2B190E" strokeWidth="1.4" strokeLinecap="round" />

      {/* Rosy Cheeks */}
      <circle cx="32" cy="36" r="3.5" fill="#F472B6" opacity="0.45" />
      <circle cx="58" cy="36" r="3.5" fill="#F472B6" opacity="0.45" />

      {/* Paws Resting on Consent Box Rim */}
      <ellipse cx="22" cy="53" rx="9" ry="7.5" fill="#C58753" stroke="#9A6133" strokeWidth="1.5" />
      <ellipse cx="22" cy="53.5" rx="4.5" ry="3.5" fill="#E8BFA1" />

      <ellipse cx="68" cy="53" rx="9" ry="7.5" fill="#C58753" stroke="#9A6133" strokeWidth="1.5" />
      <ellipse cx="68" cy="53.5" rx="4.5" ry="3.5" fill="#E8BFA1" />
    </svg>
  </div>
);

// Bottom Stacked Pastel Storybooks
export const StackedBooks: React.FC<{ className?: string }> = ({ className = 'w-16 h-12' }) => (
  <svg viewBox="0 0 60 45" className={`shrink-0 ${className}`} aria-hidden="true">
    {/* Bottom Book (Cyan/Blue) */}
    <rect x="6" y="24" width="46" height="12" rx="3" fill="#60A5FA" stroke="#3B82F6" strokeWidth="1.2" />
    <path d="M 10 24 L 10 36" stroke="#2563EB" strokeWidth="1.5" />
    <rect x="52" y="26" width="3" height="8" rx="1" fill="#FEF08A" />

    {/* Top Book (Pink) */}
    <rect x="8" y="14" width="42" height="11" rx="3" fill="#F472B6" stroke="#EC4899" strokeWidth="1.2" />
    <path d="M 12 14 L 12 25" stroke="#DB2777" strokeWidth="1.5" />
    <rect x="50" y="16" width="3" height="7" rx="1" fill="#FFFFFF" />
  </svg>
);

// Bottom Grass & Daisy Flowers
export const GrassDaisies: React.FC<{ className?: string }> = ({ className = 'w-20 h-14' }) => (
  <svg viewBox="0 0 70 50" className={`shrink-0 ${className}`} aria-hidden="true">
    {/* Grass Tufts */}
    <path
      d="M 10 50 Q 15 25 30 20 Q 32 35 34 50"
      fill="#86EFAC"
      stroke="#4ADE80"
      strokeWidth="1.5"
    />
    <path
      d="M 28 50 Q 42 18 55 24 Q 52 38 58 50"
      fill="#86EFAC"
      stroke="#4ADE80"
      strokeWidth="1.5"
    />
    <path
      d="M 45 50 Q 55 30 68 32 L 68 50 Z"
      fill="#4ADE80"
    />

    {/* Daisy Flower */}
    <g transform="translate(42, 22)">
      {/* Petals */}
      <circle cx="-5" cy="0" r="3" fill="#FFFFFF" />
      <circle cx="5" cy="0" r="3" fill="#FFFFFF" />
      <circle cx="0" cy="-5" r="3" fill="#FFFFFF" />
      <circle cx="0" cy="5" r="3" fill="#FFFFFF" />
      <circle cx="-3.5" cy="-3.5" r="3" fill="#FFFFFF" />
      <circle cx="3.5" cy="-3.5" r="3" fill="#FFFFFF" />
      <circle cx="-3.5" cy="3.5" r="3" fill="#FFFFFF" />
      <circle cx="3.5" cy="3.5" r="3" fill="#FFFFFF" />
      {/* Center */}
      <circle cx="0" cy="0" r="3" fill="#FBBF24" />
    </g>
  </svg>
);
