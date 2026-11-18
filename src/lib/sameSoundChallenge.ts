import { consonants, alignConsonants } from './articulation';
import { analyzePauses } from './acoustics';
import {
  SameSoundGroup,
  SameSoundWordResult,
  SameSoundRoundResult,
  SameSoundChallengeResult,
  SoundErrorDetail
} from '../types';

export const SAME_SOUND_GROUPS: SameSoundGroup[] = [
  {
    sound: 'प',
    romanSound: 'p',
    soundLabel: 'प (P)',
    place: 'bilabial',
    manner: 'plosive',
    words: [
      { id: 'p1', hindi: 'पानी', roman: 'paani', emoji: '💧', english: 'Water' },
      { id: 'p2', hindi: 'पतंग', roman: 'patang', emoji: '🪁', english: 'Kite' },
      { id: 'p3', hindi: 'पपीता', roman: 'papeeta', emoji: '🍈', english: 'Papaya' },
      { id: 'p4', hindi: 'पत्ता', roman: 'patta', emoji: '🍃', english: 'Leaf' },
    ],
  },
  {
    sound: 'म',
    romanSound: 'm',
    soundLabel: 'म (M)',
    place: 'bilabial',
    manner: 'nasal',
    words: [
      { id: 'm1', hindi: 'माला', roman: 'maala', emoji: '📿', english: 'Garland' },
      { id: 'm2', hindi: 'मछली', roman: 'machhli', emoji: '🐟', english: 'Fish' },
      { id: 'm3', hindi: 'मकान', roman: 'makaan', emoji: '🏠', english: 'House' },
      { id: 'm4', hindi: 'मोर', roman: 'mor', emoji: '🦚', english: 'Peacock' },
    ],
  },
  {
    sound: 'क',
    romanSound: 'k',
    soundLabel: 'क (K)',
    place: 'velar',
    manner: 'plosive',
    words: [
      { id: 'k1', hindi: 'किताब', roman: 'kitaab', emoji: '📚', english: 'Book' },
      { id: 'k2', hindi: 'कमल', roman: 'kamal', emoji: '🪷', english: 'Lotus' },
      { id: 'k3', hindi: 'कबूतर', roman: 'kabootar', emoji: '🕊️', english: 'Pigeon' },
      { id: 'k4', hindi: 'ककड़ी', roman: 'kakdi', emoji: '🥒', english: 'Cucumber' },
    ],
  },
  {
    sound: 'ब',
    romanSound: 'b',
    soundLabel: 'ब (B)',
    place: 'bilabial',
    manner: 'plosive',
    words: [
      { id: 'b1', hindi: 'बंदर', roman: 'bandar', emoji: '🐒', english: 'Monkey' },
      { id: 'b2', hindi: 'बतख', roman: 'batakh', emoji: '🦆', english: 'Duck' },
      { id: 'b3', hindi: 'बच्चा', roman: 'bachcha', emoji: '👶', english: 'Baby / Child' },
      { id: 'b4', hindi: 'बकरी', roman: 'bakri', emoji: '🐐', english: 'Goat' },
    ],
  },
  {
    sound: 'त',
    romanSound: 't',
    soundLabel: 'त (T)',
    place: 'dental',
    manner: 'plosive',
    words: [
      { id: 't1', hindi: 'ताला', roman: 'taala', emoji: '🔒', english: 'Lock' },
      { id: 't2', hindi: 'तरबूज', roman: 'tarbooj', emoji: '🍉', english: 'Watermelon' },
      { id: 't3', hindi: 'तितली', roman: 'titli', emoji: '🦋', english: 'Butterfly' },
      { id: 't4', hindi: 'तोता', roman: 'tota', emoji: '🦜', english: 'Parrot' },
    ],
  },
];

/** Clean tokens for matching */
function cleanTokens(text: string): string[] {
  return text
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Check phoneme alignment and classify substitutions/omissions/distortions */
export function evaluateWordPronunciation(
  targetWord: string,
  targetInitialSound: string,
  candidateSpoken: string[]
): {
  isCorrect: boolean;
  accuracyPct: number;
  matchedSpoken: string;
  errors: SoundErrorDetail[];
} {
  const targetCons = consonants(targetWord);
  let bestScore = -1;
  let bestCandidate = '';
  let bestAlignment: { correct: number; missed: string[] } = { correct: 0, missed: targetCons };

  for (const cand of candidateSpoken) {
    const candCons = consonants(cand);
    const align = alignConsonants(targetCons, candCons);
    const score = align.correct * 10 - align.missed.length;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = cand;
      bestAlignment = align;
    }
  }

  const errors: SoundErrorDetail[] = [];
  const targetInitial = targetCons[0] || targetInitialSound;
  const spokenCons = bestCandidate ? consonants(bestCandidate) : [];
  const spokenInitial = spokenCons[0];

  // 1. Initial Sound Check
  if (!spokenInitial) {
    errors.push({
      sound: targetInitial,
      type: 'omission',
      position: 'initial',
      description: `Initial sound '${targetInitial}' was dropped or not detected`,
    });
  } else if (spokenInitial !== targetInitial) {
    errors.push({
      sound: targetInitial,
      type: 'substitution',
      position: 'initial',
      observed: spokenInitial,
      description: `Target sound '${targetInitial}' was substituted with '${spokenInitial}'`,
    });
  }

  // 2. Medial/Final Consonant Checks
  for (let i = 1; i < targetCons.length; i++) {
    const tSound = targetCons[i];
    const sSound = spokenCons[i];
    const position = i === targetCons.length - 1 ? 'final' : 'medial';

    if (!sSound) {
      errors.push({
        sound: tSound,
        type: 'omission',
        position,
        description: `Sound '${tSound}' in ${position} position was omitted`,
      });
    } else if (sSound !== tSound) {
      errors.push({
        sound: tSound,
        type: 'substitution',
        position,
        observed: sSound,
        description: `Sound '${tSound}' (${position}) was substituted with '${sSound}'`,
      });
    }
  }

  // 3. Distortion check: if consonants are intact but vowel signs/length or clarity significantly diverges
  if (bestAlignment.correct === targetCons.length && bestCandidate !== targetWord) {
    if (bestCandidate.length !== targetWord.length) {
      errors.push({
        sound: targetInitial,
        type: 'distortion',
        position: 'medial',
        observed: bestCandidate,
        description: `Mild acoustic distortion or vowel lengthening on '${targetWord}'`,
      });
    }
  }

  const accuracyPct = targetCons.length > 0 ? Math.round((bestAlignment.correct / targetCons.length) * 100) : 100;
  // A word is deemed correct if all consonants matched without substitutions or omissions
  const hasSubOrOm = errors.some((e) => e.type === 'substitution' || e.type === 'omission');
  const isCorrect = !hasSubOrOm && accuracyPct >= 80;

  return {
    isCorrect,
    accuracyPct,
    matchedSpoken: bestCandidate || '(No match)',
    errors,
  };
}

/** Analyze an entire round of 4 words */
export function evaluateSameSoundRound(
  round: number,
  group: SameSoundGroup,
  rawTranscript: string,
  durationMs: number,
  pcm: Float32Array
): SameSoundRoundResult {
  const spokenTokens = cleanTokens(rawTranscript);
  const words: SameSoundWordResult[] = [];
  const allErrors: SoundErrorDetail[] = [];

  let correctCount = 0;
  let totalAcc = 0;

  // Search each target word in the spoken tokens pool
  group.words.forEach((w) => {
    // Look for exact word or phonetic candidates
    const candidates = spokenTokens.filter((token) => {
      const c = consonants(token);
      const t = consonants(w.hindi);
      return token === w.hindi || (c.length > 0 && c[0] === t[0]) || token.includes(w.hindi[0]);
    });

    const pool = candidates.length > 0 ? candidates : spokenTokens;
    const evalRes = evaluateWordPronunciation(w.hindi, group.sound, pool);

    if (evalRes.isCorrect) correctCount++;
    totalAcc += evalRes.accuracyPct;
    allErrors.push(...evalRes.errors);

    words.push({
      wordId: w.id,
      targetWord: w.hindi,
      targetRoman: w.roman,
      emoji: w.emoji,
      spokenText: evalRes.matchedSpoken,
      isCorrect: evalRes.isCorrect,
      accuracyPct: evalRes.accuracyPct,
      errors: evalRes.errors,
    });
  });

  const accuracyPct = Math.round(totalAcc / group.words.length);
  const pauseStats = analyzePauses(pcm, 400);

  const durationSec = Math.max(durationMs / 1000, 0.5);
  // Speaking rate in Words Per Minute (based on spoken tokens produced)
  const wordsSpoken = Math.max(spokenTokens.length, correctCount);
  const speakingRateWpm = Math.round((wordsSpoken / durationSec) * 60);

  return {
    round,
    targetSound: group.sound,
    targetWords: group.words.map((w) => w.hindi),
    spokenTranscript: rawTranscript,
    durationMs: Math.round(durationMs),
    speakingRateWpm,
    pauseCount: pauseStats.pauseCount,
    longestPauseMs: pauseStats.longestPauseMs,
    accuracyPct,
    wordsCorrect: correctCount,
    wordsIncorrect: group.words.length - correctCount,
    words,
    soundErrors: allErrors,
  };
}

/** Compute overall challenge metrics across all 3 rounds */
export function aggregateSameSoundChallenge(
  soundGroup: SameSoundGroup,
  rounds: SameSoundRoundResult[],
  childAge: number
): SameSoundChallengeResult {
  const totalRounds = rounds.length || 1;
  const overallAccuracyPct = Math.round(rounds.reduce((s, r) => s + r.accuracyPct, 0) / totalRounds);
  const totalWordsCorrect = rounds.reduce((s, r) => s + r.wordsCorrect, 0);
  const totalWordsIncorrect = rounds.reduce((s, r) => s + r.wordsIncorrect, 0);
  const totalTimeTakenMs = rounds.reduce((s, r) => s + r.durationMs, 0);
  const avgSpeakingRateWpm = Math.round(rounds.reduce((s, r) => s + r.speakingRateWpm, 0) / totalRounds);
  const totalPauses = rounds.reduce((s, r) => s + r.pauseCount, 0);

  // Consistency across 3 rounds (Variance/Standard Deviation of accuracy)
  const accScores = rounds.map((r) => r.accuracyPct);
  const meanAcc = accScores.reduce((a, b) => a + b, 0) / accScores.length;
  const variance = accScores.reduce((a, b) => a + Math.pow(b - meanAcc, 2), 0) / accScores.length;
  const stdDev = Math.sqrt(variance);

  let consistencyCategory: 'High' | 'Moderate' | 'Inconsistent' = 'High';
  let consistencyScore = 100;
  if (stdDev > 22) {
    consistencyCategory = 'Inconsistent';
    consistencyScore = Math.max(40, Math.round(100 - stdDev * 2.5));
  } else if (stdDev > 10) {
    consistencyCategory = 'Moderate';
    consistencyScore = Math.max(65, Math.round(100 - stdDev * 1.5));
  }

  // Aggregate errors
  let substitutions = 0;
  let omissions = 0;
  let distortions = 0;
  rounds.forEach((r) => {
    r.soundErrors.forEach((e) => {
      if (e.type === 'substitution') substitutions++;
      else if (e.type === 'omission') omissions++;
      else if (e.type === 'distortion') distortions++;
    });
  });

  // Sound-wise breakdown
  const soundErrorMap: Record<string, { substitutions: number; omissions: number; distortions: number }> = {};
  rounds.forEach((r) => {
    r.soundErrors.forEach((e) => {
      if (!soundErrorMap[e.sound]) {
        soundErrorMap[e.sound] = { substitutions: 0, omissions: 0, distortions: 0 };
      }
      soundErrorMap[e.sound][e.type === 'substitution' ? 'substitutions' : e.type === 'omission' ? 'omissions' : 'distortions']++;
    });
  });

  const soundWisePerformance = Object.entries(soundErrorMap).map(([sound, counts]) => ({
    sound,
    ...counts,
  }));

  // Word-wise breakdown
  const wordMap: Record<string, { targetWord: string; emoji: string; attempts: number; correct: number; totalAccuracy: number }> = {};
  rounds.forEach((r) => {
    r.words.forEach((w) => {
      if (!wordMap[w.targetWord]) {
        wordMap[w.targetWord] = { targetWord: w.targetWord, emoji: w.emoji, attempts: 0, correct: 0, totalAccuracy: 0 };
      }
      wordMap[w.targetWord].attempts++;
      if (w.isCorrect) wordMap[w.targetWord].correct++;
      wordMap[w.targetWord].totalAccuracy += w.accuracyPct;
    });
  });

  const wordWisePerformance = Object.values(wordMap).map((w) => ({
    targetWord: w.targetWord,
    emoji: w.emoji,
    attempts: w.attempts,
    correctAttempts: w.correct,
    avgAccuracyPct: Math.round(w.totalAccuracy / Math.max(w.attempts, 1)),
  }));

  // Age-norm consideration: /p, b, m/ acquired early (~3 yrs); /t, k/ (~3.5-4 yrs)
  let ageNormNote = '';
  if (childAge < 4 && (soundGroup.sound === 'क' || soundGroup.sound === 'त')) {
    ageNormNote = `At age ${childAge}, developmental substitutions or slight velar/dental fronting are common and developmentally expected.`;
  } else if (childAge < 3.5) {
    ageNormNote = `Younger children (${childAge} yrs) naturally exhibit playful sound variations.`;
  } else {
    ageNormNote = `Phonetic sounds for '${soundGroup.sound}' are typically established by age ${childAge}.`;
  }

  const clinicalNotes = `${ageNormNote} Consistency across rounds is ${consistencyCategory.toLowerCase()} (${consistencyScore}%). ${
    substitutions > 0 ? `${substitutions} substitution(s) noted. ` : ''
  }${omissions > 0 ? `${omissions} omission(s) noted. ` : ''}Results provide screening-level articulation guidance.`;

  return {
    targetSound: soundGroup.sound,
    overallAccuracyPct,
    totalWordsCorrect,
    totalWordsIncorrect,
    soundErrors: {
      substitutions,
      omissions,
      distortions,
    },
    totalTimeTakenMs,
    avgSpeakingRateWpm,
    totalPauses,
    consistencyScore,
    consistencyCategory,
    rounds,
    wordWisePerformance,
    soundWisePerformance,
    clinicalNotes,
  };
}
