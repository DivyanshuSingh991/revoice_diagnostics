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
  Mic,
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
  X,
  Pencil,
  Cake,
  Sparkles
} from 'lucide-react';
import { AnalysisInfoSection } from './AnalysisInfoSection';
import {
  BoyAvatar,
  GirlAvatar,
  StarAvatar,
  CuteRainbow,
  SparkleRays,
  ConsentTeddyBear,
  StackedBooks,
  GrassDaisies,
} from './FormDecorations';

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
        console.warn('[SignupConsent] Cloud save warning:', saveRes.error);
      }

      // 2. Advance to the assessment station
      onComplete(profile);
    } catch (err: any) {
      console.error('[SignupConsent] Error saving profile:', err);
      // Still allow proceeding so a temporary network glitch doesn't block the child's test
      onComplete(profile);
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
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-up">
      <div className="grid lg:grid-cols-5 gap-6 lg:gap-10 items-start">
        {/* Intro Information Section matching reference image */}
        <AnalysisInfoSection />

        {/* Main Action Area - Child-Friendly Registration Form matching reference image */}
        <section className="lg:col-span-3 relative rounded-[36px] border-4 border-[#BAE6FD] bg-white/95 backdrop-blur-md shadow-[0_20px_50px_-12px_rgba(56,189,248,0.22)] p-6 sm:p-8">
          {/* Top Status Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            {/* Whisper Ready Pill */}
            <div className="relative inline-flex items-center gap-2 bg-[#ECFDF5] border border-[#86EFAC] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#065F46] shadow-2xs">
              <span className="relative flex h-2.5 w-2.5">
                {!modelReady && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${modelReady ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
              <span>{whisperStatus}</span>
            </div>

            {/* Assigned Speaker ID Pill */}
            {activeTab === 'new' && (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span>Assigned Speaker ID</span>
                <span className="font-mono font-black text-blue-700 bg-[#E0F2FE] border border-[#BAE6FD] px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                  {loadingId ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : speakerId}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Tabs: New vs Existing */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('new')}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full text-sm font-bold transition-all ${
                activeTab === 'new'
                  ? 'bg-gradient-to-r from-[#E0F2FE] via-[#EDE9FE] to-[#E0F2FE] border-2 border-[#7DD3FC] text-[#0369A1] shadow-sm'
                  : 'bg-slate-50 border-2 border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <BoyAvatar className="w-6 h-6" />
              <span>Register New Child</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('existing')}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-full text-sm font-bold transition-all ${
                activeTab === 'existing'
                  ? 'bg-gradient-to-r from-[#E0F2FE] via-[#EDE9FE] to-[#E0F2FE] border-2 border-[#7DD3FC] text-[#0369A1] shadow-sm'
                  : 'bg-slate-50 border-2 border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <GirlAvatar className="w-6 h-6" />
              <span>Existing Children</span>
              {recentSpeakers.length > 0 && (
                <span className="bg-[#E0E7FF] text-[#4338CA] text-xs px-2 py-0.5 rounded-full font-extrabold border border-indigo-200">
                  {recentSpeakers.length}
                </span>
              )}
            </button>
          </div>

          {/* Dashed divider */}
          <div className="border-t-2 border-dashed border-[#BAE6FD] my-5" />

          {/* TAB 1: REGISTER NEW CHILD */}
          {activeTab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Child's Details */}
              <fieldset className="space-y-4">
                {/* Cloud Header & Rainbow */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="inline-flex items-center gap-2 bg-[#E0F2FE] border-2 border-[#BAE6FD] px-4 py-1.5 rounded-full shadow-2xs">
                      <StarAvatar className="w-5 h-5 -ml-1" />
                      <span className="text-xs font-black tracking-wider text-[#0369A1] uppercase">About The Child</span>
                    </div>
                    <SparkleRays className="w-4 h-4 text-amber-400" />
                  </div>
                  <CuteRainbow className="w-16 h-8 sm:w-20 sm:h-10 shrink-0" />
                </div>

                {/* Full name input */}
                <div>
                  <label htmlFor="child-name" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                    <span className="w-4 h-4 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 text-[10px]">👤</span>
                    <span>Full name</span>
                    <SparkleRays className="w-3 h-3 text-amber-400" />
                  </label>
                  <div className="relative">
                    <input
                      id="child-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Aman Verma"
                      className="w-full px-4 py-3 pr-10 rounded-2xl border-2 border-[#DDD6FE] bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#818CF8] focus:ring-4 focus:ring-indigo-100 text-sm font-medium transition shadow-2xs"
                    />
                    <Pencil className="w-4 h-4 text-amber-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Age & Gender Row */}
                <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] gap-4">
                  {/* Age */}
                  <div>
                    <label htmlFor="child-age" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                      <Cake className="w-4 h-4 text-pink-500" />
                      <span>Age (years)</span>
                    </label>
                    <input
                      id="child-age"
                      type="number"
                      min={3}
                      max={16}
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-2xl border-2 border-[#DDD6FE] bg-white text-slate-800 font-bold tabular-nums text-center text-sm focus:outline-none focus:border-[#818CF8] focus:ring-4 focus:ring-indigo-100 transition shadow-2xs"
                    />
                  </div>

                  {/* Gender selection pills */}
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5" id="gender-label">
                      <span className="text-blue-500 font-extrabold text-sm">♂</span>
                      <span>Gender</span>
                    </span>
                    <div role="radiogroup" aria-labelledby="gender-label" className="grid grid-cols-3 gap-2">
                      {GENDER_OPTIONS.map((opt) => {
                        const isSelected = gender === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setGender(opt.value)}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl text-xs font-bold transition-all shadow-2xs ${
                              isSelected
                                ? 'bg-[#BAE6FD]/60 border-2 border-[#38BDF8] text-[#0369A1] shadow-sm'
                                : 'bg-white border-2 border-[#DDD6FE] text-slate-600 hover:border-indigo-300'
                            }`}
                          >
                            {opt.value === 'male' && <BoyAvatar className="w-4 h-4" />}
                            {opt.value === 'female' && <GirlAvatar className="w-4 h-4" />}
                            {opt.value === 'other' && <StarAvatar className="w-4 h-4" />}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Parent / Guardian Information */}
              <fieldset className="space-y-4 pt-1">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-2 bg-[#E0F2FE] border-2 border-[#BAE6FD] px-4 py-1.5 rounded-full shadow-2xs">
                    <span className="flex -space-x-1">
                      <BoyAvatar className="w-4 h-4" />
                      <GirlAvatar className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-black tracking-wider text-[#0369A1] uppercase">Parent / Guardian</span>
                  </div>
                  <SparkleRays className="w-4 h-4 text-amber-400" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Parent name */}
                  <div>
                    <label htmlFor="parent-name" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                      <span className="w-4 h-4 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 text-[10px]">👤</span>
                      <span>Parent name</span>
                    </label>
                    <input
                      id="parent-name"
                      type="text"
                      required
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      placeholder="e.g. Rajesh Verma"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-[#DDD6FE] bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#818CF8] focus:ring-4 focus:ring-indigo-100 text-sm font-medium transition shadow-2xs"
                    />
                  </div>

                  {/* Mobile number */}
                  <div>
                    <label htmlFor="parent-mobile" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5">
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                      <span>Mobile number</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="parent-mobile"
                        type="tel"
                        inputMode="numeric"
                        required
                        pattern="[0-9]{10}"
                        value={parentMobile}
                        onChange={(e) => setParentMobile(e.target.value)}
                        placeholder="9876543210"
                        className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-[#DDD6FE] bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#818CF8] focus:ring-4 focus:ring-indigo-100 text-sm font-medium transition shadow-2xs tabular-nums tracking-wide"
                      />
                    </div>
                  </div>
                </div>

                {/* Duplicate/Existing Child Notification */}
                {matchingExistingSpeaker && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-blue-900">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>
                        Existing profile found: <strong>{matchingExistingSpeaker.child_name}</strong> ({matchingExistingSpeaker.speaker_id})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutofillFromExisting(matchingExistingSpeaker)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shrink-0"
                    >
                      Load Profile
                    </button>
                  </div>
                )}
              </fieldset>

              {/* Consent Box with Peeking Teddy Bear */}
              <div className="relative pt-4">
                {/* Teddy Bear peeking over the top-right rim */}
                <div className="absolute -top-7 right-6 z-10">
                  <ConsentTeddyBear className="w-20 h-14" />
                </div>

                <label
                  className={`block rounded-3xl border-2 border-dashed border-[#FCD34D] bg-[#FFFDF5] p-5 cursor-pointer transition shadow-2xs ${
                    consent ? 'ring-2 ring-emerald-300' : 'hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded-md text-emerald-600 border-2 border-[#FCD34D] focus:ring-emerald-500 cursor-pointer accent-emerald-600 shrink-0"
                    />
                    <div className="text-xs text-slate-600 leading-relaxed select-none">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1.5 mb-1 text-sm">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" /> Parent / Guardian Consent
                      </span>
                      I confirm that I am the parent or authorized guardian and above 18 years of age. I consent to speech recording and clinical AI analysis for evaluating speech clarity diagnostics of my child. Data is stored securely in Supabase and used solely for research and clinical purposes.
                    </div>
                  </div>
                </label>
              </div>

              {error && (
                <p role="alert" className="flex items-center gap-2 text-sm font-medium text-rose-700 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </p>
              )}

              {/* Submit Button */}
              <div className="relative pt-1">
                <SparkleRays className="absolute -top-1 left-2 w-4 h-4 text-amber-400 pointer-events-none" />
                <SparkleRays className="absolute -bottom-1 right-4 w-4 h-4 text-amber-400 pointer-events-none" />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full group relative py-4 px-6 rounded-full bg-gradient-to-r from-[#2563EB] via-[#1D4ED8] to-[#1E40AF] hover:from-[#1D4ED8] hover:to-[#172554] text-white font-extrabold text-base shadow-[0_12px_28px_-6px_rgba(37,99,235,0.45)] transition-all flex items-center justify-center gap-3 border-2 border-dashed border-white/60 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Saving profile to Database...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/40 shadow-inner shrink-0">
                        <Mic className="w-4 h-4 text-white" />
                      </span>
                      <span>Start Speech Assessment</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition shrink-0" />
                    </>
                  )}
                </button>
              </div>
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-[#DDD6FE] text-sm focus:outline-none focus:border-[#818CF8] focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadDatabaseData}
                  disabled={isLoadingSpeakers}
                  title="Refresh from Supabase"
                  className="px-3.5 py-2.5 rounded-2xl border-2 border-[#BAE6FD] bg-[#E0F2FE]/50 hover:bg-[#E0F2FE] text-[#0369A1] transition flex items-center gap-1.5 text-xs font-bold"
                >
                  <RotateCw className={`w-4 h-4 ${isLoadingSpeakers ? 'animate-spin text-blue-600' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* List of Registered Children */}
              {isLoadingSpeakers ? (
                <div className="text-center py-12 space-y-3">
                  <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-500">Fetching registered children from Supabase...</p>
                </div>
              ) : filteredSpeakers.length === 0 ? (
                <div className="text-center py-10 bg-[#FFFDF5] rounded-3xl border-2 border-dashed border-[#FCD34D] space-y-3 p-4">
                  <Users className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">No children found</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {searchQuery ? 'No child matches your search term. Try another query or register a new child.' : 'No children registered in the database yet.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('new')}
                    className="mt-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Register New Child
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {filteredSpeakers.map((speaker) => (
                    <div
                      key={speaker.speaker_id}
                      className="p-4 rounded-2xl border-2 border-[#BAE6FD] hover:border-blue-400 hover:bg-blue-50/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {speaker.gender === 'female' ? <GirlAvatar className="w-5 h-5" /> : <BoyAvatar className="w-5 h-5" />}
                          <span className="font-bold text-slate-800 text-sm">{speaker.child_name}</span>
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                            {speaker.speaker_id}
                          </span>
                          <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
                            {speaker.age} yrs • {speaker.gender}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-3">
                          <span>Parent: <strong className="text-slate-700">{speaker.parent_name}</strong></span>
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
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition flex items-center gap-1"
                        >
                          <History className="w-3.5 h-3.5 text-blue-600" />
                          History
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectExistingSpeaker(speaker)}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1"
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

          {/* Bottom decorative elements (Stacked Books on bottom left, Grass & Daisies on bottom right) */}
          <div className="absolute -bottom-5 -left-3 pointer-events-none select-none z-10">
            <StackedBooks className="w-14 h-11 sm:w-16 sm:h-12 drop-shadow-sm" />
          </div>
          <div className="absolute -bottom-6 -right-3 pointer-events-none select-none z-10">
            <GrassDaisies className="w-16 h-12 sm:w-20 sm:h-14 drop-shadow-sm" />
          </div>
        </section>
      </div>

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
