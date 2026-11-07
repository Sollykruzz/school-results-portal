import React, { useState, useMemo } from 'react';
import { Student, SubjectRule, SubjectScore, StudentSummary, Teacher, TermType } from '../types';
import {
  SESSIONS_LIST,
  TERMS_LIST,
  determineClassLevel,
  getSchoolIdPrefix,
  isSubjectFullyCompleted,
  isMatchingClass,
  isMatchingStudentId,
  getAuthoritativeSubjectsForClass,
  getScoringConfig
} from '../utils/grading';
import {
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  FilePlus,
  Filter,
  GraduationCap,
  RefreshCw,
  Search,
  Users,
  UserPlus,
  Trash2,
  X,
  Send,
  Lock,
  Globe,
  Loader2,
  AlertTriangle,
  CalendarPlus,
  Sparkles,
  Layers,
  History,
  Check,
  BookOpen,
  UserCheck,
  FileText,
  Table as TableIcon,
  Printer
} from 'lucide-react';
import { FirebaseService } from '../services/firebaseService';
import { QuickSubjectScoreSheet } from './QuickSubjectScoreSheet';
import { StudentReportCardModal } from './StudentReportCardModal';
import { GradingSettingsModal } from './GradingSettingsModal';
import { AttendanceRegister } from './AttendanceRegister';
import { Calendar } from 'lucide-react';

interface ClassRosterProps {
  currentTeacher: Teacher;
  students: Student[];
  allScores: SubjectScore[];
  subjectsList?: SubjectRule[];
  allSummaries?: StudentSummary[];
  session: string;
  term: TermType;
  onSessionChange: (newSession: string) => void;
  onTermChange: (newTerm: TermType) => void;
  onSelectStudent: (student: Student) => void;
  onOpenClassSummary: () => void;
  onRefreshData: () => void;
  onAddStudent?: (student: { studentId: string; fullName: string; className: string; gender: 'Male' | 'Female' }) => Promise<void>;
  onDeleteStudent?: (studentId: string) => Promise<void>;
  isLoading: boolean;
  isPublished?: boolean;
  onTogglePublish?: (isPublished: boolean) => Promise<void>;
  onOpenSubjectManager?: () => void;
}

export const ClassRoster: React.FC<ClassRosterProps> = ({
  currentTeacher,
  students,
  allScores,
  subjectsList = [],
  allSummaries = [],
  session,
  term,
  onSessionChange,
  onTermChange,
  onSelectStudent,
  onOpenClassSummary,
  onRefreshData,
  onAddStudent,
  onDeleteStudent,
  isLoading,
  isPublished = false,
  onTogglePublish,
  onOpenSubjectManager
}) => {
  const scoringConfig = getScoringConfig(session, term);
  const [activeTab, setActiveTab] = useState<'roster' | 'quick_scores' | 'subjects' | 'attendance'>('roster');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  // Quick Result Sheet Preview Modal
  const [reportModalStudent, setReportModalStudent] = useState<Student | null>(null);

  // Add Student Modal State
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentFullName, setNewStudentFullName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'Male' | 'Female'>('Male');
  const [newStudentDOB, setNewStudentDOB] = useState('');
  const [newStudentParentName, setNewStudentParentName] = useState('');
  const [newStudentParentPhone, setNewStudentParentPhone] = useState('');
  const [newStudentAddress, setNewStudentAddress] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('password');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState<string | null>(null);
  const [isGradingSettingsOpen, setIsGradingSettingsOpen] = useState(false);

  // Edit Student Modal State
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editStudentFullName, setEditStudentFullName] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editStudentGender, setEditStudentGender] = useState<'Male' | 'Female'>('Male');
  const [editStudentDOB, setEditStudentDOB] = useState('');
  const [editStudentParentName, setEditStudentParentName] = useState('');
  const [editStudentParentPhone, setEditStudentParentPhone] = useState('');
  const [editStudentAddress, setEditStudentAddress] = useState('');
  const [editStudentPassword, setEditStudentPassword] = useState('password');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);

  // Delete Student Modal State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Auto-generate suggested next Student ID when opening Add Student Modal
  const handleOpenAddStudentModal = () => {
    setAddStudentError(null);
    setNewStudentFullName('');
    setNewStudentGender('Male');
    setNewStudentDOB('');
    setNewStudentParentName('');
    setNewStudentParentPhone('');
    setNewStudentAddress('');
    setNewStudentPassword('password');

    // Recommend ID: DSS/001 (or next highest) for secondary, DNPS/0001 (or next highest) for primary
    const recommendedId = FirebaseService.getNextStudentIdPreview(students, currentTeacher.ClassAssigned);
    setNewStudentId(recommendedId);
    setShowAddStudentModal(true);
  };

  const handleOpenEditStudentModal = (student: Student) => {
    setStudentToEdit(student);
    setEditStudentError(null);
    setEditStudentFullName(student.FullName);
    setEditStudentId(student.StudentID);
    setEditStudentGender(student.Gender === 'Female' ? 'Female' : 'Male');
    setEditStudentDOB(student.DOB || '');
    setEditStudentParentName(student.ParentName || '');
    setEditStudentParentPhone(student.ParentPhone || '');
    setEditStudentAddress(student.Address || '');
    setEditStudentPassword(student.Password || 'password');
  };

  const handleConfirmEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToEdit) return;
    setEditStudentError(null);

    const cleanName = editStudentFullName.trim();
    const cleanId = editStudentId.trim().toUpperCase();

    if (!cleanName) {
      setEditStudentError('Please enter pupil full name.');
      return;
    }
    if (!cleanId) {
      setEditStudentError('Please enter student ID or Admission Number.');
      return;
    }

    if (cleanId.toLowerCase() !== studentToEdit.StudentID.trim().toLowerCase()) {
      const colliding = students.find((s) => s.StudentID.trim().toLowerCase() === cleanId.toLowerCase());
      if (colliding) {
        setEditStudentError(`Student ID "${cleanId}" is already assigned to ${colliding.FullName} (${colliding.Class}).`);
        return;
      }
    }

    setIsEditingStudent(true);
    try {
      const res = await FirebaseService.saveStudent({
        StudentID: cleanId,
        FullName: cleanName,
        Class: studentToEdit.Class,
        Gender: editStudentGender,
        DOB: editStudentDOB.trim(),
        ParentName: editStudentParentName.trim(),
        ParentPhone: editStudentParentPhone.trim(),
        Address: editStudentAddress.trim(),
        Password: editStudentPassword.trim() || 'password'
      });

      if (res.success) {
        setStudentToEdit(null);
        setPublishFeedback(`Pupil ${cleanName} (${cleanId}) updated successfully.`);
        setTimeout(() => setPublishFeedback(null), 5000);
        onRefreshData();
      } else {
        setEditStudentError(res.message);
      }
    } catch (err: any) {
      setEditStudentError(err?.message || 'Failed to update student.');
    } finally {
      setIsEditingStudent(false);
    }
  };

  const handleConfirmAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStudentError(null);

    const cleanName = newStudentFullName.trim();
    const cleanId = newStudentId.trim().toUpperCase();

    if (!cleanName) {
      setAddStudentError('Please enter pupil full name.');
      return;
    }
    if (!cleanId) {
      setAddStudentError('Please enter student ID or Admission Number.');
      return;
    }

    // Check if ID already exists
    const exists = students.some((s) => s.StudentID.toLowerCase() === cleanId.toLowerCase());
    if (exists) {
      setAddStudentError(`Student ID "${cleanId}" is already registered.`);
      return;
    }

    setIsAddingStudent(true);
    try {
      if (onAddStudent) {
        await onAddStudent({
          studentId: cleanId,
          fullName: cleanName,
          className: currentTeacher.ClassAssigned,
          gender: newStudentGender
        });
      } else {
        await FirebaseService.saveStudent({
          StudentID: cleanId,
          FullName: cleanName,
          Class: currentTeacher.ClassAssigned,
          Gender: newStudentGender,
          DOB: newStudentDOB.trim(),
          ParentName: newStudentParentName.trim(),
          ParentPhone: newStudentParentPhone.trim(),
          Address: newStudentAddress.trim(),
          Password: newStudentPassword.trim() || 'password'
        });
        onRefreshData();
      }

      setShowAddStudentModal(false);
      setPublishFeedback(`Pupil ${cleanName} (${cleanId}) was registered in ${currentTeacher.ClassAssigned}.`);
      setTimeout(() => setPublishFeedback(null), 5000);
    } catch (err: any) {
      setAddStudentError(err?.message || 'Failed to add student.');
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      if (onDeleteStudent) {
        await onDeleteStudent(studentToDelete.StudentID);
      } else {
        await FirebaseService.deleteStudent(studentToDelete.StudentID);
        onRefreshData();
      }

      setPublishFeedback(`Pupil ${studentToDelete.FullName} (${studentToDelete.StudentID}) removed from roster.`);
      setStudentToDelete(null);
      setTimeout(() => setPublishFeedback(null), 5000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // Switch / Start New Term Modal State
  const [showSwitchTermModal, setShowSwitchTermModal] = useState(false);
  const [targetSession, setTargetSession] = useState(session);
  const [targetTerm, setTargetTerm] = useState<TermType>(term);
  const [customSessionInput, setCustomSessionInput] = useState('');
  const [isCustomSession, setIsCustomSession] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  const handleOpenSwitchModal = () => {
    setTargetSession(session);
    // Suggest the logical next term
    if (term === 'First Term') {
      setTargetTerm('Second Term');
    } else if (term === 'Second Term') {
      setTargetTerm('Third Term');
    } else {
      setTargetTerm('First Term');
    }
    setIsCustomSession(false);
    setShowSwitchTermModal(true);
  };

  const handleConfirmSwitchTerm = () => {
    const finalSession = isCustomSession && customSessionInput.trim() ? customSessionInput.trim() : targetSession;
    onSessionChange(finalSession);
    onTermChange(targetTerm);
    setShowSwitchTermModal(false);
    setSwitchFeedback(
      `Switched workspace to ${finalSession} (${targetTerm}). The student roster is active with clean score entries, while all past records remain safely archived.`
    );
    setTimeout(() => setSwitchFeedback(null), 8000);
  };

  const handleConfirmPublish = async (publish: boolean) => {
    if (!onTogglePublish) return;
    setIsPublishing(true);
    try {
      await onTogglePublish(publish);
      setShowPublishModal(false);
      setPublishFeedback(
        publish
          ? `Results for ${currentTeacher.ClassAssigned} (${term}, ${session}) are now LIVE and visible to students.`
          : `Results for ${currentTeacher.ClassAssigned} (${term}, ${session}) are now set to DRAFT.`
      );
      setTimeout(() => setPublishFeedback(null), 5000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  // Strict filtering: Teacher can ONLY see students matching their ClassAssigned
  const classStudents = useMemo(() => {
    return students.filter(
      (s) => isMatchingClass(s.Class, currentTeacher.ClassAssigned)
    );
  }, [students, currentTeacher.ClassAssigned]);

  // Determine completed status for each student for the current session and term
  const studentStatusMap = useMemo(() => {
    const map = new Map<string, { isCompleted: boolean; completedSubjects: number; totalEntered: number }>();

    for (const student of classStudents) {
      const studentScores = allScores.filter(
        (s) =>
          isMatchingStudentId(s.StudentID, student.StudentID) &&
          (s.Session === session || !s.Session) &&
          s.Term === term
      );

      const fullyCompletedCount = studentScores.filter((s) =>
        isSubjectFullyCompleted(s.CA1, s.CA2, s.Exam) && s.Total !== null
      ).length;

      // Status is "Completed" if scores exist for that student for the selected term
      const hasScoresRecord = studentScores.length > 0 && fullyCompletedCount > 0;

      map.set(student.StudentID, {
        isCompleted: hasScoresRecord,
        completedSubjects: fullyCompletedCount,
        totalEntered: studentScores.length
      });
    }

    return map;
  }, [classStudents, allScores, session, term]);

  // Filter by search query and status filter
  const filteredStudents = useMemo(() => {
    return classStudents.filter((s) => {
      const statusInfo = studentStatusMap.get(s.StudentID);
      const isCompleted = statusInfo?.isCompleted || false;

      if (statusFilter === 'completed' && !isCompleted) return false;
      if (statusFilter === 'pending' && isCompleted) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.FullName.toLowerCase().includes(q) ||
        s.StudentID.toLowerCase().includes(q)
      );
    });
  }, [classStudents, searchQuery, statusFilter, studentStatusMap]);

  const authoritativeSubjectNames = useMemo(() => {
    return getAuthoritativeSubjectsForClass(currentTeacher.ClassAssigned, subjectsList);
  }, [currentTeacher.ClassAssigned, subjectsList]);

  // Summary counts
  const totalCount = classStudents.length;
  const completedCount = classStudents.filter(
    (s) => studentStatusMap.get(s.StudentID)?.isCompleted
  ).length;
  const pendingCount = totalCount - completedCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const classLevel = determineClassLevel(currentTeacher.ClassAssigned);

  return (
    <div className="space-y-4 pb-16 md:pb-6">
      {/* Standalone Class Workspace & Teacher Profile Hero Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-xs shrink-0 border border-amber-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-slate-950 tracking-tight uppercase">
                  {currentTeacher.ClassAssigned} Class Hub
                </h1>
                <span className="bg-amber-100 text-amber-900 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-300">
                  {classLevel}
                </span>
                <span className="bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md border border-slate-200">
                  {authoritativeSubjectNames.length} Subjects
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                <span className="font-semibold text-slate-900">Teacher: {currentTeacher.FullName || currentTeacher.Username}</span>
                <span>&bull;</span>
                <span className="font-mono text-slate-500">@{currentTeacher.Username}</span>
                <span>&bull;</span>
                <span className="text-amber-800 font-medium">{session} ({term})</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {/* Add Pupil Button */}
            <button
              type="button"
              id="add-student-btn"
              onClick={handleOpenAddStudentModal}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
              title="Add a new pupil to this class roster"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-200" />
              <span>Add Pupil</span>
            </button>

            {/* Switch Term Button */}
            <button
              id="switch-term-btn"
              onClick={handleOpenSwitchModal}
              className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
              title="Switch or start a new academic term & session"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-indigo-200" />
              <span>Switch Term</span>
            </button>

            {/* Publish Results Button */}
            {onTogglePublish && (
              <button
                id="toggle-publish-btn"
                onClick={() => setShowPublishModal(true)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs whitespace-nowrap shrink-0 ${
                  isPublished
                    ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                }`}
                title={isPublished ? 'Results are published. Click to manage.' : 'Results are draft. Click to publish.'}
              >
                {isPublished ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Live</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish</span>
                  </>
                )}
              </button>
            )}

            <button
              id="view-class-summary-btn"
              onClick={onOpenClassSummary}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Broadsheet</span>
            </button>

            <button
              id="refresh-roster-btn"
              onClick={onRefreshData}
              disabled={isLoading}
              className="p-2 sm:px-3 border border-slate-300 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Sync with Firebase Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-slate-900' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* Switch Term Feedback Notice Bar */}
        {switchFeedback && (
          <div className="mt-3 bg-indigo-50 border border-indigo-300 text-indigo-950 px-3.5 py-2.5 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-700 shrink-0" />
              <span className="font-semibold">{switchFeedback}</span>
            </div>
            <button onClick={() => setSwitchFeedback(null)} className="text-indigo-700 hover:text-indigo-950 text-xs font-bold ml-2">Dismiss</button>
          </div>
        )}

        {/* Publication Status Notice Bar */}
        {publishFeedback && (
          <div className="mt-3 bg-emerald-50 border border-emerald-300 text-emerald-900 px-3.5 py-2.5 rounded-lg text-xs flex items-center justify-between animate-in fade-in">
            <span className="font-semibold">{publishFeedback}</span>
            <button onClick={() => setPublishFeedback(null)} className="text-emerald-700 hover:text-emerald-950 text-xs font-bold ml-2">Dismiss</button>
          </div>
        )}

        <div className={`mt-3 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between border ${
          isPublished
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/70 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            {isPublished ? (
              <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-medium text-[11px] sm:text-xs">
              {isPublished ? (
                <><strong>Status: PUBLISHED.</strong> Pupils & parents can view their {term} report cards on the portal.</>
              ) : (
                <><strong>Status: DRAFT.</strong> Scores entered are saved securely in Firestore, but hidden from pupils until published.</>
              )}
            </span>
          </div>

          <button
            onClick={() => setShowPublishModal(true)}
            className="text-[11px] font-bold underline shrink-0 ml-2 cursor-pointer"
          >
            {isPublished ? 'Unpublish / Edit' : 'Publish Now'}
          </button>
        </div>

        {/* Academic Session & Term Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 pt-3.5">
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Academic Session
            </label>
            <select
              id="session-select"
              value={session}
              onChange={(e) => onSessionChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              {SESSIONS_LIST.map((s) => (
                <option key={s} value={s}>
                  {s} Session
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
              Academic Term
            </label>
            <select
              id="term-select"
              value={term}
              onChange={(e) => onTermChange(e.target.value as TermType)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              {TERMS_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Metrics Bar */}
          <div className="sm:col-span-2 grid grid-cols-4 gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-2 items-center text-center">
            <div className="border-r border-slate-200 pr-1">
              <span className="block text-[9px] uppercase font-bold text-slate-500">Pupils</span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900">{totalCount}</span>
            </div>
            <div className="border-r border-slate-200 pr-1">
              <span className="block text-[9px] uppercase font-bold text-emerald-700">Done</span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-700">{completedCount}</span>
            </div>
            <div className="border-r border-slate-200 pr-1">
              <span className="block text-[9px] uppercase font-bold text-amber-700">Pending</span>
              <span className="text-sm sm:text-base font-extrabold text-amber-700">{pendingCount}</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-700">Progress</span>
              <span className="text-sm sm:text-base font-extrabold text-slate-900">{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* 3 Standalone Class Page Tabs */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            id="tab-roster-btn"
            onClick={() => setActiveTab('roster')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'roster'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Pupil Roster & Report Cards ({totalCount})</span>
          </button>

          <button
            id="tab-quick-scores-btn"
            onClick={() => setActiveTab('quick_scores')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'quick_scores'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
            }`}
          >
            <TableIcon className="w-4 h-4 text-amber-700" />
            <span>⚡ Quick CA Score Sheet (Sheets Mode)</span>
          </button>

          <button
            id="tab-subjects-btn"
            onClick={() => setActiveTab('subjects')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'subjects'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Class Subjects ({authoritativeSubjectNames.length})</span>
          </button>

          <button
            id="tab-attendance-btn"
            onClick={() => setActiveTab('attendance')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>Attendance Register</span>
          </button>

          <button
            onClick={() => setIsGradingSettingsOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 ml-auto"
            title="Configure Academic Grading Scale & System Settings"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Grading Settings</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PUPIL ROSTER & REPORT CARDS */}
      {activeTab === 'roster' && (
        <>
          {/* Search & Filter Pill Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="student-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pupils by name or ID..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 text-slate-900 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Status Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    statusFilter === 'completed'
                      ? 'bg-emerald-800 text-white'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Completed ({completedCount})</span>
                </button>
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    statusFilter === 'pending'
                      ? 'bg-amber-800 text-white'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Pending ({pendingCount})</span>
                </button>
              </div>
            </div>
          </div>

          {/* MOBILE VIEW: Touch-Friendly Card List */}
          <div className="block md:hidden space-y-2.5">
            {filteredStudents.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl py-12 text-center text-slate-500 p-4 shadow-xs">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-800 text-sm">No pupils found</p>
                <p className="text-xs text-slate-500 mt-1">Try clearing your search query or add a new pupil.</p>
              </div>
            ) : (
              filteredStudents.map((student, index) => {
                const statusInfo = studentStatusMap.get(student.StudentID);
                const isCompleted = statusInfo?.isCompleted || false;
                const completedSubjects = statusInfo?.completedSubjects || 0;

                const initials = student.FullName.split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={student.StudentID}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {initials || `${index + 1}`}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-950 text-sm truncate">
                              {student.FullName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-medium">
                            <span className="font-mono text-slate-700">{student.StudentID}</span>
                            <span>&bull;</span>
                            <span>{student.Gender || 'Pupil'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onSelectStudent(student)}
                        className={`py-2 px-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                          isCompleted
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        <Edit3 className="w-3 h-3 text-amber-400" />
                        <span>{isCompleted ? 'Scores' : 'Scores'}</span>
                      </button>

                      <button
                        onClick={() => setReportModalStudent(student)}
                        className="py-2 px-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Sheet</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditStudentModal(student)}
                        className="py-2 px-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
                        title="Edit pupil profile & contact info"
                      >
                        <Edit3 className="w-3 h-3 text-slate-600" />
                        <span>Profile</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP VIEW: Data Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 text-slate-700 uppercase text-[11px] font-bold border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Pupil Full Name</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Users className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                        <p className="font-semibold text-slate-700">No pupils found</p>
                        <p className="text-xs text-slate-500 mt-0.5">Check search filter or add a new pupil.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, index) => {
                      const statusInfo = studentStatusMap.get(student.StudentID);
                      const isCompleted = statusInfo?.isCompleted || false;

                      return (
                        <tr
                          key={student.StudentID}
                          className="hover:bg-slate-50 transition-colors group"
                        >
                          <td className="py-3 px-4 text-center text-slate-400 font-medium font-mono text-[11px]">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-700">
                            {student.StudentID}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {student.FullName}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {student.Class}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded text-[11px] font-bold">
                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Enter / Edit Report Card Scores */}
                              <button
                                id={`action-btn-${student.StudentID}`}
                                onClick={() => onSelectStudent(student)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs ${
                                  isCompleted
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                                }`}
                              >
                                {isCompleted ? (
                                  <>
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Edit Scores</span>
                                  </>
                                ) : (
                                  <>
                                    <FilePlus className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Enter Scores</span>
                                  </>
                                )}
                              </button>

                              {/* View / Print Official Result Sheet */}
                              <button
                                onClick={() => setReportModalStudent(student)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer shadow-2xs"
                                title="View & Print Official Terminal Result Sheet with School Logo"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Result Sheet</span>
                              </button>

                              {/* Edit Pupil Profile */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditStudentModal(student)}
                                title={`Edit profile details for ${student.FullName}`}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Delete Pupil */}
                              <button
                                type="button"
                                onClick={() => setStudentToDelete(student)}
                                title={`Remove ${student.FullName} from roster`}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: QUICK CA SCORE SHEET (SHEETS MODE) */}
      {activeTab === 'quick_scores' && (
        <QuickSubjectScoreSheet
          currentTeacher={currentTeacher}
          classStudents={classStudents}
          authoritativeSubjects={authoritativeSubjectNames}
          allScores={allScores}
          session={session}
          term={term}
          onRefreshData={onRefreshData}
          onViewStudentReport={(student) => {
            onSelectStudent(student);
          }}
        />
      )}

      {/* TAB 3: CLASS SUBJECTS CURRICULUM */}
      {activeTab === 'subjects' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase">
                Curriculum Subjects Assigned to {currentTeacher.ClassAssigned} Alone
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total of {authoritativeSubjectNames.length} registered subjects according to official national & state curriculum.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('quick_scores')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 self-start cursor-pointer shadow-xs"
            >
              <TableIcon className="w-4 h-4" />
              <span>Open Fast Score Sheet</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {authoritativeSubjectNames.map((subjectName, i) => (
              <div
                key={subjectName}
                className="bg-slate-50 border border-slate-200 hover:border-amber-400 rounded-xl p-3.5 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      {subjectName}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Continuous Assessment: CA1 ({scoringConfig.maxCA1}) + CA2 ({scoringConfig.maxCA2}) + Exam ({scoringConfig.maxExam})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('quick_scores')}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 underline opacity-80 group-hover:opacity-100 cursor-pointer"
                >
                  Enter
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ATTENDANCE REGISTER */}
      {activeTab === 'attendance' && (
        <AttendanceRegister
          currentClass={currentTeacher.ClassAssigned}
          session={session}
          term={term}
          studentsList={students}
          currentTeacher={currentTeacher}
          onRefreshData={onRefreshData}
          onSessionChange={onSessionChange}
          onTermChange={onTermChange}
        />
      )}

      {/* Official Terminal Result Sheet Modal (Direct 1-Click Inspection with School Logo & Stamp) */}
      {reportModalStudent && (
        <StudentReportCardModal
          isOpen={true}
          onClose={() => setReportModalStudent(null)}
          student={reportModalStudent}
          allClassStudents={classStudents}
          allScores={allScores}
          allSummaries={allSummaries}
          subjectsList={subjectsList}
          session={session}
          term={term}
        />
      )}

      {/* Publish Results Confirmation Dialog */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isPublished ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {isPublished ? <AlertTriangle className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-950">
                  {isPublished ? 'Unpublish Terminal Results?' : 'Publish Results to Student Portal?'}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {currentTeacher.ClassAssigned} &bull; {term} ({session})
                </p>
              </div>
            </div>

            <div className="my-4 text-xs text-slate-600 leading-relaxed space-y-2">
              {isPublished ? (
                <>
                  <p>
                    Unpublishing will immediately <strong>hide</strong> terminal results for all pupils in <strong>{currentTeacher.ClassAssigned}</strong> from the Student Result Portal.
                  </p>
                  <p className="text-slate-500">
                    Students checking their IDs will see an "In Compilation / Under Review" notice until you publish again.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Publishing will make the official continuous assessment and terminal report cards <strong>live and visible</strong> to students and parents on the main Student Result Portal.
                  </p>
                  <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-700">
                    Currently <strong>{completedCount} of {totalCount}</strong> pupils have completed report card entries.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={isPublishing}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() => handleConfirmPublish(!isPublished)}
                disabled={isPublishing}
                className={`px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isPublished
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : isPublished ? (
                  <span>Yes, Revert to Draft</span>
                ) : (
                  <span>Yes, Publish Live Now</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Switch / Start New Academic Term Modal */}
      {showSwitchTermModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-950">
                    Switch / Start New Academic Term
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automated Workspace Rollover &bull; {currentTeacher.ClassAssigned}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSwitchTermModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Active Workspace Summary */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Active Workspace</span>
                <strong className="text-slate-900 font-bold text-xs sm:text-sm">
                  {session} &bull; {term}
                </strong>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-200">
                {completedCount} / {totalCount} Graded
              </span>
            </div>

            {/* Selection Form */}
            <div className="my-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Target Academic Session (Year)
                </label>
                <div className="space-y-2">
                  <select
                    value={isCustomSession ? '__custom__' : targetSession}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsCustomSession(true);
                      } else {
                        setIsCustomSession(false);
                        setTargetSession(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-600 cursor-pointer"
                  >
                    {SESSIONS_LIST.map((s) => (
                      <option key={s} value={s}>
                        {s} Academic Session
                      </option>
                    ))}
                    <option value="__custom__">+ Enter Custom Academic Year...</option>
                  </select>

                  {isCustomSession && (
                    <input
                      type="text"
                      value={customSessionInput}
                      onChange={(e) => setCustomSessionInput(e.target.value)}
                      placeholder="e.g. 2027/2028 or 2028/2029"
                      className="w-full bg-white border border-indigo-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Target Academic Term
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TERMS_LIST.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTargetTerm(t)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                        targetTerm === t
                          ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Automated Guarantee Explanation */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-[11px] text-indigo-950 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>How Automated Rollover Works:</span>
                </div>
                <ul className="space-y-1 text-slate-700 text-[11px] list-disc list-inside">
                  <li>
                    <strong>Past Terms Preserved:</strong> All scores and remarks from <strong>{session} ({term})</strong> remain permanently archived and available for parents to view anytime.
                  </li>
                  <li>
                    <strong>Automatic Clean Slate:</strong> The system immediately prepares a clean scoring workspace for all pupils in <strong>{currentTeacher.ClassAssigned}</strong> for the new term.
                  </li>
                  <li>
                    <strong>Zero Manual Work:</strong> You do NOT need to manually copy or duplicate spreadsheets. The system indexes everything automatically.
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowSwitchTermModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmSwitchTerm}
                className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider rounded-lg flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-600 text-white transition-colors cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Switch to {isCustomSession && customSessionInput.trim() ? customSessionInput.trim() : targetSession} &bull; {targetTerm}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Add New Pupil</h3>
                  <p className="text-xs text-slate-500">Register pupil in {currentTeacher.ClassAssigned}</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddStudent} className="space-y-3.5 pt-4">
              {addStudentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{addStudentError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentFullName}
                  onChange={(e) => setNewStudentFullName(e.target.value)}
                  placeholder="e.g. John Okonkwo"
                  className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Student ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newStudentId}
                    onChange={(e) => setNewStudentId(e.target.value)}
                    placeholder={FirebaseService.isSecondaryClass(currentTeacher.ClassAssigned) ? 'e.g. DSS/001' : 'e.g. DNPS/0001'}
                    className="w-full text-xs font-mono font-bold text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 uppercase"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Auto-recommended in sequence. You can modify this ID if needed.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gender
                  </label>
                  <select
                    value={newStudentGender}
                    onChange={(e) => setNewStudentGender(e.target.value as 'Male' | 'Female')}
                    className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    value={newStudentParentName}
                    onChange={(e) => setNewStudentParentName(e.target.value)}
                    placeholder="e.g. Mr. & Mrs. Okonkwo"
                    className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Parent Phone Number
                  </label>
                  <input
                    type="text"
                    value={newStudentParentPhone}
                    onChange={(e) => setNewStudentParentPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full text-xs font-mono text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Home Address
                </label>
                <input
                  type="text"
                  value={newStudentAddress}
                  onChange={(e) => setNewStudentAddress(e.target.value)}
                  placeholder="e.g. 14 School Road, City, State"
                  className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isAddingStudent}
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isAddingStudent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{isAddingStudent ? 'Adding...' : 'Add Pupil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {studentToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Edit Pupil Profile</h3>
                  <p className="text-xs text-slate-500">{studentToEdit.FullName} ({studentToEdit.Class})</p>
                </div>
              </div>
              <button
                onClick={() => setStudentToEdit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEditStudent} className="space-y-3.5 pt-4">
              {editStudentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editStudentError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editStudentFullName}
                  onChange={(e) => setEditStudentFullName(e.target.value)}
                  className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Student ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editStudentId}
                    onChange={(e) => setEditStudentId(e.target.value)}
                    className="w-full text-xs font-mono font-bold text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gender
                  </label>
                  <select
                    value={editStudentGender}
                    onChange={(e) => setEditStudentGender(e.target.value as 'Male' | 'Female')}
                    className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    value={editStudentParentName}
                    onChange={(e) => setEditStudentParentName(e.target.value)}
                    placeholder="e.g. Mr. & Mrs. Okonkwo"
                    className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Parent Phone Number
                  </label>
                  <input
                    type="text"
                    value={editStudentParentPhone}
                    onChange={(e) => setEditStudentParentPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full text-xs font-mono text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Home Address
                </label>
                <input
                  type="text"
                  value={editStudentAddress}
                  onChange={(e) => setEditStudentAddress(e.target.value)}
                  placeholder="e.g. 14 School Road, City, State"
                  className="w-full text-xs text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Login Password
                </label>
                <input
                  type="text"
                  value={editStudentPassword}
                  onChange={(e) => setEditStudentPassword(e.target.value)}
                  className="w-full text-xs font-mono text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isEditingStudent}
                  onClick={() => setStudentToEdit(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditingStudent}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isEditingStudent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isEditingStudent ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-slate-900 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Remove Pupil from School?</h3>
                <p className="text-xs text-slate-500">
                  {studentToDelete.FullName} ({studentToDelete.StudentID})
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-1">
              <p className="font-bold">Permanent Deletion Warning:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                <li>Removes pupil from <strong>{studentToDelete.Class}</strong> roster</li>
                <li>Deletes all associated scores across all sessions/terms</li>
                <li>Deletes teacher summaries and attendance records</li>
              </ul>
              <p className="pt-1 text-[11px] text-rose-700">
                This deletion will synchronize directly with the Google Sheet.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={handleConfirmDeleteStudent}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeletingStudent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeletingStudent ? 'Deleting...' : 'Yes, Delete Pupil'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Academic Grading Settings Modal */}
      <GradingSettingsModal
        isOpen={isGradingSettingsOpen}
        onClose={() => setIsGradingSettingsOpen(false)}
        currentUser={currentTeacher}
        session={session}
        term={term}
        allScores={allScores}
        onScalesUpdated={onRefreshData}
      />
    </div>
  );
};
