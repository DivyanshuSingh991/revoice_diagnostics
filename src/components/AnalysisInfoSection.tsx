import React from 'react';
import { ChildKiteHero } from './ChildKiteHero';

// 1. Clipboard Checklist Icon for Card 1
export const ClipboardCardIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="4" width="14" height="17" rx="3" />
    <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V4z" />
    <path d="M9 11l1.5 1.5L14 9" strokeWidth="2.2" />
    <line x1="9" y1="16" x2="15" y2="16" strokeWidth="2.2" />
  </svg>
);

// 2. Microphone with Voice Sound Waves for Card 2
export const MicCardIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Sound waves left & right */}
    <path d="M3 10a5 5 0 0 0 0 4" strokeWidth="2" />
    <path d="M21 10a5 5 0 0 1 0 4" strokeWidth="2" />
    {/* Mic capsule */}
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" fillOpacity="0.1" />
    <path d="M6 10a6 6 0 0 0 12 0" />
    <line x1="12" y1="16" x2="12" y2="20" />
    <line x1="8" y1="20" x2="16" y2="20" />
  </svg>
);

// 3. Bar Chart for Card 3
export const ChartCardIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Bar 1 (low) */}
    <rect x="4" y="14" width="4" height="6" rx="1.5" fill="currentColor" fillOpacity="0.15" />
    {/* Bar 2 (medium) */}
    <rect x="10" y="9" width="4" height="11" rx="1.5" fill="currentColor" fillOpacity="0.15" />
    {/* Bar 3 (high) */}
    <rect x="16" y="4" width="4" height="16" rx="1.5" fill="currentColor" fillOpacity="0.15" />
  </svg>
);

// 4. Lightbulb Icon for Tip Box
export const LightbulbCardIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 21h4" />
    <path d="M12 2a7 7 0 0 0-4.5 12.3c.7.6 1.5 1.7 1.5 2.7h6c0-1-.8-2.1-1.5-2.7A7 7 0 0 0 12 2z" fill="#FBBF24" fillOpacity="0.2" />
    {/* Glow rays */}
    <line x1="12" y1="0.5" x2="12" y2="2" strokeWidth="2.5" />
    <line x1="3.5" y1="4" x2="5" y2="5.5" strokeWidth="2.5" />
    <line x1="20.5" y1="4" x2="19" y2="5.5" strokeWidth="2.5" />
    <line x1="2" y1="12" x2="3.5" y2="12" strokeWidth="2.5" />
    <line x1="22" y1="12" x2="20.5" y2="12" strokeWidth="2.5" />
  </svg>
);

export const AnalysisInfoSection: React.FC = () => {
  return (
    <section className="lg:col-span-2 lg:sticky lg:top-24 space-y-5 pt-1">
      {/* Main Heading & Description */}
      <div>
        <div className="relative inline-block">
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-[#0F2744] tracking-tight leading-tight flex items-center flex-wrap gap-x-2">
            <span>Child Speech</span>
            <span className="relative inline-block">
              <span>Analysis</span>
              {/* Playful curved yellow highlighter underline */}
              <svg
                className="absolute -bottom-1.5 left-0 w-full h-2.5 overflow-visible text-[#FBBF24]"
                viewBox="0 0 100 12"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M 2 8 Q 50 12 98 4"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </svg>
              {/* Three yellow sparkle rays radiating upwards-right */}
              <span className="absolute -top-3.5 -right-4 flex gap-0.5 text-amber-400 select-none pointer-events-none">
                <svg viewBox="0 0 24 24" className="w-5 h-5 overflow-visible" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="8" y1="16" x2="4" y2="4" />
                  <line x1="14" y1="18" x2="16" y2="4" />
                  <line x1="18" y1="20" x2="24" y2="10" />
                </svg>
              </span>
            </span>
          </h1>
        </div>
        <p className="mt-2.5 text-slate-600 text-sm leading-relaxed max-w-md">
          A clinical, playful clarity check. Your child completes simple Hindi speech tasks and you get an immediate structured diagnostic report.
        </p>
      </div>

      {/* Three Information Cards */}
      <div className="space-y-3">
        {/* Card 1 — Child Details */}
        <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-3xl bg-[#E0F2FE]/80 border-2 border-[#BAE6FD] hover:border-[#7DD3FC] shadow-sm transition-all">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#BAE6FD]/70 border border-[#7DD3FC]/50 text-[#0284C7] flex items-center justify-center shrink-0">
            <ClipboardCardIcon className="w-6 h-6" />
          </div>
          <div className="w-1 h-8 rounded-full bg-[#0284C7] shrink-0" />
          <div className="min-w-0">
            <h3 className="font-extrabold text-[#0F2744] text-sm sm:text-[15px] leading-snug">
              1. Child Details
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-normal mt-0.5">
              Register new child or select existing profile from cloud DB.
            </p>
          </div>
        </div>

        {/* Card 2 — Speech Tasks */}
        <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-3xl bg-[#FCE7F3]/80 border-2 border-[#FBCFE8] hover:border-[#F472B6] shadow-sm transition-all">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#FBCFE8]/70 border border-[#F472B6]/50 text-[#DB2777] flex items-center justify-center shrink-0">
            <MicCardIcon className="w-6 h-6" />
          </div>
          <div className="w-1 h-8 rounded-full bg-[#DB2777] shrink-0" />
          <div className="min-w-0">
            <h3 className="font-extrabold text-[#0F2744] text-sm sm:text-[15px] leading-snug">
              2. Speech Tasks
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-normal mt-0.5">
              Voice "आ", Pa-Ta-Ka rate, Picture Naming & 5 sentences.
            </p>
          </div>
        </div>

        {/* Card 3 — Diagnostic Report */}
        <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-3xl bg-[#DCFCE7]/80 border-2 border-[#BBF7D0] hover:border-[#86EFAC] shadow-sm transition-all">
          <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#BBF7D0]/70 border border-[#86EFAC]/50 text-[#16A34A] flex items-center justify-center shrink-0">
            <ChartCardIcon className="w-6 h-6" />
          </div>
          <div className="w-1 h-8 rounded-full bg-[#16A34A] shrink-0" />
          <div className="min-w-0">
            <h3 className="font-extrabold text-[#0F2744] text-sm sm:text-[15px] leading-snug">
              3. Diagnostic Report
            </h3>
            <p className="text-xs text-slate-600 font-medium leading-normal mt-0.5">
              Clarity scores, clinical indicators & home intervention plan.
            </p>
          </div>
        </div>
      </div>

      {/* Tip Box */}
      <div className="flex items-center gap-3.5 p-3.5 sm:p-4 rounded-3xl bg-[#FFFDF5] border-2 border-dashed border-[#FCD34D] shadow-2xs">
        <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] text-amber-500 border border-amber-200/80 flex items-center justify-center shrink-0">
          <LightbulbCardIcon className="w-6 h-6" />
        </div>
        <div className="w-1 h-8 rounded-full bg-[#F59E0B] shrink-0" />
        <p className="text-xs sm:text-[13px] leading-relaxed text-[#78350F]">
          <strong className="font-extrabold text-[#451A03]">Tip:</strong> Find a quiet room and hold the device about an arm’s length from your child.
        </p>
      </div>

      {/* 3D Child running with ReVoice kite - Perfectly placed on the meadow */}
      <div className="pt-2 flex justify-start pl-1">
        <ChildKiteHero />
      </div>
    </section>
  );
};
