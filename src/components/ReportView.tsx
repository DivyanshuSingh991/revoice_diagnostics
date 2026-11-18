import React from 'react';
import { DiagnosticReport } from '../types';
import {
  LogOut,
  AlertCircle,
  Check,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Activity,
  HeartPulse,
  Download,
  ClipboardCheck,
  Info
} from 'lucide-react';
import { METRIC_STYLES, MetricMeter, ScoreRing, scoreTone, StatusPill, STATUS_STYLES } from './ui';
import { OVERALL_LABEL, ageBand, bestVoiceAttempt, effectiveNaming, namingSummary, scoredNaming } from '../lib/screening';
import { PICTURE_WORDS } from '../lib/articulation';

const SEVERITY_TONES: Record<DiagnosticReport['coreDiagnosis']['severity'], { panel: string; icon: string; badge: string }> = {
  Optimal: { panel: 'bg-emerald-50/70 border-emerald-200', icon: 'bg-emerald-500 text-white', badge: 'bg-emerald-100 text-emerald-800' },
  Mild: { panel: 'bg-sky-50/70 border-sky-200', icon: 'bg-sky-500 text-white', badge: 'bg-sky-100 text-sky-800' },
  Moderate: { panel: 'bg-amber-50/70 border-amber-200', icon: 'bg-amber-500 text-white', badge: 'bg-amber-100 text-amber-800' },
  Noticeable: { panel: 'bg-rose-50/70 border-rose-200', icon: 'bg-rose-500 text-white', badge: 'bg-rose-100 text-rose-800' },
};

interface Props {
  report: DiagnosticReport;
  onLogout: () => void;
}

export const ReportView: React.FC<Props> = ({ report, onLogout }) => {
  const { profile, coreDiagnosis, recommendations, sentences } = report;

  const handlePrint = () => {
    window.print();
  };

  const severityTone = SEVERITY_TONES[coreDiagnosis.severity] || SEVERITY_TONES.Mild;
  const overallTone = scoreTone(report.overallScore);

  const flagItems = [
    { on: coreDiagnosis.flags.stuttering, yes: 'Repetition Stutter Detected', no: 'No Syllable Stutter' },
    { on: coreDiagnosis.flags.prolongation, yes: 'Sound Prolongation Present', no: 'Sound Sustain Normal' },
    { on: coreDiagnosis.flags.breathSustain, yes: 'Breath Support Attention', no: 'Breath Duration Sufficient' },
    { on: coreDiagnosis.flags.articulation, yes: 'Word Articulation Attention', no: 'Clear Phonetic Output' },
  ];

  const meta = [
    { label: 'Speaker ID', value: profile.speakerId || 'SPK10000', mono: true },
    { label: "Child's name", value: profile.name },
    { label: 'Age & gender', value: `${profile.age} yrs · ${profile.gender}` },
    { label: "Parent's name", value: profile.parentName || 'N/A' },
    { label: 'Mobile no.', value: profile.parentMobile || 'N/A', mono: true },
    { label: 'Assessment date', value: report.date },
  ];

  return (
    <article className="max-w-4xl mx-auto space-y-5 animate-fade-up print:space-y-4 print:animate-none">
      {/* Header & Actions */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
        <div className="min-w-0">
          <p className="eyebrow text-brand-600">ReVoice speech screening report</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
            Speech screening for {profile.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acoustic clarity &amp; disfluency diagnostic · Whisper Devanagari (temperature 0)
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="btn-primary h-11 px-4 text-sm"
            title="Save as PDF or print paper report"
          >
            <Download className="w-4 h-4" />
            Save as PDF / Print
          </button>
          <button
            onClick={onLogout}
            className="btn-secondary h-11 px-4 text-sm hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50"
            title="Log out and clear session"
          >
            <LogOut className="w-4 h-4" />
            End session
          </button>
        </div>
      </header>

      {/* Child & Parent Summary Meta */}
      <dl className="card p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-4 print:shadow-none">
        {meta.map((m) => (
          <div key={m.label} className="min-w-0">
            <dt className="text-xs font-medium text-slate-400">{m.label}</dt>
            <dd className={`mt-0.5 font-semibold text-slate-800 truncate ${m.mono ? 'font-mono text-[15px]' : ''}`}>
              {m.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Screening outcome per domain */}
      {report.screening && (
        <section className="card overflow-hidden print:shadow-none print:break-inside-avoid">
          <div className={`px-5 md:px-7 py-5 flex items-start gap-4 border-b ${STATUS_STYLES[report.screening.overall].pill}`}>
            <ClipboardCheck className="w-6 h-6 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="eyebrow !text-current opacity-80">Screening outcome · age band {report.screening.ageBand}</p>
              <h2 className="text-2xl font-bold leading-tight">{OVERALL_LABEL[report.screening.overall].title}</h2>
              <p className="text-sm mt-0.5 opacity-90">{OVERALL_LABEL[report.screening.overall].action}</p>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {report.screening.domains.map((d) => (
              <li key={d.key} className="px-5 md:px-7 py-3.5 grid sm:grid-cols-[12rem_7.5rem_1fr] gap-x-4 gap-y-1 items-start">
                <span className="font-semibold text-slate-800 text-sm">{d.label}</span>
                <span>
                  <StatusPill status={d.status} />
                </span>
                <span className="text-sm text-slate-600 min-w-0">
                  {d.measure !== '—' && <span className="block font-medium text-slate-800 tabular-nums">{d.measure}</span>}
                  <span className="block text-xs text-slate-500">{d.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Overall Score Summary (Clarity, Repetition, Sustain) */}
      <section className="card p-6 md:p-7 grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-center print:shadow-none print:break-inside-avoid">
        <div className="flex items-center gap-5">
          <ScoreRing score={report.overallScore} />
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5" /> Overall clarity score
            </p>
            <p className={`font-display text-2xl font-bold mt-1 ${overallTone.text}`}>{overallTone.label}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[13rem]">
              Synthesized acoustic accuracy and phoneme precision
            </p>
          </div>
        </div>
        <div className="space-y-5">
          {report.avgAccuracy !== undefined && (
            <div>
              <MetricMeter metric="accuracy" value={report.avgAccuracy} compact />
              <p className="text-xs text-slate-500 mt-1.5">Target words produced correctly, in order</p>
            </div>
          )}
          <div>
            <MetricMeter metric="repetition" value={report.avgRepetitionScore} compact />
            <p className="text-xs text-slate-500 mt-1.5">Syllable-level consistency &amp; stutter detection</p>
          </div>
          <div>
            <MetricMeter metric="sustain" value={report.avgProlongationScore} compact />
            <p className="text-xs text-slate-500 mt-1.5">Breath sustain &amp; sound prolongation control</p>
          </div>
        </div>
      </section>

      {/* Core Diagnostic Section */}
      <section className={`rounded-3xl border p-6 md:p-7 ${severityTone.panel} print:break-inside-avoid`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${severityTone.icon}`}>
            {coreDiagnosis.severity === 'Optimal' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="eyebrow">Diagnostic finding</p>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${severityTone.badge}`}>
                {coreDiagnosis.severity} degree
              </span>
            </div>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 leading-tight">{coreDiagnosis.primaryIssue}</h2>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{coreDiagnosis.description}</p>
          </div>
        </div>

        {/* Diagnostic Flags */}
        <ul className="mt-5 grid sm:grid-cols-2 gap-2">
          {flagItems.map((f) => (
            <li
              key={f.yes}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-white/80 border ${
                f.on ? 'border-amber-300 text-amber-900' : 'border-white text-slate-600'
              }`}
            >
              {f.on ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
              ) : (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
              )}
              {f.on ? f.yes : f.no}
            </li>
          ))}
        </ul>
      </section>

      {/* Detailed Per-Sentence Analysis */}
      <section className="card overflow-hidden print:shadow-none">
        <div className="px-5 md:px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-600" />
            Per-sentence clarity breakdown
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
            {(report.avgAccuracy !== undefined ? (['clarity', 'accuracy', 'repetition', 'sustain'] as const) : (['clarity', 'repetition', 'sustain'] as const)).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${METRIC_STYLES[k].bar}`} />
                {METRIC_STYLES[k].label}
              </span>
            ))}
          </div>
        </div>
        <ol className="divide-y divide-slate-100">
          {sentences.map((s, idx) => (
            <li key={s.sentenceId} className="px-5 md:px-6 py-4 grid md:grid-cols-[2rem_1fr_auto] gap-x-4 gap-y-3 print:break-inside-avoid">
              <span className="hidden md:flex w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-xs font-bold items-center justify-center">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">
                  <span className="md:hidden font-semibold text-slate-500 mr-1">#{idx + 1}</span>
                  Target: <span className="font-display text-sm">{s.targetSentence}</span>
                </p>
                <p className="font-display text-lg font-bold text-slate-900 leading-snug mt-0.5">{s.spokenWhisperText}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {s.detectedIssues.length > 0 ? (
                    s.detectedIssues.map((iss, i) => (
                      <span key={i} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {iss}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Clear &amp; Accurate
                    </span>
                  )}
                  {s.audioFilename && (
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      {s.audioFilename}
                    </span>
                  )}
                </div>
              </div>
              <div className={`grid gap-2 self-center ${s.accuracyPct !== undefined ? 'grid-cols-4 md:w-80' : 'grid-cols-3 md:w-60'}`}>
                {([
                  ['clarity', s.clarityPct],
                  ...(s.accuracyPct !== undefined ? [['accuracy', s.accuracyPct] as const] : []),
                  ['repetition', s.repetitionPct],
                  ['sustain', s.prolongationPct],
                ] as const).map(([k, v]) => (
                  <div key={k} className={`rounded-xl px-2 py-1.5 text-center ${METRIC_STYLES[k].soft}`}>
                    <span className={`block font-display text-lg font-bold tabular-nums leading-tight ${METRIC_STYLES[k].text}`}>{v}%</span>
                    <span className="block text-[10px] font-medium text-slate-500">{METRIC_STYLES[k].short}</span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {report.tasks && <TaskDetails tasks={report.tasks} age={profile.age} />}

      {/* Clinical Guidance: How Child Can Speak More Clearly */}
      <section>
        <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Targeted speech therapy &amp; home intervention plan
        </h3>
        <div className={`grid grid-cols-1 gap-4 ${recommendations.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {recommendations.map((rec, i) => (
            <div key={i} className="card p-5 print:shadow-none print:break-inside-avoid">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 shrink-0 rounded-xl bg-brand-50 text-brand-700 font-display font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 leading-snug">{rec.title}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mt-1">{rec.advice}</p>
                </div>
              </div>
              <p className="eyebrow mt-4 mb-2">Recommended home drills</p>
              <ul className="space-y-2">
                {rec.activities.map((act, actIdx) => (
                  <li key={actIdx} className="flex gap-2.5 text-sm text-slate-700 bg-slate-50 p-3 rounded-xl">
                    <Check className="w-4 h-4 shrink-0 text-brand-500 mt-0.5" strokeWidth={2.5} />
                    {act}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="flex gap-2 text-xs text-slate-500 leading-relaxed border-t border-slate-200 pt-4">
        <Info className="w-4 h-4 shrink-0 text-slate-400" />
        This is an automated screening, not a diagnosis. Results depend on recording quality and use provisional cut-offs.
        Only a qualified speech-language pathologist can diagnose a speech or language disorder.
      </p>
    </article>
  );
};

const TaskDetails: React.FC<{ tasks: NonNullable<DiagnosticReport['tasks']>; age: number }> = ({ tasks, age }) => {
  const voice = bestVoiceAttempt(tasks.voice);
  const ddk = [tasks.ddk?.amr, tasks.ddk?.smr].filter((d): d is NonNullable<typeof d> => !!d);
  const naming = scoredNaming(tasks.naming);
  const summary = namingSummary(tasks.naming);
  if (!voice && ddk.length === 0 && naming.length === 0) return null;

  const cell = (label: string, value: React.ReactNode, hint?: string) => (
    <div>
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className="font-display text-lg font-bold text-slate-900 tabular-nums leading-tight">{value}</dd>
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
  const val = (x: number, unit: string) => (Number.isNaN(x) ? '—' : `${x}${unit}`);

  const band = ageBand(age);
  const mptExp = band === '3–5' ? 6 : band === '6–8' ? 8 : 10;
  const pitchExp = band === '3–5' ? '250–350 Hz' : band === '6–8' ? '220–300 Hz' : '190–260 Hz';

  return (
    <section className="grid md:grid-cols-2 gap-4">
      {voice && (
        <div className="card p-5 print:shadow-none print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-900">🎈 Voice &amp; breath</h3>
          <p className="text-xs text-slate-500 mb-4">Sustained “आ”, best of {tasks.voice?.length} tries</p>
          <dl className="grid grid-cols-3 gap-3">
            {cell('Held for', `${voice.mptSec} s`, `≥ ${mptExp}s normal`)}
            {cell('Pitch', voice.f0Hz ? `${voice.f0Hz} Hz` : '—', `${pitchExp} normal`)}
            {cell('HNR', val(voice.hnrDb, ' dB'), '≥ 12 dB normal')}
            {cell('Jitter', val(voice.jitterPct, '%'), '≤ 1.5% normal')}
            {cell('Shimmer', val(voice.shimmerPct, '%'), '≤ 6% normal')}
            {cell('Noise (SNR)', `${voice.snrDb} dB`, '≥ 15 dB clean')}
          </dl>
        </div>
      )}
      {ddk.length > 0 && (
        <div className="card p-5 print:shadow-none print:break-inside-avoid">
          <h3 className="text-lg font-bold text-slate-900">🚂 Speech motor</h3>
          <p className="text-xs text-slate-500 mb-4">Repeating syllables as fast as possible</p>
          <div className="space-y-3">
            {ddk.map((d) => {
              const expectedRate = d.kind === 'amr'
                ? (band === '3–5' ? 3.0 : band === '6–8' ? 3.5 : 4.0)
                : (band === '3–5' ? 2.5 : band === '6–8' ? 3.0 : 3.5);
              return (
                <dl key={d.kind} className="grid grid-cols-[6.5rem_1fr_1fr_1fr] gap-3 items-end">
                  <span className="font-display text-lg font-bold text-slate-700">{d.kind === 'amr' ? 'पा-पा-पा' : 'पा-टा-का'}</span>
                  {cell('Rate', `${d.ratePerSec}/s`, `≥ ${expectedRate}/s normal`)}
                  {cell('Rhythm', d.regularityCv > 0.3 ? 'Uneven' : 'Even', `CV ${d.regularityCv} (≤ 0.30)`)}
                  {cell('Order', d.kind === 'smr' ? (d.sequenceCorrect === undefined ? '—' : d.sequenceCorrect ? 'Kept' : 'Mixed') : 'n/a', d.kind === 'smr' ? 'Sequence' : undefined)}
                </dl>
              );
            })}
          </div>
        </div>
      )}
      {naming.length > 0 && (
        <div className="card p-5 md:col-span-2 print:shadow-none print:break-inside-avoid">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">🖼️ Speech sounds — picture naming</h3>
              <p className="text-xs text-slate-500">
                {summary.items} pictures · {summary.wordsCorrect} named with all sounds correct · PCC {summary.pcc}%
              </p>
            </div>
            {summary.soundsToWatch.length > 0 && (
              <p className="text-sm text-slate-600">
                Sounds to watch:{' '}
                <span className="font-display font-bold text-rose-700">{summary.soundsToWatch.join(', ')}</span>
              </p>
            )}
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {naming.map((it) => {
              const e = effectiveNaming(it);
              const ok = e.correct === it.consonantsTotal;
              const pic = PICTURE_WORDS.find((w) => w.id === it.id);
              return (
                <li key={it.id} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${ok ? 'border-slate-200' : 'border-rose-200 bg-rose-50/50'}`}>
                  <span className="text-xl" aria-hidden>{pic?.emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-display text-sm font-bold text-slate-800 truncate">{it.target}</span>
                    <span className={`block text-[11px] truncate ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {ok ? 'Correct' : `Heard: ${it.heard}`}
                      {it.examinerOverride && ' · examiner'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
