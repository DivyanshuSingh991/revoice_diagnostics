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
    <div className="space-y-5 animate-fade-up">
      <div className="card p-3 md:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <nav aria-label="Screening tasks" className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
          {tabs.map((t) => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 p-2.5 rounded-2xl border text-left transition ${
                  isActive ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300' : 'border-transparent hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
                    t.done ? 'bg-emerald-500 text-white' : isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.done ? <Check className="w-4 h-4" strokeWidth={3} /> : <t.icon className="w-[18px] h-[18px]" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{t.label}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {t.area} · <span className="tabular-nums">{t.progress}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="flex items-center lg:pl-3 lg:border-l border-slate-100 shrink-0">
          <button onClick={() => generate()} className="btn-primary h-11 px-4 text-sm shrink-0">
            <FileText className="w-4 h-4" />
            Generate report
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
