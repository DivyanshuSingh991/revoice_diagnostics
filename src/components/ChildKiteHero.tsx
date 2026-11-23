import React from 'react';

export const ChildKiteHero: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative select-none pointer-events-none ${className}`}>
      {/* 3D Child running from left to right with lively animated motion */}
      <div
        className="relative flex items-center justify-start transition-transform"
        style={{
          animation: 'kidFloatRun 6s ease-in-out infinite alternate',
        }}
      >
        {/* Soft 3D ground contact shadow */}
        <div
          className="absolute -bottom-2 left-1/3 -translate-x-1/2 w-44 h-5 bg-emerald-950/20 rounded-full blur-md"
          aria-hidden="true"
        />

        <img
          src="/child-kite-3d.png?v=3"
          alt="Child running with ReVoice kite"
          className="w-full max-w-[220px] sm:max-w-[260px] md:max-w-[290px] h-auto object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.18)]"
          style={{
            animation: 'kidStepBob 0.8s ease-in-out infinite alternate',
          }}
        />
      </div>

      <style>{`
        @keyframes kidFloatRun {
          0% {
            transform: translateX(0px) scale(0.98);
          }
          50% {
            transform: translateX(12px) scale(1);
          }
          100% {
            transform: translateX(24px) scale(0.98);
          }
        }

        @keyframes kidStepBob {
          0% {
            transform: translateY(0px) rotate(-0.5deg);
          }
          50% {
            transform: translateY(-5px) rotate(0.5deg);
          }
          100% {
            transform: translateY(-1px) rotate(0.75deg);
          }
        }
      `}</style>
    </div>
  );
};
