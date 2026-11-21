import React, { useState, useEffect } from 'react';
import { ChildProfile } from '../types';
import {
  saveSpeakerProfile,
  fetchNextSpeakerId,
  fetchRecentSpeakers,
  fetchSpeakerHistory,
  SpeakerRecord,
  PastAssessmentSummary
} from '../lib/dbService';
import {
  ShieldCheck,
  User,
  Phone,
  Baby,
  Sparkles,
  ClipboardList,
  Mic,
  FileBarChart,
  Lightbulb,
  AlertCircle,
  ArrowRight,
  Database,
  Search,
  RotateCw,
  CheckCircle2,
  Users,
  UserPlus,
  Calendar,
  History,
  Loader2,
  ChevronRight,
  ChevronDown,
  X
} from 'lucide-react';

interface Props {
  onComplete: (profile: ChildProfile) => void;
  whisperStatus: string;
}

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Boy' },
  { value: 'Female', label: 'Girl' },
  { value: 'Other', label: 'Other' },
];

export const SignupConsent: React.FC<Props> = ({ onComplete, whisperStatus }) => {
  // Mode: 'new' = register a new child, 'existing' = select registered child from database
  const [activeTab, setActiveTab] = useState<'new' | 'existing'>('new');

  // Form inputs
  const [name, setName] = useState('');
  const [age, setAge] = useState<number>(6);
  const [gender, setGender] = useState('Male');
  const [parentName, setParentName] = useState('');
  const [parentMobile, setParentMobile] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Dynamic Speaker ID from Supabase
  const [speakerId, setSpeakerId] = useState<string>('SPK10000');
  const [loadingId, setLoadingId] = useState(true);

  // Database records
  const [recentSpeakers, setRecentSpeakers] = useState<SpeakerRecord[]>([]);
  const [isLoadingSpeakers, setIsLoadingSpeakers] = useState(false);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'offline'>('checking');
  const [searchQuery, setSearchQuery] = useState('');

  // Past assessments modal/drawer
  const [selectedSpeakerForHistory, setSelectedSpeakerForHistory] = useState<SpeakerRecord | null>(null);
  const [speakerHistory, setSpeakerHistory] = useState<{
    assessments: PastAssessmentSummary[];
    screeningResults: any[];
  }>({ assessments: [], screeningResults: [] });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load next ID and recent speakers from Supabase on mount
  const loadDatabaseData = async () => {
    setIsLoadingSpeakers(true);
    try {
      const [nextId, speakersRes] = await Promise.all([
        fetchNextSpeakerId(),
        fetchRecentSpeakers(50)
      ]);

      setSpeakerId(nextId);
      setLoadingId(false);

      if (!speakersRes.error) {
        setRecentSpeakers(speakersRes.data);
        setDbStatus('connected');
      } else {
        setDbStatus('offline');
      }
    } catch (err) {
      console.warn('[SignupConsent] Error loading database data:', err);
      setDbStatus('offline');
    } finally {
      setIsLoadingSpeakers(false);
      setLoadingId(false);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  // Check if current phone number or name matches an existing child in the database
  const matchingExistingSpeaker = recentSpeakers.find(s => {
    if (parentMobile.trim().length >= 10 && s.parent_mobile === parentMobile.trim()) {
      return true;
    }
    if (name.trim().length >= 3 && s.child_name.toLowerCase() === name.trim().toLowerCase()) {
      return true;
    }
    return false;
  });

  const handleSelectExistingSpeaker = (speaker: SpeakerRecord) => {
    const profile: ChildProfile = {
      name: speaker.child_name,
      age: Number(speaker.age),
      gender: speaker.gender,
      parentName: speaker.parent_name,
      parentMobile: speaker.parent_mobile,
      consent: true,
      speakerId: speaker.speaker_id
    };
    onComplete(profile);
  };

  const handleAutofillFromExisting = (speaker: SpeakerRecord) => {
    setName(speaker.child_name);
    setAge(speaker.age);
    setGender(speaker.gender);
    setParentName(speaker.parent_name);
    setParentMobile(speaker.parent_mobile);
    setSpeakerId(speaker.speaker_id);
    setConsent(true);
    setActiveTab('new');
  };

  const handleViewHistory = async (speaker: SpeakerRecord) => {
    setSelectedSpeakerForHistory(speaker);
    setIsLoadingHistory(true);
    try {
      const history = await fetchSpeakerHistory(speaker.speaker_id);
      setSpeakerHistory({
        assessments: history.assessments,
        screeningResults: history.screeningResults
      });
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter the child's name.");
      return;
    }
    if (!parentName.trim()) {
      setError("Please enter the parent/guardian's name.");
      return;
    }
    if (!parentMobile.trim() || parentMobile.trim().length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!consent) {
      setError('Please check the parent/guardian consent checkbox.');
      return;
    }
    setError('');
    setIsSaving(true);

    const profile: ChildProfile = {
      name: name.trim(),
      age: Number(age),
      gender,
      parentName: parentName.trim(),
      parentMobile: parentMobile.trim(),
      consent,
      speakerId: speakerId.trim().toUpperCase()
    };

    try {
      // 1. Explicitly save to Supabase cloud database
      const saveRes = await saveSpeakerProfile(profile);
      if (saveRes.error) {
        console.error('[SignupConsent] Cloud save error:', saveRes.error);
        setError(`Database save warning: ${typeof saveRes.error === 'string' ? saveRes.error : JSON.stringify(saveRes.error)}`);
        setIsSaving(false);
        return;
      }
      
      // 2. Advance to the assessment station
      onComplete(profile);
    } catch (err: any) {
      console.error('[SignupConsent] Error saving profile:', err);
      setError(`Database Error: ${err?.message || err}. Please try again.`);
      setIsSaving(false);
      return;
    } finally {
      setIsSaving(false);
    }
  };

  const modelReady = whisperStatus.startsWith('Whisper Ready');

  // Filtered speakers based on search query
  const filteredSpeakers = recentSpeakers.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.child_name.toLowerCase().includes(q) ||
      s.speaker_id.toLowerCase().includes(q) ||
      s.parent_mobile.includes(q) ||
      s.parent_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="grid lg:grid-cols-5 gap-6 lg:gap-10 items-start max-w-5xl mx-auto animate-fade-up">
      {/* Intro Sidebar */}
      <section className="lg:col-span-2 lg:sticky lg:top-24 space-y-6 pt-2">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Hindi speech check-up
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 tracking-tight leading-[1.1]">
            Child Speech Analysis
          </h1>
          <p className="mt-2 text-slate-600 leading-relaxed">
            A clinical, playful clarity check. Your child completes simple Hindi speech tasks and you get an immediate structured diagnostic report.
          </p>
        </div>

        <ol className="space-y-3">
          {[
            { icon: ClipboardList, title: 'Child Details', text: 'Register new child or select existing profile from cloud DB.' },
            { icon: Mic, title: 'Speech Tasks', text: 'Voice "आ", Pa-Ta-Ka rate, Picture Naming & 5 sentences.' },
            { icon: FileBarChart, title: 'Diagnostic Report', text: 'Clarity scores, clinical indicators & home intervention plan.' },
          ].map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-3">
              <span className="w-9 h-9 shrink-0 rounded-xl bg-white border border-slate-200 shadow-card flex items-center justify-center text-blue-600">
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  <span className="text-slate-400 mr-1">{i + 1}.</span>
                  {title}
                </p>
                <p className="text-sm text-slate-500">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Database Live Connectivity Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-600" /> Supabase Cloud Database
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
              dbStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-600' : 'bg-amber-600 animate-pulse'}`} />
              {dbStatus === 'connected' ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <p className="text-slate-500">
            {recentSpeakers.length > 0 
              ? `${recentSpeakers.length} child profiles synchronized with cloud database.`
              : 'Synchronizing profiles with cloud database...'}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/70 text-sm text-amber-900 flex gap-3">
          <Lightbulb className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
          <p>
            <strong className="font-semibold">Tip:</strong> Find a quiet room and hold the device about an arm’s length from your child.
          </p>
        </div>
      </section>

      {/* Main Action Area */}
      <section className="lg:col-span-3 card p-6 md:p-8">
        {/* Top Status & Tabs */}
        <div className="space-y-4 pb-5 mb-6 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="relative flex h-2.5 w-2.5">
                {!modelReady && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${modelReady ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className="font-medium">{whisperStatus}</span>
            </div>

            {activeTab === 'new' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Assigned Speaker ID</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  {loadingId ? <Loader2 className="w-3 h-3 animate-spin text-blue-600" /> : speakerId}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Tabs: New vs Existing */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition ${
                activeTab === 'new'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Register New Child
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('existing')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition ${
                activeTab === 'existing'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              Existing Children
              {recentSpeakers.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-[11px] px-1.5 py-0.2 rounded-full font-bold">
                  {recentSpeakers.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: REGISTER NEW CHILD */}
        {activeTab === 'new' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Child's Details */}
            <fieldset className="space-y-4">
              <legend className="eyebrow mb-2 flex items-center gap-2 text-slate-800 font-semibold text-xs tracking-wider uppercase">
                <Baby className="w-4 h-4 text-blue-600" /> About the child
              </legend>

              <div>
                <label htmlFor="child-name" className="label text-xs font-semibold text-slate-700">Full name</label>
                <input
                  id="child-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aman Verma"
                  className="field w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-4">
                <div>
                  <label htmlFor="child-age" className="label text-xs font-semibold text-slate-700">Age (years)</label>
                  <input
                    id="child-age"
                    type="number"
                    min={3}
                    max={16}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="field w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums"
                  />
                </div>

                <div>
                  <span className="label text-xs font-semibold text-slate-700" id="gender-label">Gender</span>
                  <div role="radiogroup" aria-labelledby="gender-label" className="grid grid-cols-3 gap-1 p-1 h-11 mt-1 rounded-xl bg-slate-100">
                    {GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={gender === opt.value}
                        onClick={() => setGender(opt.value)}
                        className={`rounded-lg text-sm font-semibold transition ${
                          gender === opt.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Parent / Guardian Information */}
            <fieldset className="space-y-4">
              <legend className="eyebrow mb-2 flex items-center gap-2 text-slate-800 font-semibold text-xs tracking-wider uppercase">
                <User className="w-4 h-4 text-blue-600" /> Parent / guardian
              </legend>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="parent-name" className="label text-xs font-semibold text-slate-700">Parent name</label>
                  <input
                    id="parent-name"
                    type="text"
                    required
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="e.g. Rajesh Verma"
                    className="field w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="parent-mobile" className="label text-xs font-semibold text-slate-700">Mobile number</label>
                  <div className="relative mt-1">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="parent-mobile"
                      type="tel"
                      inputMode="numeric"
                      required
                      pattern="[0-9]{10}"
                      value={parentMobile}
                      onChange={(e) => setParentMobile(e.target.value)}
                      placeholder="9876543210"
                      className="field w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums tracking-wide"
                    />
                  </div>
                </div>
              </div>

              {/* Duplicate/Existing Child Notification */}
              {matchingExistingSpeaker && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      Existing profile found: <strong>{matchingExistingSpeaker.child_name}</strong> ({matchingExistingSpeaker.speaker_id})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAutofillFromExisting(matchingExistingSpeaker)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shrink-0"
                  >
                    Load Profile
                  </button>
                </div>
              )}
            </fieldset>

            {/* Legal Consent Checkbox */}
            <label
              className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition ${
                consent ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-5 h-5 shrink-0 accent-emerald-600 cursor-pointer"
              />
              <div className="text-sm text-slate-600 leading-relaxed select-none">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Parent / Guardian Consent
                </span>
                I confirm that I am the parent or authorized guardian and above 18 years of age. I consent to speech recording and clinical AI analysis for evaluating speech clarity diagnostics of my child. Data is stored securely in Supabase and used solely for research and clinical purposes.
              </div>
            </label>

            {error && (
              <div role="alert" className="space-y-2 text-sm text-rose-700 bg-rose-50 p-4 rounded-xl border border-rose-200">
                <p className="flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </p>
                {error.includes('Database') && (
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      onComplete({
                        name: name.trim(),
                        age: Number(age),
                        gender,
                        parentName: parentName.trim(),
                        parentMobile: parentMobile.trim(),
                        consent,
                        speakerId: speakerId.trim().toUpperCase()
                      });
                    }}
                    className="text-xs px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-semibold transition"
                  >
                    Proceed offline anyway &rarr;
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary w-full h-14 text-base bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition disabled:opacity-75"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving profile to Database...
                </>
              ) : (
                <>
                  Start Speech Assessment
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 2: SELECT EXISTING CHILD FROM DATABASE */}
        {activeTab === 'existing' && (
          <div className="space-y-4">
            {/* Search Bar & Refresh */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by child name, mobile, or Speaker ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={loadDatabaseData}
                disabled={isLoadingSpeakers}
                title="Refresh from Supabase"
                className="px-3 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-600 transition flex items-center gap-1.5 text-xs font-medium"
              >
                <RotateCw className={`w-4 h-4 ${isLoadingSpeakers ? 'animate-spin text-blue-600' : ''}`} />
                Refresh
              </button>
            </div>

            {/* List of Registered Children */}
            {isLoadingSpeakers ? (
              <div className="text-center py-12 space-y-3">
                <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
                <p className="text-sm text-slate-500">Fetching registered children from Supabase...</p>
              </div>
            ) : filteredSpeakers.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No children found</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {searchQuery ? 'No child matches your search term. Try another query or register a new child.' : 'No children registered in the database yet.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
                >
                  Register New Child
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {filteredSpeakers.map((speaker) => (
                  <div
                    key={speaker.speaker_id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-sm">{speaker.child_name}</span>
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                          {speaker.speaker_id}
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {speaker.age} yrs • {speaker.gender}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-3">
                        <span>Parent: <strong>{speaker.parent_name}</strong></span>
                        <span>•</span>
                        <span>{speaker.parent_mobile}</span>
                        {speaker.created_at && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">
                              {new Date(speaker.created_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewHistory(speaker)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5 text-blue-600" />
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectExistingSpeaker(speaker)}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1"
                      >
                        Start Test
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* PAST REPORTS / HISTORY MODAL */}
      {selectedSpeakerForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto animate-fade-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {selectedSpeakerForHistory.child_name}'s Past Records
                </h3>
                <p className="text-xs text-slate-500">
                  Speaker ID: <span className="font-mono font-bold text-blue-600">{selectedSpeakerForHistory.speaker_id}</span> • Age: {selectedSpeakerForHistory.age}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSpeakerForHistory(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                <p className="text-xs text-slate-500">Loading diagnostic assessments from Supabase...</p>
              </div>
            ) : speakerHistory.assessments.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl space-y-2">
                <FileBarChart className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No past diagnostic reports yet</p>
                <p className="text-xs text-slate-500">
                  This child has not completed a speech diagnostic session yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectExistingSpeaker(selectedSpeakerForHistory);
                    setSelectedSpeakerForHistory(null);
                  }}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
                >
                  Start Assessment Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Past Assessments ({speakerHistory.assessments.length})
                </p>
                {speakerHistory.assessments.map((a) => (
                  <div key={a.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {a.primary_issue || 'Speech Clarity Evaluation'}
                      </span>
                      <span className="text-slate-400">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 py-1 text-center">
                      <div className="p-2 bg-white rounded-lg border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Clarity</span>
                        <span className="text-sm font-bold text-blue-600">{a.avg_clarity}%</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Overall</span>
                        <span className="text-sm font-bold text-emerald-600">{a.overall_score}%</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-100">
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">Severity</span>
                        <span className="text-sm font-bold text-slate-700">{a.severity || 'Mild'}</span>
                      </div>
                    </div>

                    {a.clinical_description && (
                      <p className="text-xs text-slate-600 italic">
                        "{a.clinical_description}"
                      </p>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    handleSelectExistingSpeaker(selectedSpeakerForHistory);
                    setSelectedSpeakerForHistory(null);
                  }}
                  className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  Start New Assessment For {selectedSpeakerForHistory.child_name}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
