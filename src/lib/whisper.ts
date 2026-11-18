let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let resolveInit: (() => void) | null = null;
let rejectInit: ((err: any) => void) | null = null;
let messageCallbacks: Record<string, { resolve: (text: string) => void, reject: (err: any) => void }> = {};
let messageIdCounter = 0;
let activeBackend = '';

export function getWhisperBackend(): string {
    return activeBackend;
}

export function initWhisper(onProgress?: (progress: any) => void): Promise<void> {
    if (initPromise) return initPromise;

    initPromise = new Promise<void>((resolve, reject) => {
        resolveInit = resolve;
        rejectInit = reject;

        worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (event) => {
            const { id, type, data, text, error, backend } = event.data;

            if (type === 'progress' && onProgress) {
                onProgress(data);
            } else if (type === 'ready') {
                activeBackend = backend || 'web-ready';
                console.info(`[whisper] backend: ${activeBackend}`);
                if (resolveInit) resolveInit();
                resolveInit = null;
                rejectInit = null;
            } else if (type === 'error') {
                if (rejectInit) {
                    rejectInit(new Error(error));
                    rejectInit = null;
                    resolveInit = null;
                } else if (id && messageCallbacks[id]) {
                    messageCallbacks[id].reject(new Error(error));
                    delete messageCallbacks[id];
                }
            } else if (type === 'result') {
                if (id && messageCallbacks[id]) {
                    messageCallbacks[id].resolve(text);
                    delete messageCallbacks[id];
                }
            }
        };

        worker.onerror = (e) => {
            const err = new Error(`Whisper worker failed to start: ${e.message || 'unknown error'}`);
            if (rejectInit) { rejectInit(err); rejectInit = null; resolveInit = null; }
        };

        worker.postMessage({ type: 'load' });
    });

    initPromise.catch(() => { initPromise = null; worker = null; });
    return initPromise;
}

export function transcribeAudio(audioData: Float32Array, language: string = 'hindi'): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!worker) {
            reject(new Error('Whisper worker not initialized. Call initWhisper() first.'));
            return;
        }

        const id = (messageIdCounter++).toString();
        messageCallbacks[id] = { resolve, reject };

        worker.postMessage({
            id,
            type: 'transcribe',
            audio: audioData,
            language
        });
    });
}

export function trimSilence(samples: Float32Array, sampleRate = 16000): Float32Array {
    const WINDOW = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms frames
    const MARGIN = Math.floor(sampleRate * 0.15);             // keep 150ms

    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
        const v = Math.abs(samples[i]);
        if (v > peak) peak = v;
    }
    if (peak < 1e-4) return samples;
    const threshold = Math.max(peak * 0.06, 0.005);

    const isLoud = (start: number) => {
        const end = Math.min(start + WINDOW, samples.length);
        let sum = 0;
        for (let i = start; i < end; i++) sum += samples[i] * samples[i];
        return Math.sqrt(sum / Math.max(1, end - start)) > threshold;
    };

    let first = -1;
    for (let i = 0; i + WINDOW <= samples.length; i += WINDOW) {
        if (isLoud(i)) { first = i; break; }
    }
    if (first < 0) return samples;

    let last = samples.length;
    for (let i = samples.length - WINDOW; i >= 0; i -= WINDOW) {
        if (isLoud(i)) { last = i + WINDOW; break; }
    }
    if (last <= first) return samples;

    const from = Math.max(0, first - MARGIN);
    const to = Math.min(samples.length, last + MARGIN);
    if (to - from < sampleRate * 0.25) return samples;
    return samples.slice(from, to);
}

export function isDegenerateTranscript(text: string, promptWordCount: number): boolean {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return false;
    const tooLong = words.length > promptWordCount * 3 + 4;
    const unique = new Set(words.map(w => w.toLowerCase())).size;
    return tooLong && unique / words.length < 0.35;
}

export async function blobToRawFloat32Array(blob: Blob, targetSampleRate = 16000): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioContextClass({ sampleRate: targetSampleRate });
    try {
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        return audioBuffer.getChannelData(0);
    } finally {
        ctx.close().catch(() => {});
    }
}

export async function blobToFloat32Array(blob: Blob): Promise<Float32Array> {
    const raw = await blobToRawFloat32Array(blob, 16000);
    return trimSilence(raw, 16000);
}
