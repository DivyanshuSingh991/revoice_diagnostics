/**
 * Turns raw task measures into a school screening outcome per domain:
 * typical / monitor / refer (or inconclusive when the recording was too noisy).
 *
 * IMPORTANT: the cut-offs below are PROVISIONAL, taken from published child
 * norms (MPT, DDK, PCC) and widened for browser-microphone measurement error.
 * They must be calibrated against speech-language pathologist ratings on a
 * local sample before results are used to make referral decisions at scale.
 */
import {
  DdkResult,
  NamingItem,
  ScreeningDomain,
  ScreeningStatus,
  ScreeningSummary,
  ScreeningTasks,
  SentenceEvaluation,
  VoiceAttempt,
} from '../types';

export type AgeBand = '3–5' | '6–8' | '9+';
export const ageBand = (age: number): AgeBand => (age <= 5 ? '3–5' : age <= 8 ? '6–8' : '9+');

/** [typical if ≥, refer if <] — anything in between is "monitor". */
const CUTOFFS: Record<'mpt' | 'pcc' | 'amr' | 'ta' | 'ka' | 'smr' | 'wordAcc', Record<AgeBand, [number, number]>> = {
  mpt: { '3–5': [6, 4], '6–8': [8, 5], '9+': [10, 6] }, // seconds, best of 3
  pcc: { '3–5': [80, 65], '6–8': [90, 75], '9+': [95, 85] }, // % consonants correct
  amr: { '3–5': [3.0, 2.0], '6–8': [3.5, 2.5], '9+': [4.0, 3.0] }, // पा-पा-पा syllables/s
  ta: { '3–5': [3.0, 2.0], '6–8': [3.5, 2.5], '9+': [4.0, 3.0] }, // ता-ता-ता syllables/s
  ka: { '3–5': [2.8, 1.8], '6–8': [3.3, 2.3], '9+': [3.8, 2.8] }, // का-का-का syllables/s
  smr: { '3–5': [2.5, 1.5], '6–8': [3.0, 2.0], '9+': [3.5, 2.5] }, // पा-टा-का syllables/s
  wordAcc: { '3–5': [75, 50], '6–8': [85, 60], '9+': [90, 70] }, // sentence word accuracy %
};

/** Voice perturbation limits: [typical within, refer beyond]. */
const VOICE = {
  jitterPct: [1.5, 3.0],
  shimmerPct: [6, 10],
  hnrDb: [12, 8], // higher is better
};

const MIN_SNR_DB = 15;

export const gradeHigherBetter = (value: number, [typical, refer]: [number, number]): ScreeningStatus =>
  value >= typical ? 'typical' : value < refer ? 'refer' : 'monitor';

const gradeLowerBetter = (value: number, [typical, refer]: number[]): ScreeningStatus =>
  value <= typical ? 'typical' : value > refer ? 'refer' : 'monitor';

const RANK: Record<ScreeningStatus, number> = { not_tested: 0, inconclusive: 1, typical: 2, monitor: 3, refer: 4 };
const worst = (...s: ScreeningStatus[]) => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'not_tested' as ScreeningStatus);

export const STATUS_LABEL: Record<ScreeningStatus, string> = {
  typical: 'Typical',
  monitor: 'Monitor',
  refer: 'Refer',
  inconclusive: 'Inconclusive',
  not_tested: 'Not tested',
};

export const OVERALL_LABEL: Record<ScreeningStatus, { title: string; action: string }> = {
  typical: { title: 'No concerns found', action: 'Speech is within the expected range for age on the tasks completed.' },
  monitor: { title: 'Monitor', action: 'Practise the home activities and rescreen in about 3 months.' },
  refer: { title: 'Refer to a speech-language pathologist', action: 'Share this report with an RCI-registered speech-language pathologist for a full assessment.' },
  inconclusive: { title: 'Inconclusive — retest', action: 'Recordings were too noisy or incomplete. Retest in a quiet room.' },
  not_tested: { title: 'Not enough data', action: 'Complete at least the sentence task.' },
};

// ---------------------------------------------------------------------------
// Per-task helpers (also used by the task screens for live feedback)
// ---------------------------------------------------------------------------

export const bestVoiceAttempt = (attempts: VoiceAttempt[] = []) =>
  attempts.reduce<VoiceAttempt | undefined>((best, a) => (!best || a.mptSec > best.mptSec ? a : best), undefined);

/** Under 1 s of voicing means the child did not really attempt the task. */
export const MIN_VALID_MPT = 1;

export function breathStatus(age: number, attempts?: VoiceAttempt[]): ScreeningStatus {
  const best = bestVoiceAttempt(attempts);
  if (!best) return 'not_tested';
  if (best.snrDb < 10 || best.mptSec < MIN_VALID_MPT) return 'inconclusive';
  return gradeHigherBetter(best.mptSec, CUTOFFS.mpt[ageBand(age)]);
}

export function voiceQualityStatus(attempts?: VoiceAttempt[]): ScreeningStatus {
  const best = bestVoiceAttempt(attempts);
  if (!best) return 'not_tested';
  if (best.snrDb < MIN_SNR_DB || best.mptSec < 1.5 || Number.isNaN(best.jitterPct)) return 'inconclusive';
  const grades = [
    gradeLowerBetter(best.jitterPct, VOICE.jitterPct),
    gradeLowerBetter(best.shimmerPct, VOICE.shimmerPct),
    gradeHigherBetter(best.hnrDb, VOICE.hnrDb as [number, number]),
  ];
  // A single out-of-range measure is often mic noise — need two to refer.
  const refers = grades.filter((g) => g === 'refer').length;
  if (refers >= 2) return 'refer';
  return grades.some((g) => g !== 'typical') ? 'monitor' : 'typical';
}

export function ddkStatus(age: number, r?: DdkResult): ScreeningStatus {
  if (!r) return 'not_tested';
  if (r.snrDb < 10 || r.syllables < 4) return 'inconclusive';
  let s = gradeHigherBetter(r.ratePerSec, CUTOFFS[r.kind][ageBand(age)]);
  if (r.regularityCv > 0.3) s = worst(s, 'monitor');
  if (r.sequenceCorrect === false) s = worst(s, 'monitor');
  return s;
}

/** Applies the examiner's override on top of the automatic consonant score. */
export function effectiveNaming(item: NamingItem) {
  if (item.examinerOverride === 'correct') return { correct: item.consonantsTotal, missed: [] as string[] };
  if (item.examinerOverride === 'error' && item.consonantsCorrect >= item.consonantsTotal) {
    return { correct: Math.max(0, item.consonantsTotal - 1), missed: item.missedSounds };
  }
  return { correct: item.consonantsCorrect, missed: item.missedSounds };
}

/** Items that count towards the score (a non-response only counts if the examiner rated it). */
export const scoredNaming = (items: NamingItem[] = []) => items.filter((i) => !i.noResponse || i.examinerOverride);

export function namingSummary(allItems: NamingItem[] = []) {
  const items = scoredNaming(allItems);
  let total = 0;
  let correct = 0;
  let wordsCorrect = 0;
  const missedCounts: Record<string, number> = {};
  for (const it of items) {
    const e = effectiveNaming(it);
    total += it.consonantsTotal;
    correct += e.correct;
    if (e.correct === it.consonantsTotal) wordsCorrect++;
    for (const m of e.missed) missedCounts[m] = (missedCounts[m] || 0) + 1;
  }
  const soundsToWatch = Object.entries(missedCounts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
  return {
    pcc: total ? Math.round((correct / total) * 100) : 0,
    wordsCorrect,
    items: items.length,
    soundsToWatch,
    soundsMissed: Object.keys(missedCounts),
  };
}

// ---------------------------------------------------------------------------
// Full summary
// ---------------------------------------------------------------------------

export function buildScreening(age: number, sentences: SentenceEvaluation[], tasks: ScreeningTasks = {}): ScreeningSummary {
  const band = ageBand(age);
  const domains: ScreeningDomain[] = [];

  // 1. Fluency (sentences) — recordings with no recognised speech are not scored
  const spoken = sentences.filter((e) => e.spokenWhisperText !== '(No speech recorded)');
  const silent = sentences.length - spoken.length;
  {
    const n = spoken.length;
    const stutter = spoken.filter((e) => e.repetitionPct < 75).length;
    const prolong = spoken.filter((e) => e.prolongationPct < 75).length;
    const longPauses = spoken.filter((e) => (e.longestPauseMs ?? 0) >= 1200).length;
    const avgRep = n ? Math.round(spoken.reduce((s, e) => s + e.repetitionPct, 0) / n) : 0;
    const noisy = spoken.filter((e) => e.snrDb !== undefined && e.snrDb < 10).length;

    let status: ScreeningStatus = 'not_tested';
    if (n > 0) {
      if ((stutter >= 2 && prolong >= 2) || stutter >= 3 || avgRep < 60) status = 'refer';
      else if (stutter >= 1 || prolong >= 1 || longPauses >= 2) status = 'monitor';
      else status = 'typical';
      if (noisy > n / 2 && status === 'typical') status = 'inconclusive';
    } else if (silent > 0) {
      status = 'inconclusive';
    }
    const notes = [];
    if (stutter) notes.push(`repetitions in ${stutter} sentence${stutter > 1 ? 's' : ''}`);
    if (prolong) notes.push(`stretched sounds in ${prolong}`);
    if (longPauses) notes.push(`long pauses in ${longPauses}`);
    if (n > 0 && n < 3) notes.push(`only ${n} of 5 sentences recorded — less reliable`);
    if (silent) notes.push(`${silent} recording${silent > 1 ? 's' : ''} had no recognisable speech`);
    domains.push({
      key: 'fluency',
      label: 'Fluency (stuttering)',
      status,
      measure: n ? `Repetition ${avgRep}% · ${n} sentence${n > 1 ? 's' : ''}` : '—',
      note: notes.length ? capitalise(notes.join('; ')) : 'No repetitions, prolongations or long pauses detected.',
    });
  }

  // 2. Speech sounds (picture naming, else sentence word accuracy)
  {
    const naming = tasks.naming ?? [];
    const accs = spoken.map((e) => e.accuracyPct).filter((v): v is number => v !== undefined);
    if (scoredNaming(naming).length >= 10) {
      const sum = namingSummary(naming);
      domains.push({
        key: 'sounds',
        label: 'Speech sounds (articulation)',
        status: gradeHigherBetter(sum.pcc, CUTOFFS.pcc[band]),
        measure: `PCC ${sum.pcc}% · ${sum.wordsCorrect}/${sum.items} words`,
        note: sum.soundsToWatch.length
          ? `Sounds to watch (missed more than once): ${sum.soundsToWatch.slice(0, 5).join(', ')}`
          : sum.soundsMissed.length
          ? `Single errors on: ${sum.soundsMissed.join(', ')}`
          : 'All sounds produced correctly.',
      });
    } else if (accs.length) {
      const acc = Math.round(accs.reduce((a, b) => a + b, 0) / accs.length);
      const graded = gradeHigherBetter(acc, CUTOFFS.wordAcc[band]);
      domains.push({
        key: 'sounds',
        label: 'Speech sounds (articulation)',
        // ASR word matches alone are weak evidence — never refer on them without picture naming
        status: graded === 'refer' ? 'monitor' : graded,
        measure: `Word accuracy ${acc}%`,
        note: `Estimated from sentences only — complete picture naming${naming.length ? ` (${naming.length}/22 done)` : ''} for a reliable check.`,
      });
    } else {
      domains.push({ key: 'sounds', label: 'Speech sounds (articulation)', status: 'not_tested', measure: '—', note: 'Picture naming not done.' });
    }
  }

  // 3 & 4. Voice quality and breath support (sustained vowel)
  {
    const best = bestVoiceAttempt(tasks.voice);
    const vq = voiceQualityStatus(tasks.voice);
    domains.push({
      key: 'voice',
      label: 'Voice quality',
      status: vq,
      measure: best && !Number.isNaN(best.jitterPct) ? `Jitter ${best.jitterPct}% · Shimmer ${best.shimmerPct}% · HNR ${best.hnrDb} dB` : '—',
      note: !best
        ? 'Sustained "आ" not recorded.'
        : vq === 'inconclusive'
        ? 'Too much background noise or too short to measure voice quality.'
        : vq === 'typical'
        ? 'Steady, clear voice.'
        : 'Signs of a rough or breathy voice. If hoarseness lasts over 2 weeks, consult an ENT doctor.',
    });
    const br = breathStatus(age, tasks.voice);
    const [typ] = CUTOFFS.mpt[band];
    domains.push({
      key: 'breath',
      label: 'Breath support',
      status: br,
      measure: best ? `Longest "आ" ${best.mptSec} s (expected ≥ ${typ} s)` : '—',
      note: !best
        ? 'Sustained "आ" not recorded.'
        : br === 'inconclusive'
        ? 'No clear sustained sound recorded — retest in a quiet room.'
        : br === 'typical'
        ? 'Holds a sound for an age-appropriate time.'
        : 'Shorter than expected for age — check effort and breath control.',
    });
  }

  // 5. Speech motor (DDK)
  {
    const amr = tasks.ddk?.amr;
    const ta = tasks.ddk?.ta;
    const ka = tasks.ddk?.ka;
    const smr = tasks.ddk?.smr;
    const allResults = [amr, ta, ka, smr].filter((r): r is DdkResult => !!r);
    const status = allResults.length ? worst(...allResults.map((r) => ddkStatus(age, r))) : 'not_tested';
    const parts = [
      amr && `पा-पा-पा ${amr.ratePerSec}/s`,
      ta && `ता-ता-ता ${ta.ratePerSec}/s`,
      ka && `का-का-का ${ka.ratePerSec}/s`,
      smr && `पा-टा-का ${smr.ratePerSec}/s`,
    ].filter(Boolean);
    const notes = [];
    for (const r of allResults) {
      if (r && r.syllables >= 4 && gradeHigherBetter(r.ratePerSec, CUTOFFS[r.kind][band]) !== 'typical') {
        const title = r.kind === 'amr' ? 'पा-पा-पा' : r.kind === 'ta' ? 'ता-ता-ता' : r.kind === 'ka' ? 'का-का-का' : 'पा-टा-का';
        notes.push(`${title} slower than expected (≥ ${CUTOFFS[r.kind][band][0]}/s)`);
      }
    }
    if (allResults.some((r) => r && r.syllables < 4)) notes.push('too few syllables detected — retest');
    if (allResults.some((r) => (r?.regularityCv ?? 0) > 0.3)) notes.push('uneven rhythm');
    if (smr?.sequenceCorrect === false) notes.push('could not keep the पा-टा-का order (check motor planning)');
    domains.push({
      key: 'motor',
      label: 'Speech motor (DDK)',
      status,
      measure: parts.length ? parts.join(' · ') : '—',
      note: allResults.length === 0 ? 'DDK tasks not done.' : notes.length ? capitalise(notes.join('; ')) : 'Rate and rhythm within the expected range.',
    });
  }

  const tested = domains.filter((d) => d.status !== 'not_tested');
  const valid = tested.filter((d) => d.status !== 'inconclusive');
  const overall: ScreeningStatus = valid.length ? worst(...valid.map((d) => d.status)) : tested.length ? 'inconclusive' : 'not_tested';

  return { overall, ageBand: band, domains };
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
