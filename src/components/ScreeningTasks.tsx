import React, { useRef, useState } from 'react';
import { DdkResult, NamingItem, ScreeningTasks, VoiceAttempt } from '../types';
import { analyzeDdk, analyzeSustainedVowel } from '../lib/acoustics';
import { PICTURE_WORDS, scoreNamingAttempt } from '../lib/articulation';
import {
  ageBand,
  bestVoiceAttempt,
  breathStatus,
  MIN_VALID_MPT,
  ddkStatus,
  effectiveNaming,
  namingSummary,
  voiceQualityStatus,
} from '../lib/screening';
import { isDegenerateTranscript, transcribeAudio, trimSilence } from '../lib/whisper';
import { ensureDevanagari } from '../lib/devanagari';
import { decodeHiRes, useAudioCapture } from '../hooks/useAudioCapture';
import { StatusPill } from './ui';
import { AlertTriangle, ArrowRight, Check, Mic, RotateCcw, Square, Volume2, X } from 'lucide-react';

type Updater<T> = (fn: (prev: T) => T) => void;

const speak = (text: string, rate = 0.82) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'hi-IN';
  u.rate = rate;
  window.speechSynthesis.speak(u);
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const RecordControl: React.FC<{
  status: 'idle' | 'recording' | 'processing';
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  idleLabel: string;
  recordingLabel: string;
  processingLabel?: string;
  size?: 'lg' | 'md';
}> = ({ status, disabled, onStart, onStop, idleLabel, recordingLabel, processingLabel = 'Analysing…', size = 'lg' }) => {
  const dim = size === 'lg' ? 'w-24 h-24' : 'w-20 h-20';
  if (status === 'processing') {
    return (
      <div className="flex flex-col items-center">
        <div className={`${dim} flex items-center justify-center`}>
          <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">{processingLabel}</p>
      </div>
    );
  }
  if (status === 'recording') {
    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-rose-500/40 motion-safe:animate-pulse-ring" />
          <button
            onClick={onStop}
            aria-label="Stop"
            className={`relative ${dim} rounded-full bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center shadow-xl shadow-rose-600/30 active:scale-95 transition`}
          >
            <Square className="w-8 h-8 fill-current" />
            <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">Stop</span>
          </button>
        </div>
        <p className="mt-3 text-sm font-semibold text-rose-600">{recordingLabel}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onStart}
        disabled={disabled}
        aria-label="Record"
        className={`${dim} rounded-full flex flex-col items-center justify-center text-white transition active:scale-95 ${
          disabled ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 hover:scale-105 shadow-lift'
        }`}
      >
        <Mic className="w-9 h-9" />
        <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">Record</span>
      </button>
      <p className="mt-3 text-sm font-semibold text-slate-700">{idleLabel}</p>
    </div>
  );
};

const TaskHeader: React.FC<{ emoji: string; eyebrow: string; title: string; children: React.ReactNode; aside?: React.ReactNode }> = ({
  emoji,
  eyebrow,
  title,
  children,
  aside,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-start gap-4 px-5 md:px-8 pt-6">
    <div className="w-12 h-12 shrink-0 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl" aria-hidden>
      {emoji}
    </div>
    <div className="flex-1 min-w-0">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-2xl font-bold text-slate-900 leading-tight">{title}</h2>
      <div className="mt-1 text-sm text-slate-600 leading-relaxed">{children}</div>
    </div>
    {aside}
  </div>
);

const NoiseWarning: React.FC<{ snrDb: number; min?: number }> = ({ snrDb, min = 15 }) =>
  snrDb < min ? (
    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Background noise is high ({snrDb} dB SNR) — retry in a quieter spot.
    </p>
  ) : null;

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-medium text-slate-400">{label}</p>
    <p className="font-display text-lg font-bold text-slate-900 tabular-nums leading-tight">{value}</p>
    {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
  </div>
);

const fmt = (x: number, unit = '') => (Number.isNaN(x) ? '—' : `${x}${unit}`);

// ---------------------------------------------------------------------------
// 1. Sustained vowel — breath support + voice quality
// ---------------------------------------------------------------------------

const MAX_VOICE_TRIES = 3;
const MPT_EXPECTED: Record<string, number> = { '3–5': 6, '6–8': 8, '9+': 10 };
const PITCH_EXPECTED: Record<string, string> = { '3–5': '250–350 Hz', '6–8': '220–300 Hz', '9+': '190–260 Hz' };

export const VoiceTask: React.FC<{
  speakerId: string;
  age: number;
  attempts: VoiceAttempt[];
  update: Updater<VoiceAttempt[]>;
}> = ({ speakerId, age, attempts, update }) => {
  const cap = useAudioCapture();
  const latest = useRef(attempts);
  latest.current = attempts;
  const best = bestVoiceAttempt(attempts);
  const band = ageBand(age);
  const expected = MPT_EXPECTED[band];
  const pitchRange = PITCH_EXPECTED[band];

  const record = () =>
    cap.start({
      maxMs: 30000,
      onDone: async ({ blob, pcm }) => {
        let hiRes: { pcm: Float32Array; sr: number; offsetSec: number } | undefined;
        try {
          hiRes = { pcm: trimSilence(await decodeHiRes(blob), 48000), sr: 48000, offsetSec: 0 };
        } catch (_) {
          hiRes = undefined;
        }
        const m = analyzeSustainedVowel(pcm, hiRes);
        const n = latest.current.length + 1;
        const audioFilename = `REC_${speakerId.toUpperCase()}_L1V0${n}.WAV`;
        update((prev) => [...prev, { attempt: n, ...m, audioFilename }]);
      },
    });

  const balloonScale = cap.status === 'recording' ? 1 + Math.min(cap.elapsedMs / 1000 / expected, 1.4) : 1;

  return (
    <section className="card overflow-hidden">
      <TaskHeader
        emoji="🎈"
        eyebrow="Voice & breath · Sustained vowel"
        title="Balloon breath: “आआआ…”"
        aside={
          <button onClick={() => speak('आआआआआआआआ', 0.5)} className="btn-secondary h-9 px-3.5 text-sm rounded-full self-start">
            <Volume2 className="w-4 h-4 text-brand-600" /> Listen
          </button>
        }
      >
        Take a big breath, then say <strong className="font-display text-base">“आ”</strong> in one long, steady voice for as long as possible —
        like filling a balloon. Keep the same loudness. Best of {MAX_VOICE_TRIES} tries counts.
      </TaskHeader>

      <div className="mx-4 md:mx-8 my-6 rounded-3xl bg-gradient-to-b from-sky-50 to-white border border-slate-100 py-8 flex flex-col items-center min-h-[17rem] justify-center">
        <div className="h-24 flex items-end justify-center mb-4">
          <span
            className="text-6xl transition-transform duration-200 origin-bottom inline-block"
            style={{ transform: `scale(${balloonScale})` }}
            aria-hidden
          >
            🎈
          </span>
        </div>
        {cap.status === 'recording' && (
          <p className="font-display text-4xl font-bold text-slate-900 tabular-nums mb-4">{(cap.elapsedMs / 1000).toFixed(1)} s</p>
        )}
        <RecordControl
          status={cap.status}
          disabled={attempts.length >= MAX_VOICE_TRIES}
          onStart={record}
          onStop={cap.stop}
          idleLabel={attempts.length >= MAX_VOICE_TRIES ? 'All 3 tries done' : `Try ${attempts.length + 1} of ${MAX_VOICE_TRIES}`}
          recordingLabel="Keep going… tap Stop when the sound ends"
        />
        <p className="mt-2 text-xs text-slate-500">Expected for age {ageBand(age)}: at least {expected} seconds</p>
      </div>

      {attempts.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 md:px-8 py-6 space-y-4 animate-fade-up">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Breath support <StatusPill status={breathStatus(age, attempts)} />
            </span>
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              Voice quality <StatusPill status={voiceQualityStatus(attempts)} />
            </span>
            <button
              onClick={() => update(() => [])}
              disabled={cap.status !== 'idle'}
              className="ml-auto text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear tries
            </button>
          </div>
          <div className="grid gap-3">
            {attempts.map((a) => (
              <div
                key={a.attempt}
                className={`rounded-2xl bg-white border p-4 ${a === best ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200/80'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-700">
                    Try {a.attempt} {a === best && <span className="ml-1 text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">Best</span>}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{a.audioFilename}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  <Stat label="Held for" value={`${a.mptSec} s`} hint={`≥ ${expected}s normal`} />
                  <Stat label="Pitch" value={a.f0Hz ? `${a.f0Hz} Hz` : '—'} hint={`${pitchRange} normal`} />
                  <Stat label="Jitter" value={fmt(a.jitterPct, '%')} hint="≤ 1.5% normal" />
                  <Stat label="Shimmer" value={fmt(a.shimmerPct, '%')} hint="≤ 6% normal" />
                  <Stat label="HNR" value={fmt(a.hnrDb, ' dB')} hint="≥ 12 dB normal" />
                </div>
                <div className="mt-3 space-y-1">
                  {a.mptSec < MIN_VALID_MPT && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> No long “आ” detected — encourage the child to hold the sound and try again.
                    </p>
                  )}
                  <NoiseWarning snrDb={a.snrDb} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------
// 2. DDK — पा-पा-पा and पा-टा-का
// ---------------------------------------------------------------------------

const DDK_MS = 6000;

const DDK_INFO = {
  amr: { title: 'पा-पा-पा', demo: 'पा पा पा पा पा पा पा पा', label: 'Same sound', emoji: '🥁' },
  smr: { title: 'पा-टा-का', demo: 'पाटाका पाटाका पाटाका पाटाका', label: 'Sound sequence', emoji: '🚂' },
} as const;

const DDK_RATE_EXPECTED: Record<'amr' | 'smr', Record<string, number>> = {
  amr: { '3–5': 3.0, '6–8': 3.5, '9+': 4.0 },
  smr: { '3–5': 2.5, '6–8': 3.0, '9+': 3.5 },
};

const DdkPanel: React.FC<{
  kind: 'amr' | 'smr';
  speakerId: string;
  age: number;
  result?: DdkResult;
  onResult: (r: DdkResult) => void;
}> = ({ kind, speakerId, age, result, onResult }) => {
  const cap = useAudioCapture();
  const info = DDK_INFO[kind];
  const remaining = Math.max(0, DDK_MS - cap.elapsedMs);
  const band = ageBand(age);
  const expectedRate = DDK_RATE_EXPECTED[kind][band];
  const expectedSyllables = Math.round(expectedRate * 6);

  const record = () =>
    cap.start({
      maxMs: DDK_MS,
      onDone: ({ pcm }) => {
        const m = analyzeDdk(pcm);
        const audioFilename = `REC_${speakerId.toUpperCase()}_L2${kind.toUpperCase()}.WAV`;
        onResult({ kind, ...m, audioFilename, sequenceCorrect: kind === 'smr' ? result?.sequenceCorrect : undefined });
      },
    });

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{info.label}</p>
          <p className="font-display text-3xl font-bold text-slate-900">
            {info.emoji} {info.title}
          </p>
        </div>
        <button onClick={() => speak(info.demo, 1.1)} className="btn-secondary h-9 px-3 text-sm rounded-full">
          <Volume2 className="w-4 h-4 text-brand-600" /> Listen
        </button>
      </div>

      <div className="my-5 flex flex-col items-center">
        {cap.status === 'recording' && (
          <div className="w-full mb-4">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-rose-500 transition-[width] duration-100" style={{ width: `${(remaining / DDK_MS) * 100}%` }} />
            </div>
            <p className="text-center mt-1 text-xs font-semibold text-rose-600 tabular-nums">{(remaining / 1000).toFixed(1)} s left</p>
          </div>
        )}
        <RecordControl
          size="md"
          status={cap.status}
          onStart={record}
          onStop={cap.stop}
          idleLabel={result ? 'Record again' : 'Fast & clear for 6 seconds'}
          recordingLabel="Faster, faster! 🚀"
        />
      </div>

      {result && (
        <div className="mt-auto pt-4 border-t border-slate-100 space-y-3 animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Result</span>
            <StatusPill status={ddkStatus(age, result)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Rate" value={`${result.ratePerSec}/s`} hint={`≥ ${expectedRate}/s normal`} />
            <Stat label="Syllables" value={result.syllables} hint={`≥ ${expectedSyllables} in 6s normal`} />
            <Stat label="Rhythm" value={result.regularityCv > 0.3 ? 'Uneven' : 'Even'} hint={`CV ${result.regularityCv} (≤ 0.30 normal)`} />
          </div>
          <NoiseWarning snrDb={result.snrDb} min={10} />
          {kind === 'smr' && (
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700 mb-2">Examiner: did the child keep the पा-टा-का order?</p>
              <div className="flex gap-2">
                {[
                  { v: true, label: 'Yes' },
                  { v: false, label: 'No — mixed up' },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => onResult({ ...result, sequenceCorrect: o.v })}
                    className={`btn h-8 px-3 text-xs rounded-lg border ${
                      result.sequenceCorrect === o.v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const DdkTask: React.FC<{
  speakerId: string;
  age: number;
  ddk: ScreeningTasks['ddk'];
  update: Updater<NonNullable<ScreeningTasks['ddk']>>;
}> = ({ speakerId, age, ddk = {}, update }) => (
  <section className="card overflow-hidden">
    <TaskHeader emoji="🚂" eyebrow="Speech motor · Diadochokinesis" title="Train talk">
      Say the sounds as <strong>fast and clearly</strong> as possible, over and over, until the timer ends. Tap Listen to hear an
      example first. Recording stops by itself after 6 seconds.
    </TaskHeader>
    <div className="grid md:grid-cols-2 gap-4 p-4 md:p-8 pt-6">
      {(['amr', 'smr'] as const).map((kind) => (
        <DdkPanel
          key={kind}
          kind={kind}
          speakerId={speakerId}
          age={age}
          result={ddk[kind]}
          onResult={(r) => update((prev) => ({ ...prev, [kind]: r }))}
        />
      ))}
    </div>
  </section>
);

// ---------------------------------------------------------------------------
// 3. Picture naming — speech sounds (PCC)
// ---------------------------------------------------------------------------

export const NamingTask: React.FC<{
  speakerId: string;
  whisperReady: boolean;
  items: NamingItem[];
  update: Updater<NamingItem[]>;
}> = ({ speakerId, whisperReady, items, update }) => {
  const cap = useAudioCapture();
  const [selectedId, setSelectedId] = useState(1);
  const word = PICTURE_WORDS.find((w) => w.id === selectedId) || PICTURE_WORDS[0];
  const result = items.find((i) => i.id === word.id);
  const summary = namingSummary(items);

  const record = () =>
    cap.start({
      asr: true,
      maxMs: 4000,
      onDone: async ({ pcm, browserText }) => {
        let whisperText = '';
        if (whisperReady) {
          try {
            const raw = await transcribeAudio(pcm, 'hindi');
            whisperText = raw && !isDegenerateTranscript(raw, 1) ? ensureDevanagari(raw) : '';
          } catch (err) {
            console.warn('[naming] whisper failed:', err);
          }
        }
        const browser = ensureDevanagari(browserText);
        const score = scoreNamingAttempt(word, [browser, whisperText]);
        const audioFilename = `REC_${speakerId.toUpperCase()}_L3W${word.id.toString().padStart(2, '0')}.WAV`;
        const heard = browser || whisperText;
        // A one-picture answer is 1–3 words ("यह सेब है"); a long transcript means ASR guessed.
        const unclear = heard.split(/\s+/).filter(Boolean).length > 4;
        const item: NamingItem = {
          id: word.id,
          target: word.word,
          heard: heard || '(No speech recorded)',
          ...score,
          noResponse: !heard || unclear,
          audioFilename,
        };
        update((prev) => [...prev.filter((p) => p.id !== word.id), item].sort((a, b) => a.id - b.id));
      },
    });

  const setOverride = (o?: NamingItem['examinerOverride']) =>
    update((prev) => prev.map((p) => (p.id === word.id ? { ...p, examinerOverride: o } : p)));

  const next = PICTURE_WORDS.find((w) => w.id > word.id && !items.some((i) => i.id === w.id)) ?? PICTURE_WORDS.find((w) => !items.some((i) => i.id === w.id));

  return (
    <section className="card overflow-hidden">
      <TaskHeader
        emoji="🖼️"
        eyebrow="Speech sounds · Picture naming"
        title="What is this?"
        aside={
          <div className="text-right shrink-0">
            <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
              {items.length}
              <span className="text-slate-300">/{PICTURE_WORDS.length}</span>
            </p>
            {items.length > 0 && <p className="text-xs text-slate-500">PCC so far {summary.pcc}%</p>}
          </div>
        }
      >
        Show the picture and ask “यह क्या है?”. <strong>Don’t say the word for the child.</strong> Name at least 10 pictures for a
        reliable score; all {PICTURE_WORDS.length} is best.
      </TaskHeader>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem] gap-5 p-4 md:p-8 pt-6">
        {/* Active picture */}
        <div className="rounded-3xl bg-gradient-to-b from-amber-50 to-white border border-slate-100 p-6 flex flex-col items-center text-center">
          <div className="text-[7rem] leading-none select-none" aria-label={`Picture ${word.id}`}>
            {word.emoji}
          </div>
          <button onClick={() => speak('यह क्या है?')} className="mt-3 btn-secondary h-9 px-3.5 text-sm rounded-full">
            <Volume2 className="w-4 h-4 text-brand-600" /> “यह क्या है?”
          </button>
          <div className="mt-5">
            <RecordControl
              size="md"
              status={cap.status}
              onStart={record}
              onStop={cap.stop}
              idleLabel={result ? 'Record again' : 'Tap, then the child names it'}
              recordingLabel="Listening… (stops in 4 s)"
              processingLabel="Checking sounds…"
            />
          </div>

          {result && (
            <div className="w-full mt-6 pt-5 border-t border-amber-100 space-y-3 text-left animate-fade-up">
              <div className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 items-baseline">
                <span className="text-xs text-slate-400">Target</span>
                <span className="font-display text-lg text-slate-600">
                  {word.word} <span className="text-sm text-slate-400">({word.roman})</span>
                </span>
                <span className="text-xs text-slate-400">Heard</span>
                <span className="font-display text-xl font-bold text-slate-900">{result.heard}</span>
              </div>
              {result.noResponse && !result.examinerOverride ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> Nothing clear recognised — record again, or rate it yourself below. Not scored yet.
                </p>
              ) : (() => {
                const e = effectiveNaming(result);
                return (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {e.correct}/{result.consonantsTotal} sounds correct
                    </span>
                    {e.missed.map((m, i) => (
                      <span key={i} className="font-display text-sm font-bold px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                        {m}
                      </span>
                    ))}
                  </div>
                );
              })()}
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">Examiner check — what did you hear?</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: undefined, label: 'Use automatic score' },
                    { v: 'correct' as const, label: 'Said correctly', icon: Check },
                    { v: 'error' as const, label: 'Sound error', icon: X },
                  ].map((o) => (
                    <button
                      key={o.label}
                      onClick={() => setOverride(o.v)}
                      className={`btn h-8 px-3 text-xs rounded-lg border ${
                        result.examinerOverride === o.v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {o.icon && <o.icon className="w-3.5 h-3.5" />}
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {next && (
                <button onClick={() => setSelectedId(next.id)} className="btn-primary w-full h-11">
                  Next picture <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Picture grid */}
        <div>
          <p className="eyebrow mb-2">All pictures</p>
          <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-4 gap-2">
            {PICTURE_WORDS.map((w) => {
              const found = items.find((i) => i.id === w.id);
              const it = found && (!found.noResponse || found.examinerOverride) ? found : undefined;
              const ok = it && effectiveNaming(it).correct === it.consonantsTotal;
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedId(w.id)}
                  disabled={cap.status !== 'idle'}
                  aria-label={`Picture ${w.id}${it ? (ok ? ', correct' : ', sound error') : ''}`}
                  className={`relative aspect-square rounded-xl border text-2xl flex items-center justify-center transition ${
                    w.id === word.id ? 'border-brand-400 ring-2 ring-brand-200 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  {w.emoji}
                  {it && (
                    <span
                      className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white ${
                        ok ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    >
                      {ok ? <Check className="w-2.5 h-2.5" strokeWidth={4} /> : <X className="w-2.5 h-2.5" strokeWidth={4} />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {summary.soundsToWatch.length > 0 && (
            <div className="mt-4 rounded-xl bg-rose-50/60 border border-rose-100 p-3">
              <p className="text-xs font-semibold text-rose-800 mb-1.5">Sounds to watch</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.soundsToWatch.map((s) => (
                  <span key={s} className="font-display text-base font-bold px-2 rounded-lg bg-white text-rose-700 border border-rose-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
