-- ============================================================================
-- ReVoice Child Speech Diagnosis - Complete Supabase Database Schema
-- Run this script in your Supabase Project: Dashboard -> SQL Editor -> New Query
-- ============================================================================

-- 1. SPEAKERS TABLE (Child Profile & Guardian Info)
create table if not exists public.speakers (
  speaker_id         text primary key,
  child_name         text not null,
  age                int not null,
  gender             text not null,
  parent_name        text not null,
  parent_mobile      text not null,
  consent            boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 2. SENTENCE RECORDS TABLE (Prompt-wise Sentence Evaluations)
create table if not exists public.sentence_records (
  id                           bigint generated always as identity primary key,
  speaker_id                   text not null references public.speakers (speaker_id) on delete cascade,
  prompt_id                    text not null,
  sentence_number              int not null,
  target_hindi                 text not null,
  target_hinglish              text,
  spoken_devanagari_transcript text,
  audio_filename               text, -- Stores filename e.g. 'REC_SPK10000_L0S01.WAV'
  duration_ms                  int,
  clarity_pct                  int,
  repetition_pct               int,
  prolongation_pct             int,
  detected_issues              jsonb default '[]'::jsonb,
  clinical_feedback            text,
  created_at                   timestamptz not null default now(),
  constraint unique_speaker_prompt unique (speaker_id, prompt_id)
);

create index if not exists idx_sentence_records_speaker on public.sentence_records (speaker_id);

-- 3. DIAGNOSTIC ASSESSMENTS TABLE (Final Clinical Report Summary)
create table if not exists public.diagnostic_assessments (
  id                   bigint generated always as identity primary key,
  speaker_id           text not null references public.speakers (speaker_id) on delete cascade,
  overall_score        int not null,
  avg_clarity          int not null,
  avg_repetition       int not null,
  avg_prolongation     int not null,
  primary_issue        text not null,
  severity             text not null,
  clinical_description text,
  diagnostic_flags     jsonb default '{}'::jsonb,
  recommendations      jsonb default '[]'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists idx_diagnostic_assessments_speaker on public.diagnostic_assessments (speaker_id);

-- 4. SCREENING RESULTS TABLE (Voice MPT, DDK Pa-ta-ka, Picture Naming Articulation)
create table if not exists public.screening_results (
  id                 bigint generated always as identity primary key,
  speaker_id         text not null references public.speakers (speaker_id) on delete cascade,
  age                int,
  age_band           text,
  overall_status     text not null check (overall_status in ('typical', 'monitor', 'refer', 'inconclusive', 'not_tested')),
  domains            jsonb not null,
  avg_word_accuracy  int,
  voice_attempts     jsonb default '[]'::jsonb,
  ddk                jsonb default '{}'::jsonb,
  picture_naming     jsonb default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists idx_screening_results_speaker on public.screening_results (speaker_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allows the web app (using public anon key) to insert and read records
-- ============================================================================

-- Enable RLS on all tables
alter table public.speakers enable row level security;
alter table public.sentence_records enable row level security;
alter table public.diagnostic_assessments enable row level security;
alter table public.screening_results enable row level security;

-- Speakers policies
create policy "Allow anon insert to speakers" on public.speakers for insert to anon with check (true);
create policy "Allow anon update to speakers" on public.speakers for update to anon using (true) with check (true);
create policy "Allow anon select from speakers" on public.speakers for select to anon using (true);

-- Sentence Records policies
create policy "Allow anon insert to sentence_records" on public.sentence_records for insert to anon with check (true);
create policy "Allow anon update to sentence_records" on public.sentence_records for update to anon using (true) with check (true);
create policy "Allow anon select from sentence_records" on public.sentence_records for select to anon using (true);

-- Diagnostic Assessments policies
create policy "Allow anon insert to diagnostic_assessments" on public.diagnostic_assessments for insert to anon with check (true);
create policy "Allow anon select from diagnostic_assessments" on public.diagnostic_assessments for select to anon using (true);

-- Screening Results policies
create policy "Allow anon insert to screening_results" on public.screening_results for insert to anon with check (true);
create policy "Allow anon select from screening_results" on public.screening_results for select to anon using (true);
