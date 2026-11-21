import React, { useState, useEffect } from 'react';
import { ChildProfile, SentenceEvaluation, DiagnosticReport, ScreeningTasks } from './types';
import { ASSESSMENT_SENTENCES, generateDiagnosticReport } from './lib/speechAnalysis';
import { initWhisper, getWhisperBackend } from './lib/whisper';
import { saveSpeakerProfile, saveDiagnosticAssessment, saveScreeningResult } from './lib/dbService';
import { SignupConsent } from './components/SignupConsent';
import { AssessmentStation } from './components/AssessmentStation';
import { ReportView } from './components/ReportView';
import { Check, LogOut } from 'lucide-react';

const STORAGE_KEYS = {
  PROFILE: 'revoice_active_profile',
  REPORT: 'revoice_active_report',
  EVALS: 'revoice_active_evals',
};

const STEPS = ['Details', 'Record', 'Report'];

export function App() {
  // State initialization from localStorage so page reload does NOT lose assessment or report!
  const [profile, setProfile] = useState<ChildProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [report, setReport] = useState<DiagnosticReport | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REPORT);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [whisperReady, setWhisperReady] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState('Initializing AI Model...');

  useEffect(() => {
    // Warm up the Whisper pipeline in background
    initWhisper((prog) => {
      if (prog && prog.status === 'progress') {
        const pct = Math.round((prog.loaded / (prog.total || 1)) * 100);
        setWhisperStatus(`Downloading AI: ${pct}%`);
      }
    })
      .then(() => {
        setWhisperReady(true);
        setWhisperStatus(`Whisper Ready (${getWhisperBackend() || 'Active'})`);
      })
      .catch((err) => {
        console.error('Whisper load error:', err);
        setWhisperStatus('Whisper Offline (Standard analysis)');
        setWhisperReady(true);
      });
  }, []);

  const handleProfileSubmit = (prof: ChildProfile) => {
    setProfile(prof);
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(prof));
    // Save to Supabase speakers table
    saveSpeakerProfile(prof).catch(err => console.warn('[DB] speaker save caught:', err));
  };

  const handleAllSentencesDone = (evaluations: SentenceEvaluation[], tasks: ScreeningTasks = {}) => {
    if (!profile) return;
    const finalReport = generateDiagnosticReport(profile, evaluations, tasks);
    setReport(finalReport);
    localStorage.setItem(STORAGE_KEYS.REPORT, JSON.stringify(finalReport));
    localStorage.setItem(STORAGE_KEYS.EVALS, JSON.stringify(evaluations));
    // Save to Supabase diagnostic_assessments table
    saveDiagnosticAssessment(finalReport).catch(err => console.warn('[DB] report save caught:', err));
    // Screening protocol results (opt-in table, see supabase/screening_results.sql)
    saveScreeningResult(finalReport).catch(err => console.warn('[DB] screening save caught:', err));
  };

  // Explicit Logout / Complete Session
  const handleLogout = () => {
    const confirmLogout = window.confirm(
      "Are you sure you want to log out and complete this session?\nMake sure you have saved the PDF Report if needed."
    );
    if (!confirmLogout) return;

    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.REPORT);
    localStorage.removeItem(STORAGE_KEYS.EVALS);
    setProfile(null);
    setReport(null);
  };

  // Return from Report to Recording view without losing progress
  const handleBackToRecord = () => {
    setReport(null);
    localStorage.removeItem(STORAGE_KEYS.REPORT);
  };

  const step = report ? 3 : profile ? 2 : 1;
  // whisperReady is also set when loading fails; a loaded model always reports its backend.
  const modelState = !whisperReady ? 'loading' : getWhisperBackend() ? 'ready' : 'offline';
  const downloadPct = Number(whisperStatus.match(/(\d+)%/)?.[1] ?? 0);

  return (
    <div className="min-h-screen bg-canvas text-slate-800 flex flex-col font-sans print:bg-white">
      {/* Top Navbar */}
      <header className="bg-white/85 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="min-w-0 leading-tight">
            <span className="font-display font-bold text-xl text-[#3B82F6] tracking-tight">ReVoice</span>
            <p className="text-[11px] text-slate-500 font-medium -mt-0.5">Child Speech Assessment</p>
          </div>

          <ol className="hidden md:flex items-center gap-1 text-sm" aria-label="Progress">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <li key={label} className="flex items-center gap-1">
                  {i > 0 && <span className={`w-8 h-px ${done || active ? 'bg-brand-300' : 'bg-slate-200'}`} />}
                  <span
                    aria-current={active ? 'step' : undefined}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-full font-medium ${
                      active ? 'bg-brand-50 text-brand-700' : done ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        active ? 'bg-brand-600 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {done ? <Check className="w-3 h-3" strokeWidth={3} /> : n}
                    </span>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center gap-2">
            <span
              className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  modelState === 'ready' ? 'bg-emerald-500' : modelState === 'offline' ? 'bg-slate-400' : 'bg-amber-500 animate-pulse'
                }`}
              />
              {modelState === 'ready' ? 'System ready' : modelState === 'offline' ? 'Standard mode' : downloadPct ? `Loading ${downloadPct}%` : 'Loading...'}
            </span>

            {profile && (
              <button
                onClick={handleLogout}
                className="btn h-8 px-3 text-xs text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-full"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log out
              </button>
            )}
          </div>
        </div>
        {modelState === 'loading' && (
          <div className="h-0.5 bg-slate-100">
            <div className="h-full bg-brand-500 transition-[width] duration-500" style={{ width: `${downloadPct}%` }} />
          </div>
        )}
      </header>

      {/* Main Body */}
      <main className="flex-1 px-4 py-6 md:px-6 md:py-10 max-w-6xl w-full mx-auto print:p-0 print:max-w-none">
        {!profile && (
          <SignupConsent
            onComplete={handleProfileSubmit}
            whisperStatus={whisperStatus}
          />
        )}

        {profile && !report && (
          <AssessmentStation
            sentences={ASSESSMENT_SENTENCES}
            onGenerateReport={handleAllSentencesDone}
            whisperReady={whisperReady}
            childName={profile.name}
            speakerId={profile.speakerId}
            age={profile.age}
          />
        )}

        {report && (
          <ReportView
            report={report}
            onLogout={handleLogout}
            onBackToRecord={handleBackToRecord}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 mt-auto print:hidden">
        <span className="text-[#3B82F6] font-semibold">ReVoice</span> Pediatric Speech Assessment &copy; 2026 all rights reserved.
      </footer>
    </div>
  );
}

export default App;
