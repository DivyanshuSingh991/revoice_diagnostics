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
  AlertTriangle,
  Sparkles,
  Lightbulb
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
    <div className="grid grid-cols-1 lg:grid-cols-[19.5rem_minmax(0,1fr)] gap-5 lg:gap-6 items-start animate-fade-up">
      {/* Sidebar: child, progress, sentence list, report */}
      <aside className="min-w-0 rounded-[32px] sm:rounded-[36px] border-4 border-[#BAE6FD] bg-white/95 backdrop-blur-md shadow-[0_20px_50px_-12px_rgba(56,189,248,0.22)] p-5 md:p-6 lg:sticky lg:top-24 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-300 flex items-center justify-center text-2xl shadow-xs" aria-hidden>
            🐰
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1 bg-[#E0F2FE] border border-[#BAE6FD] px-2.5 py-0.5 rounded-full text-[10px] font-black text-[#0369A1] uppercase tracking-wider mb-0.5">
              Practice station
            </div>
            <p className="font-display text-lg font-extrabold text-[#0F2744] truncate leading-tight">{childName}</p>
            <p className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 mt-0.5">
              {speakerId.toUpperCase()}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
            <span className="text-slate-600">Recorded</span>
            <span className="text-[#0369A1] bg-[#E0F2FE] px-2.5 py-0.5 rounded-full font-mono font-bold tabular-nums">
              {completedCount} of {sentences.length}
            </span>
          </div>
          <div className="h-3 rounded-full bg-[#E0F2FE] border border-[#BAE6FD]/70 overflow-hidden p-0.5">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-[width] duration-500 shadow-xs" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* All 5 sentences, any order */}
        <nav aria-label="Sentences">
          <p className="text-xs font-black text-[#0369A1] uppercase tracking-wider mb-2.5 hidden lg:flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Choose any sentence
          </p>
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
                  className={`shrink-0 lg:w-full flex items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-2xl border-2 text-left transition-all ${
                    isCurrent
                      ? 'border-[#38BDF8] bg-gradient-to-r from-[#E0F2FE] via-[#EDE9FE]/50 to-[#E0F2FE] shadow-sm'
                      : isCompleted
                      ? 'border-[#86EFAC] bg-[#F0FDF4] hover:bg-[#DCFCE7]/70'
                      : 'border-slate-200 bg-white hover:border-[#BAE6FD] hover:bg-blue-50/30'
                  }`}
                >
                  <span
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold shadow-xs ${
                      isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-gradient-to-br from-[#0284C7] to-[#2563EB] text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : s.id}
                  </span>
                  <span className={`min-w-0 flex-1 ${isCompleted ? '' : 'hidden lg:block'}`}>
                    <span className="hidden lg:block font-display text-[15px] font-bold text-[#0F2744] truncate">
                      {s.hindi}
                    </span>
                    <span className={`block text-xs truncate font-medium ${isCompleted ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
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
        <div className="pt-4 border-t-2 border-dashed border-[#BAE6FD] space-y-2.5">
          {completedCount >= 1 ? (
            <button
              onClick={handleGenerateReportClick}
              className="w-full py-3.5 px-4 rounded-full bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] hover:from-[#1D4ED8] hover:to-[#172554] text-white font-extrabold text-sm shadow-[0_8px_20px_-4px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 border-2 border-dashed border-white/60 hover:scale-[1.01] active:scale-[0.99]"
            >
              <FileText className="w-4 h-4" />
              <span>Generate Diagnosis Report</span>
            </button>
          ) : (
            <div className="bg-[#FFFDF5] border-2 border-dashed border-[#FCD34D] rounded-2xl p-3 text-xs text-amber-900 font-medium flex items-center gap-2 shadow-2xs">
              <Lock className="w-4 h-4 shrink-0 text-amber-500" />
              <span>Record any 1 sentence to unlock the report</span>
            </div>
          )}
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 justify-center">
            <Download className="w-3.5 h-3.5 text-blue-500" /> Each recording downloads automatically as WAV
          </p>
        </div>
      </aside>

      {/* Active Sentence Practice Card */}
      <section className="min-w-0 rounded-[32px] sm:rounded-[36px] border-4 border-[#BAE6FD] bg-white/95 backdrop-blur-md shadow-[0_20px_50px_-12px_rgba(56,189,248,0.22)] p-6 md:p-8 space-y-6 relative overflow-visible">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 bg-[#E0F2FE] border-2 border-[#BAE6FD] px-4 py-1.5 rounded-full shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-black tracking-wider text-[#0369A1] uppercase">
              Sentence {currentSentence.id} <span className="text-[#0284C7]/60">of {sentences.length}</span>
            </span>
          </div>
          <button
            onClick={() => playTTSPrompt(currentSentence.hindi)}
            className="px-4 py-2 rounded-full border-2 border-[#BAE6FD] bg-[#E0F2FE]/70 hover:bg-[#E0F2FE] text-[#0369A1] font-bold text-xs flex items-center gap-2 transition-all shadow-2xs hover:scale-105 active:scale-95"
          >
            <Volume2 className="w-4 h-4 text-[#0284C7]" />
            <span>Listen</span>
          </button>
        </div>

        {/* Large Sentence Display */}
        <div className="pt-2 pb-2 text-center">
          <h2 className="text-3xl md:text-[2.65rem] font-black text-[#0F2744] leading-snug tracking-tight">
            {currentSentence.hindi}
          </h2>
          <p className="mt-2 text-base md:text-xl font-bold text-slate-500">
            {currentSentence.roman}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FFFBEB] border border-amber-200/80 text-xs text-amber-900 font-medium shadow-2xs">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Can’t read yet? Tap <strong className="font-extrabold text-[#451A03]">Listen</strong> and let the child repeat the sentence.</span>
          </div>
        </div>

        {/* Mic Recording Button Area */}
        <div className="rounded-3xl bg-gradient-to-b from-[#F0F9FF]/90 via-white to-[#F0F9FF]/60 border-2 border-dashed border-[#BAE6FD] py-8 px-4 flex flex-col items-center text-center min-h-[16rem] justify-center relative shadow-inner">
          {!isRecording && !isProcessing && (
            <>
              <button
                disabled={!whisperReady}
                onClick={startRecording}
                aria-label="Record"
                className={`w-30 h-30 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center text-white transition-all duration-200 active:scale-95 ${
                  whisperReady
                    ? 'bg-gradient-to-b from-[#38BDF8] via-[#2563EB] to-[#1D4ED8] hover:from-[#60A5FA] hover:to-[#1E40AF] shadow-[0_14px_30px_-6px_rgba(37,99,235,0.45)] border-3 border-dashed border-white/70 hover:scale-105'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <Mic className="w-12 h-12 text-white drop-shadow-sm" />
                <span className="text-[11px] font-black mt-1 uppercase tracking-wider">Record</span>
              </button>
              <p className="mt-5 text-lg font-extrabold text-[#0F2744]">
                {whisperReady ? 'Tap to Speak Sentence' : 'AI Model Initializing...'}
              </p>
              <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                Saves as
                <code className="font-mono font-bold text-[#0369A1] bg-[#E0F2FE] border border-[#BAE6FD] px-2.5 py-0.5 rounded-lg text-xs">
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
                  className="relative w-30 h-30 sm:w-32 sm:h-32 rounded-full bg-gradient-to-b from-[#FB7185] to-[#E11D48] text-white flex flex-col items-center justify-center shadow-[0_14px_30px_-6px_rgba(225,29,72,0.45)] border-3 border-dashed border-white/80 hover:bg-rose-700 active:scale-95 transition"
                >
                  <Square className="w-10 h-10 fill-current" />
                  <span className="text-[11px] font-black mt-1 uppercase tracking-wider">Stop</span>
                </button>
              </div>
              <div className="mt-6 flex items-end gap-1.5 h-7" aria-hidden>
                {[0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2].map((d, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-full rounded-full bg-rose-500 origin-bottom motion-safe:animate-level"
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </div>
              <p className="mt-4 text-lg font-extrabold text-rose-600 animate-pulse">
                Child is speaking… tap Stop when finished
              </p>
            </>
          )}

          {isProcessing && (
            <>
              <div className="w-14 h-14 border-4 border-[#BAE6FD] border-t-[#0284C7] rounded-full animate-spin"></div>
              <p className="mt-5 text-lg font-extrabold text-[#0F2744]">Listening carefully…</p>
              <p className="text-sm font-medium text-slate-500">Whisper is transcribing the Hindi speech and checking clarity</p>
            </>
          )}
        </div>

        {/* Child Friendly Cheer & Results */}
        {recentEval && (
          <div className="border-t-2 border-dashed border-[#BAE6FD] bg-[#F8FAFC]/60 rounded-3xl p-5 md:p-6 space-y-5 animate-fade-up">
            {/* Encouraging Cartoon Toast */}
            <div className="flex items-center gap-4 p-4 rounded-3xl bg-gradient-to-r from-amber-100 via-[#FEF3C7] to-amber-50 border-2 border-amber-300 shadow-sm">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-white/90 flex items-center justify-center text-3xl motion-safe:animate-bounce shadow-xs">
                {cheerMsg.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-amber-950 text-lg leading-tight">{cheerMsg.title}</h4>
                <p className="text-sm text-amber-900 font-medium">{cheerMsg.phrase}</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#0369A1] bg-white px-3 py-1 rounded-full border border-blue-200 shadow-2xs">
                <Download className="w-3.5 h-3.5 text-blue-500" />
                {recentEval.audioFilename || getAudioFileName(currentSentence.id)}
              </span>
            </div>

            {/* Target vs what the child said */}
            <div className="rounded-3xl bg-white border-2 border-[#DDD6FE] divide-y-2 divide-dashed divide-slate-100 shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#F5F3FF] to-white">
                <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">Transcript</span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-0.5 rounded-full">
                  Browser ASR + Whisper
                </span>
              </div>
              <div className="px-5 py-4 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2.5 items-baseline">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target</span>
                <p className="text-lg text-slate-600 font-bold leading-snug">{recentEval.targetSentence}</p>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Heard</span>
                <p className="text-xl font-black text-[#0F2744] leading-snug">{recentEval.spokenWhisperText}</p>
              </div>
              {recentEval.detectedIssues.length > 0 && (
                <div className="px-5 py-3 flex flex-wrap gap-2 bg-[#FFFBEB]/60">
                  {recentEval.detectedIssues.map((issue, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100/80 text-amber-900 border border-amber-300 flex items-center gap-1.5"
                    >
                      <Activity className="w-3.5 h-3.5 text-amber-600" />
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
                    Longest pause <strong className="text-slate-700 tabular-nums font-bold">{(recentEval.longestPauseMs / 1000).toFixed(1)} s</strong>
                  </span>
                )}
                {recentEval.missedWords && recentEval.missedWords.length > 0 && (
                  <span>
                    Missed or changed: <strong className="font-display text-sm text-slate-700 font-bold">{recentEval.missedWords.join(', ')}</strong>
                  </span>
                )}
                {recentEval.snrDb !== undefined && recentEval.snrDb < 15 && (
                  <span className="flex items-center gap-1 font-bold text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Noisy recording ({recentEval.snrDb} dB) — try a quieter spot
                  </span>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={startRecording}
                className="py-3 px-5 rounded-full border-2 border-[#BAE6FD] bg-[#E0F2FE]/70 hover:bg-[#E0F2FE] text-[#0369A1] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs flex-1"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try again</span>
              </button>

              {currentSentence.id < sentences.length && (
                <button
                  onClick={() => {
                    setSelectedSentenceId(currentSentence.id + 1);
                    setRecentEval(evaluationsMap[currentSentence.id + 1] || null);
                  }}
                  className="py-3 px-5 rounded-full bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] hover:from-[#1D4ED8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(37,99,235,0.4)] border-2 border-dashed border-white/60 transition-all flex-1"
                >
                  <span>Next sentence</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleGenerateReportClick}
                className="py-3 px-5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md border-2 border-dashed border-white/60 transition-all flex-1"
              >
                <FileText className="w-4 h-4" />
                <span>Generate report</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
