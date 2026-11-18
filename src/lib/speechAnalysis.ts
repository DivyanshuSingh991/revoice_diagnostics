import { SentenceItem, SentenceEvaluation, DiagnosticReport, ChildProfile, ScreeningTasks } from '../types';
import { wordAccuracy } from './articulation';
import { breathStatus, buildScreening, ddkStatus, namingSummary, voiceQualityStatus } from './screening';

export const ASSESSMENT_SENTENCES: SentenceItem[] = [
  {
    id: 1,
    hindi: "मेरा नाम अमन है और मेरा घर पास में है।",
    roman: "Mera naam Aman hai aur mera ghar paas mein hai.",
    translation: ""
  },
  {
    id: 2,
    hindi: "मुझे पानी चाहिए क्योंकि मुझे प्यास लगी है।",
    roman: "Mujhe paani chahiye kyunki mujhe pyaas lagi hai.",
    translation: ""
  },
  {
    id: 3,
    hindi: "यह मेरी माँ हैं और पापा घर पर हैं।",
    roman: "Yeh meri maa hain aur papa ghar par hain.",
    translation: ""
  },
  {
    id: 4,
    hindi: "आज मौसम अच्छा है और मुझे बाहर जाना है।",
    roman: "Aaj mausam achchha hai aur mujhe bahar jaana hai.",
    translation: ""
  },
  {
    id: 5,
    hindi: "मुझे आम पसंद है और मुझे फल खाना अच्छा लगता है।",
    roman: "Mujhe aam pasand hai aur mujhe phal khana achchha lagta hai.",
    translation: ""
  }
];

export function tokenize(s: string): string[] {
  // Replace hyphens with spaces so stuttered fragments ("m-m-moo") become separate words ("m m moo").
  // Then remove all non-alphanumeric/space characters (from ReVoice speech.ts)
  return s
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Collapse consecutive repeated characters in a word (from ReVoice speech.ts)
 * "मेेेरा" → "मेरा", "meeerra" → "mera"
 */
export function collapseRepeats(word: string): string {
  if (word.length <= 1) return word;
  return word.replace(/(.+?)\1+/g, (_, g1) => g1);
}

/**
 * EXACT Clarity Calculation from ReVoice (speech.ts line 860-901)
 *
 * repetition   — word-level fragments repeated ("मे मे मेरा"), seen as extra words against prompt's word count
 * prolongation — sounds held on ("मेेेरा"), seen as repeated characters
 */
export function measureClarity(promptWords: string[], transcriptWords: string[]) {
  if (transcriptWords.length === 0) return { clarity: 0, repetition: 0, prolongation: 0 };

  // Calculate natural repeated letters in the prompt to avoid penalizing them (e.g. "maa", "book")
  let naturalRepeats = 0;
  promptWords.forEach(word => {
    naturalRepeats += word.length - collapseRepeats(word).length;
  });

  // Calculate repeated letters in the transcript
  let spokenRepeats = 0;
  transcriptWords.forEach(word => {
    spokenRepeats += word.length - collapseRepeats(word).length;
  });

  // Only penalize if they repeated MORE letters than naturally exist in the target word
  let hiddenStutterLetters = Math.max(0, spokenRepeats - naturalRepeats);

  // Roughly 3 letters per spoken syllable. Treat these hidden syllables as extra stuttered words!
  const hiddenExtraWords = hiddenStutterLetters / 3;

  // Penalize both explicit extra words (separated by spaces) AND hidden extra words (merged by Whisper)
  const diffWords = Math.abs(transcriptWords.length - promptWords.length) + hiddenExtraWords;
  const repetition = Math.max(0, 1 - (diffWords / Math.max(promptWords.length, 1)));

  // For prolongation, adjust the ratio to account for natural repeats
  const expectedTotalChars = promptWords.reduce((sum, w) => sum + w.length, 0);
  const actualTotalChars = transcriptWords.reduce((sum, w) => sum + w.length, 0);
  const unexpectedExtraChars = Math.max(0, actualTotalChars - expectedTotalChars);

  let prolongation = 1.0;
  if (actualTotalChars > 0) {
    prolongation = Math.max(0, 1 - (unexpectedExtraChars / actualTotalChars));
  }

  // Exact 70% repetition + 30% prolongation weight from ReVoice
  const raw = 0.7 * repetition + 0.3 * prolongation;
  return {
    clarity: Math.max(0, Math.min(100, Math.round(raw * 100))),
    repetition: Math.round(repetition * 100),
    prolongation: Math.round(prolongation * 100),
  };
}

/**
 * Evaluates sentence using dual-transcript clarity scoring from ReVoice:
 * Takes Math.min(browserClarity, whisperClarity) so stutters captured by either engine are accurately penalized!
 */
export function evaluateDualSentence(
  sentenceItem: SentenceItem,
  whisperSpoken: string,
  browserSpoken: string,
  durationMs: number
): SentenceEvaluation {
  const pTokens = tokenize(sentenceItem.hindi);
  const whisperTokens = tokenize(whisperSpoken);
  const browserTokens = tokenize(browserSpoken);

  // ReVoice dual measurement logic:
  // Calculate clarity against browser ASR transcript
  let cl = measureClarity(pTokens, browserTokens.length > 0 ? browserTokens : whisperTokens);

  // If whisper transcript is available, calculate on whisper and take the minimum (captures phonetic stutters)
  if (whisperTokens.length > 0) {
    const clWhisper = measureClarity(pTokens, whisperTokens);
    if (browserTokens.length === 0 || clWhisper.clarity < cl.clarity) {
      cl = clWhisper;
    }
  }

  // Display text: Browser ASR is strictly in native Hindi Devanagari script.
  // If browser ASR captured text, use it as primary readable display text;
  // If only whisper is available, use whisper.
  const displayDevanagari = browserSpoken.trim() || whisperSpoken.trim() || '(No speech recorded)';

  const detectedIssues: string[] = [];
  if (cl.repetition < 70) {
    detectedIssues.push('Syllable / Word Repetition (Stuttering)');
  }
  if (cl.prolongation < 70) {
    detectedIssues.push('Sound Stretching / Prolongation');
  }
  const effectiveTokens = browserTokens.length > 0 ? browserTokens : whisperTokens;
  if (effectiveTokens.length < pTokens.length * 0.6) {
    detectedIssues.push('Omitted words / Incomplete phrase');
  }

  // Word accuracy: were the right words said? Take the better of the two engines,
  // since an ASR mistake is more likely than a child's error.
  const accuracy = [browserTokens, whisperTokens]
    .filter(t => t.length > 0)
    .map(t => wordAccuracy(pTokens, t))
    .reduce<ReturnType<typeof wordAccuracy> | null>((best, a) => (!best || a.accuracyPct > best.accuracyPct ? a : best), null)
    ?? { accuracyPct: 0, missedWords: pTokens };
  if (accuracy.accuracyPct < 70 && effectiveTokens.length >= pTokens.length * 0.6) {
    detectedIssues.push('Word substitutions / Mispronunciations');
  }

  let feedback = 'Clear and fluent expression!';
  if (cl.clarity < 65) {
    feedback = 'Noticeable stuttering & disfluency. Practice smooth easy-onset speech.';
  } else if (cl.clarity < 75) {
    feedback = 'Minor sound repetitions or prolongations observed. Practice continuous breath.';
  }

  return {
    sentenceId: sentenceItem.id,
    targetSentence: sentenceItem.hindi,
    spokenWhisperText: displayDevanagari,
    spokenBrowserText: browserSpoken.trim(),
    durationMs,
    clarityPct: cl.clarity,
    repetitionPct: cl.repetition,
    prolongationPct: cl.prolongation,
    detectedIssues,
    feedback,
    accuracyPct: accuracy.accuracyPct,
    missedWords: accuracy.missedWords
  };
}

/**
 * Score evaluated sentence using ReVoice measurement
 */
export function evaluateSentence(
  sentenceItem: SentenceItem,
  whisperSpoken: string,
  durationMs: number
): SentenceEvaluation {
  return evaluateDualSentence(sentenceItem, whisperSpoken, '', durationMs);
}

/**
 * Aggregates diagnostic report exactly following ReVoice scoring logic
 */
export function generateDiagnosticReport(
  profile: ChildProfile,
  evaluations: SentenceEvaluation[],
  tasks: ScreeningTasks = {}
): DiagnosticReport {
  const total = evaluations.length || 1;
  const avgClarity = Math.round(evaluations.reduce((sum, e) => sum + e.clarityPct, 0) / total);
  const avgRepetition = Math.round(evaluations.reduce((sum, e) => sum + e.repetitionPct, 0) / total);
  const avgProlongation = Math.round(evaluations.reduce((sum, e) => sum + e.prolongationPct, 0) / total);

  const overallScore = avgClarity;

  const stutterCount = evaluations.filter(e => e.repetitionPct < 75).length;
  const prolongCount = evaluations.filter(e => e.prolongationPct < 75).length;
  const omittedCount = evaluations.filter(e => e.detectedIssues.some(i => i.includes('Omitted'))).length;
  const accuracies = evaluations.map(e => e.accuracyPct).filter((v): v is number => v !== undefined);
  const avgAccuracy = accuracies.length ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : undefined;

  const screening = buildScreening(profile.age, evaluations, tasks);
  const domainStatus = (key: string) => screening.domains.find(d => d.key === key)?.status;
  const flagged = (key: string) => domainStatus(key) === 'monitor' || domainStatus(key) === 'refer';
  const breathTested = breathStatus(profile.age, tasks.voice) !== 'not_tested';

  const flags = {
    stuttering: stutterCount >= 2,
    prolongation: prolongCount >= 2,
    // Measured directly from the sustained "आ" when available
    breathSustain: breathTested ? flagged('breath') : prolongCount >= 2,
    articulation: omittedCount >= 2 || avgClarity < 70 || flagged('sounds') || (tasks.sameSound ? tasks.sameSound.overallAccuracyPct < 75 : false),
  };

  let primaryIssue = 'Clear Natural Speech';
  let severity: 'Mild' | 'Moderate' | 'Noticeable' | 'Optimal' = 'Optimal';
  let description = 'The child displayed clear pronunciation, good speech sound articulation, and high vocal clarity in Devanagari.';

  if (overallScore < 55) {
    severity = 'Noticeable';
  } else if (overallScore < 75) {
    severity = 'Moderate';
  } else if (overallScore < 88) {
    severity = 'Mild';
  }

  if (flags.stuttering && flags.prolongation) {
    primaryIssue = 'Childhood Disfluency (Stuttering & Sound Prolongations)';
    description = 'The child displays recurring syllable repetitions and stretched sounds in Devanagari speech.';
  } else if (flags.stuttering) {
    primaryIssue = 'Repetition-Predominant Stuttering';
    description = 'Frequent syllable and word-level repetitions observed before stabilizing on the target words.';
  } else if (flags.prolongation || (flags.breathSustain && !breathTested)) {
    primaryIssue = 'Breath Sustain & Sound Prolongation';
    description = 'Vowels and fricative sounds are prolonged past normal duration, pointing to vocal tension or low respiratory support.';
  } else if (flags.breathSustain) {
    primaryIssue = 'Reduced Breath Support for Speech';
    description = 'The child could not sustain "आ" for as long as expected for their age, suggesting limited breath support for speech.';
  } else if (flags.articulation) {
    primaryIssue = 'Word Articulation & Sound Clarity';
    description = 'Phonetic substitutions or omissions observed in multisyllabic target words.';
  }

  // A specific finding should never be presented as "Optimal".
  if (primaryIssue !== 'Clear Natural Speech' && severity === 'Optimal') {
    severity = 'Mild';
  }

  const recommendations = [];

  if (flags.stuttering) {
    recommendations.push({
      title: 'Easy Onset & Light Articulatory Contact',
      advice: 'Encourage the child to start words with very gentle airflow rather than hard vocal bursts. Avoid saying "hurry up" or finishing their sentences.',
      activities: [
        'Sigh-to-word transition: Take a relaxed breath and gently slide into words like "hhaa... mera".',
        'Turtle Speech: Practice reading short phrases slowly at half-speed with rhythmic hand taps.'
      ]
    });
  }

  if (flags.breathSustain || flags.prolongation) {
    recommendations.push({
      title: 'Diaphragmatic Breath & Continuous Phonation',
      advice: 'The child needs steady respiratory support so sounds do not stretch or choke mid-sentence.',
      activities: [
        'Belly Balloon: Place a hand on the tummy and take 3 deep belly breaths before speaking.',
        'Continuous Phonation Straw: Hum a gentle sound through a paper straw for 4 seconds without stopping.'
      ]
    });
  }

  if (flags.articulation || recommendations.length === 0) {
    recommendations.push({
      title: 'Mirror Word Articulation & Visual Imitation',
      advice: 'Work on distinct mouth positioning for multisyllabic Hindi words.',
      activities: [
        'Mirror Practice: Look together in a mirror while speaking words with "स", "र", and "प".',
        'Echo Game: Parent says 3 words clearly; child echoes with focused lip movement.'
      ]
    });
  }

  if (voiceQualityStatus(tasks.voice) === 'monitor' || voiceQualityStatus(tasks.voice) === 'refer') {
    recommendations.push({
      title: 'Voice Care & Healthy Voicing',
      advice: 'The voice sounded rough or breathy on the sustained "आ". If hoarseness lasts more than 2 weeks, consult an ENT doctor.',
      activities: [
        'Water breaks: Sip water through the school day to keep the voice box moist.',
        'Quiet voice games: Use a "library voice" indoors and avoid shouting or loud imitation sounds.'
      ]
    });
  }

  if ([ddkStatus(profile.age, tasks.ddk?.amr), ddkStatus(profile.age, tasks.ddk?.smr)].some(s => s === 'monitor' || s === 'refer')) {
    recommendations.push({
      title: 'Speech Motor Rhythm Practice',
      advice: 'Repeating syllables quickly and evenly was harder than expected for age.',
      activities: [
        'Drum talk: Tap a drum once for each syllable — "पा-टा-का" slowly, then a little faster.',
        'Copycat chains: Parent says two syllables ("पा-टा"), child copies; add one more syllable when easy.'
      ]
    });
  }

  const naming = namingSummary(tasks.naming);
  if (naming.soundsToWatch.length > 0) {
    const sounds = naming.soundsToWatch.slice(0, 3).join(', ');
    recommendations.push({
      title: `Target Sound Practice (${sounds})`,
      advice: `These sounds were missed in more than one picture name: ${sounds}.`,
      activities: [
        'Sound hunt: Find 5 things at home that start with the practice sound and name them together.',
        'Slow & clear: Say each practice word 3 times slowly while looking in a mirror.'
      ]
    });
  }

  return {
    profile,
    date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    overallScore,
    overallClarity: avgClarity,
    avgRepetitionScore: avgRepetition,
    avgProlongationScore: avgProlongation,
    sentences: evaluations,
    coreDiagnosis: {
      primaryIssue,
      severity,
      description,
      flags
    },
    recommendations,
    avgAccuracy,
    tasks,
    screening
  };
}
