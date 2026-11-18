import React from 'react';

export const PapayaIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10 inline-block' }) => (
  <svg
    viewBox="0 0 72 72"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Papaya"
  >
    {/* Outer Green/Yellow Rind */}
    <path
      d="M36 6C23 6 15 19 15 36C15 53 23 66 36 66C49 66 57 53 57 36C57 19 49 6 36 6Z"
      fill="#7CB342"
    />
    {/* Golden Yellow Outer Layer */}
    <path
      d="M36 8C24.5 8 17.5 20 17.5 36C17.5 51 24.5 64 36 64C47.5 64 54.5 51 54.5 36C54.5 20 47.5 8 36 8Z"
      fill="#FDD835"
    />
    {/* Sweet Ripe Orange/Yellow Flesh */}
    <path
      d="M36 11C26.5 11 20 22 20 36C20 49 26.5 61 36 61C45.5 61 52 49 52 36C52 22 45.5 11 36 11Z"
      fill="#FB8C00"
    />
    {/* Inner Central Seed Cavity */}
    <path
      d="M36 21C30 21 27 27 27 36C27 45 30 51 36 51C42 51 45 45 45 36C45 27 42 21 36 21Z"
      fill="#FFF3E0"
    />
    <path
      d="M36 23C31 23 28.5 28 28.5 36C28.5 44 31 49 36 49C41 49 43.5 44 43.5 36C43.5 28 41 23 36 23Z"
      fill="#FFE0B2"
    />
    {/* Dark Papaya Seeds */}
    {/* Column 1 */}
    <circle cx="33" cy="27" r="1.6" fill="#212121" />
    <circle cx="38" cy="26" r="1.7" fill="#374151" />
    <circle cx="35" cy="30" r="1.8" fill="#18181B" />
    <circle cx="32" cy="33" r="1.7" fill="#27272A" />
    <circle cx="39" cy="32" r="1.6" fill="#18181B" />
    {/* Column 2 - Center */}
    <circle cx="36" cy="36" r="1.9" fill="#111827" />
    <circle cx="33" cy="39" r="1.8" fill="#27272A" />
    <circle cx="38" cy="38" r="1.7" fill="#18181B" />
    <circle cx="35" cy="42" r="1.8" fill="#212121" />
    {/* Column 3 - Lower */}
    <circle cx="33" cy="45" r="1.6" fill="#374151" />
    <circle cx="38" cy="44" r="1.7" fill="#111827" />
    <circle cx="36" cy="47" r="1.5" fill="#212121" />

    {/* Seed Glisten Highlights */}
    <circle cx="32.5" cy="26.5" r="0.5" fill="#FFFFFF" opacity="0.8" />
    <circle cx="35.5" cy="35.5" r="0.6" fill="#FFFFFF" opacity="0.9" />
    <circle cx="37.5" cy="37.5" r="0.5" fill="#FFFFFF" opacity="0.8" />
    <circle cx="34.5" cy="41.5" r="0.5" fill="#FFFFFF" opacity="0.8" />

    {/* Stem top */}
    <path
      d="M36 3C37 3 38 4 37.5 6L36 6L34.5 6C34 4 35 3 36 3Z"
      fill="#558B2F"
    />
  </svg>
);
