import React from 'react';
import { ScreeningStatus } from '../types';
import { STATUS_LABEL } from '../lib/screening';

// One colour per metric, used consistently across the recorder and the report.
export const METRIC_STYLES = {
  clarity: { label: 'Clarity', short: 'Clarity', hint: 'Words spoken accurately', bar: 'bg-brand-500', text: 'text-brand-700', soft: 'bg-brand-50' },
  repetition: { label: 'Repetition', short: 'Repetition', hint: 'Free of repeated syllables', bar: 'bg-teal-500', text: 'text-teal-700', soft: 'bg-teal-50' },
  accuracy: { label: 'Word accuracy', short: 'Accuracy', hint: 'Right words, in order', bar: 'bg-cyan-500', text: 'text-cyan-700', soft: 'bg-cyan-50' },
  sustain: { label: 'Sound sustain', short: 'Sustain', hint: 'Free of stretched sounds', bar: 'bg-sky-500', text: 'text-sky-700', soft: 'bg-sky-50' },
} as const;

export type MetricKey = keyof typeof METRIC_STYLES;

export const MetricMeter: React.FC<{ metric: MetricKey; value: number; compact?: boolean }> = ({
  metric,
  value,
  compact,
}) => {
  const m = METRIC_STYLES[metric];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={compact ? '' : 'p-4 rounded-2xl border border-slate-200/80 bg-white'}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">{m.label}</span>
        <span className={`font-display font-bold tabular-nums ${compact ? 'text-base' : 'text-2xl'} ${m.text}`}>
          {value}%
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${m.bar} transition-[width] duration-700`} style={{ width: `${pct}%` }} />
      </div>
      {!compact && <p className="mt-2 text-xs text-slate-500">{m.hint}</p>}
    </div>
  );
};

export const scoreTone = (score: number) => {
  if (score >= 85) return { ring: 'stroke-emerald-500', text: 'text-emerald-700', label: 'Excellent' };
  if (score >= 70) return { ring: 'stroke-brand-500', text: 'text-brand-700', label: 'Good' };
  if (score >= 55) return { ring: 'stroke-amber-500', text: 'text-amber-700', label: 'Fair' };
  return { ring: 'stroke-rose-500', text: 'text-rose-700', label: 'Needs support' };
};

export const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 132 }) => {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const tone = scoreTone(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={`${tone.ring} transition-[stroke-dashoffset] duration-1000`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-4xl font-bold leading-none tabular-nums ${tone.text}`}>{score}</span>
        <span className="text-[11px] font-medium text-slate-400 mt-1">out of 100</span>
      </div>
    </div>
  );
};

export const STATUS_STYLES: Record<ScreeningStatus, { pill: string; dot: string }> = {
  typical: { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  monitor: { pill: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  refer: { pill: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  inconclusive: { pill: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  not_tested: { pill: 'bg-white text-slate-400 border-dashed border-slate-300', dot: 'bg-slate-300' },
};

export const StatusPill: React.FC<{ status: ScreeningStatus; className?: string }> = ({ status, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[status].pill} ${className}`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[status].dot}`} />
    {STATUS_LABEL[status]}
  </span>
);
