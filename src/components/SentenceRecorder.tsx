import React, { useState, useRef, useEffect } from 'react';
import { SentenceItem, SentenceEvaluation } from '../types';
import { blobToFloat32Array, transcribeAudio, isDegenerateTranscript } from '../lib/whisper';
import { evaluateDualSentence } from '../lib/speechAnalysis';
import { pcmToWavBlob } from '../lib/wavEncoder';
import { ensureDevanagari } from '../lib/devanagari';
import { savePromptRecord } from '../lib/dbService';
import { analyzePauses } from '../lib/acoustics';
import confetti from 'canvas-confetti';
import {
  Mic,
  Square,
  RotateCcw,
  Volume2,
  FileText,
  Download,
  Check,
  Lock,
  ArrowRight,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { MetricMeter } from './ui';

interface Props {
  sentences: SentenceItem[];
  onGenerateReport: (evaluations: SentenceEvaluation[]) => void;
  onEvaluationsChange?: (evaluations: SentenceEvaluation[]) => void;
  whisperReady: boolean;
  childName: string;
  speakerId: string;
}

const CARTOON_CHEERS = [
  { emoji: "🌟", title: "Hurrah! Super Job!", phrase: "You tried so well! You speak like a little champ!" },
  { emoji: "🎉", title: "Woohoo! Great Effort!", phrase: "Awesome speaking! That was wonderful and clear!" },
  { emoji: "🐰", title: "Fantastic Speaking!", phrase: "High five! You pronounced it with great courage!" },
  { emoji: "🚀", title: "Rocket Fast!", phrase: "Keep going, little star! You are doing amazing!" },
  { emoji: "🦁", title: "Brave Voice!", phrase: "Lion-heart effort! Your voice is getting clearer every time!" }
];

export const SentenceRecorder: React.FC<Props> = ({
  sentences,
  onGenerateReport,
  onEvaluationsChange,
  whisperReady,
  childName,
  speakerId
}) => {
  const [selectedSentenceId, setSelectedSentenceId] = useState<number>(1);
  const [evaluationsMap, setEvaluationsMap] = useState<Record<number, SentenceEvaluation>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentEval, setRecentEval] = useState<SentenceEvaluation | null>(null);
  const [cheerMsg, setCheerMsg] = useState(CARTOON_CHEERS[0]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordStartTimeRef = useRef<number>(0);

  // Browser Web Speech API ASR references (exact ReVoice dual-engine pipeline)
  const recognitionRef = useRef<any>(null);
  const browserTranscriptRef = useRef<string>('');

  useEffect(() => {
    onEvaluationsChange?.(Object.values(evaluationsMap));
  }, [evaluationsMap]);

  const currentSentence = sentences.find(s => s.id === selectedSentenceId) || sentences[0];
  const completedCount = Object.keys(evaluationsMap).length;

  const getAudioFileName = (sid: number) => {
    const sIdFormatted = sid.toString().padStart(2, '0');
    return `REC_${speakerId.toUpperCase()}_L0S${sIdFormatted}.WAV`;
  };

  const triggerAutoAudioDownload = (wavBlob: Blob, sentenceId: number) => {
    try {
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = getAudioFileName(sentenceId);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Auto download audio error:', e);
    }
  };

  // Helper to init browser SpeechRecognition for Hindi
  const startBrowserASR = () => {
    browserTranscriptRef.current = '';
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[Browser ASR] Web Speech API not supported in this browser.');
      return;
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.lang = 'hi-IN';
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 1;

      recognizer.onresult = (event: any) => {
        let finalStr = '';
        for (let i = 0; i < event.results.length; i++) {
          finalStr += event.results[i][0].transcript + ' ';
        }
        browserTranscriptRef.current = finalStr.trim();
      };

      recognizer.onerror = (e: any) => {
        console.warn('[Browser ASR] error:', e?.error || e);
      };

      recognizer.onend = () => {
        // Recognizer ended
      };

      recognizer.start();
      recognitionRef.current = recognizer;
    } catch (err) {
      console.warn('[Browser ASR] failed to start:', err);
    }
  };

  const stopBrowserASR = (): string => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    return browserTranscriptRef.current.trim();
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      // Start Browser Web Speech API in parallel with MediaRecorder (Exact ReVoice pattern)
      startBrowserASR();

      recordStartTimeRef.current = performance.now();
      recorder.start();
      setIsRecording(true);
      setRecentEval(null);
    } catch (err: any) {
      alert('Microphone access denied: ' + (err.message || err));
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    setIsRecording(false);
    setIsProcessing(true);

    // Stop browser ASR
    const capturedBrowserASR = stopBrowserASR();

    const recorder = mediaRecorderRef.current;
    recorder.onstop = async () => {
      try {
        const durationMs = Math.max(500, performance.now() - recordStartTimeRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // 1. Decode audio into 16kHz PCM Float32 for Whisper with exact trimSilence from ReVoice
        const pcmData = await blobToFloat32Array(audioBlob);

        // 2. Convert PCM Float32 into lossless, high-quality 16-bit WAV file and auto-download!
        const wavBlob = pcmToWavBlob(pcmData, 16000);
        triggerAutoAudioDownload(wavBlob, currentSentence.id);

        // 3. Client-side Whisper STT (language: 'hindi'). If Whisper could not load on this
        //    device, continue with browser ASR alone instead of discarding the recording.
        let rawWhisper = '';
        try {
          rawWhisper = await transcribeAudio(pcmData, 'hindi');
        } catch (whisperErr) {
          console.warn('[Whisper] unavailable, using browser ASR only:', whisperErr);
        }
        const promptWordCount = currentSentence.hindi.trim().split(/\s+/).filter(Boolean).length;

        let whisperDevanagari = '';
        if (rawWhisper && isDegenerateTranscript(rawWhisper, promptWordCount)) {
          console.warn('[Whisper] Degenerate decode loop discarded:', rawWhisper);
          whisperDevanagari = '';
        } else {
          // Normalize any Perso-Arabic or Roman characters into Devanagari Hindi
          whisperDevanagari = ensureDevanagari(rawWhisper);
        }

        // Clean browser ASR output (ensure strict Hindi Devanagari)
        const browserDevanagari = ensureDevanagari(capturedBrowserASR || browserTranscriptRef.current);

        // 4. Clinical Dual Speech Clarity Evaluation (Exact ReVoice dual-engine logic)
        // Combines Browser ASR Devanagari with Whisper Phonetic STT
        const evalResult = evaluateDualSentence(
          currentSentence,
          whisperDevanagari,
          browserDevanagari,
          durationMs
        );
        // Silent pauses inside the sentence (possible blocks) and recording noise level
        const pauses = analyzePauses(pcmData);
        evalResult.longestPauseMs = pauses.longestPauseMs;
        evalResult.pauseCount = pauses.pauseCount;
        evalResult.snrDb = pauses.snrDb;
        if (pauses.longestPauseMs >= 1200) {
          evalResult.detectedIssues.push('Long mid-sentence pause (possible block / hesitation)');
        }
        evalResult.speakerId = speakerId.toUpperCase();
        evalResult.audioFilename = getAudioFileName(currentSentence.id);
        setRecentEval(evalResult);

        // Save into evaluation dictionary
        setEvaluationsMap(prev => ({
          ...prev,
          [currentSentence.id]: evalResult
        }));

        // Real-time auto sync to Supabase sentence_records table
        savePromptRecord(speakerId, evalResult, currentSentence.roman).catch(err => {
          console.warn('[DB] prompt save error caught:', err);
        });

        // Pick random encouraging cartoon cheer
        const cheer = CARTOON_CHEERS[Math.floor(Math.random() * CARTOON_CHEERS.length)];
        setCheerMsg(cheer);

        // Pop celebratory confetti!
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 }
          });
        } catch (_) {}

      } catch (err: any) {
        console.error('Error during whisper/ASR processing:', err);
        const fallback = evaluateDualSentence(
          currentSentence,
          '',
          browserTranscriptRef.current,
          1000
        );
        fallback.feedback = 'Microphone error: ' + (err.message || 'Audio not processed');
        setRecentEval(fallback);
      } finally {
        setIsProcessing(false);
        recorder.stream.getTracks().forEach(t => t.stop());
      }
    };

    recorder.stop();
  };

  const playTTSPrompt = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      utter.rate = 0.82;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleGenerateReportClick = () => {
    const list = Object.values(evaluationsMap);
    if (list.length === 0) {
      alert('Please record at least 1 sentence before generating diagnosis report!');
      return;
    }
    onGenerateReport(list);
  };

  const progressPct = Math.round((completedCount / sentences.length) * 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[19rem_minmax(0,1fr)] gap-5 lg:gap-6 items-start animate-fade-up">
      {/* Sidebar: child, progress, sentence list, report */}
      <aside className="min-w-0 card p-4 md:p-5 lg:sticky lg:top-24 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl" aria-hidden>
            🐰
          </div>
          <div className="min-w-0">
            <p className="eyebrow">Practice station</p>
            <p className="font-display text-lg font-bold text-slate-900 truncate leading-tight">{childName}</p>
            <p className="font-mono text-[11px] font-semibold text-brand-700">{speakerId.toUpperCase()}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-slate-600">Recorded</span>
            <span className="font-semibold text-slate-800 tabular-nums">{completedCount} of {sentences.length}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* All 5 sentences, any order */}
        <nav aria-label="Sentences">
          <p className="eyebrow mb-2 hidden lg:block">Choose any sentence</p>
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible -mx-1 px-1 pb-1 lg:pb-0">
            {sentences.map((s) => {
              const isCompleted = !!evaluationsMap[s.id];
              const isCurrent = s.id === selectedSentenceId;
              const evalData = evaluationsMap[s.id];

              return (
                <button
                  type="button"
                  key={s.id}
                  aria-current={isCurrent ? 'true' : undefined}
                  aria-label={`Sentence ${s.id}: ${s.hindi}`}
                  onClick={() => {
                    setSelectedSentenceId(s.id);
                    setRecentEval(evalData || null);
                  }}
                  className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 p-1.5 lg:p-3 rounded-2xl border text-left transition ${
                    isCurrent
                      ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : s.id}
                  </span>
                  <span className={`min-w-0 flex-1 ${isCompleted ? '' : 'hidden lg:block'}`}>
                    <span className="hidden lg:block font-display text-[15px] font-semibold text-slate-800 truncate">
                      {s.hindi}
                    </span>
                    <span className={`block text-xs truncate ${isCompleted ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                      {isCompleted ? (
                        <>
                          {evalData.clarityPct}%<span className="hidden lg:inline"> clarity</span>
                        </>
                      ) : 'Tap to try'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Generate Report Button visible whenever at least 1 sentence has been spoken */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          {completedCount >= 1 ? (
            <button onClick={handleGenerateReportClick} className="btn-primary w-full h-12">
              <FileText className="w-4 h-4" />
              Generate Diagnosis Report
            </button>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              Record any 1 sentence to unlock the report
            </p>
          )}
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Download className="w-3 h-3" /> Each recording downloads automatically as WAV
          </p>
        </div>
      </aside>

      {/* Active Sentence Practice Card */}
      <section className="min-w-0 card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 md:px-8 pt-5 md:pt-6">
          <span className="eyebrow">
            Sentence {currentSentence.id} <span className="text-slate-300">of {sentences.length}</span>
          </span>
          <button
            onClick={() => playTTSPrompt(currentSentence.hindi)}
            className="btn-secondary h-9 px-3.5 text-sm rounded-full"
          >
            <Volume2 className="w-4 h-4 text-brand-600" />
            Listen
          </button>
        </div>

        {/* Large Sentence Display */}
        <div className="px-5 md:px-10 pt-6 pb-8 text-center">
          <h2 className="text-3xl md:text-[2.6rem] font-bold text-slate-900 leading-snug">
            {currentSentence.hindi}
          </h2>
          <p className="mt-2 text-base md:text-lg text-slate-500">
            {currentSentence.roman}
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Can’t read yet? Tap <strong className="font-semibold text-slate-500">Listen</strong> and let the child repeat the sentence.
          </p>
        </div>

        {/* Mic Recording Button Area */}
        <div className="mx-4 md:mx-8 mb-6 rounded-3xl bg-gradient-to-b from-slate-50 to-white border border-slate-100 py-8 px-4 flex flex-col items-center text-center min-h-[15rem] justify-center">
          {!isRecording && !isProcessing && (
            <>
              <button
                disabled={!whisperReady}
                onClick={startRecording}
                aria-label="Record"
                className={`w-28 h-28 rounded-full flex flex-col items-center justify-center text-white transition duration-200 active:scale-95 ${
                  whisperReady
                    ? 'bg-brand-600 hover:bg-brand-700 hover:scale-105 shadow-lift'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <Mic className="w-11 h-11" />
                <span className="text-[11px] font-bold mt-1 uppercase tracking-wider">Record</span>
              </button>
              <p className="mt-5 font-display text-lg font-semibold text-slate-800">
                {whisperReady ? 'Tap to Speak Sentence' : 'AI Model Initializing...'}
              </p>
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
                Saves as
                <code className="font-mono font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
                  {getAudioFileName(currentSentence.id)}
                </code>
              </p>
            </>
          )}

          {isRecording && (
            <>
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-rose-500/40 motion-safe:animate-pulse-ring"></span>
                <span className="absolute inset-0 rounded-full bg-rose-500/30 motion-safe:animate-pulse-ring [animation-delay:0.8s]"></span>
                <button
                  onClick={stopRecording}
                  aria-label="Stop"
                  className="relative w-28 h-28 rounded-full bg-rose-600 text-white flex flex-col items-center justify-center shadow-xl shadow-rose-600/30 hover:bg-rose-700 active:scale-95 transition"
                >
                  <Square className="w-9 h-9 fill-current" />
                  <span className="text-[11px] font-bold mt-1 uppercase tracking-wider">Stop</span>
                </button>
              </div>
              <div className="mt-6 flex items-end gap-1 h-6" aria-hidden>
                {[0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2].map((d, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-full rounded-full bg-rose-400 origin-bottom motion-safe:animate-level"
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </div>
              <p className="mt-3 font-display text-lg font-semibold text-rose-600">
                Child is speaking… tap Stop when finished
              </p>
            </>
          )}

          {isProcessing && (
            <>
              <div className="w-14 h-14 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div>
              <p className="mt-5 font-display text-lg font-semibold text-slate-800">Listening carefully…</p>
              <p className="text-sm text-slate-500">Processing Hindi speech audio and evaluating clarity…</p>
            </>
          )}
        </div>

        {/* Child Friendly Cheer & Results */}
        {recentEval && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 md:px-8 py-6 space-y-5 animate-fade-up">
            {/* Encouraging Cartoon Toast */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-100 to-orange-50 border border-amber-200/70">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/80 flex items-center justify-center text-3xl motion-safe:animate-bounce">
                {cheerMsg.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-amber-900 text-lg leading-tight">{cheerMsg.title}</h4>
                <p className="text-sm text-amber-800">{cheerMsg.phrase}</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-900 bg-white/80 px-2.5 py-1 rounded-full border border-amber-200">
                <Download className="w-3 h-3" />
                {recentEval.audioFilename || getAudioFileName(currentSentence.id)}
              </span>
            </div>

            {/* Target vs what the child said (Clean Devanagari Hindi STT) */}
            <div className="rounded-2xl bg-white border border-slate-200/80 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="eyebrow">Transcript</span>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Speech Analysis
                </span>
              </div>
              <div className="px-4 py-3 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 items-baseline">
                <span className="text-xs font-medium text-slate-400">Target</span>
                <p className="font-display text-lg text-slate-500 leading-snug">{recentEval.targetSentence}</p>
                <span className="text-xs font-medium text-slate-400">Heard</span>
                <p className="font-display text-xl font-bold text-slate-900 leading-snug">{recentEval.spokenWhisperText}</p>
              </div>
              {recentEval.detectedIssues.length > 0 && (
                <div className="px-4 py-3 flex flex-wrap gap-1.5">
                  {recentEval.detectedIssues.map((issue, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5"
                    >
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      {issue}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Metric Meters (ReVoice Clarity Engine) */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${recentEval.accuracyPct !== undefined ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
              <MetricMeter metric="clarity" value={recentEval.clarityPct} />
              {recentEval.accuracyPct !== undefined && <MetricMeter metric="accuracy" value={recentEval.accuracyPct} />}
              <MetricMeter metric="repetition" value={recentEval.repetitionPct} />
              <MetricMeter metric="sustain" value={recentEval.prolongationPct} />
            </div>

            {(recentEval.longestPauseMs !== undefined || recentEval.snrDb !== undefined) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                {recentEval.longestPauseMs !== undefined && (
                  <span>
                    Longest pause <strong className="text-slate-700 tabular-nums">{(recentEval.longestPauseMs / 1000).toFixed(1)} s</strong>
                  </span>
                )}
                {recentEval.missedWords && recentEval.missedWords.length > 0 && (
                  <span>
                    Missed or changed: <strong className="font-display text-sm text-slate-700">{recentEval.missedWords.join(', ')}</strong>
                  </span>
                )}
                {recentEval.snrDb !== undefined && recentEval.snrDb < 15 && (
                  <span className="flex items-center gap-1 font-medium text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Noisy recording ({recentEval.snrDb} dB) — try a quieter spot
                  </span>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={startRecording} className="btn-secondary h-12 px-5 flex-1">
                <RotateCcw className="w-4 h-4" />
                Try again
              </button>

              {currentSentence.id < sentences.length && (
                <button
                  onClick={() => {
                    setSelectedSentenceId(currentSentence.id + 1);
                    setRecentEval(evaluationsMap[currentSentence.id + 1] || null);
                  }}
                  className="btn-primary h-12 px-5 flex-1"
                >
                  Next sentence
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleGenerateReportClick}
                className="btn h-12 px-5 flex-1 bg-slate-900 text-white hover:bg-slate-800"
              >
                <FileText className="w-4 h-4" />
                Generate report
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
