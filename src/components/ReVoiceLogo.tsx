import React from 'react';

interface ReVoiceLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showBadge?: boolean;
  badgeText?: string;
  capitalized?: boolean;
}

export const ReVoiceLogo: React.FC<ReVoiceLogoProps> = ({
  className = '',
  size = 'md',
  showBadge = false,
  badgeText = '',
  capitalized = false,
}) => {
  // FirstCry Palette:
  // "first" = all signature warm orange (#FA8223)
  // "c" = pink/magenta (#E75A9E)
  // "r" = lime green (#8FC742)
  // "y" = sky blue (#4FC3F7)
  // Pill badge = pink (#E75A9E) with white text
  const letters = capitalized
    ? [
        { char: 'R', color: '#FA8223', rot: '-3deg', y: '-1px' },
        { char: 'e', color: '#FA8223', rot: '2deg', y: '0px' },
        { char: 'V', color: '#E75A9E', rot: '-2.5deg', y: '-1px' },
        { char: 'o', color: '#8FC742', rot: '3deg', y: '1px' },
        { char: 'i', color: '#4FC3F7', rot: '-1.5deg', y: '-1px' },
        { char: 'c', color: '#E75A9E', rot: '2deg', y: '1px' },
        { char: 'e', color: '#4FC3F7', rot: '-2deg', y: '0px' },
      ]
    : [
        { char: 'r', color: '#FA8223', rot: '-3deg', y: '0px' },
        { char: 'e', color: '#FA8223', rot: '2deg', y: '-1px' },
        { char: 'v', color: '#E75A9E', rot: '-2.5deg', y: '0px' },
        { char: 'o', color: '#8FC742', rot: '3deg', y: '1px' },
        { char: 'i', color: '#4FC3F7', rot: '-1.5deg', y: '-1px' },
        { char: 'c', color: '#E75A9E', rot: '2deg', y: '1px' },
        { char: 'e', color: '#4FC3F7', rot: '-2deg', y: '0px' },
      ];

  const sizeStyles = {
    xs: { text: 'text-sm', badge: 'text-[7px] px-1 py-0' },
    sm: { text: 'text-lg', badge: 'text-[8px] px-1 py-0.2' },
    md: { text: 'text-2xl', badge: 'text-[9px] px-1.5 py-0.5' },
    lg: { text: 'text-3xl', badge: 'text-[10px] px-2 py-0.5' },
    xl: { text: 'text-4xl', badge: 'text-[12px] px-2.5 py-0.5' },
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <span
      className={`inline-flex items-center gap-1 relative select-none font-extrabold ${currentSize.text} ${className}`}
      style={{
        fontFamily: "'Fredoka', 'Itim', 'Sniglet', 'Baloo 2', cursive, system-ui, sans-serif",
        lineHeight: 1,
      }}
    >
      <span className="inline-flex items-baseline tracking-[-0.01em]">
        {letters.map((item, idx) => (
          <span
            key={idx}
            className="inline-block transition-transform duration-150 hover:scale-110"
            style={{
              color: item.color,
              transform: `translateY(${item.y}) rotate(${item.rot})`,
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.06))',
              marginRight: idx === 1 ? '1px' : '0.5px',
            }}
          >
            {item.char}
          </span>
        ))}
      </span>

      {showBadge && (
        <span
          className={`rounded-md text-white font-bold bg-[#E75A9E] leading-tight shadow-sm inline-flex items-center justify-center transform -rotate-3 -translate-y-0.5 ${currentSize.badge}`}
          style={{ fontFamily: "'Fredoka', sans-serif" }}
        >
          {badgeText}
        </span>
      )}
    </span>
  );
};
