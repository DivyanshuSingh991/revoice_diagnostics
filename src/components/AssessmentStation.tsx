import React, { useState } from 'react';
import { ScreeningTasks, SentenceEvaluation, SentenceItem } from '../types';
import { SentenceRecorder } from './SentenceRecorder';
import { DdkTask, VoiceTask } from './ScreeningTasks';
import { SameSoundTask } from './SameSoundChallenge';
import { Check, FileText, MessageSquareText, TrainFront, Wind, Sparkles } from 'lucide-react';

interface Props {
  sentences: SentenceItem[];
  onGenerateReport: (evaluations: SentenceEvaluation[], tasks: ScreeningTasks) => void;
  whisperReady: boolean;
  childName: string;
  speakerId: string;
  age: number;
}

type TaskKey = 'sentences' | 'voice' | 'ddk' | 'sameSound';

/** Screening protocol: sentences (required) plus three optional tasks. */
export const AssessmentStation: React.FC<Props> = ({ sentences, onGenerateReport, whisperReady, childName, speakerId, age }) => {
  const [active, setActive] = useState<TaskKey>('sentences');
  const [tasks, setTasks] = useState<ScreeningTasks>({});
  const [evaluations, setEvaluations] = useState<SentenceEvaluation[]>([]);

  const generate = (list: SentenceEvaluation[] = evaluations) => {
    if (list.length === 0) {
      alert('Please record at least 1 sentence before generating diagnosis report!');
      return;
    }
    onGenerateReport(list, tasks);
  };

  const voiceCount = tasks.voice?.length ?? 0;
  const ddkCount =
    (tasks.ddk?.amr ? 1 : 0) +
    (tasks.ddk?.ta ? 1 : 0) +
    (tasks.ddk?.ka ? 1 : 0) +
    (tasks.ddk?.smr ? 1 : 0);
  const sameSoundDone = Boolean(tasks.sameSound && tasks.sameSound.rounds.length > 0);

  const tabs: { key: TaskKey; label: string; area: string; icon: React.ElementType; progress: string; done: boolean }[] = [
    { key: 'sentences', label: 'Sentences', area: 'Fluency', icon: MessageSquareText, progress: `${evaluations.length}/${sentences.length}`, done: evaluations.length >= 3 },
    { key: 'sameSound', label: 'Same Sound', area: 'Articulation', icon: Sparkles, progress: sameSoundDone ? '1/1' : '0/1', done: sameSoundDone },
    { key: 'voice', label: 'Bird Flight “आ”', area: 'Voice', icon: Wind, progress: `${voiceCount}/3`, done: voiceCount >= 2 },
    { key: 'ddk', label: 'Pa-Ta-Ka (DDK)', area: 'Motor', icon: TrainFront, progress: `${ddkCount}/4`, done: ddkCount >= 3 },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Task Navigation Bar */}
      <div className="rounded-[32px] sm:rounded-[36px] border-4 border-[#BAE6FD] bg-white/95 backdrop-blur-md shadow-[0_20px_50px_-12px_rgba(56,189,248,0.22)] p-3.5 sm:p-4.5 flex flex-col lg:flex-row lg:items-center gap-3.5">
        <nav aria-label="Screening tasks" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                  isActive
                    ? 'border-[#7DD3FC] bg-gradient-to-r from-[#E0F2FE] via-[#EDE9FE] to-[#E0F2FE] text-[#0369A1] shadow-sm'
                    : 'border-transparent bg-slate-50/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
                }`}
              >
                <span
                  className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-all ${
                    t.done
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : isActive
                      ? 'bg-gradient-to-br from-[#0284C7] to-[#0369A1] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                >
                  {t.done ? <Check className="w-5 h-5" strokeWidth={3} /> : <t.icon className="w-5 h-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-[#0F2744] truncate">{t.label}</span>
                  <span className="block text-[11px] font-semibold text-slate-500 truncate">
                    {t.area} · <span className="tabular-nums font-bold text-blue-600">{t.progress}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="flex items-center lg:pl-3 lg:border-l-2 lg:border-dashed lg:border-[#BAE6FD] shrink-0">
          <button
            onClick={() => generate()}
            className="w-full lg:w-auto py-3 px-5 rounded-full bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] hover:from-[#1D4ED8] hover:to-[#172554] text-white font-extrabold text-sm shadow-[0_8px_20px_-4px_rgba(37,99,235,0.4)] transition-all flex items-center justify-center gap-2 border-2 border-dashed border-white/60 hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>Generate report</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>
      </div>

      {/* Panels stay mounted so in-progress results survive tab switches */}
      <div className={active === 'sentences' ? '' : 'hidden'}>
        <SentenceRecorder
          sentences={sentences}
          onGenerateReport={(list) => generate(list)}
          onEvaluationsChange={setEvaluations}
          whisperReady={whisperReady}
          childName={childName}
          speakerId={speakerId}
        />
      </div>
      <div className={active === 'voice' ? '' : 'hidden'}>
        <VoiceTask
          speakerId={speakerId}
          age={age}
          attempts={tasks.voice ?? []}
          update={(fn) => setTasks((t) => ({ ...t, voice: fn(t.voice ?? []) }))}
        />
      </div>
      <div className={active === 'ddk' ? '' : 'hidden'}>
        <DdkTask speakerId={speakerId} age={age} ddk={tasks.ddk} update={(fn) => setTasks((t) => ({ ...t, ddk: fn(t.ddk ?? {}) }))} />
      </div>
      <div className={active === 'sameSound' ? '' : 'hidden'}>
        <SameSoundTask
          speakerId={speakerId}
          age={age}
          whisperReady={whisperReady}
          result={tasks.sameSound}
          onResult={(res) => setTasks((t) => ({ ...t, sameSound: res }))}
        />
      </div>
    </div>
  );
};
