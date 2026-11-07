import React, { useState, useEffect, useMemo } from 'react';
import {
  GradingScaleItem,
  Teacher,
  TermType,
  SubjectScore,
  ScoringConfig
} from '../types';
import {
  DEFAULT_GENERAL_GRADING_SCALE,
  DEFAULT_SECONDARY_WAEC_SCALE,
  DEFAULT_EARLY_YEARS_SCALE,
  DEFAULT_SCORING_CONFIG,
  DEFAULT_CURRENT_SESSION,
  DEFAULT_CURRENT_TERM,
  SESSIONS_LIST,
  TERMS_LIST,
  getActiveGradingScales,
  setActiveGradingScales,
  getGradeAndRemark,
  getScoringConfig,
  normalizeSessionAndTerm
} from '../utils/grading';
import { FirebaseService, getCachedSchoolData } from '../services/firebaseService';
import {
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  Calculator,
  Check,
  AlertCircle,
  AlertTriangle,
  Shield,
  Layers,
  GraduationCap,
  Sliders
} from 'lucide-react';

interface GradingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: Teacher | null;
  session?: string;
  term?: TermType;
  allScores?: SubjectScore[];
  onScalesUpdated?: (newScales?: GradingScaleItem[]) => void;
}

export const GradingSettingsModal: React.FC<GradingSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  session: propSession,
  term: propTerm,
  allScores = [],
  onScalesUpdated
}) => {
  const [scales, setScales] = useState<GradingScaleItem[]>(() => getActiveGradingScales());
  const [testScore, setTestScore] = useState<number | string>(75);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('All');

  // Academic Session & Term targeting for Score Limits
  const [selectedSession, setSelectedSession] = useState<string>(
    () => propSession || DEFAULT_CURRENT_SESSION
  );
  const [selectedTerm, setSelectedTerm] = useState<TermType>(
    () => propTerm || DEFAULT_CURRENT_TERM
  );

  // Score Limits state (CA1, CA2, Exam)
  const [ca1, setCa1] = useState<number | string>(20);
  const [ca2, setCa2] = useState<number | string>(20);
  const [exam, setExam] = useState<number | string>(60);
  const [initialScoringConfig, setInitialScoringConfig] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG);

  // Warning Confirmation Modal state (when changing limits for term that has scores)
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [existingScoresCount, setExistingScoresCount] = useState(0);

  // Form for adding a new tier
  const [isAddingTier, setIsAddingTier] = useState(false);
  const [newTier, setNewTier] = useState<GradingScaleItem>({
    id: '',
    minScore: 50,
    maxScore: 59.9,
    grade: 'C',
    remark: 'Credit',
    gpaPoint: 3.0,
    section: 'All',
    description: ''
  });

  // Load configuration whenever modal opens or session/term changes
  useEffect(() => {
    if (isOpen) {
      // 1. Fetch current scoring config for selected session & term
      const localConfig = getScoringConfig(selectedSession, selectedTerm);
      setCa1(localConfig.maxCA1);
      setCa2(localConfig.maxCA2);
      setExam(localConfig.maxExam);
      setInitialScoringConfig(localConfig);

      FirebaseService.fetchScoringConfig(selectedSession, selectedTerm).then((remoteConfig) => {
        if (remoteConfig) {
          setCa1(remoteConfig.maxCA1);
          setCa2(remoteConfig.maxCA2);
          setExam(remoteConfig.maxExam);
          setInitialScoringConfig(remoteConfig);
        }
      });

      // 2. Fetch grading scales
      FirebaseService.fetchGradingScales().then((fetched) => {
        if (fetched && fetched.length > 0) {
          setScales(fetched);
        }
      });
      setFeedback(null);
    }
  }, [isOpen, selectedSession, selectedTerm]);

  // Derived numeric limits
  const numCa1 = typeof ca1 === 'number' ? ca1 : parseInt(String(ca1), 10);
  const numCa2 = typeof ca2 === 'number' ? ca2 : parseInt(String(ca2), 10);
  const numExam = typeof exam === 'number' ? exam : parseInt(String(exam), 10);

  const totalScoreLimit =
    (isNaN(numCa1) ? 0 : numCa1) +
    (isNaN(numCa2) ? 0 : numCa2) +
    (isNaN(numExam) ? 0 : numExam);

  // Validate Score Limits
  const scoreLimitValidationError = useMemo(() => {
    if (isNaN(numCa1) || isNaN(numCa2) || isNaN(numExam)) {
      return 'All score limits must be valid numbers.';
    }
    if (!Number.isInteger(numCa1) || !Number.isInteger(numCa2) || !Number.isInteger(numExam)) {
      return 'All score limits must be whole numbers (integers without decimals).';
    }
    if (numCa1 < 0 || numCa1 > 100) {
      return '1st CA must be a whole number between 0 and 100.';
    }
    if (numCa2 < 0 || numCa2 > 100) {
      return '2nd CA must be a whole number between 0 and 100.';
    }
    if (numExam <= 0 || numExam > 100) {
      return 'Exam maximum must be greater than 0 (up to 100).';
    }
    if (totalScoreLimit !== 100) {
      return `Total maximum marks must equal exactly 100 (current total: ${totalScoreLimit} / 100).`;
    }
    return null;
  }, [numCa1, numCa2, numExam, totalScoreLimit]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: 'general' | 'secondary' | 'early_years') => {
    let chosen: GradingScaleItem[] = [];
    if (preset === 'general') chosen = DEFAULT_GENERAL_GRADING_SCALE;
    if (preset === 'secondary') chosen = DEFAULT_SECONDARY_WAEC_SCALE;
    if (preset === 'early_years') chosen = DEFAULT_EARLY_YEARS_SCALE;

    setScales(JSON.parse(JSON.stringify(chosen)));
    setFeedback({
      type: 'success',
      message: `Loaded preset scale template. Click "Save to Firebase" to apply school-wide.`
    });
  };

  const handleApplyScorePreset = (pCa1: number, pCa2: number, pExam: number) => {
    setCa1(pCa1);
    setCa2(pCa2);
    setExam(pExam);
    setFeedback(null);
  };

  const handleUpdateItem = (index: number, field: keyof GradingScaleItem, value: any) => {
    setScales((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleDeleteItem = (index: number) => {
    if (scales.length <= 2) {
      setFeedback({ type: 'error', message: 'You must maintain at least 2 grading tiers.' });
      return;
    }
    setScales((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTier.grade.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a valid Grade code (e.g., A, A1, B+).' });
      return;
    }
    if (Number(newTier.minScore) > Number(newTier.maxScore)) {
      setFeedback({ type: 'error', message: 'Min Score cannot exceed Max Score.' });
      return;
    }

    const item: GradingScaleItem = {
      ...newTier,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      minScore: Number(newTier.minScore),
      maxScore: Number(newTier.maxScore),
      gpaPoint: Number(newTier.gpaPoint) || 0,
      section: selectedSection || 'All'
    };

    setScales((prev) => [...prev, item].sort((a, b) => b.minScore - a.minScore));
    setIsAddingTier(false);
    setNewTier({
      id: '',
      minScore: 0,
      maxScore: 39.9,
      grade: 'F',
      remark: 'Fail',
      gpaPoint: 0.0,
      section: 'All',
      description: ''
    });
    setFeedback({ type: 'success', message: `Added tier "${item.grade}". Remember to save changes.` });
  };

  const handleSaveToFirebase = async (forceConfirm = false) => {
    // 1. Validate Score Limits
    if (scoreLimitValidationError) {
      setFeedback({ type: 'error', message: scoreLimitValidationError });
      return;
    }

    // 2. Check if score limits changed from initial
    const limitsChanged =
      numCa1 !== initialScoringConfig.maxCA1 ||
      numCa2 !== initialScoringConfig.maxCA2 ||
      numExam !== initialScoringConfig.maxExam;

    // 3. If limits changed and confirmation not yet given, check if saved scores exist
    if (limitsChanged && !forceConfirm) {
      const cached = getCachedSchoolData();
      const scoreSource = allScores.length > 0 ? allScores : cached?.scores || [];
      const count = scoreSource.filter(
        (s) =>
          s &&
          s.Term === selectedTerm &&
          (s.Session === selectedSession || !s.Session) &&
          (s.CA1 !== null || s.CA2 !== null || s.Exam !== null)
      ).length;

      if (count > 0) {
        setExistingScoresCount(count);
        setShowWarningModal(true);
        return;
      }
    }

    setIsSaving(true);
    setFeedback(null);
    setShowWarningModal(false);

    try {
      const updaterName = currentUser?.FullName || currentUser?.Username || 'Teacher/Admin';

      // 1. Save Score Limits to Firestore
      const scoringRes = await FirebaseService.saveScoringConfig(
        { maxCA1: numCa1, maxCA2: numCa2, maxExam: numExam, maxTotal: 100 },
        selectedSession,
        selectedTerm,
        updaterName
      );

      if (!scoringRes.success) {
        setFeedback({ type: 'error', message: scoringRes.message });
        setIsSaving(false);
        return;
      }

      // 2. Save Grading Scale Tiers
      const sorted = [...scales].sort((a, b) => b.minScore - a.minScore);
      const scaleRes = await FirebaseService.saveGradingScales(sorted, updaterName);

      if (!scaleRes.success) {
        setFeedback({ type: 'error', message: scaleRes.message });
        setIsSaving(false);
        return;
      }

      setActiveGradingScales(sorted);
      setInitialScoringConfig({ maxCA1: numCa1, maxCA2: numCa2, maxExam: numExam, maxTotal: 100 });

      if (onScalesUpdated) {
        onScalesUpdated(sorted);
      }

      setFeedback({
        type: 'success',
        message: `Score limits (CA1: ${numCa1}, CA2: ${numCa2}, Exam: ${numExam}) & grading thresholds successfully updated for ${selectedTerm} (${selectedSession})!`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Live Test Calculation
  const evaluatedTest = getGradeAndRemark(
    typeof testScore === 'number' ? testScore : parseFloat(testScore as string) || 0,
    scales,
    selectedSection
  );

  const filteredScales = scales.filter(
    (s) => selectedSection === 'All' || !s.section || s.section === 'All' || s.section === selectedSection
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Academic Score Limits &amp; Grading Settings</h2>
              <p className="text-xs text-indigo-200">
                Configure maximum continuous assessment marks, exam ceilings, grade letters, and GPA thresholds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`px-6 py-3 text-sm flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-semibold hover:underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* ========================================================================= */}
          {/* SECTION 1: SCORE LIMITS (CA1, CA2, EXAM) */}
          {/* ========================================================================= */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Sliders className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Score Limits (Continuous Assessment &amp; Exam)</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the maximum marks for CA1, CA2, and Exam. The three values must always add up to exactly 100.
                </p>
              </div>

              {/* Session and Term Selector */}
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {SESSIONS_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value as TermType)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {TERMS_LIST.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Three Number Inputs + Live Total */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
              {/* CA1 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1st CA Max
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={ca1}
                  onChange={(e) =>
                    setCa1(e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl text-center font-mono font-bold text-slate-900 text-sm shadow-2xs"
                  placeholder="20"
                />
              </div>

              {/* CA2 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2nd CA Max
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={ca2}
                  onChange={(e) =>
                    setCa2(e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl text-center font-mono font-bold text-slate-900 text-sm shadow-2xs"
                  placeholder="20"
                />
              </div>

              {/* Exam */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Exam Max
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={exam}
                  onChange={(e) =>
                    setExam(e.target.value === '' ? ('' as any) : parseInt(e.target.value, 10))
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl text-center font-mono font-bold text-slate-900 text-sm shadow-2xs"
                  placeholder="60"
                />
              </div>

              {/* Live Total Indicator */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 text-center">
                  Live Sum
                </label>
                <div
                  className={`px-3 py-2 rounded-xl text-center text-sm font-black flex items-center justify-center gap-1.5 border transition-all ${
                    totalScoreLimit === 100
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {totalScoreLimit === 100 ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>Total: {isNaN(totalScoreLimit) ? 0 : totalScoreLimit} / 100</span>
                </div>
              </div>
            </div>

            {/* Presets and Live Error Message */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyScorePreset(20, 20, 60)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    numCa1 === 20 && numCa2 === 20 && numExam === 60
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  20 / 20 / 60 (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyScorePreset(15, 15, 70)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    numCa1 === 15 && numCa2 === 15 && numExam === 70
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  15 / 15 / 70
                </button>
              </div>

              {scoreLimitValidationError && (
                <div className="text-xs font-bold text-rose-600 flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{scoreLimitValidationError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Presets & Controls for Scale Tiers */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Quick Template Presets
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('general')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition"
                >
                  Standard 5-Point Scale (A-F)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('secondary')}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition"
                >
                  WAEC / NECO 9-Point (A1-F9)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('early_years')}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200 transition"
                >
                  Early Years / Nursery Scale
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsAddingTier(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Grade Tier</span>
              </button>
            </div>
          </div>

          {/* Section 2: Live Simulator Box */}
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/80 p-4 rounded-xl border border-indigo-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Live Grade Simulator</h4>
                <p className="text-xs text-slate-500">Test how any student score is classified under the current rules</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-600">Test Score (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={testScore}
                  onChange={(e) => setTestScore(e.target.value)}
                  className="w-20 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-slate-800 text-center shadow-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="h-6 w-px bg-indigo-200" />

              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-slate-500">Result:</span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${evaluatedTest.badgeBg}`}>
                  Grade {evaluatedTest.grade} ({evaluatedTest.remark})
                </span>
                {evaluatedTest.gpaPoint !== undefined && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    {evaluatedTest.gpaPoint.toFixed(1)} pts
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Add Tier Form Modal / Card */}
          {isAddingTier && (
            <form
              onSubmit={handleAddTierSubmit}
              className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3 animate-in fade-in duration-100"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">Add New Grading Tier</h4>
                <button
                  type="button"
                  onClick={() => setIsAddingTier(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Grade Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. A1 or A+"
                    value={newTier.grade}
                    onChange={(e) => setNewTier({ ...newTier, grade: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Min Score</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    value={newTier.minScore}
                    onChange={(e) => setNewTier({ ...newTier, minScore: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Max Score</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.1"
                    value={newTier.maxScore}
                    onChange={(e) => setNewTier({ ...newTier, maxScore: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Remark</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Excellent"
                    value={newTier.remark}
                    onChange={(e) => setNewTier({ ...newTier, remark: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">GPA Point</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={newTier.gpaPoint}
                    onChange={(e) => setNewTier({ ...newTier, gpaPoint: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingTier(false)}
                  className="px-3 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Confirm Tier
                </button>
              </div>
            </form>
          )}

          {/* Section 3: Grading Scale Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Active Grading Thresholds ({filteredScales.length} Tiers)
              </span>
              <span className="text-[11px] text-slate-500">
                Highest scores at the top. Ranges must be contiguous.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-4">Grade</th>
                    <th className="py-2.5 px-4">Min Score (%)</th>
                    <th className="py-2.5 px-4">Max Score (%)</th>
                    <th className="py-2.5 px-4">Official Remark</th>
                    <th className="py-2.5 px-4">GPA Point</th>
                    <th className="py-2.5 px-4">Section</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredScales.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={item.grade}
                          onChange={(e) => handleUpdateItem(index, 'grade', e.target.value)}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-bold text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.minScore}
                          onChange={(e) =>
                            handleUpdateItem(index, 'minScore', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.maxScore}
                          onChange={(e) =>
                            handleUpdateItem(index, 'maxScore', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="text"
                          value={item.remark}
                          onChange={(e) => handleUpdateItem(index, 'remark', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <input
                          type="number"
                          min="0"
                          max="5"
                          step="0.5"
                          value={item.gpaPoint ?? 0}
                          onChange={(e) =>
                            handleUpdateItem(index, 'gpaPoint', parseFloat(e.target.value) || 0)
                          }
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-bold text-indigo-700 text-center"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-medium">
                        {item.section || 'All'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>Changes are synced live to Firebase Firestore and reflect across all report cards.</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleSaveToFirebase(false)}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save to Firebase</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Warning Modal when changing limits for term that has scores */}
      {showWarningModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Term Has Existing Scores</h3>
                <p className="text-xs text-slate-500 font-medium">{selectedTerm} ({selectedSession})</p>
              </div>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              There are currently <strong>{existingScoresCount}</strong> saved pupil score records for this term. Changing the score limits from <strong>{initialScoringConfig.maxCA1}/{initialScoringConfig.maxCA2}/{initialScoringConfig.maxExam}</strong> to <strong>{numCa1}/{numCa2}/{numExam}</strong> will NOT alter or rescale existing scores, but all future entries and caps will enforce the new limits.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveToFirebase(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Yes, Apply New Limits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
