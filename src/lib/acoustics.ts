/**
 * Lightweight in-browser acoustic measures for the screening tasks.
 *
 * These are screening-grade approximations of the standard Praat measures
 * (autocorrelation pitch, local jitter/shimmer, HNR). They are sensitive to
 * microphone quality and background noise — always read them together with snrDb.
 */

const SR = 16000;
const HOP = 160; // 10 ms
const HOP_SEC = HOP / SR;

function percentile(values: ArrayLike<number>, p: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Frame RMS with a 20 ms window and 10 ms hop. */
export function frameRms(pcm: Float32Array, win = 320, hop = HOP): Float32Array {
  const n = Math.max(0, Math.floor((pcm.length - win) / hop) + 1);
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    const start = f * hop;
    for (let i = start; i < start + win; i++) sum += pcm[i] * pcm[i];
    out[f] = Math.sqrt(sum / win);
  }
  return out;
}

/**
 * Noise floor = mean of the 10 quietest frames. trimSilence() keeps ~150 ms of
 * margin on both sides, so these frames are background noise even when the
 * child voices continuously (sustained vowel).
 */
function levels(rms: Float32Array) {
  const sorted = Array.from(rms).filter((v) => v > 0).sort((a, b) => a - b);
  const noise = Math.max(mean(sorted.slice(0, 10)), 1e-5);
  const speech = Math.max(percentile(rms, 0.9), noise);
  return { noise, speech };
}

export function signalToNoiseDb(pcm: Float32Array): number {
  const { noise, speech } = levels(frameRms(pcm));
  return Math.round(20 * Math.log10(speech / noise));
}

// ---------------------------------------------------------------------------
// Pitch tracking (normalised autocorrelation)
// ---------------------------------------------------------------------------

interface PitchTrack {
  f0: Float32Array; // 0 when unvoiced
  r: Float32Array; // autocorrelation peak per frame
  voiced: Uint8Array;
}

function pitchTrack(pcm: Float32Array, fmin = 100, fmax = 700): PitchTrack {
  const win = 480; // 30 ms
  const minLag = Math.floor(SR / fmax);
  const maxLag = Math.ceil(SR / fmin);
  const n = Math.max(0, Math.floor((pcm.length - win - maxLag) / HOP) + 1);
  const f0 = new Float32Array(n);
  const r = new Float32Array(n);
  const voiced = new Uint8Array(n);

  const rms = frameRms(pcm, win, HOP);
  const { noise } = levels(rms);
  const peakRms = percentile(rms, 0.98);
  const energyGate = Math.max(noise * 1.5, peakRms * 0.04);

  const corr = new Float32Array(maxLag + 1);
  for (let f = 0; f < n; f++) {
    const s = f * HOP;
    if (rms[f] < energyGate) continue;

    let e0 = 0;
    for (let i = s; i < s + win; i++) e0 += pcm[i] * pcm[i];
    let eLag = 0;
    for (let i = s + minLag; i < s + minLag + win; i++) eLag += pcm[i] * pcm[i];

    let best = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let num = 0;
      for (let i = 0; i < win; i++) num += pcm[s + i] * pcm[s + i + lag];
      const c = num / Math.sqrt(e0 * eLag + 1e-12);
      corr[lag] = c;
      if (c > best) best = c;
      // slide the lagged-window energy one sample forward
      const out = pcm[s + lag];
      const inn = pcm[s + lag + win];
      eLag += inn * inn - out * out;
    }

    // Prefer the shortest lag close to the best peak, which avoids octave-down errors.
    let lagSel = minLag;
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (corr[lag] >= 0.85 * best && corr[lag] >= corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
        lagSel = lag;
        break;
      }
    }
    const a = corr[lagSel - 1] ?? corr[lagSel];
    const b = corr[lagSel];
    const c = corr[lagSel + 1] ?? corr[lagSel];
    const denom = a - 2 * b + c;
    const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const lagExact = lagSel + Math.max(-0.5, Math.min(0.5, shift));

    r[f] = b;
    // Sustained /a/ has strong periodicity; threshold 0.38 handles noisy mics/breathiness
    if (b >= 0.38) {
      voiced[f] = 1;
      f0[f] = SR / lagExact;
    }
  }
  return { f0, r, voiced };
}

/** Longest run of voiced frames, bridging brief vocal fry or micro-gaps up to maxGapFrames (e.g. ~400ms). */
function longestVoicedRun(voiced: Uint8Array, maxGapFrames = 40) {
  let bestStart = 0;
  let bestEnd = -1;
  let start = -1;
  let lastVoiced = -1;
  for (let i = 0; i < voiced.length; i++) {
    if (!voiced[i]) continue;
    if (start < 0 || i - lastVoiced > maxGapFrames) start = i;
    lastVoiced = i;
    if (lastVoiced - start > bestEnd - bestStart) {
      bestStart = start;
      bestEnd = lastVoiced;
    }
  }
  return { start: bestStart, end: bestEnd };
}

// ---------------------------------------------------------------------------
// Sustained vowel: MPT + voice quality
// ---------------------------------------------------------------------------

/**
 * Cycle-to-cycle perturbation by peak picking with parabolic interpolation.
 * Run at a higher sample rate where possible — 16 kHz quantisation alone
 * adds ~1% jitter for a 300 Hz child voice.
 */
function perturbation(signal: Float32Array, sr: number, f0: number, fromSec: number, toSec: number) {
  const T0 = sr / f0;
  let p = Math.floor(fromSec * sr);
  const end = Math.min(signal.length - 2, Math.floor(toSec * sr));

  const peakIn = (a: number, b: number) => {
    let idx = a;
    for (let i = a; i < b && i < end; i++) if (signal[i] > signal[idx]) idx = i;
    return idx;
  };
  const refine = (i: number) => {
    const a = signal[i - 1], b = signal[i], c = signal[i + 1];
    const d = a - 2 * b + c;
    const shift = d !== 0 ? (0.5 * (a - c)) / d : 0;
    return { t: i + Math.max(-0.5, Math.min(0.5, shift)), amp: b - 0.25 * (a - c) * shift };
  };

  p = peakIn(p, p + Math.ceil(T0));
  let prev = refine(p);
  let T = T0;
  const periods: number[] = [];
  const amps: number[] = [prev.amp];

  while (p + 1.3 * T < end) {
    const q = peakIn(Math.floor(p + 0.75 * T), Math.ceil(p + 1.25 * T));
    const cur = refine(q);
    const period = cur.t - prev.t;
    if (period > 0.7 * T0 && period < 1.3 * T0 && cur.amp > 0) {
      periods.push(period);
      amps.push(cur.amp);
      T = period;
    } else {
      T = T0;
    }
    prev = cur;
    p = q;
  }

  const diffMean = (xs: number[]) => mean(xs.slice(1).map((x, i) => Math.abs(x - xs[i])));
  return {
    jitterPct: periods.length > 10 ? (diffMean(periods) / mean(periods)) * 100 : NaN,
    shimmerPct: amps.length > 10 ? (diffMean(amps) / mean(amps)) * 100 : NaN,
  };
}

export interface VoiceMeasures {
  mptSec: number;
  f0Hz: number;
  jitterPct: number;
  shimmerPct: number;
  hnrDb: number;
  snrDb: number;
}

/**
 * @param pcm16k  trimmed 16 kHz PCM (pitch, MPT, HNR)
 * @param hiRes   optional higher-rate copy of the same recording for jitter/shimmer,
 *                trimmed with the same trimSilence() so it lines up within one 20 ms frame
 */
export function analyzeSustainedVowel(
  pcm16k: Float32Array,
  hiRes?: { pcm: Float32Array; sr: number; offsetSec: number }
): VoiceMeasures {
  const snrDb = signalToNoiseDb(pcm16k);
  const track = pitchTrack(pcm16k);
  const run = longestVoicedRun(track.voiced);
  const mptSec = run.end >= run.start ? (run.end - run.start + 1) * HOP_SEC : 0;

  if (mptSec < 0.5) {
    return { mptSec: round1(mptSec), f0Hz: 0, jitterPct: NaN, shimmerPct: NaN, hnrDb: NaN, snrDb };
  }

  // Analyse a stable middle stretch (skip onset/offset, cap at 3 s).
  const runLen = run.end - run.start + 1;
  const skip = runLen > 200 ? 50 : Math.floor(runLen * 0.15);
  let a = run.start + skip;
  let b = run.end - skip;
  if (b - a > 300) {
    const mid = Math.floor((a + b) / 2);
    a = mid - 150;
    b = mid + 150;
  }

  const f0s: number[] = [];
  const hnrs: number[] = [];
  for (let i = a; i <= b; i++) {
    if (!track.voiced[i]) continue;
    f0s.push(track.f0[i]);
    const rr = Math.min(0.999, Math.max(0.001, track.r[i]));
    hnrs.push(10 * Math.log10(rr / (1 - rr)));
  }
  const f0Hz = percentile(f0s, 0.5);

  const fromSec = a * HOP_SEC;
  const toSec = b * HOP_SEC + 0.03;
  const pert = hiRes
    ? perturbation(hiRes.pcm, hiRes.sr, f0Hz, fromSec + hiRes.offsetSec, toSec + hiRes.offsetSec)
    : perturbation(pcm16k, SR, f0Hz, fromSec, toSec);

  return {
    mptSec: round1(mptSec),
    f0Hz: Math.round(f0Hz),
    jitterPct: Math.round(pert.jitterPct * 100) / 100,
    shimmerPct: round1(pert.shimmerPct),
    hnrDb: round1(mean(hnrs)),
    snrDb,
  };
}

// ---------------------------------------------------------------------------
// DDK: syllable rate and regularity from the energy envelope
// ---------------------------------------------------------------------------

export interface DdkMeasures {
  syllables: number;
  durationSec: number;
  ratePerSec: number;
  regularityCv: number;
  snrDb: number;
}

export function analyzeDdk(pcm: Float32Array): DdkMeasures {
  const raw = frameRms(pcm);
  const env = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    env[i] = (raw[Math.max(0, i - 1)] + raw[i] + raw[Math.min(raw.length - 1, i + 1)]) / 3;
  }
  const { noise, speech } = levels(env);
  const snrDb = Math.round(20 * Math.log10(speech / noise));
  // Responsive threshold so softer child consonant releases are not cut off
  const thr = noise + 0.12 * (speech - noise);
  const minDist = 6; // 60 ms → allows fast repetitions without missing syllables

  const peaks: number[] = [];
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] < thr || env[i] < env[i - 1] || env[i] <= env[i + 1]) continue;
    const last = peaks[peaks.length - 1];
    if (last === undefined) {
      peaks.push(i);
      continue;
    }
    let valley = Infinity;
    for (let k = last; k <= i; k++) valley = Math.min(valley, env[k]);
    // 0.72 valley dip ratio ensures soft syllable transitions in ta-ta-ta and ka-ka-ka are detected
    const distinct = i - last >= minDist && valley < 0.72 * Math.min(env[last], env[i]);
    if (distinct) peaks.push(i);
    else if (env[i] > env[last]) peaks[peaks.length - 1] = i;
  }

  if (peaks.length < 3) {
    return { syllables: peaks.length, durationSec: 0, ratePerSec: 0, regularityCv: 0, snrDb };
  }
  const intervals = peaks.slice(1).map((p, i) => (p - peaks[i]) * HOP_SEC);
  const m = mean(intervals);
  const sd = Math.sqrt(mean(intervals.map((x) => (x - m) ** 2)));
  const durationSec = Math.max(0.5, (peaks[peaks.length - 1] - peaks[0]) * HOP_SEC);
  return {
    syllables: peaks.length,
    durationSec: round1(durationSec),
    ratePerSec: round1((peaks.length - 1) / durationSec),
    regularityCv: Math.round((sd / (m || 1)) * 100) / 100,
    snrDb,
  };
}

// ---------------------------------------------------------------------------
// Sentences: silent pauses inside the utterance (possible blocks/hesitations)
// ---------------------------------------------------------------------------

export function analyzePauses(pcm: Float32Array, minPauseMs = 400) {
  const env = frameRms(pcm);
  const { noise, speech } = levels(env);
  const thr = noise + 0.1 * (speech - noise);
  let first = -1;
  let last = -1;
  for (let i = 0; i < env.length; i++) {
    if (env[i] >= thr) {
      if (first < 0) first = i;
      last = i;
    }
  }
  let pauseCount = 0;
  let longest = 0;
  let run = 0;
  for (let i = first + 1; i < last; i++) {
    if (env[i] < thr) {
      run++;
    } else {
      const ms = run * HOP_SEC * 1000;
      if (ms >= minPauseMs) pauseCount++;
      longest = Math.max(longest, ms);
      run = 0;
    }
  }
  return {
    pauseCount,
    longestPauseMs: Math.round(longest),
    snrDb: Math.round(20 * Math.log10(speech / noise)),
  };
}
