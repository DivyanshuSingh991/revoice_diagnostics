import React from 'react';
import { Check } from 'lucide-react';

interface Props {
  currentStep: number; // 1 = Details, 2 = Record, 3 = Report
  className?: string;
  onStepClick?: (step: number) => void;
}

// 1. Teddy Bear Mascot (Peeks over the top of the Details cloud)
const TeddyBearMascot: React.FC<{ active: boolean }> = ({ active }) => (
  <div
    className={`absolute -top-5.5 md:-top-6 left-1/2 -translate-x-1/2 pointer-events-none transition-transform duration-300 ${
      active ? 'scale-110 -translate-y-0.5' : 'scale-100 opacity-90'
    }`}
    style={{ width: '74px', height: '38px' }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 80 40" className="w-full h-full overflow-visible">
      {/* Sparkle rays on top-left */}
      <g transform="translate(6, 4) rotate(-15)">
        <line x1="-7" y1="0" x2="-2" y2="0" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="-5" y1="-5" x2="-1" y2="-1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="-7" x2="0" y2="-2" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Bear Ears */}
      <circle cx="27" cy="15" r="9" fill="#B97843" stroke="#8A5123" strokeWidth="1.2" />
      <circle cx="27" cy="15" r="5" fill="#E8BFA0" />

      <circle cx="53" cy="15" r="9" fill="#B97843" stroke="#8A5123" strokeWidth="1.2" />
      <circle cx="53" cy="15" r="5" fill="#E8BFA0" />

      {/* Bear Head */}
      <ellipse cx="40" cy="22" rx="18" ry="15" fill="#B97843" stroke="#8A5123" strokeWidth="1.2" />

      {/* Eyes */}
      <circle cx="34" cy="20" r="2" fill="#20150D" />
      <circle cx="34.6" cy="19.4" r="0.7" fill="#FFFFFF" />

      <circle cx="46" cy="20" r="2" fill="#20150D" />
      <circle cx="46.6" cy="19.4" r="0.7" fill="#FFFFFF" />

      {/* Muzzle */}
      <ellipse cx="40" cy="25" rx="7.5" ry="5.5" fill="#FCE6CF" />
      {/* Nose */}
      <ellipse cx="40" cy="23.5" rx="2.2" ry="1.6" fill="#2B190E" />
      {/* Mouth */}
      <path d="M 38 26 Q 40 27.8 42 26" fill="none" stroke="#2B190E" strokeWidth="1" strokeLinecap="round" />

      {/* Rosy cheeks */}
      <circle cx="31" cy="23.5" r="2.5" fill="#F472B6" opacity="0.45" />
      <circle cx="49" cy="23.5" r="2.5" fill="#F472B6" opacity="0.45" />

      {/* Paws resting on cloud rim */}
      <ellipse cx="23" cy="33" rx="6.5" ry="5.5" fill="#B97843" stroke="#8A5123" strokeWidth="1.2" />
      <ellipse cx="23" cy="33.5" rx="3.5" ry="2.5" fill="#E8BFA0" />

      <ellipse cx="57" cy="33" rx="6.5" ry="5.5" fill="#B97843" stroke="#8A5123" strokeWidth="1.2" />
      <ellipse cx="57" cy="33.5" rx="3.5" ry="2.5" fill="#E8BFA0" />
    </svg>
  </div>
);

// 2. Bunny Mascot (Peeks over the top of the Report cloud)
const BunnyMascot: React.FC<{ active: boolean }> = ({ active }) => (
  <div
    className={`absolute -top-6.5 md:-top-7.5 left-1/2 -translate-x-1/2 pointer-events-none transition-transform duration-300 ${
      active ? 'scale-110 -translate-y-0.5' : 'scale-100 opacity-90'
    }`}
    style={{ width: '74px', height: '42px' }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 80 44" className="w-full h-full overflow-visible">
      {/* Sparkle rays on top-right */}
      <g transform="translate(68, 6) rotate(15)">
        <line x1="2" y1="0" x2="7" y2="0" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="1" y1="-5" x2="5" y2="-1" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="0" y1="-7" x2="0" y2="-2" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Bunny Ears */}
      {/* Left Ear */}
      <ellipse
        cx="32"
        cy="15"
        rx="5.5"
        ry="15"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="1.2"
        transform="rotate(-9 32 15)"
      />
      <ellipse
        cx="32"
        cy="16"
        rx="3"
        ry="10"
        fill="#F9A8D4"
        transform="rotate(-9 32 16)"
      />

      {/* Right Ear */}
      <ellipse
        cx="48"
        cy="15"
        rx="5.5"
        ry="15"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="1.2"
        transform="rotate(9 48 15)"
      />
      <ellipse
        cx="48"
        cy="16"
        rx="3"
        ry="10"
        fill="#F9A8D4"
        transform="rotate(9 48 16)"
      />

      {/* Bunny Head */}
      <ellipse cx="40" cy="27" rx="16" ry="13" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />

      {/* Eyes */}
      <circle cx="34" cy="26" r="1.8" fill="#1E293B" />
      <circle cx="34.5" cy="25.5" r="0.6" fill="#FFFFFF" />

      <circle cx="46" cy="26" r="1.8" fill="#1E293B" />
      <circle cx="46.5" cy="25.5" r="0.6" fill="#FFFFFF" />

      {/* Nose */}
      <polygon points="40,29.5 38.5,28 41.5,28" fill="#F472B6" />
      {/* Mouth */}
      <path d="M 38.5 30 Q 40 31.8 41.5 30" fill="none" stroke="#64748B" strokeWidth="0.9" strokeLinecap="round" />

      {/* Pink cheeks */}
      <circle cx="32" cy="28.5" r="2.8" fill="#FCE7F3" opacity="0.9" />
      <circle cx="48" cy="28.5" r="2.8" fill="#FCE7F3" opacity="0.9" />

      {/* White Paws over Cloud Rim */}
      <ellipse cx="25" cy="37" rx="5.5" ry="4.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />
      <ellipse cx="55" cy="37" rx="5.5" ry="4.5" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.2" />
    </svg>
  </div>
);

// 3. Cute Little Golden Star Decorator
const CuteStar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-4 h-4 text-amber-400 drop-shadow-xs pointer-events-none ${className}`}
    fill="currentColor"
    stroke="#F59E0B"
    strokeWidth="1.2"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" />
  </svg>
);

// 4. Arrow Divider between Steps
const StepArrow: React.FC<{ active: boolean }> = ({ active }) => (
  <div className="flex items-center justify-center px-1.5 sm:px-3 md:px-4 shrink-0 select-none">
    <svg
      viewBox="0 0 16 16"
      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 transition-colors duration-300 ${
        active ? 'text-sky-500' : 'text-slate-300'
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="5 2 11 8 5 14" />
    </svg>
  </div>
);

export const CuteCloudStepper: React.FC<Props> = ({ currentStep, className = '', onStepClick }) => {
  const steps = [
    { num: 1, label: 'Details', hasMascot: 'bear' as const },
    { num: 2, label: 'Record', hasStar: true },
    { num: 3, label: 'Report', hasMascot: 'bunny' as const },
  ];

  return (
    <nav
      aria-label="Assessment Progress"
      className={`relative flex items-center justify-center select-none bg-transparent w-full ${className}`}
      style={{
        fontFamily: "'Fredoka', 'Baloo 2', 'Sniglet', cursive, system-ui, sans-serif",
      }}
    >
      <ol className="flex items-center justify-center gap-1.5 sm:gap-3 md:gap-4 w-full">
        {steps.map((step, idx) => {
          const isActive = currentStep === step.num;
          const isDone = currentStep > step.num;

          return (
            <React.Fragment key={step.num}>
              {idx > 0 && <StepArrow active={currentStep >= step.num} />}

              <li className="relative">
                {/* 1. Peeking Animal Mascot (Teddy Bear on Details, Bunny on Report) */}
                {step.hasMascot === 'bear' && <TeddyBearMascot active={isActive} />}
                {step.hasMascot === 'bunny' && <BunnyMascot active={isActive} />}

                {/* 2. Cloud Step Container */}
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.num)}
                  disabled={!onStepClick}
                  aria-current={isActive ? 'step' : undefined}
                  className={`group relative flex items-center gap-2 sm:gap-2.5 h-10 sm:h-11 md:h-12 px-3.5 sm:px-5 md:px-6 rounded-full transition-all duration-300 ${
                    onStepClick ? 'cursor-pointer active:scale-95' : 'cursor-default'
                  } ${
                    isActive
                      ? 'bg-sky-50/95 text-sky-900 border-2 border-sky-400 shadow-[0_3px_12px_rgba(56,189,248,0.32)] ring-2 ring-sky-300/40'
                      : isDone
                      ? 'bg-white/90 text-emerald-800 border-1.5 border-emerald-300 shadow-xs hover:border-emerald-400'
                      : 'bg-white/80 text-slate-500 border border-slate-200/90 shadow-2xs hover:border-slate-300'
                  }`}
                  style={{
                    borderRadius: '9999px',
                  }}
                >
                  {/* Step Number Badge in Circle */}
                  <span
                    className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold shrink-0 transition-colors duration-300 shadow-xs ${
                      isActive
                        ? 'bg-sky-600 text-white'
                        : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.num}
                  </span>

                  {/* Step Label ("Details", "Record", "Report") */}
                  <span
                    className={`text-xs sm:text-sm md:text-base tracking-tight font-bold transition-colors duration-300 whitespace-nowrap ${
                      isActive
                        ? 'text-sky-900'
                        : isDone
                        ? 'text-emerald-800 font-semibold'
                        : 'text-slate-600 font-medium'
                    }`}
                  >
                    {step.label}
                  </span>

                  {/* Little star decoration on the Record cloud */}
                  {step.hasStar && (
                    <span className="absolute -bottom-1 -right-1 transform rotate-12">
                      <CuteStar />
                    </span>
                  )}
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
