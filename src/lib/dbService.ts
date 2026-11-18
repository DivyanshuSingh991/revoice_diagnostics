import { supabase } from './supabase';
import { ChildProfile, SentenceEvaluation, DiagnosticReport } from '../types';

export interface SpeakerRecord {
  speaker_id: string;
  child_name: string;
  age: number;
  gender: string;
  parent_name: string;
  parent_mobile: string;
  consent: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PastAssessmentSummary {
  id: number;
  speaker_id: string;
  overall_score: number;
  avg_clarity: number;
  avg_repetition: number;
  avg_prolongation: number;
  primary_issue: string;
  severity: string;
  clinical_description: string;
  created_at: string;
}

/**
 * 1. Save or update speaker profile in Supabase
 */
export async function saveSpeakerProfile(profile: ChildProfile): Promise<{ data: any; error: any }> {
  try {
    const speakerIdUpper = profile.speakerId.trim().toUpperCase();
    const payload = {
      speaker_id: speakerIdUpper,
      child_name: profile.name.trim(),
      age: Number(profile.age),
      gender: profile.gender,
      parent_name: profile.parentName.trim(),
      parent_mobile: profile.parentMobile.trim(),
      consent: Boolean(profile.consent),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('speakers')
      .upsert(payload, { onConflict: 'speaker_id' });

    if (error) {
      console.error('[DB] Error saving speaker profile:', error);
      return { data: null, error };
    }

    // Keep localStorage updated with this speaker number
    const numMatch = speakerIdUpper.match(/^SPK(\d+)$/i);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      const currentSaved = parseInt(localStorage.getItem('last_speaker_num') || '0', 10);
      if (num >= currentSaved) {
        localStorage.setItem('last_speaker_num', (num + 1).toString());
      }
    }

    console.log('[DB] Speaker profile saved to Supabase:', speakerIdUpper);
    return { data, error: null };
  } catch (err: any) {
    console.error('[DB] Unexpected error saving speaker:', err);
    return { data: null, error: err?.message || err };
  }
}

/**
 * 2. Fetch the next available Speaker ID from Supabase (e.g. SPK10004)
 */
export async function fetchNextSpeakerId(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('speakers')
      .select('speaker_id');

    let maxNum = 9999;

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (typeof row.speaker_id === 'string') {
          const match = row.speaker_id.match(/^SPK(\d+)$/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (!isNaN(val) && val > maxNum) {
              maxNum = val;
            }
          }
        }
      }
    }

    // Check localStorage as well to avoid regressions
    const localSaved = parseInt(localStorage.getItem('last_speaker_num') || '0', 10);
    if (!isNaN(localSaved) && localSaved > maxNum) {
      maxNum = localSaved - 1;
    }

    const nextNum = Math.max(maxNum + 1, 10000);
    localStorage.setItem('last_speaker_num', nextNum.toString());
    return `SPK${nextNum}`;
  } catch (err) {
    console.warn('[DB] Could not query next speaker ID, using local fallback:', err);
    const saved = localStorage.getItem('last_speaker_num');
    const num = saved ? parseInt(saved, 10) : 10000;
    return `SPK${num}`;
  }
}

/**
 * 3. Fetch recently registered speakers from Supabase
 */
export async function fetchRecentSpeakers(limit = 40): Promise<{ data: SpeakerRecord[]; error: any }> {
  try {
    const { data, error } = await supabase
      .from('speakers')
      .select('*', { order: 'created_at.desc', limit });

    if (error) {
      console.error('[DB] Failed to fetch speakers:', error);
      return { data: [], error };
    }

    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (err: any) {
    console.error('[DB] Network error fetching speakers:', err);
    return { data: [], error: err?.message || err };
  }
}

/**
 * 4. Fetch past diagnostic assessments and screening history for a speaker
 */
export async function fetchSpeakerHistory(speakerId: string): Promise<{
  assessments: PastAssessmentSummary[];
  screeningResults: any[];
  error: any;
}> {
  try {
    const idUpper = speakerId.trim().toUpperCase();
    
    // Fetch assessments
    const { data: assessmentsData, error: assessError } = await supabase
      .from('diagnostic_assessments')
      .select('*', {
        filters: { speaker_id: `eq.${idUpper}` },
        order: 'created_at.desc',
        limit: 10
      });

    // Fetch screening results
    const { data: screeningData, error: screenError } = await supabase
      .from('screening_results')
      .select('*', {
        filters: { speaker_id: `eq.${idUpper}` },
        order: 'created_at.desc',
        limit: 10
      });

    return {
      assessments: Array.isArray(assessmentsData) ? assessmentsData : [],
      screeningResults: Array.isArray(screeningData) ? screeningData : [],
      error: assessError || screenError || null
    };
  } catch (err: any) {
    console.error('[DB] Error fetching speaker history:', err);
    return { assessments: [], screeningResults: [], error: err?.message || err };
  }
}

/**
 * 5. Save prompt-wise sentence evaluation record
 */
export async function savePromptRecord(
  speakerId: string,
  evalResult: SentenceEvaluation,
  promptRoman?: string
) {
  try {
    const promptCode = `L0_S${evalResult.sentenceId.toString().padStart(2, '0')}`;
    const { data, error } = await supabase
      .from('sentence_records')
      .upsert({
        speaker_id: speakerId.toUpperCase(),
        prompt_id: promptCode,
        sentence_number: evalResult.sentenceId,
        target_hindi: evalResult.targetSentence,
        target_hinglish: promptRoman || '',
        spoken_devanagari_transcript: evalResult.spokenWhisperText,
        audio_filename: evalResult.audioFilename || '',
        duration_ms: evalResult.durationMs,
        clarity_pct: evalResult.clarityPct,
        repetition_pct: evalResult.repetitionPct,
        prolongation_pct: evalResult.prolongationPct,
        detected_issues: evalResult.detectedIssues,
        clinical_feedback: evalResult.feedback
      }, { onConflict: 'speaker_id,prompt_id' });

    if (error) {
      console.error('[DB] Error saving prompt record:', error);
    } else {
      console.log('[DB] Sentence record saved for prompt:', promptCode);
    }
    return { data, error };
  } catch (err) {
    console.error('[DB] Unexpected error saving sentence record:', err);
    return { error: err };
  }
}

/**
 * 6. Save final diagnostic assessment report
 */
export async function saveDiagnosticAssessment(report: DiagnosticReport) {
  try {
    const { data, error } = await supabase
      .from('diagnostic_assessments')
      .insert({
        speaker_id: report.profile.speakerId.toUpperCase(),
        overall_score: report.overallScore,
        avg_clarity: report.overallClarity,
        avg_repetition: report.avgRepetitionScore,
        avg_prolongation: report.avgProlongationScore,
        primary_issue: report.coreDiagnosis.primaryIssue,
        severity: report.coreDiagnosis.severity,
        clinical_description: report.coreDiagnosis.description,
        diagnostic_flags: report.coreDiagnosis.flags,
        recommendations: report.recommendations
      });

    if (error) {
      console.error('[DB] Error saving diagnostic assessment:', error);
    } else {
      console.log('[DB] Diagnostic assessment saved for:', report.profile.speakerId);
    }
    return { data, error };
  } catch (err) {
    console.error('[DB] Unexpected error saving diagnostic report:', err);
    return { error: err };
  }
}

/**
 * 7. Save screening protocol results (voice, DDK, picture naming + domain outcomes).
 */
export async function saveScreeningResult(report: DiagnosticReport) {
  if (import.meta.env.VITE_SAVE_SCREENING === 'false' || !report.screening) return { error: null };

  try {
    const { data, error } = await supabase
      .from('screening_results')
      .insert({
        speaker_id: report.profile.speakerId.toUpperCase(),
        age: report.profile.age,
        age_band: report.screening.ageBand,
        overall_status: report.screening.overall,
        domains: report.screening.domains,
        avg_word_accuracy: report.avgAccuracy ?? null,
        voice_attempts: report.tasks?.voice ?? [],
        ddk: report.tasks?.ddk ?? {},
        picture_naming: report.tasks?.naming ?? []
      });

    if (error) {
      console.error('[DB] Error saving screening result:', error);
    } else {
      console.log('[DB] Screening result saved for:', report.profile.speakerId);
    }
    return { data, error };
  } catch (err) {
    console.error('[DB] Unexpected error saving screening result:', err);
    return { error: err };
  }
}
