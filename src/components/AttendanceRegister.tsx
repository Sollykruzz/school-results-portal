import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Student,
  TermType,
  AttendanceStatus,
  DailyAttendanceRecord,
  AttendanceEntry,
  StudentAttendanceTally,
  Teacher
} from '../types';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Save,
  Send,
  Users,
  Check,
  Filter,
  Search,
  Sparkles,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  Sliders,
  Trash2
} from 'lucide-react';
import {
  FirebaseService
} from '../services/firebaseService';
import {
  isMatchingClass,
  isMatchingStudentId,
  TERMS_LIST,
  SESSIONS_LIST
} from '../utils/grading';

type ClearScope = 'day' | 'week' | 'month' | 'term';

// Date helpers work on plain YYYY-MM-DD strings in UTC so the result never
// shifts by a day because of the device's timezone.
const parseYMD = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const toYMD = (d: Date): string => d.toISOString().slice(0, 10);
const addDaysUTC = (d: Date, n: number): Date => new Date(d.getTime() + n * 86400000);
const prettyDate = (ymd: string): string =>
  parseYMD(ymd).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Returns the inclusive date range covered by a clear scope (null = whole term).
const getClearRange = (scope: ClearScope, anchor: string): { from: string; to: string } | null => {
  if (scope === 'term') return null;
  const a = parseYMD(anchor);
  if (scope === 'day') return { from: toYMD(a), to: toYMD(a) };
  if (scope === 'week') {
    const offsetFromMonday = (a.getUTCDay() + 6) % 7; // Monday = 0
    const monday = addDaysUTC(a, -offsetFromMonday);
    return { from: toYMD(monday), to: toYMD(addDaysUTC(monday, 6)) };
  }
  const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
  const last = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
  return { from: toYMD(first), to: toYMD(last) };
};

interface AttendanceRegisterProps {
  currentClass: string;
  classesList?: string[];
  session: string;
  term: TermType;
  studentsList: Student[];
  currentTeacher?: Teacher;
  onRefreshData?: () => Promise<void> | void;
  onClassChange?: (newClass: string) => void;
  onSessionChange?: (newSession: string) => void;
  onTermChange?: (newTerm: TermType) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

export const AttendanceRegister: React.FC<AttendanceRegisterProps> = ({
  currentClass,
  classesList = [],
  session,
  term,
  studentsList,
  currentTeacher,
  onRefreshData,
  onClassChange,
  onSessionChange,
  onTermChange,
  onEditingChange
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [viewMode, setViewMode] = useState<'daily' | 'summary' | 'batch_setup'>('daily');
  const [dailyRecords, setDailyRecords] = useState<DailyAttendanceRecord[]>([]);
  const [currentDayEntries, setCurrentDayEntries] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDayDirty, setIsDayDirty] = useState(false);
  const isDayDirtyRef = useRef(false);
  const dirtyDateRef = useRef<string | null>(null);

  // Report editing state up so background refreshes app-wide can be paused
  // while the teacher is mid-roll-call, the same protection the per-pupil
  // "Enter Scores" tab already has.
  useEffect(() => {
    isDayDirtyRef.current = isDayDirty;
    dirtyDateRef.current = isDayDirty ? selectedDate : null;
    onEditingChange?.(isDayDirty);
  }, [isDayDirty, selectedDate, onEditingChange]);

  // Clear saved attendance state
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearScope, setClearScope] = useState<ClearScope>('day');
  const [clearAnchor, setClearAnchor] = useState<string>('');
  const [isClearing, setIsClearing] = useState(false);
  const [alsoUpdateReportCards, setAlsoUpdateReportCards] = useState(true);

  // Batch setup state
  const [batchDaysOpened, setBatchDaysOpened] = useState<number>(60);
  const [batchTallies, setBatchTallies] = useState<Record<string, { daysPresent: number; daysOpened: number }>>({});

  // Filter students for the active class
  const classStudents = useMemo(() => {
    return studentsList.filter((s) => isMatchingClass(s.Class, currentClass));
  }, [studentsList, currentClass]);

  // Load attendance records for current class, session, and term
  const loadAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await FirebaseService.fetchAttendanceRecords(currentClass, session, term);
      setDailyRecords(records);

      // Find record for currently selected date
      const matchingDay = records.find((r) => r.date === selectedDate);

      // If the teacher has unsaved marks for THIS SAME date, this reload was
      // triggered by a background refresh (not a deliberate date change) —
      // don't wipe their in-progress roll call.
      if (isDayDirtyRef.current && dirtyDateRef.current === selectedDate) {
        setIsLoading(false);
        return;
      }

      const entriesMap: Record<string, { status: AttendanceStatus; remarks: string }> = {};

      // Initialize all class students to Present by default or matching existing entry
      classStudents.forEach((st) => {
        const found = matchingDay?.entries?.find((e) => isMatchingStudentId(e.studentId, st.StudentID));
        if (found) {
          entriesMap[st.StudentID] = {
            status: found.status,
            remarks: found.remarks || ''
          };
        } else {
          entriesMap[st.StudentID] = {
            status: 'Present',
            remarks: ''
          };
        }
      });

      setCurrentDayEntries(entriesMap);

      // Initialize batch tallies
      const talliesMap: Record<string, { daysPresent: number; daysOpened: number }> = {};
      classStudents.forEach((st) => {
        const presentCount = records.filter((rec) => {
          const e = rec.entries?.find((ent) => isMatchingStudentId(ent.studentId, st.StudentID));
          return e && (e.status === 'Present' || e.status === 'Late');
        }).length;

        talliesMap[st.StudentID] = {
          daysPresent: records.length > 0 ? presentCount : 0,
          daysOpened: Math.max(records.length, batchDaysOpened)
        };
      });
      setBatchTallies(talliesMap);
    } catch (err) {
      console.warn('Failed to load attendance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentClass, session, term, selectedDate, classStudents, batchDaysOpened]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Change individual student's daily status
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setCurrentDayEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { remarks: '' }),
        status
      }
    }));
    setIsDayDirty(true);
  };

  // Change individual student's remarks
  const handleRemarksChange = (studentId: string, remarks: string) => {
    setCurrentDayEntries((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: 'Present' }),
        remarks
      }
    }));
    setIsDayDirty(true);
  };

  // Mark all students present
  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    classStudents.forEach((st) => {
      updated[st.StudentID] = {
        remarks: currentDayEntries[st.StudentID]?.remarks || '',
        status
      };
    });
    setCurrentDayEntries(updated);
    setIsDayDirty(true);
  };

  // Navigate date by +/- 1 day
  const handleShiftDate = (days: number) => {
    if (isDayDirty && !window.confirm('You have unsaved attendance marks for this day. Switch date and discard them?')) {
      return;
    }
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Save current day's attendance to Firestore
  const handleSaveDailyAttendance = async () => {
    if (classStudents.length === 0) {
      setFeedback({ type: 'error', message: 'No students in this class to record attendance for.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const entries: AttendanceEntry[] = classStudents.map((st) => ({
        studentId: st.StudentID,
        studentName: st.FullName,
        status: currentDayEntries[st.StudentID]?.status || 'Present',
        remarks: currentDayEntries[st.StudentID]?.remarks || ''
      }));

      const totalPresent = entries.filter((e) => e.status === 'Present').length;
      const totalAbsent = entries.filter((e) => e.status === 'Absent').length;
      const totalLate = entries.filter((e) => e.status === 'Late').length;
      const totalExcused = entries.filter((e) => e.status === 'Excused').length;

      const dayOfWeek = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' });

      const record: DailyAttendanceRecord = {
        className: currentClass,
        session,
        term,
        date: selectedDate,
        dayOfWeek,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        entries,
        recordedBy: currentTeacher?.FullName || 'Class Teacher'
      };

      const res = await FirebaseService.saveDailyAttendance(record);
      if (res.success) {
        setIsDayDirty(false);
        setFeedback({
          type: 'success',
          message: `Attendance for ${selectedDate} (${dayOfWeek}) saved! ${totalPresent + totalLate}/${classStudents.length} present.`
        });
        await loadAttendance();
        if (onRefreshData) await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save attendance.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Sync Attendance Tallies directly to Student Report Cards (StudentSummary)
  const handleSyncToReportCards = async (useManualBatch = false) => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.syncAttendanceToReportCards(currentClass, session, term, {
        defaultDaysOpened: batchDaysOpened,
        manualTallies: useManualBatch ? batchTallies : undefined
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
        if (onRefreshData) await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to sync attendance to report sheets.' });
    } finally {
      setIsSyncing(false);
    }
  };

  const openClearDialog = () => {
    setClearAnchor(selectedDate);
    setClearScope('day');
    setAlsoUpdateReportCards(true);
    setShowClearDialog(true);
  };

  const clearRange = useMemo(
    () => (clearAnchor || clearScope === 'term' ? getClearRange(clearScope, clearAnchor) : undefined),
    [clearScope, clearAnchor]
  );

  // Records that would be removed, based on what is currently loaded
  const recordsToClear = useMemo(() => {
    if (clearScope === 'term') return dailyRecords;
    if (!clearRange) return [];
    return dailyRecords.filter((r) => r.date >= clearRange.from && r.date <= clearRange.to);
  }, [dailyRecords, clearScope, clearRange]);

  const clearScopeLabel = useMemo(() => {
    if (clearScope === 'term') return `the whole of ${term}, ${session}`;
    if (!clearRange) return '';
    if (clearScope === 'day') return prettyDate(clearRange.from);
    if (clearScope === 'week') return `${prettyDate(clearRange.from)} to ${prettyDate(clearRange.to)}`;
    return parseYMD(clearRange.from).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  }, [clearScope, clearRange, term, session]);

  const handleConfirmClear = async () => {
    if (recordsToClear.length === 0) return;
    setIsClearing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.deleteAttendanceRecords(
        currentClass,
        session,
        term,
        clearScope === 'term' ? undefined : clearRange || undefined
      );
      if (res.success) {
        // Discard any unsaved marks so the reload below is allowed to reset the sheet
        isDayDirtyRef.current = false;
        dirtyDateRef.current = null;
        setIsDayDirty(false);
        setShowClearDialog(false);

        let reportNote = ' Pupil report cards were not changed until you sync again.';
        if (alsoUpdateReportCards) {
          const remaining = dailyRecords.length - res.count;
          const rc =
            remaining > 0
              ? await FirebaseService.syncAttendanceToReportCards(currentClass, session, term, {
                  defaultDaysOpened: batchDaysOpened
                })
              : await FirebaseService.resetReportCardAttendance(currentClass, session, term);
          reportNote = rc.success
            ? remaining > 0
              ? ' Report cards re-tallied from the remaining roll calls.'
              : ' Days Present / Days Opened cleared from report cards.'
            : ` Attendance was cleared, but report cards could not be updated: ${rc.message}`;
          if (onRefreshData) await onRefreshData();
        }

        setFeedback({ type: 'success', message: `${res.message}${reportNote}` });
        await loadAttendance();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to clear attendance.' });
    } finally {
      setIsClearing(false);
    }
  };

  // Computed tallies across all daily records for this class & term
  const studentTallies: StudentAttendanceTally[] = useMemo(() => {
    return classStudents.map((st) => {
      let daysPresent = 0;
      let daysAbsent = 0;
      let daysLate = 0;
      let daysExcused = 0;

      dailyRecords.forEach((rec) => {
        const ent = rec.entries?.find((e) => isMatchingStudentId(e.studentId, st.StudentID));
        if (ent) {
          if (ent.status === 'Present') daysPresent++;
          else if (ent.status === 'Late') {
            daysLate++;
            daysPresent++; // Late counts towards attendance
          } else if (ent.status === 'Absent') daysAbsent++;
          else if (ent.status === 'Excused') daysExcused++;
        }
      });

      const totalDaysRecorded = dailyRecords.length;
      const attendancePercentage =
        totalDaysRecorded > 0 ? Math.round((daysPresent / totalDaysRecorded) * 100) : 100;

      return {
        studentId: st.StudentID,
        studentName: st.FullName,
        daysPresent,
        daysAbsent,
        daysLate,
        daysExcused,
        totalDaysRecorded,
        attendancePercentage
      };
    });
  }, [classStudents, dailyRecords]);

  // Current day metrics
  const dayStats = useMemo(() => {
    const values = Object.values(currentDayEntries);
    const present = values.filter((v) => v.status === 'Present').length;
    const late = values.filter((v) => v.status === 'Late').length;
    const absent = values.filter((v) => v.status === 'Absent').length;
    const excused = values.filter((v) => v.status === 'Excused').length;
    const total = classStudents.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { present, late, absent, excused, total, rate };
  }, [currentDayEntries, classStudents]);

  // Filtered student list by search
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return classStudents;
    return classStudents.filter(
      (s) => s.FullName.toLowerCase().includes(q) || s.StudentID.toLowerCase().includes(q)
    );
  }, [classStudents, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase font-serif tracking-tight text-white">
                  Class Attendance Register
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-mono font-bold text-[11px] uppercase tracking-wider">
                  Live Roll Call
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentClass} &bull; {term} &bull; {session} &bull; Automatically tallies Days Present &amp; Days Opened onto pupil report cards.
              </p>
            </div>
          </div>

          {/* Controls: Class / Term / Session Switcher */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-800/90 p-2 rounded-xl border border-slate-700">
            {classesList.length > 0 && onClassChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400">Class:</span>
                <select
                  value={currentClass}
                  onChange={(e) => onClassChange(e.target.value)}
                  className="bg-slate-900 text-amber-400 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  {classesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onTermChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400">Term:</span>
                <select
                  value={term}
                  onChange={(e) => onTermChange(e.target.value as TermType)}
                  className="bg-slate-900 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  {TERMS_LIST.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onSessionChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400">Session:</span>
                <select
                  value={session}
                  onChange={(e) => onSessionChange(e.target.value)}
                  className="bg-slate-900 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-hidden cursor-pointer"
                >
                  {SESSIONS_LIST.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={loadAttendance}
              disabled={isLoading}
              className="p-1.5 px-3 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Refresh attendance records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'daily'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily Roll Call</span>
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'summary'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Term Tally &amp; Report Sync</span>
          </button>
          <button
            onClick={() => setViewMode('batch_setup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'batch_setup'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Quick Batch Days Opened</span>
          </button>
          <button
            type="button"
            onClick={openClearDialog}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-rose-500/15 text-rose-300 border border-rose-400/30 hover:bg-rose-500/25"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Saved Attendance</span>
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
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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

      {/* TAB 1: DAILY ROLL CALL */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          {/* Daily Toolbar & Date Navigation */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Date Picker & Nav */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleShiftDate(-1)}
                className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-600">
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              <button
                onClick={() => handleShiftDate(1)}
                className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer ml-1"
              >
                Today
              </button>
            </div>

            {/* Quick Bulk Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleMarkAll('Present')}
                className="text-xs px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark All Present</span>
              </button>
              <button
                onClick={() => handleMarkAll('Absent')}
                className="text-xs px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Mark All Absent</span>
              </button>

              <button
                onClick={handleSaveDailyAttendance}
                disabled={isSaving}
                className="text-xs px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'Saving...' : 'Save Daily Roll Call'}</span>
              </button>
            </div>
          </div>

          {/* Daily Quick Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Enrolled Pupils</span>
              <span className="text-xl font-black text-slate-900">{dayStats.total}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase block">Present</span>
              <span className="text-xl font-black text-emerald-800">{dayStats.present}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase block">Late</span>
              <span className="text-xl font-black text-amber-800">{dayStats.late}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase block">Absent</span>
              <span className="text-xl font-black text-rose-800">{dayStats.absent}</span>
            </div>
            <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase block">Attendance Rate</span>
              <span className="text-xl font-black text-amber-400">{dayStats.rate}%</span>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search pupils by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Roll Call Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Pupil Info</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Remarks / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        No pupils found matching "{searchQuery}" in {currentClass}.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const currentStatus = currentDayEntries[st.StudentID]?.status || 'Present';
                      const currentRemarks = currentDayEntries[st.StudentID]?.remarks || '';

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
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(st.StudentID, 'Present')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                  currentStatus === 'Present'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                }`}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(st.StudentID, 'Late')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                  currentStatus === 'Late'
                                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                                }`}
                              >
                                Late
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(st.StudentID, 'Absent')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                  currentStatus === 'Absent'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                                }`}
                              >
                                Absent
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(st.StudentID, 'Excused')}
                                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                                  currentStatus === 'Excused'
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
                                }`}
                              >
                                Excused
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={currentRemarks}
                              onChange={(e) => handleRemarksChange(st.StudentID, e.target.value)}
                              placeholder="Optional remarks (e.g. medical reason)..."
                              className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                            />
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

      {/* TAB 2: TERM TALLY SUMMARY & ONE-CLICK DIRECT SYNC */}
      {viewMode === 'summary' && (
        <div className="space-y-4">
          {/* Action Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
                Term Attendance Tallies ({dailyRecords.length} Roll Calls Recorded)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review computed total Days Present and sync them directly onto the student report cards.
              </p>
            </div>

            <button
              onClick={() => handleSyncToReportCards(false)}
              disabled={isSyncing || classStudents.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Send className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing to Report Cards...' : 'Sync Tallies Directly to Report Cards'}</span>
            </button>
          </div>

          {/* Tallies Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Pupil Name &amp; ID</th>
                    <th className="py-3 px-4 text-center">Days Present</th>
                    <th className="py-3 px-4 text-center">Days Absent</th>
                    <th className="py-3 px-4 text-center">Days Late</th>
                    <th className="py-3 px-4 text-center">Total Sessions</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4 text-center">Report Card Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {studentTallies.map((tally, idx) => (
                    <tr key={tally.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{tally.studentName}</span>
                        <span className="font-mono text-[11px] text-slate-500">{tally.studentId}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700 font-mono">
                        {tally.daysPresent}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-rose-700 font-mono">
                        {tally.daysAbsent}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-amber-700 font-mono">
                        {tally.daysLate}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700 font-mono">
                        {Math.max(tally.totalDaysRecorded, batchDaysOpened)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-xs ${
                            tally.attendancePercentage >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : tally.attendancePercentage >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tally.attendancePercentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          {tally.daysPresent} / {Math.max(tally.totalDaysRecorded, batchDaysOpened)} days
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUICK BATCH SETUP DAYS OPENED */}
      {viewMode === 'batch_setup' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="font-black text-slate-900 text-sm uppercase tracking-wide">
              Quick Batch Attendance Configuration
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Instantly set Total Days School Opened (e.g. 60 or 65 days) and customize individual Days Present for the whole class.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Total Days School Opened This Term
              </label>
              <input
                type="number"
                min="1"
                max="150"
                value={batchDaysOpened}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 60;
                  setBatchDaysOpened(val);
                  setBatchTallies((prev) => {
                    const updated = { ...prev };
                    Object.keys(updated).forEach((k) => {
                      updated[k].daysOpened = val;
                    });
                    return updated;
                  });
                }}
                className="w-36 text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <button
              onClick={() => {
                const updated: Record<string, { daysPresent: number; daysOpened: number }> = {};
                classStudents.forEach((st) => {
                  updated[st.StudentID] = {
                    daysPresent: batchDaysOpened,
                    daysOpened: batchDaysOpened
                  };
                });
                setBatchTallies(updated);
              }}
              className="text-xs px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors cursor-pointer self-end"
            >
              Fill All Perfect Attendance ({batchDaysOpened}/{batchDaysOpened})
            </button>

            <button
              onClick={() => handleSyncToReportCards(true)}
              disabled={isSyncing}
              className="text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg transition-colors cursor-pointer self-end flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSyncing ? 'Writing to Report Sheets...' : 'Save & Sync Batch to Report Cards'}</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Pupil</th>
                  <th className="py-2.5 px-3 w-36">Days Present</th>
                  <th className="py-2.5 px-3 w-36">Days Opened</th>
                  <th className="py-2.5 px-3 text-center">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.map((st, idx) => {
                  const present = batchTallies[st.StudentID]?.daysPresent ?? batchDaysOpened;
                  const opened = batchTallies[st.StudentID]?.daysOpened ?? batchDaysOpened;
                  const rate = opened > 0 ? Math.round((present / opened) * 100) : 100;

                  return (
                    <tr key={st.StudentID} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.FullName}</td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="0"
                          max={opened}
                          value={present}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setBatchTallies((prev) => ({
                              ...prev,
                              [st.StudentID]: {
                                ...(prev[st.StudentID] || { daysOpened: opened }),
                                daysPresent: val
                              }
                            }));
                          }}
                          className="w-24 px-2.5 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          min="1"
                          value={opened}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || batchDaysOpened;
                            setBatchTallies((prev) => ({
                              ...prev,
                              [st.StudentID]: {
                                ...(prev[st.StudentID] || { daysPresent: present }),
                                daysOpened: val
                              }
                            }));
                          }}
                          className="w-24 px-2.5 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 font-mono">
                        {rate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLEAR SAVED ATTENDANCE DIALOG */}
      {showClearDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70"
          onClick={() => !isClearing && setShowClearDialog(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Clear Saved Attendance</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentClass} &bull; {term} &bull; {session}
                </p>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">What do you want to clear?</span>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-xl">
                {([
                  ['day', 'Daily'],
                  ['week', 'Weekly'],
                  ['month', 'Monthly'],
                  ['term', 'Termly']
                ] as [ClearScope, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setClearScope(key)}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      clearScope === key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {clearScope !== 'term' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                  {clearScope === 'day' ? 'Date' : clearScope === 'week' ? 'Pick any date in the week' : 'Pick any date in the month'}
                </label>
                <input
                  type="date"
                  value={clearAnchor}
                  onChange={(e) => setClearAnchor(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            )}

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 space-y-1">
              {clearScope !== 'term' && !clearAnchor ? (
                <p className="font-bold">Pick a date to continue.</p>
              ) : recordsToClear.length === 0 ? (
                <p className="font-bold">No saved attendance found for {clearScopeLabel}.</p>
              ) : (
                <>
                  <p className="font-bold">
                    This will permanently delete {recordsToClear.length} saved roll call
                    {recordsToClear.length === 1 ? '' : 's'} for {clearScopeLabel}.
                  </p>
                  <p>This cannot be undone.</p>
                </>
              )}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoUpdateReportCards}
                onChange={(e) => setAlsoUpdateReportCards(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-slate-900"
              />
              <span className="text-xs text-slate-700">
                <span className="font-bold text-slate-900">Also update pupil report cards</span>
                <span className="block text-slate-500">
                  Days Present / Days Opened are re-tallied from what remains, or blanked if nothing remains.
                  Untick to leave report cards as they are.
                </span>
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                disabled={isClearing}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                disabled={isClearing || recordsToClear.length === 0}
                className="px-4 py-2 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isClearing ? 'animate-pulse' : ''}`} />
                <span>{isClearing ? 'Clearing...' : 'Clear Attendance'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
