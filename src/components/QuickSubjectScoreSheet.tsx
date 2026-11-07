import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, SubjectScore, Teacher, TermType } from '../types';
import { calculateSubjectTotal, getGradeDetails, getScoringConfig } from '../utils/grading';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Users,
  Award,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Loader2,
  Table as TableIcon,
  ChevronRight,
  FileText
} from 'lucide-react';
import { FirebaseService } from '../services/firebaseService';

interface QuickSubjectScoreSheetProps {
  currentTeacher: Teacher;
  classStudents: Student[];
  authoritativeSubjects: string[];
  allScores: SubjectScore[];
  session: string;
  term: TermType;
  onRefreshData: () => void;
  onViewStudentReport: (student: Student) => void;
  onEditingChange?: (isEditing: boolean) => void;
}

interface StudentRowScore {
  student: Student;
  ca1: string;
  ca2: string;
  exam: string;
}

export const QuickSubjectScoreSheet: React.FC<QuickSubjectScoreSheetProps> = ({
  currentTeacher,
  classStudents,
  authoritativeSubjects,
  allScores,
  session,
  term,
  onRefreshData,
  onViewStudentReport,
  onEditingChange
}) => {
  const [activeSubject, setActiveSubject] = useState<string>(
    authoritativeSubjects[0] || 'Mathematics'
  );

  // Sync activeSubject if authoritativeSubjects change
  useEffect(() => {
    if (authoritativeSubjects.length > 0 && !authoritativeSubjects.includes(activeSubject)) {
      setActiveSubject(authoritativeSubjects[0]);
    }
  }, [authoritativeSubjects, activeSubject]);

  // Local state for all student inputs in the active subject
  const [rowScores, setRowScores] = useState<Record<string, { ca1: string; ca2: string; exam: string }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const lastLoadedKeyRef = useRef<string>('');

  // Report editing state up so background refreshes app-wide can be paused,
  // matching the protection the per-pupil "Enter Scores" tab already has.
  useEffect(() => {
    isDirtyRef.current = isDirty;
    onEditingChange?.(isDirty);
  }, [isDirty, onEditingChange]);

  // Populate rowScores when activeSubject, allScores, or session/term changes.
  // If the subject/session/term are unchanged and the teacher has unsaved edits,
  // this run was triggered by a background data refresh — don't wipe their typing.
  useEffect(() => {
    const key = `${activeSubject}|${session}|${term}`;
    if (isDirtyRef.current && key === lastLoadedKeyRef.current) {
      return;
    }
    lastLoadedKeyRef.current = key;

    const initialMap: Record<string, { ca1: string; ca2: string; exam: string }> = {};

    classStudents.forEach((student) => {
      const match = allScores.find(
        (s) =>
          s.StudentID.trim().toLowerCase() === student.StudentID.trim().toLowerCase() &&
          s.Subject.trim().toLowerCase() === activeSubject.trim().toLowerCase() &&
          s.Term === term &&
          (s.Session === session || !s.Session)
      );

      initialMap[student.StudentID] = {
        ca1: match && match.CA1 !== null && match.CA1 !== undefined ? String(match.CA1) : '',
        ca2: match && match.CA2 !== null && match.CA2 !== undefined ? String(match.CA2) : '',
        exam: match && match.Exam !== null && match.Exam !== undefined ? String(match.Exam) : ''
      };
    });

    setRowScores(initialMap);
    setIsDirty(false);
    setFeedback(null);
  }, [activeSubject, classStudents, allScores, session, term]);

  const scoringConfig = useMemo(() => getScoringConfig(session, term), [session, term]);
  const maxCa1 = scoringConfig.maxCA1;
  const maxCa2 = scoringConfig.maxCA2;
  const maxExam = scoringConfig.maxExam;
  const maxCaTotal = maxCa1 + maxCa2;

  const handleScoreChange = (
    studentId: string,
    field: 'ca1' | 'ca2' | 'exam',
    value: string
  ) => {
    // Only allow numbers or empty string
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
      return;
    }

    const num = parseFloat(value);
    const max = field === 'exam' ? maxExam : field === 'ca1' ? maxCa1 : maxCa2;

    if (!isNaN(num) && num > max) {
      value = String(max);
    }

    if (value !== '' && (isNaN(num) || num < 0)) {
      return;
    }

    setRowScores((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { ca1: '', ca2: '', exam: '' }),
        [field]: value
      }
    }));
    setIsDirty(true);
    setFeedback(null);
  };

  // Quick autofill or clear helpers
  const handleClearAll = () => {
    if (!window.confirm(`Clear all entered scores for ${activeSubject}?`)) return;
    const cleared: Record<string, { ca1: string; ca2: string; exam: string }> = {};
    classStudents.forEach((s) => {
      cleared[s.StudentID] = { ca1: '', ca2: '', exam: '' };
    });
    setRowScores(cleared);
    setIsDirty(true);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const payloadScores: Array<{
        studentId: string;
        subject: string;
        ca1: number | null;
        ca2: number | null;
        exam: number | null;
        total: number | null;
      }> = [];

      classStudents.forEach((student) => {
        const row = rowScores[student.StudentID] || { ca1: '', ca2: '', exam: '' };
        const ca1Val = row.ca1.trim() !== '' ? parseFloat(row.ca1) : null;
        const ca2Val = row.ca2.trim() !== '' ? parseFloat(row.ca2) : null;
        const examVal = row.exam.trim() !== '' ? parseFloat(row.exam) : null;
        const totalVal = calculateSubjectTotal(ca1Val, ca2Val, examVal);

        payloadScores.push({
          studentId: student.StudentID,
          subject: activeSubject,
          ca1: ca1Val,
          ca2: ca2Val,
          exam: examVal,
          total: totalVal
        });
      });

      const res = await FirebaseService.saveBatchSubjectScores({
        session,
        term,
        scores: payloadScores
      });

      if (res.success) {
        setIsDirty(false);
        setFeedback({
          type: 'success',
          message: `Successfully saved ${activeSubject} scores for all ${classStudents.length} pupils in ${currentTeacher.ClassAssigned}!`
        });
        onRefreshData();
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to save scores to database. Please retry.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculations for subject summary
  const studentRowsCalculated = useMemo(() => {
    return classStudents.map((student, idx) => {
      const row = rowScores[student.StudentID] || { ca1: '', ca2: '', exam: '' };
      const ca1Val = row.ca1.trim() !== '' ? parseFloat(row.ca1) : null;
      const ca2Val = row.ca2.trim() !== '' ? parseFloat(row.ca2) : null;
      const examVal = row.exam.trim() !== '' ? parseFloat(row.exam) : null;

      const caTotal = (ca1Val !== null || ca2Val !== null)
        ? (ca1Val || 0) + (ca2Val || 0)
        : null;

      const total = calculateSubjectTotal(ca1Val, ca2Val, examVal);
      const gradeInfo = total !== null ? getGradeDetails(total) : null;
      const isComplete = ca1Val !== null && ca2Val !== null && examVal !== null;

      return {
        student,
        index: idx + 1,
        ca1: row.ca1,
        ca2: row.ca2,
        exam: row.exam,
        caTotal,
        total,
        gradeInfo,
        isComplete
      };
    });
  }, [classStudents, rowScores]);

  const completedCount = studentRowsCalculated.filter((r) => r.isComplete).length;
  const totalScoresList = studentRowsCalculated
    .map((r) => r.total)
    .filter((t): t is number => t !== null);

  const subjectAverage = totalScoresList.length > 0
    ? Math.round((totalScoresList.reduce((a, b) => a + b, 0) / totalScoresList.length) * 10) / 10
    : null;
  const highestScore = totalScoresList.length > 0 ? Math.max(...totalScoresList) : null;
  const lowestScore = totalScoresList.length > 0 ? Math.min(...totalScoresList) : null;

  return (
    <div className="space-y-4">
      {/* Top Banner: Subject Selector & Quick Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <TableIcon className="w-5 h-5 text-amber-600" />
                <span>Quick CA Score Sheet &bull; {currentTeacher.ClassAssigned}</span>
              </h2>
              <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                {activeSubject}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Enter CA1 (max {maxCa1}), CA2 (max {maxCa2}), and Exam (max {maxExam}) for the whole class. Math and grades compute automatically.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="save-quick-scores-btn"
              onClick={handleSaveAll}
              disabled={isSaving || classStudents.length === 0}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer ${
                isDirty
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50 animate-pulse'
                  : 'bg-emerald-700 hover:bg-emerald-600 text-white'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving to Firebase...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save {activeSubject} Scores</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold'
                : 'bg-rose-50 border border-rose-300 text-rose-900 font-semibold'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Subject Navigation Tabs (All Authoritative Subjects for this Class Alone) */}
        <div className="mt-4">
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
            Select Subject for Score Entry ({authoritativeSubjects.length} subjects for {currentTeacher.ClassAssigned}):
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
            {authoritativeSubjects.map((subj) => {
              const isActive = subj.toLowerCase() === activeSubject.toLowerCase();
              return (
                <button
                  key={subj}
                  onClick={() => {
                    if (isDirty && !window.confirm(`You have unsaved ${activeSubject} scores. Switch subject and discard them?`)) {
                      return;
                    }
                    setActiveSubject(subj);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs scale-105'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {subj}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Subject Stats Bar */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center text-xs">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500">Pupils Entered</span>
            <span className="font-extrabold text-slate-900 text-sm">{completedCount} / {classStudents.length}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500">Subject Average</span>
            <span className="font-extrabold text-slate-900 text-sm">{subjectAverage !== null ? `${subjectAverage}%` : '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-emerald-700">Highest Score</span>
            <span className="font-extrabold text-emerald-700 text-sm">{highestScore !== null ? `${highestScore}/100` : '—'}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-600">Lowest Score</span>
            <span className="font-extrabold text-slate-800 text-sm">{lowestScore !== null ? `${lowestScore}/100` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Spreadsheet Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/95 text-slate-800 uppercase text-[11px] font-extrabold border-b border-slate-200 tracking-wider sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3 w-28">Student ID</th>
                <th className="py-3 px-2 w-20 text-center bg-amber-50/70 text-amber-950">CA 1 ({maxCa1})</th>
                <th className="py-3 px-2 w-20 text-center bg-amber-50/70 text-amber-950">CA 2 ({maxCa2})</th>
                <th className="py-3 px-2 w-20 text-center bg-amber-100/70 text-amber-950 font-black">CA Total ({maxCaTotal})</th>
                <th className="py-3 px-2 w-20 text-center bg-indigo-50/70 text-indigo-950">Exam ({maxExam})</th>
                <th className="py-3 px-2 w-20 text-center bg-slate-200 text-slate-950 font-black">Total (100)</th>
                <th className="py-3 px-2 w-16 text-center">Grade</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {studentRowsCalculated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700">No pupils registered in this class roster</p>
                  </td>
                </tr>
              ) : (
                studentRowsCalculated.map((row) => (
                  <tr
                    key={row.student.StudentID}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {row.index}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {row.student.FullName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                      {row.student.StudentID}
                    </td>

                    {/* CA1 Input (/{maxCa1}) */}
                    <td className="py-2 px-2 bg-amber-50/30 text-center">
                      <input
                        type="number"
                        min="0"
                        max={maxCa1}
                        step="0.5"
                        value={row.ca1}
                        onChange={(e) =>
                          handleScoreChange(row.student.StudentID, 'ca1', e.target.value)
                        }
                        placeholder="—"
                        className="w-16 mx-auto text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </td>

                    {/* CA2 Input (/{maxCa2}) */}
                    <td className="py-2 px-2 bg-amber-50/30 text-center">
                      <input
                        type="number"
                        min="0"
                        max={maxCa2}
                        step="0.5"
                        value={row.ca2}
                        onChange={(e) =>
                          handleScoreChange(row.student.StudentID, 'ca2', e.target.value)
                        }
                        placeholder="—"
                        className="w-16 mx-auto text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </td>

                    {/* CA Total (/{maxCaTotal}) */}
                    <td className="py-2.5 px-2 bg-amber-100/40 text-center font-black text-amber-950">
                      {row.caTotal !== null ? row.caTotal : '—'}
                    </td>

                    {/* Exam Input (/{maxExam}) */}
                    <td className="py-2 px-2 bg-indigo-50/30 text-center">
                      <input
                        type="number"
                        min="0"
                        max={maxExam}
                        step="0.5"
                        value={row.exam}
                        onChange={(e) =>
                          handleScoreChange(row.student.StudentID, 'exam', e.target.value)
                        }
                        placeholder="—"
                        className="w-16 mx-auto text-center font-bold text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      />
                    </td>

                    {/* Terminal Total (/100) */}
                    <td className="py-2.5 px-2 bg-slate-100 text-center font-black text-slate-950 text-sm">
                      {row.total !== null ? row.total : '—'}
                    </td>

                    {/* Grade */}
                    <td className="py-2.5 px-2 text-center">
                      {row.gradeInfo ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold ${
                            row.gradeInfo.grade === 'A'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.gradeInfo.grade === 'B'
                              ? 'bg-blue-100 text-blue-800'
                              : row.gradeInfo.grade === 'C'
                              ? 'bg-amber-100 text-amber-800'
                              : row.gradeInfo.grade === 'D'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.gradeInfo.grade}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* View Report Card */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onViewStudentReport(row.student)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                        title="View & Edit Full Terminal Report Card"
                      >
                        <FileText className="w-3 h-3 text-amber-600" />
                        <span>Report Card</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Scores are saved immediately to Firebase and synchronized across all devices.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleClearAll}
              className="px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors cursor-pointer"
            >
              Clear Subject
            </button>

            <button
              onClick={handleSaveAll}
              disabled={isSaving || classStudents.length === 0}
              className="flex-1 sm:flex-none px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save {activeSubject}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
