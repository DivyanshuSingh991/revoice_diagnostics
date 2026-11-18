import React, { useState } from 'react';
import { SameSoundGroup, SameSoundChallengeResult } from '../types';
import { SAME_SOUND_GROUPS, evaluateSameSoundRound, aggregateSameSoundChallenge } from '../lib/sameSoundChallenge';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { transcribeAudio, isDegenerateTranscript } from '../lib/whisper';
import { ensureDevanagari } from '../lib/devanagari';
import { pcmToWavBlob } from '../lib/wavEncoder';
import { PapayaIcon } from './PapayaIcon';
import {
  Volume2,
  Mic,
  Square,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Check,
  X,
  Activity,
  FileAudio
} from 'lucide-react';

interface Props {
  speakerId: string;
  age: number;
  whisperReady: boolean;
  result?: SameSoundChallengeResult;
  onResult: (res: SameSoundChallengeResult) => void;
}

const speak = (text: string, rate = 0.85) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'hi-IN';
  u.rate = rate;
  window.speechSynthesis.speak(u);
};

export const SameSoundTask: React.FC<Props> = ({ speakerId, age, whisperReady, result, onResult }) => {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const activeGroup = SAME_SOUND_GROUPS[selectedGroupIndex];

  const cap = useAudioCapture();

  const handleStartRecording = () => {
    cap.start({
      asr: true,
      maxMs: 16000,
      onDone: async ({ rawPcm, durationMs, browserText }) => {
        let whisperText = '';
        if (whisperReady) {
          try {
            const raw = await transcribeAudio(rawPcm, 'hindi');
            whisperText = raw && !isDegenerateTranscript(raw, 4) ? ensureDevanagari(raw) : '';
          } catch (err) {
            console.warn('[same-sound] whisper error:', err);
          }
        }

        const combinedTranscript = (whisperText ? `${whisperText} ${browserText}` : browserText).trim();
        const roundRes = evaluateSameSoundRound(
          1,
          activeGroup,
          combinedTranscript,
          durationMs,
          rawPcm
        );

        const audioFilename = `REC_${speakerId.toUpperCase()}_SS_${activeGroup.romanSound.toUpperCase()}.WAV`;
        roundRes.audioFilename = audioFilename;

        try {
          const wavBlob = pcmToWavBlob(rawPcm, 16000);
          const url = URL.createObjectURL(wavBlob);
          (roundRes as any).audioBlobUrl = url;
        } catch (_) {}

        // Single-round analysis & aggregation
        const aggregated = aggregateSameSoundChallenge(activeGroup, [roundRes], age);
        onResult(aggregated);
      },
    });
  };

  const handleReset = () => {
    onResult({
      targetSound: activeGroup.sound,
      overallAccuracyPct: 0,
      totalWordsCorrect: 0,
      totalWordsIncorrect: 0,
      soundErrors: { substitutions: 0, omissions: 0, distortions: 0 },
      totalTimeTakenMs: 0,
      avgSpeakingRateWpm: 0,
      totalPauses: 0,
      consistencyScore: 0,
      consistencyCategory: 'High',
      rounds: [],
      wordWisePerformance: [],
      soundWisePerformance: [],
      clinicalNotes: '',
    });
  };

  const roundData = result && result.rounds.length > 0 ? result.rounds[0] : null;

  return (
    <section className="card overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-5 md:px-8 pt-6 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600">
            <span>🎯 Articulation &amp; Speech Screening</span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            <span>Single Round Test</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            Same Sound Challenge <span className="text-xl">🔤</span>
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Ask the child to pronounce all 4 simple Hindi words starting with the same sound one by one. The AI ASR models
            will capture what was said, evaluate pronunciation accuracy, and identify correctly vs. incorrectly spoken words.
          </p>
        </div>

        {/* Target Sound Selector */}
        <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
          <span className="text-xs font-semibold text-slate-500">Choose Sound Group:</span>
          <div className="flex flex-wrap gap-1.5">
            {SAME_SOUND_GROUPS.map((grp, idx) => (
              <button
                key={grp.sound}
                onClick={() => {
                  if (idx !== selectedGroupIndex) {
                    setSelectedGroupIndex(idx);
                    handleReset();
                  }
                }}
                disabled={cap.status !== 'idle'}
                className={`w-9 h-9 rounded-xl font-display font-bold text-base transition flex items-center justify-center ${
                  idx === selectedGroupIndex
                    ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {grp.sound}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 md:p-8 space-y-6">
        {/* Active Target Sound Info */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl p-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Target Sound:</span>
            <span className="font-display font-extrabold text-xl text-brand-700 bg-white px-3 py-0.5 rounded-lg border border-slate-200 shadow-xs">
              '{activeGroup.sound}' ({activeGroup.soundLabel})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => speak(activeGroup.words.map((w) => w.hindi).join(', '))}
              className="btn-secondary h-8 px-3 text-xs rounded-full"
            >
              <Volume2 className="w-3.5 h-3.5 text-brand-600" /> Listen all 4
            </button>
            {roundData && (
              <button
                onClick={handleReset}
                disabled={cap.status !== 'idle'}
                className="text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1 transition px-2 py-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Re-record
              </button>
            )}
          </div>
        </div>

        {/* 4 Words Display Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {activeGroup.words.map((w, i) => {
            const wordRes = roundData?.words.find((wr) => wr.targetWord === w.hindi);
            return (
              <div
                key={w.id}
                className={`relative rounded-2xl border p-4 text-center transition ${
                  wordRes
                    ? wordRes.isCorrect
                      ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                      : 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200'
                    : 'bg-white border-slate-200 hover:border-brand-200'
                }`}
              >
                <span className="absolute top-2.5 left-3 text-[11px] font-bold text-slate-400">#{i + 1}</span>
                {wordRes && (
                  <span className="absolute top-2.5 right-3">
                    {wordRes.isCorrect ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-full">
                        <Check className="w-3 h-3" strokeWidth={3} /> Correct
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/90 px-1.5 py-0.5 rounded-full">
                        <X className="w-3 h-3" strokeWidth={3} /> Error
                      </span>
                    )}
                  </span>
                )}

                <div className="h-12 flex items-center justify-center my-1 select-none">
                  {w.id === 'p3' ? (
                    <PapayaIcon className="w-12 h-12" />
                  ) : (
                    <span className="text-4xl">{w.emoji}</span>
                  )}
                </div>
                <h3 className="font-display text-xl font-bold text-slate-800">{w.hindi}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{w.roman} ({w.english})</p>

                {wordRes ? (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-left">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">ASR Heard:</span>
                    <span className={`font-display text-sm font-bold block truncate ${wordRes.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {wordRes.spokenText || '(No speech)'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Accuracy: <strong>{wordRes.accuracyPct}%</strong>
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => speak(w.hindi)}
                    className="mt-2.5 text-[11px] font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-full border border-slate-200"
                  >
                    <Volume2 className="w-3 h-3" /> Say word
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Recording Controls */}
        <div className="rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 p-6 flex flex-col items-center text-center">
          <p className="text-sm font-medium text-slate-700 mb-4">
            Say all 4 words clearly in order:{" "}
            <strong className="text-brand-700">
              {activeGroup.words.map((w) => w.hindi).join(' → ')}
            </strong>
          </p>

          {cap.status === 'recording' ? (
            <div className="flex flex-col items-center">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />
                <button
                  onClick={cap.stop}
                  className="relative w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center shadow-lg active:scale-95 transition"
                >
                  <Square className="w-7 h-7 fill-current" />
                  <span className="text-[10px] font-bold mt-1">STOP</span>
                </button>
              </div>
              <p className="mt-3 text-sm font-bold text-rose-600 animate-pulse">
                Listening… Say all 4 words ({(cap.elapsedMs / 1000).toFixed(1)} s)
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <button
                onClick={handleStartRecording}
                className="w-20 h-20 rounded-full bg-brand-600 hover:bg-brand-700 text-white flex flex-col items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition"
              >
                <Mic className="w-8 h-8" />
                <span className="text-[10px] font-bold mt-1 uppercase">
                  {roundData ? 'Record Again' : 'Record'}
                </span>
              </button>
              <p className="mt-3 text-sm font-semibold text-slate-700">
                {roundData ? 'Tap to re-record response' : 'Tap to record complete audio'}
              </p>
            </div>
          )}
        </div>

        {/* Immediate Result & ASR Speech Analysis */}
        {roundData && (
          <div className="rounded-2xl border-2 border-brand-200 bg-white p-5 space-y-4 animate-fade-up shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Speech Analysis &amp; ASR Result
                </span>
                <h4 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  Accuracy: <span className="text-brand-600">{roundData.accuracyPct}%</span> ·{' '}
                  <span className="text-emerald-700">{roundData.wordsCorrect} Correct</span>
                  {roundData.wordsIncorrect > 0 && (
                    <span className="text-rose-600"> · {roundData.wordsIncorrect} Incorrect</span>
                  )}
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
                <span>⏱️ {(roundData.durationMs / 1000).toFixed(1)} s total</span>
                <span>🗣️ {roundData.speakingRateWpm} WPM</span>
                <span>⏸️ {roundData.pauseCount} pauses</span>
              </div>
            </div>

            {/* Complete ASR Spoken Transcript */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Complete ASR Recognized Speech:
              </span>
              <p className="font-display text-base font-bold text-slate-800">
                {roundData.spokenTranscript ? `"${roundData.spokenTranscript}"` : '(No speech detected)'}
              </p>
            </div>

            {/* Word-by-Word Breakdown Cards */}
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                Word-by-Word Pronunciation Result:
              </span>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {roundData.words.map((w) => (
                  <div
                    key={w.wordId}
                    className={`rounded-xl border p-3 flex items-start justify-between gap-2 ${
                      w.isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 flex items-center justify-center select-none shrink-0">
                        {w.wordId === 'p3' ? <PapayaIcon className="w-8 h-8" /> : <span className="text-2xl">{w.emoji}</span>}
                      </span>
                      <div>
                        <span className="font-display font-bold text-slate-900 text-sm block">
                          Target: {w.targetWord}
                        </span>
                        <span className="text-xs text-slate-600 block">
                          Said: <strong className={w.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>{w.spokenText}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${
                          w.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {w.isCorrect ? 'Correct' : 'Needs Practice'}
                      </span>
                      <span className="block text-[11px] font-mono text-slate-500 mt-1">{w.accuracyPct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sound Errors (Substitutions, Omissions, Distortions) */}
            {roundData.soundErrors.length > 0 ? (
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                  Identified Sound Variations:
                </span>
                <div className="grid sm:grid-cols-2 gap-2">
                  {roundData.soundErrors.map((err, idx) => (
                    <div
                      key={idx}
                      className={`text-xs p-2.5 rounded-xl border flex items-start gap-2 ${
                        err.type === 'substitution'
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : err.type === 'omission'
                          ? 'bg-rose-50 text-rose-900 border-rose-200'
                          : 'bg-sky-50 text-sky-900 border-sky-200'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold uppercase tracking-wider text-[10px] block">
                          {err.type} ({err.position} sound)
                        </span>
                        <span>{err.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                All words pronounced with clear target consonants!
              </div>
            )}

            {/* Clinical screening reminder */}
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 leading-relaxed">
              💡 <em>Clinical Note:</em> {result?.clinicalNotes}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
