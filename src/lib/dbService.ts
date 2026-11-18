import { supabase } from './supabase';
import { ChildProfile, SentenceEvaluation, DiagnosticReport } from '../types';

/**
 * 1. Save or update speaker profile
 */
export async function saveSpeakerProfile(profile: ChildProfile) {
  if (!supabase) {
    console.warn('[DB] Supabase not connected. Skipping save.');
    return { error: 'Supabase client not initialized' };
  }

  try {
    const { data, error } = await supabase
      .from('speakers')
      .upsert({
        speaker_id: profile.speakerId.toUpperCase(),
        child_name: profile.name,
        age: profile.age,
        gender: profile.gender,
        parent_name: profile.parentName,
        parent_mobile: profile.parentMobile,
        consent: profile.consent,
      }, { onConflict: 'speaker_id' });

    if (error) {
      console.error('[DB] Error saving speaker profile:', error);
    } else {
      console.log('[DB] Speaker profile saved to Supabase:', profile.speakerId);
    }
    return { data, error };
  } catch (err) {
    console.error('[DB] Unexpected error saving speaker:', err);
    return { error: err };
  }
}

/**
 * 2. Save prompt-wise sentence evaluation record
 */
export async function savePromptRecord(
  speakerId: string,
  evalResult: SentenceEvaluation,
  promptRoman?: string
) {
  if (!supabase) return { error: 'Supabase not initialized' };

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
 * 3. Save final diagnostic assessment report
 */
export async function saveDiagnosticAssessment(report: DiagnosticReport) {
  if (!supabase) return { error: 'Supabase not initialized' };

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
 * 4. Save screening protocol results (voice, DDK, picture naming + domain outcomes).
 *    Opt-in: create the table with supabase/screening_results.sql, then set VITE_SAVE_SCREENING=true.
 */
export async function saveScreeningResult(report: DiagnosticReport) {
  if (!supabase || import.meta.env.VITE_SAVE_SCREENING === 'false' || !report.screening) return { error: null };

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
