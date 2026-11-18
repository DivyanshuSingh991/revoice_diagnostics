import { useCallback, useEffect, useRef, useState } from 'react';
import { blobToFloat32Array, blobToRawFloat32Array, trimSilence } from '../lib/whisper';
import { pcmToWavBlob } from '../lib/wavEncoder';

export interface CaptureResult {
  blob: Blob;
  pcm: Float32Array; // 16 kHz, silence-trimmed
  rawPcm: Float32Array; // 16 kHz, untrimmed original recording
  durationMs: number;
  browserText: string;
}

interface StartOptions {
  /** Stop automatically after this many ms. */
  maxMs?: number;
  /** Run browser Hindi speech recognition alongside the recording. */
  asr?: boolean;
  onDone: (result: CaptureResult) => void;
  onError?: (err: any) => void;
}

/** Microphone capture shared by the screening tasks (same pipeline as the sentence recorder). */
export function useAudioCapture() {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveVolume, setLiveVolume] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number>();
  const autoStopRef = useRef<number>();
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const optionsRef = useRef<StartOptions | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>();

  const clearTimers = () => {
    window.clearInterval(tickRef.current);
    window.clearTimeout(autoStopRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    clearTimers();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setStatus('processing');
    recorder.stop();
  }, []);

  const startRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    try {
      const recognizer = new SpeechRecognition();
      recognizer.lang = 'hi-IN';
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 1;
      recognizer.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript + ' ';
        transcriptRef.current = text.trim();
      };
      recognizer.onerror = (e: any) => console.warn('[Browser ASR] error:', e?.error || e);
      recognizer.start();
      recognitionRef.current = recognizer;
    } catch (err) {
      console.warn('[Browser ASR] failed to start:', err);
    }
  };

  const start = useCallback(
    async (options: StartOptions) => {
      if (recorderRef.current?.state === 'recording') return;
      optionsRef.current = options;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err: any) {
        alert('Microphone access denied: ' + (err.message || err));
        return;
      }

      chunksRef.current = [];
      transcriptRef.current = '';

      // Live volume analyser for playful animations (bird fly)
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        const pcmData = new Uint8Array(analyser.frequencyBinCount);
        const updateVol = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(pcmData);
          let sum = 0;
          for (let i = 0; i < pcmData.length; i++) sum += pcmData[i];
          const avg = sum / pcmData.length;
          setLiveVolume(Math.min(1, Math.max(0, avg / 70)));
          animFrameRef.current = requestAnimationFrame(updateVol);
        };
        updateVol();
      } catch (_) {}

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const durationMs = performance.now() - startedAtRef.current;
        stream.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const rawPcm = await blobToRawFloat32Array(blob, 16000);
          const pcm = trimSilence(rawPcm, 16000);
          optionsRef.current?.onDone({ blob, pcm, rawPcm, durationMs, browserText: transcriptRef.current.trim() });
        } catch (err) {
          console.error('[capture] processing failed:', err);
          optionsRef.current?.onError?.(err);
        } finally {
          setStatus('idle');
          setLiveVolume(0);
        }
      };
      recorderRef.current = recorder;

      if (options.asr) startRecognition();
      startedAtRef.current = performance.now();
      recorder.start();
      setStatus('recording');
      setElapsedMs(0);
      tickRef.current = window.setInterval(() => setElapsedMs(performance.now() - startedAtRef.current), 100);
      if (options.maxMs) autoStopRef.current = window.setTimeout(stop, options.maxMs);
    },
    [stop]
  );

  useEffect(
    () => () => {
      clearTimers();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    },
    []
  );

  return { status, elapsedMs, liveVolume, start, stop };
}

/** Saves a 16 kHz WAV next to the sentence recordings (same naming scheme). */
export function downloadWav(pcm: Float32Array, filename: string) {
  try {
    const url = URL.createObjectURL(pcmToWavBlob(pcm, 16000));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('WAV download error:', e);
  }
}

/** Decodes the original recording at 48 kHz (for jitter/shimmer precision). */
export async function decodeHiRes(blob: Blob, sampleRate = 48000): Promise<Float32Array> {
  const ctx = new AudioContext({ sampleRate });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    return buf.getChannelData(0);
  } finally {
    ctx.close().catch(() => {});
  }
}
