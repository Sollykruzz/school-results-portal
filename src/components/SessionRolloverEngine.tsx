import React, { useState, useMemo, useEffect } from 'react';
import {
  Student,
  SubjectScore,
  StudentSummary,
  Teacher,
  RolloverStudentDecision,
  RolloverHistoryRecord
} from '../types';
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  History,
  Users,
  Search,
  Filter,
  Save,
  ShieldAlert,
  Sliders,
  Archive,
  Award,
  Check,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import {
  FirebaseService
} from '../services/firebaseService';
import {
  getNextClassName,
  isGraduatingClass,
  getNextSession,
  isMatchingClass,
  isMatchingStudentId,
  computeOverallStudentAverage,
  calculateAnnualPromotionStatus,
  SESSIONS_LIST
} from '../utils/grading';

interface SessionRolloverEngineProps {
  students: Student[];
  allScores: SubjectScore[];
  allSummaries: StudentSummary[];
  currentSession: string;
  classesList: string[];
  currentUser?: Teacher;
  onRefreshData: () => Promise<void> | void;
  onSessionRolledOver?: (newSession: string) => void;
}

export const SessionRolloverEngine: React.FC<SessionRolloverEngineProps> = ({
  students,
  allScores,
  allSummaries,
  currentSession,
  classesList,
  currentUser,
  onRefreshData,
  onSessionRolledOver
}) => {
  const [fromSession, setFromSession] = useState<string>(currentSession);
  const [toSession, setToSession] = useState<string>(() => getNextSession(currentSession));
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [passCutoff, setPassCutoff] = useState<number>(50);
  const [trialCutoff, setTrialCutoff] = useState<number>(40);
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'alumni' | 'history'>('preview');

  // Interactive overrides per student: studentId -> RolloverStudentDecision
  const [studentDecisions, setStudentDecisions] = useState<Record<string, RolloverStudentDecision>>({});
  const [historyLogs, setHistoryLogs] = useState<RolloverHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // When fromSession changes, suggest toSession
  useEffect(() => {
    setToSession(getNextSession(fromSession));
  }, [fromSession]);

  // Load history logs
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const logs = await FirebaseService.fetchRolloverHistory();
      setHistoryLogs(logs);
    } catch (err) {
      console.warn('Failed to load rollover history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Compute decisions for all active students
  useEffect(() => {
    const decisions: Record<string, RolloverStudentDecision> = {};

    students.forEach((st) => {
      // Calculate 3rd term or annual cumulative score
      const currentClass = st.Class;
      const isGraduating = isGraduatingClass(currentClass);
      const nextClass = isGraduating ? 'Graduated (Alumni)' : getNextClassName(currentClass);

      // Student's Third Term scores
      const thirdTermScores = allScores.filter(
        (s) =>
          isMatchingStudentId(s.StudentID, st.StudentID) &&
          s.Session === fromSession &&
          s.Term === 'Third Term'
      );
      const thirdTermAvg =
        thirdTermScores.length > 0 ? computeOverallStudentAverage(thirdTermScores) : null;

      // Check all 3 terms for this session
      const allSessionScores = allScores.filter(
        (s) => isMatchingStudentId(s.StudentID, st.StudentID) && s.Session === fromSession
      );
      const annualAvg =
        allSessionScores.length > 0 ? computeOverallStudentAverage(allSessionScores) : thirdTermAvg;

      const evalScore = annualAvg !== null ? annualAvg : thirdTermAvg !== null ? thirdTermAvg : 70; // default passing if no scores

      let defaultAction: RolloverStudentDecision['action'] = 'Promote';
      let decisionText = `Promoted to ${nextClass}`;

      if (isGraduating) {
        defaultAction = 'Graduate';
        decisionText = 'Graduated (Alumni)';
      } else if (evalScore >= passCutoff) {
        defaultAction = 'Promote';
        decisionText = `Promoted to ${nextClass}`;
      } else if (evalScore >= trialCutoff) {
        defaultAction = 'PromoteOnTrial';
        decisionText = `Promoted on Trial to ${nextClass}`;
      } else {
        defaultAction = 'Repeat';
        decisionText = `Advised to Repeat ${currentClass}`;
      }

      decisions[st.StudentID] = {
        studentId: st.StudentID,
        studentName: st.FullName,
        currentClass,
        targetClass: defaultAction === 'Repeat' ? currentClass : nextClass,
        action: defaultAction,
        annualAverage: annualAvg,
        thirdTermAverage: thirdTermAvg,
        promotionDecisionText: decisionText,
        isCustomOverride: false
      };
    });

    setStudentDecisions(decisions);
  }, [students, allScores, fromSession, passCutoff, trialCutoff]);

  // Handle manual override for a student
  const handleStudentActionChange = (studentId: string, action: RolloverStudentDecision['action'], customTargetClass?: string) => {
    setStudentDecisions((prev) => {
      const current = prev[studentId];
      if (!current) return prev;

      let targetClass = current.targetClass;
      let decisionText = current.promotionDecisionText;

      if (action === 'Promote') {
        targetClass = getNextClassName(current.currentClass);
        decisionText = `Promoted to ${targetClass}`;
      } else if (action === 'PromoteOnTrial') {
        targetClass = getNextClassName(current.currentClass);
        decisionText = `Promoted on Trial to ${targetClass}`;
      } else if (action === 'Repeat') {
        targetClass = current.currentClass;
        decisionText = `Advised to Repeat ${current.currentClass}`;
      } else if (action === 'Graduate') {
        targetClass = 'Graduated (Alumni)';
        decisionText = 'Graduated';
      } else if (action === 'Custom') {
        targetClass = customTargetClass || targetClass;
        decisionText = `Transferred to ${targetClass}`;
      }

      return {
        ...prev,
        [studentId]: {
          ...current,
          action,
          targetClass,
          promotionDecisionText: decisionText,
          isCustomOverride: true
        }
      };
    });
  };

  // Handle custom target class change
  const handleCustomTargetClassChange = (studentId: string, newTarget: string) => {
    setStudentDecisions((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: {
          ...current,
          targetClass: newTarget,
          promotionDecisionText: `Promoted to ${newTarget}`,
          isCustomOverride: true
        }
      };
    });
  };

  // Batch action for currently filtered students
  const handleBatchAction = (action: RolloverStudentDecision['action']) => {
    const updated = { ...studentDecisions };
    displayedStudents.forEach((st) => {
      const current = updated[st.StudentID];
      if (!current) return;

      let targetClass = current.targetClass;
      let decisionText = current.promotionDecisionText;

      if (action === 'Promote') {
        targetClass = isGraduatingClass(current.currentClass) ? 'Graduated (Alumni)' : getNextClassName(current.currentClass);
        decisionText = `Promoted to ${targetClass}`;
      } else if (action === 'Repeat') {
        targetClass = current.currentClass;
        decisionText = `Advised to Repeat ${current.currentClass}`;
      } else if (action === 'Graduate') {
        targetClass = 'Graduated (Alumni)';
        decisionText = 'Graduated';
      }

      updated[st.StudentID] = {
        ...current,
        action,
        targetClass,
        promotionDecisionText: decisionText,
        isCustomOverride: true
      };
    });
    setStudentDecisions(updated);
  };

  // Filtered student list for table
  const displayedStudents = useMemo(() => {
    return students.filter((st) => {
      const matchesClass =
        selectedClassFilter === 'all' || isMatchingClass(st.Class, selectedClassFilter);
      const matchesQuery =
        !searchQuery ||
        st.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.StudentID.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesQuery;
    });
  }, [students, selectedClassFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const list = Object.values(studentDecisions);
    const total = list.length;
    const promoted = list.filter((d) => d.action === 'Promote').length;
    const trial = list.filter((d) => d.action === 'PromoteOnTrial').length;
    const repeat = list.filter((d) => d.action === 'Repeat').length;
    const graduate = list.filter((d) => d.action === 'Graduate').length;
    const custom = list.filter((d) => d.action === 'Custom').length;

    return { total, promoted, trial, repeat, graduate, custom };
  }, [studentDecisions]);

  // Execute Rollover
  const handleExecuteRollover = async () => {
    setIsExecuting(true);
    setFeedback(null);
    setShowConfirmModal(false);

    try {
      const decisionsList = Object.values(studentDecisions);

      const res = await FirebaseService.executeSessionRollover({
        currentSession: fromSession,
        nextSession: toSession,
        studentDecisions: decisionsList,
        executedBy: currentUser?.FullName || 'Administrator',
        notes: `Academic Rollover: ${fromSession} → ${toSession}`
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
        await loadHistory();
        if (onRefreshData) await onRefreshData();
        if (onSessionRolledOver) onSessionRolledOver(toSession);
      } else {
        setFeedback({
          type: 'error',
          message: res.message
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'An error occurred during session rollover.'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Alumni list
  const alumniStudents = useMemo(() => {
    return students.filter(
      (s) => isGraduatingClass(s.Class) || s.Class.toLowerCase().includes('alumni') || s.Class.toLowerCase().includes('graduated')
    );
  }, [students]);

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase font-serif tracking-tight text-white">
                  Session Rollover &amp; Promotion Engine
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono font-bold text-[11px] uppercase tracking-wider">
                  Academic Year Transition
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                One-click automated progression: Basic 1 &rarr; Basic 2, JSS 3 &rarr; SSS 1, and archive graduating SSS 3 classes.
              </p>
            </div>
          </div>

          {/* Session Switcher Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-800/90 p-2.5 rounded-xl border border-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase text-slate-400">Current Session:</span>
              <select
                value={fromSession}
                onChange={(e) => setFromSession(e.target.value)}
                className="bg-slate-900 text-amber-400 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
              >
                {SESSIONS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase text-slate-400">Rollover To:</span>
              <input
                type="text"
                value={toSession}
                onChange={(e) => setToSession(e.target.value)}
                placeholder="2027/2028"
                className="w-28 bg-slate-900 text-emerald-400 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono font-bold focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={() => setActiveSubTab('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'preview'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Promotion Roster Preview ({students.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('alumni')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'alumni'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Graduating &amp; Alumni Registry ({alumniStudents.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Rollover History &amp; Logs ({historyLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-xs"
          >
            &times;
          </button>
        </div>
      )}

      {/* SUB-TAB 1: PROMOTION PREVIEW & ROSTER */}
      {activeSubTab === 'preview' && (
        <div className="space-y-4">
          {/* Promotion Criteria & Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Total Pupils</span>
              <span className="text-xl font-black text-slate-900">{metrics.total}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">Promoted</span>
              <span className="text-xl font-black text-emerald-800">{metrics.promoted}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase block">On Trial</span>
              <span className="text-xl font-black text-amber-800">{metrics.trial}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase block">Repeating</span>
              <span className="text-xl font-black text-rose-800">{metrics.repeat}</span>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-purple-700 uppercase block">Graduating (Alumni)</span>
              <span className="text-xl font-black text-purple-800">{metrics.graduate}</span>
            </div>
            <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Next Active Session</span>
              <span className="text-sm font-black text-amber-400 font-mono">{toSession}</span>
            </div>
          </div>

          {/* Promotion Cutoff Configuration */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-700 uppercase">Promotion Rules:</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600">Pass Cutoff (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={passCutoff}
                  onChange={(e) => setPassCutoff(parseInt(e.target.value, 10) || 50)}
                  className="w-16 px-2 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-600">Trial Cutoff (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={trialCutoff}
                  onChange={(e) => setTrialCutoff(parseInt(e.target.value, 10) || 40)}
                  className="w-16 px-2 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg text-center"
                />
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isExecuting || metrics.total === 0}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Execute 1-Click Session Rollover</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden"
              >
                <option value="all">All Classes ({students.length})</option>
                {classesList.map((c) => (
                  <option key={c} value={c}>
                    {c} ({students.filter((s) => isMatchingClass(s.Class, c)).length})
                  </option>
                ))}
              </select>

              {/* Batch buttons for selected class */}
              {selectedClassFilter !== 'all' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleBatchAction('Promote')}
                    className="text-[11px] font-bold px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg cursor-pointer"
                  >
                    Promote All
                  </button>
                  <button
                    onClick={() => handleBatchAction('Repeat')}
                    className="text-[11px] font-bold px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg cursor-pointer"
                  >
                    Repeat All
                  </button>
                  {isGraduatingClass(selectedClassFilter) && (
                    <button
                      onClick={() => handleBatchAction('Graduate')}
                      className="text-[11px] font-bold px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg cursor-pointer"
                    >
                      Graduate &amp; Archive All
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pupil name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Main Progression Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Pupil</th>
                    <th className="py-3 px-4">Current Class</th>
                    <th className="py-3 px-4 text-center">3rd Term Avg</th>
                    <th className="py-3 px-4 text-center">Annual Avg</th>
                    <th className="py-3 px-4">Action Decision</th>
                    <th className="py-3 px-4">Target Class for {toSession}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No pupils found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map((st, idx) => {
                      const dec = studentDecisions[st.StudentID];
                      if (!dec) return null;

                      return (
                        <tr key={st.StudentID} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{st.FullName}</span>
                            <span className="font-mono text-[11px] text-slate-500">{st.StudentID}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs">
                              {dec.currentClass}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                            {dec.thirdTermAverage !== null ? `${dec.thirdTermAverage.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                            {dec.annualAverage !== null ? `${dec.annualAverage.toFixed(1)}%` : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={dec.action}
                                onChange={(e) =>
                                  handleStudentActionChange(
                                    st.StudentID,
                                    e.target.value as RolloverStudentDecision['action']
                                  )
                                }
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg border focus:outline-hidden cursor-pointer ${
                                  dec.action === 'Promote'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : dec.action === 'PromoteOnTrial'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : dec.action === 'Repeat'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : dec.action === 'Graduate'
                                    ? 'bg-purple-50 text-purple-800 border-purple-300'
                                    : 'bg-slate-50 text-slate-800 border-slate-300'
                                }`}
                              >
                                <option value="Promote">Promote</option>
                                <option value="PromoteOnTrial">Promote on Trial</option>
                                <option value="Repeat">Repeat Class</option>
                                <option value="Graduate">Graduate (Alumni)</option>
                                <option value="Custom">Custom Transfer</option>
                              </select>

                              {dec.isCustomOverride && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                  Manual
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {dec.action === 'Custom' ? (
                              <input
                                type="text"
                                value={dec.targetClass}
                                onChange={(e) => handleCustomTargetClassChange(st.StudentID, e.target.value)}
                                placeholder="Enter Target Class..."
                                className="w-36 text-xs font-bold px-2.5 py-1 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span
                                  className={`px-2.5 py-1 font-black rounded-lg text-xs ${
                                    dec.action === 'Graduate'
                                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                      : dec.action === 'Repeat'
                                      ? 'bg-rose-100 text-rose-900 border border-rose-200'
                                      : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                  }`}
                                >
                                  {dec.targetClass}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GRADUATING & ALUMNI REGISTRY */}
      {activeSubTab === 'alumni' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                <Archive className="w-4 h-4 text-purple-600" />
                <span>Graduating Classes &amp; Alumni Archive</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Students completing Senior Secondary (SSS 3 / SS 3) or final primary tiers archived for historical record retention.
              </p>
            </div>
            <span className="text-xs font-bold text-purple-800 bg-purple-100 px-3 py-1 rounded-full">
              {alumniStudents.length} Graduated Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Student ID</th>
                  <th className="py-2.5 px-3">Class Enrolled</th>
                  <th className="py-2.5 px-3">Gender</th>
                  <th className="py-2.5 px-3">Parent Contact</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alumniStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No graduating or alumni students recorded yet.
                    </td>
                  </tr>
                ) : (
                  alumniStudents.map((st, idx) => (
                    <tr key={st.StudentID} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.FullName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{st.StudentID}</td>
                      <td className="py-2.5 px-3 font-bold text-purple-700">{st.Class}</td>
                      <td className="py-2.5 px-3">{st.Gender || '—'}</td>
                      <td className="py-2.5 px-3">{st.ParentPhone || '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[11px]">
                          Alumni / Graduated
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ROLLOVER HISTORY & LOGS */}
      {activeSubTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                <span>Academic Session Rollover Logs</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of all previous automated transitions and class promotions.
              </p>
            </div>
            <button
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Transition</th>
                  <th className="py-2.5 px-3 text-center">Promoted</th>
                  <th className="py-2.5 px-3 text-center">Repeated</th>
                  <th className="py-2.5 px-3 text-center">Graduated</th>
                  <th className="py-2.5 px-3">Executed By</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No historical rollovers recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {log.fromSession} &rarr; {log.toSession}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                        {log.promotedCount}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-700">
                        {log.repeatedCount}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                        {log.graduatedCount}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{log.executedBy}</td>
                      <td className="py-2.5 px-3 text-slate-500">{log.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <ShieldAlert className="w-7 h-7 shrink-0" />
              <div>
                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                  Confirm Session Rollover
                </h3>
                <p className="text-xs text-slate-500">
                  Transition from <span className="font-bold text-slate-800">{fromSession}</span> to{' '}
                  <span className="font-bold text-emerald-700">{toSession}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <p className="font-bold text-slate-800">
                Are you sure you want to execute the end-of-year class progression?
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>
                  <strong className="text-emerald-700">{metrics.promoted + metrics.trial} pupils</strong> will be moved to their next class (e.g. Basic 1 &rarr; Basic 2, JSS 3 &rarr; SSS 1).
                </li>
                <li>
                  <strong className="text-rose-700">{metrics.repeat} pupils</strong> will remain in their current class to repeat.
                </li>
                <li>
                  <strong className="text-purple-700">{metrics.graduate} pupils</strong> in graduating classes will be archived to Alumni status.
                </li>
                <li>
                  Promotion decisions and cumulative records will be permanently saved to Firestore.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRollover}
                disabled={isExecuting}
                className="px-5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
                <span>{isExecuting ? 'Executing Rollover...' : 'Confirm & Apply Rollover'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
