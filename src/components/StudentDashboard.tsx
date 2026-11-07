import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Student,
  Teacher,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  PublishedRecord,
  TermType,
  WebsiteConfig
} from '../types';
import { FirebaseService } from '../services/firebaseService';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import {
  GraduationCap,
  Award,
  BookOpen,
  Calendar,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  FileText,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileX2,
  FileCheck,
  Phone,
  User,
  MapPin,
  Layers,
  Camera,
  Printer
} from 'lucide-react';
import { processPassportPhoto } from '../utils/imageUpload';
import { safeStorage, safeSessionStorage } from '../utils/safeStorage';
import {
  SESSIONS_LIST,
  TERMS_LIST,
  DEFAULT_CURRENT_SESSION,
  DEFAULT_CURRENT_TERM,
  computeClassRankings,
  calculateStudentOverallAverage,
  getGradeAndRemark,
  getAuthoritativeSubjectsForClass,
  isMatchingClass,
  isMatchingStudentId,
  normalizeClassIdentifier
} from '../utils/grading';
import { StudentReportCardModal } from './StudentReportCardModal';
import { SchoolLogo } from './SchoolLogo';
import { CheckCAScore } from './CheckCAScore';

interface StudentDashboardProps {
  currentStudent: Student;
  studentsList: Student[];
  teachersList?: Teacher[];
  subjectsList: SubjectRule[];
  allScores: SubjectScore[];
  allSummaries: StudentSummary[];
  publishedRecords: PublishedRecord[];
  isClassResultPublished: (className: string, term: TermType, session: string) => boolean;
  onLogout: () => void;
  onRefreshData: () => Promise<void> | void;
  websiteConfig?: WebsiteConfig;
  onUpdateCurrentStudent?: (student: Student) => void;
}

export type ResultStatusType = 'ready_to_view' | 'in_progress' | 'not_found';
export type StudentTabType = 'result' | 'ca' | 'profile';

export interface TermResultItem {
  key: string;
  term: TermType;
  session: string;
  classLevel: string;
  status: ResultStatusType;
  isPublished: boolean;
  hasScores: boolean;
  enteredScoresCount: number;
  totalClassSubjects: number;
  enteredSubjects: string[];
  scores: SubjectScore[];
  summary?: StudentSummary;
  totalMarks: number;
  totalPossible: number;
  average: number | null;
  grade: string;
  remark: string;
  positionLabel: string;
  totalPupils: number;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentStudent,
  studentsList,
  teachersList = [],
  subjectsList,
  allScores,
  allSummaries,
  publishedRecords,
  isClassResultPublished,
  onLogout,
  onRefreshData,
  websiteConfig,
  onUpdateCurrentStudent
}) => {
  const activeSchool = websiteConfig
    ? getActiveSchoolConfig({
        schoolName: websiteConfig.schoolName,
        shortName: websiteConfig.shortName,
        motto: websiteConfig.motto,
        logoUrl: websiteConfig.logoUrl,
        campusAddress: websiteConfig.campusAddress,
        cityState: websiteConfig.cityState,
      })
    : getActiveSchoolConfig();

  // Navigation: Primary Bottom & Desktop Tabs ('result' | 'ca' | 'profile')
  const [activeTab, setActiveTab] = useState<StudentTabType>('result');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedResultKey, setExpandedResultKey] = useState<string | null>(null);

  // Auto-refresh data on student dashboard mount to catch latest releases
  useEffect(() => {
    if (onRefreshData) {
      Promise.resolve(onRefreshData()).catch((err) =>
        console.warn('Student background refresh notice:', err)
      );
    }
  }, [onRefreshData]);

  // Available Academic Sessions
  const availableSessions = useMemo(() => {
    const sessions = new Set<string>();
    if (DEFAULT_CURRENT_SESSION) sessions.add(DEFAULT_CURRENT_SESSION);
    SESSIONS_LIST.forEach((s) => sessions.add(s));
    allScores.forEach((s) => {
      if (s.Session) sessions.add(s.Session);
    });
    (publishedRecords || []).forEach((p) => {
      if (p.session) sessions.add(p.session);
    });
    return Array.from(sessions).sort().reverse();
  }, [allScores, publishedRecords]);

  // Selected Academic Session
  const [selectedSession, setSelectedSession] = useState<string>(() => {
    const studentScores = allScores.filter((s) =>
      isMatchingStudentId(s.StudentID, currentStudent.StudentID)
    );
    if (studentScores.length > 0 && studentScores[0].Session) {
      return studentScores[0].Session;
    }
    return DEFAULT_CURRENT_SESSION || '2026/2027';
  });

  // Selected Term for Continuous Assessment Tab
  const [selectedCATerm, setSelectedCATerm] = useState<TermType>(DEFAULT_CURRENT_TERM);

  // Selected Report Card for Modal View & Print
  const [selectedResultModal, setSelectedResultModal] = useState<{
    session: string;
    term: TermType;
  } | null>(null);

  // Password Change Form State
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const cleanStudentId = useMemo(() => {
    return (currentStudent.StudentID || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }, [currentStudent.StudentID]);

  // Student Passport Photo State (strictly enforced <= 100KB)
  const [studentPhoto, setStudentPhoto] = useState<string>(() => {
    const fallbackPhoto = safeStorage.getItem(`student_photo_${cleanStudentId}`) || '';
    return (
      (currentStudent.PhotoURL && currentStudent.PhotoURL.trim()) ||
      (currentStudent.PassportUrl && currentStudent.PassportUrl.trim()) ||
      (currentStudent as any)?.photoUrl ||
      fallbackPhoto
    );
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    const fallbackPhoto = safeStorage.getItem(`student_photo_${cleanStudentId}`) || '';
    const photo =
      (currentStudent.PhotoURL && currentStudent.PhotoURL.trim()) ||
      (currentStudent.PassportUrl && currentStudent.PassportUrl.trim()) ||
      (currentStudent as any)?.photoUrl ||
      fallbackPhoto;
    if (photo) {
      setStudentPhoto(photo);
    }
  }, [currentStudent.PhotoURL, currentStudent.PassportUrl, (currentStudent as any)?.photoUrl, cleanStudentId]);

  // Class classmates for ranking calculation
  const classStudents = useMemo(() => {
    return studentsList.filter((s) => isMatchingClass(s.Class, currentStudent.Class));
  }, [studentsList, currentStudent.Class]);

  // Authoritative subjects for this student's class
  const classSubjects = useMemo(() => {
    return getAuthoritativeSubjectsForClass(currentStudent.Class, subjectsList);
  }, [currentStudent.Class, subjectsList]);

  const isSecondary = useMemo(() => {
    return FirebaseService.isSecondaryClass(currentStudent.Class);
  }, [currentStudent.Class]);

  // Class Teacher or Form Master Name
  const classTeacherName = useMemo(() => {
    if (teachersList && teachersList.length > 0) {
      const match = teachersList.find((t) =>
        isMatchingClass(t.ClassAssigned, currentStudent.Class)
      );
      if (match) return match.FullName || match.Username;
    }
    return isSecondary ? 'Form Master' : 'Class Teacher';
  }, [teachersList, currentStudent.Class, isSecondary]);

  // =========================================================================
  // COMPILE ALL 3 TERMS FOR SELECTED SESSION
  // =========================================================================
  const termResultsForSession = useMemo<TermResultItem[]>(() => {
    const termsOrder: TermType[] = ['First Term', 'Second Term', 'Third Term'];

    return termsOrder.map((trm) => {
      const sess = selectedSession;
      const cleanTrm = trm.trim().toLowerCase();
      const cleanSess = sess.trim().toLowerCase().replace(/session/g, '').trim();

      // Check if published by teacher
      const cleanClass = normalizeClassIdentifier(currentStudent.Class);
      let matchedRecord: PublishedRecord | undefined;

      for (let i = (publishedRecords || []).length - 1; i >= 0; i--) {
        const r = publishedRecords[i];
        const rClass = normalizeClassIdentifier(r.className);
        const rTerm = (r.term || '').trim().toLowerCase();
        const rSess = (r.session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

        const classMatches = rClass === cleanClass || isMatchingClass(r.className, currentStudent.Class);
        const termMatches = !rTerm || !cleanTrm || rTerm === cleanTrm;
        const sessMatches = !rSess || !cleanSess || rSess === cleanSess;

        if (classMatches && termMatches && sessMatches) {
          matchedRecord = r;
          break;
        }
      }

      let isPublished = false;
      if (matchedRecord !== undefined) {
        isPublished = Boolean(matchedRecord.isPublished);
      } else {
        isPublished = Boolean(isClassResultPublished(currentStudent.Class, trm, sess));
      }

      // Find scores matching this student, session, and term
      const matchingScores = allScores.filter((s) => {
        if (!isMatchingStudentId(s.StudentID, currentStudent.StudentID)) return false;
        const sTerm = (s.Term || '').trim().toLowerCase();
        const sSess = (s.Session || '').trim().toLowerCase().replace(/session/g, '').trim();

        const termMatch = sTerm === cleanTrm || sTerm.includes(cleanTrm) || cleanTrm.includes(sTerm);
        const sessMatch =
          !sSess ||
          !cleanSess ||
          sSess === cleanSess ||
          sSess.includes(cleanSess) ||
          cleanSess.includes(sSess);

        return termMatch && sessMatch;
      });

      // Find terminal summary
      const matchingSummary = allSummaries.find((sm) => {
        if (!isMatchingStudentId(sm.StudentID, currentStudent.StudentID)) return false;
        const smTerm = (sm.Term || '').trim().toLowerCase();
        const smSess = (sm.Session || '').trim().toLowerCase().replace(/session/g, '').trim();

        const termMatch = smTerm === cleanTrm || smTerm.includes(cleanTrm) || cleanTrm.includes(smTerm);
        const sessMatch =
          !smSess ||
          !cleanSess ||
          smSess === cleanSess ||
          smSess.includes(cleanSess) ||
          cleanSess.includes(smSess);

        return termMatch && sessMatch;
      });

      // Normalize subject scores
      const normalizedScores = matchingScores.map((sc) => {
        const ca1 = sc.CA1 !== null && sc.CA1 !== undefined ? Number(sc.CA1) : null;
        const ca2 = sc.CA2 !== null && sc.CA2 !== undefined ? Number(sc.CA2) : null;
        const exam = sc.Exam !== null && sc.Exam !== undefined ? Number(sc.Exam) : null;
        let total =
          sc.Total !== null && sc.Total !== undefined && !isNaN(Number(sc.Total))
            ? Number(sc.Total)
            : null;

        if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
          total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
        }

        return {
          ...sc,
          CA1: ca1,
          CA2: ca2,
          Exam: exam,
          Total: total
        };
      });

      const meaningfulScores = normalizedScores.filter(
        (s) =>
          (typeof s.Total === 'number' && s.Total > 0) ||
          (typeof s.Exam === 'number' && s.Exam > 0) ||
          (typeof s.CA1 === 'number' && s.CA1 > 0) ||
          (typeof s.CA2 === 'number' && s.CA2 > 0) ||
          s.Total !== null ||
          s.Exam !== null ||
          s.CA1 !== null ||
          s.CA2 !== null
      );

      const hasScores = meaningfulScores.length > 0;
      const enteredSubjects = Array.from(new Set(meaningfulScores.map((s) => s.Subject)));

      const avgInfo = calculateStudentOverallAverage(
        normalizedScores.map((sc) => ({ subject: sc.Subject, total: sc.Total }))
      );
      const gradeInfo = getGradeAndRemark(avgInfo.average);

      const rankings = computeClassRankings(
        classStudents,
        allScores,
        sess,
        trm,
        classSubjects
      );
      const studentRank = rankings.find((r) =>
        isMatchingStudentId(r.student.StudentID, currentStudent.StudentID)
      );

      let status: ResultStatusType;
      if (isPublished) {
        status = 'ready_to_view';
      } else if (hasScores) {
        status = 'in_progress';
      } else {
        status = 'not_found';
      }

      return {
        key: `${sess}_${trm}`,
        term: trm,
        session: sess,
        classLevel: currentStudent.Class,
        status,
        isPublished,
        hasScores,
        enteredScoresCount: meaningfulScores.length,
        totalClassSubjects: classSubjects.length || meaningfulScores.length,
        enteredSubjects,
        scores: normalizedScores,
        summary: matchingSummary,
        totalMarks: avgInfo.totalMarks,
        totalPossible:
          classSubjects.length > 0
            ? classSubjects.length * 100
            : avgInfo.completedCount * 100 || 100,
        average: avgInfo.average,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        positionLabel: studentRank ? studentRank.positionLabel : '—',
        totalPupils: classStudents.length
      };
    });
  }, [
    selectedSession,
    currentStudent.Class,
    currentStudent.StudentID,
    isClassResultPublished,
    publishedRecords,
    allScores,
    allSummaries,
    classStudents,
    classSubjects
  ]);

  // Scores specific to CA tab
  const caScoresForSelectedTerm = useMemo(() => {
    const cleanTrm = selectedCATerm.trim().toLowerCase();
    const cleanSess = selectedSession.trim().toLowerCase().replace(/session/g, '').trim();

    const matching = allScores.filter((s) => {
      if (!isMatchingStudentId(s.StudentID, currentStudent.StudentID)) return false;
      const sTerm = (s.Term || '').trim().toLowerCase();
      const sSess = (s.Session || '').trim().toLowerCase().replace(/session/g, '').trim();

      const termMatch = sTerm === cleanTrm || sTerm.includes(cleanTrm) || cleanTrm.includes(sTerm);
      const sessMatch =
        !sSess ||
        !cleanSess ||
        sSess === cleanSess ||
        sSess.includes(cleanSess) ||
        cleanSess.includes(sSess);

      return termMatch && sessMatch;
    });

    // Merge with class subjects so all enrolled subjects appear in table
    return classSubjects.map((subjectName) => {
      const existing = matching.find(
        (m) => m.Subject.trim().toLowerCase() === subjectName.trim().toLowerCase()
      );
      const ca1 = existing?.CA1 !== null && existing?.CA1 !== undefined ? Number(existing.CA1) : null;
      const ca2 = existing?.CA2 !== null && existing?.CA2 !== undefined ? Number(existing.CA2) : null;
      const totalCA = (ca1 !== null ? ca1 : 0) + (ca2 !== null ? ca2 : 0);
      const hasAny = ca1 !== null || ca2 !== null;

      return {
        subject: subjectName,
        ca1,
        ca2,
        totalCA: hasAny ? totalCA : null,
        hasRecord: hasAny
      };
    });
  }, [allScores, currentStudent.StudentID, selectedCATerm, selectedSession, classSubjects]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshData) {
        await onRefreshData();
      }
      await new Promise((res) => setTimeout(res, 350));
    } catch (err) {
      console.error('Error refreshing portal:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshData]);

  // Passport upload handler
  const handlePassportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimeTypes.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
      setPhotoFeedback({
        type: 'error',
        message: 'Invalid image format. Please upload a JPEG, PNG, or WebP photograph.'
      });
      return;
    }

    if (file.size > 100 * 1024) {
      setPhotoFeedback({
        type: 'error',
        message: `Passport photograph must be 100KB or lower. Selected file is ${(file.size / 1024).toFixed(1)}KB.`
      });
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const dataUrl = await processPassportPhoto(file, 100 * 1024);
      setStudentPhoto(dataUrl);

      const res = await FirebaseService.saveStudent({
        ...currentStudent,
        PhotoURL: dataUrl,
        PassportUrl: dataUrl
      });

      if (res.success) {
        currentStudent.PhotoURL = dataUrl;
        currentStudent.PassportUrl = dataUrl;

        const updatedStudent: Student = {
          ...currentStudent,
          PhotoURL: dataUrl,
          PassportUrl: dataUrl
        };

        safeStorage.setItem(`student_photo_${cleanStudentId}`, dataUrl);
        safeSessionStorage.setItem('school_portal_student_auth', JSON.stringify(updatedStudent));

        if (onUpdateCurrentStudent) {
          onUpdateCurrentStudent(updatedStudent);
        }

        setPhotoFeedback({
          type: 'success',
          message: 'Passport photograph uploaded and permanently saved!'
        });
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        setPhotoFeedback({
          type: 'error',
          message: res.message || 'Failed to persist passport photo.'
        });
      }
    } catch (err: any) {
      setPhotoFeedback({
        type: 'error',
        message: err.message || 'Failed to upload passport photo.'
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Password change handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    const actualCurrentPass = currentStudent.Password || 'password';
    if (currentPasswordInput !== actualCurrentPass) {
      setPasswordFeedback({
        type: 'error',
        message: 'Current password does not match. Please verify and try again.'
      });
      return;
    }

    if (newPasswordInput.length < 4) {
      setPasswordFeedback({
        type: 'error',
        message: 'New password must be at least 4 characters long.'
      });
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordFeedback({
        type: 'error',
        message: 'New password and confirmation do not match.'
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await FirebaseService.updateStudentPassword(
        currentStudent.StudentID,
        newPasswordInput.trim()
      );
      if (res.success) {
        setPasswordFeedback({
          type: 'success',
          message: 'Your password has been changed successfully!'
        });
        currentStudent.Password = newPasswordInput.trim();
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        setPasswordFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err.message || 'Failed to update password.'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-28 text-slate-900 font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP PORTAL HEADER BAR (School Identity & Pupil Card)                   */}
      {/* ========================================================================= */}
      <header className="relative overflow-hidden bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-800">
        {/* Conditional Student Profile Picture Background with Dark Overlay */}
        {studentPhoto ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-opacity duration-300"
              style={{
                backgroundImage: `url(${studentPhoto})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
              aria-hidden="true"
            />
            {/* Clear, gentle gradient overlay so the student's photo remains distinct and vibrant */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/35 to-slate-950/20 sm:from-slate-950/55 sm:via-slate-950/30 sm:to-slate-950/15 pointer-events-none"
              aria-hidden="true"
            />
          </>
        ) : null}

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* School & Pupil Brand Lockup */}
          <div className="flex items-center gap-3.5 min-w-0">
            <SchoolLogo
              size="md"
              src={activeSchool.logoUrl}
              alt={activeSchool.schoolName}
              className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 object-contain rounded-xl bg-white p-1 shadow-md ring-1 ring-white/30"
            />
            <div className="min-w-0">
              <span className="text-xs uppercase font-bold tracking-wider text-amber-400 block truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {activeSchool.shortName || activeSchool.schoolName}
              </span>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                {currentStudent.FullName}
              </h1>
              <div className="flex items-center gap-2 text-xs text-white mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                <span className="font-mono text-amber-300 font-bold bg-slate-950/40 px-1.5 py-0.5 rounded-sm backdrop-blur-xs">
                  {currentStudent.StudentID}
                </span>
                <span aria-hidden="true">&bull;</span>
                <span className="font-semibold text-slate-100">{currentStudent.Class}</span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              id="student-refresh-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 backdrop-blur-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Sync latest live records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <button
              type="button"
              id="student-logout-btn"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-200 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 backdrop-blur-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Desktop Segmented Navigation Tabs */}
        <div className="relative z-10 mt-5 pt-4 border-t border-slate-800/80 hidden sm:flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 backdrop-blur-xs border border-slate-800 rounded-xl">
            <button
              type="button"
              id="tab-btn-result-desktop"
              onClick={() => setActiveTab('result')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'result'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span>Terminal Results</span>
            </button>

            <button
              type="button"
              id="tab-btn-ca-desktop"
              onClick={() => setActiveTab('ca')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'ca'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileCheck className="w-4 h-4 text-amber-500" />
              <span>Continuous Assessment (CA)</span>
            </button>

            <button
              type="button"
              id="tab-btn-profile-desktop"
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <User className="w-4 h-4 text-amber-500" />
              <span>Student Profile</span>
            </button>
          </div>

          <div className="text-xs text-slate-300 drop-shadow-xs">
            <span className="text-slate-400">Session: </span>
            <strong className="text-slate-100 font-mono">{selectedSession}</strong>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. TAB 1: TERMINAL RESULTS (Report Cards, Positions, Summaries)          */}
      {/* ========================================================================= */}
      {activeTab === 'result' && (
        <section aria-label="Terminal Results" className="space-y-5 animate-in fade-in duration-150">
          {/* Controls Bar: Session Selector & Clean CA Checker Trigger */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Academic Results &amp; Termly Report Sheets
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official end-of-term continuous assessment and examination records for {currentStudent.Class}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
              <CheckCAScore
                studentId={currentStudent.StudentID}
                currentTerm={DEFAULT_CURRENT_TERM}
                currentSession={selectedSession}
                enrolledSubjects={classSubjects}
              />

              <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Session:</span>
                <select
                  id="student-session-selector"
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="bg-transparent font-mono font-bold text-xs text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  {availableSessions.map((sess) => (
                    <option key={sess} value={sess}>
                      {sess}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3 Terms Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {termResultsForSession.map((termItem) => {
              const isReady = termItem.status === 'ready_to_view';
              const isInProgress = termItem.status === 'in_progress';
              const isNotFound = termItem.status === 'not_found';

              return (
                <div
                  key={termItem.key}
                  className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                    isReady
                      ? 'border-slate-300 shadow-xs'
                      : isInProgress
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-slate-200 opacity-90'
                  }`}
                >
                  <div>
                    {/* Term Header & Status Tag */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 block uppercase tracking-wider">
                          Term Assessment
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {termItem.term}
                        </h3>
                      </div>

                      {isReady && (
                        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Ready
                        </span>
                      )}
                      {isInProgress && (
                        <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          In Progress
                        </span>
                      )}
                      {isNotFound && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                          Not Released
                        </span>
                      )}
                    </div>

                    {/* Term Key Metrics */}
                    <div className="py-4 space-y-2 text-xs">
                      {isReady ? (
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Class Position</span>
                            <strong className="text-sm font-bold text-slate-900">
                              {termItem.positionLabel}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Overall Average</span>
                            <strong className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                              {termItem.average !== null ? `${termItem.average.toFixed(1)}%` : '—'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Grade</span>
                            <strong className="text-xs font-bold text-slate-800">
                              {termItem.grade || '—'} ({termItem.remark || '—'})
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Subjects</span>
                            <strong className="text-xs font-bold text-slate-800">
                              {termItem.enteredScoresCount} Recorded
                            </strong>
                          </div>
                        </div>
                      ) : isInProgress ? (
                        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-amber-900 text-xs">
                          <p className="font-semibold">Under Evaluation</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Teacher has entered {termItem.enteredScoresCount} scores. Result will appear once officially released.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-500 text-xs text-center py-5">
                          No assessment records available for this term yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="pt-2">
                    {isReady ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedResultModal({
                            session: termItem.session,
                            term: termItem.term
                          })
                        }
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>View &amp; Print Report Sheet</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs cursor-not-allowed"
                      >
                        Result Awaiting Release
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB 2: CONTINUOUS ASSESSMENT (CA Scores Tab)                          */}
      {/* ========================================================================= */}
      {activeTab === 'ca' && (
        <section aria-label="Continuous Assessment" className="space-y-5 animate-in fade-in duration-150">
          {/* Header Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Continuous Assessment (CA) Scoreboard
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Periodic test scores (CA1 and CA2) across all registered curriculum subjects
              </p>
            </div>

            {/* Term & Session Filters */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="font-semibold text-slate-600">Term:</span>
                <select
                  id="ca-tab-term-select"
                  value={selectedCATerm}
                  onChange={(e) => setSelectedCATerm(e.target.value as TermType)}
                  className="bg-transparent font-semibold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  {TERMS_LIST.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="font-semibold text-slate-600">Session:</span>
                <select
                  id="ca-tab-session-select"
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="bg-transparent font-mono font-semibold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  {availableSessions.map((sess) => (
                    <option key={sess} value={sess}>
                      {sess}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Embedded Anti-AI CA Query Card */}
          <CheckCAScore
            studentId={currentStudent.StudentID}
            currentTerm={selectedCATerm}
            currentSession={selectedSession}
            enrolledSubjects={classSubjects}
            variant="embedded"
          />

          {/* Full CA Subject Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                All Enrolled Subjects &bull; {selectedCATerm} ({selectedSession})
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                {caScoresForSelectedTerm.filter((s) => s.hasRecord).length} of {caScoresForSelectedTerm.length} subjects recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-center font-mono">CA1 (20)</th>
                    <th className="py-3 px-4 text-center font-mono">CA2 (20)</th>
                    <th className="py-3 px-4 text-center font-mono">Total CA (40)</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {caScoresForSelectedTerm.map((item) => (
                    <tr key={item.subject} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.subject}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-800">
                        {item.ca1 !== null ? item.ca1 : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-mono tabular-nums text-slate-800">
                        {item.ca2 !== null ? item.ca2 : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold tabular-nums text-slate-900">
                        {item.totalCA !== null ? (
                          `${item.totalCA} / 40`
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.hasRecord ? (
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            Recorded
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {caScoresForSelectedTerm.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No subjects registered for this class level.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 3: STUDENT PROFILE (Bio, Passport Photo, Password Change)         */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <section aria-label="Student Profile" className="space-y-5 animate-in fade-in duration-150">
          {/* Top Profile Card with Passport Upload */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Passport Photo Slot */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shadow-xs">
                  {studentPhoto ? (
                    <img
                      src={studentPhoto}
                      alt={currentStudent.FullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-slate-400" />
                  )}
                </div>

                <label
                  htmlFor="profile-passport-upload"
                  className="absolute -bottom-1 -right-1 bg-slate-900 hover:bg-slate-800 text-white p-1.5 rounded-full border-2 border-white shadow-xs cursor-pointer transition-colors"
                  title="Upload passport photograph (Max 100KB)"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <input
                    id="profile-passport-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePassportUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Identity Overview */}
              <div className="space-y-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {currentStudent.FullName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                    {currentStudent.StudentID}
                  </span>
                  <span>{currentStudent.Class}</span>
                  <span aria-hidden="true">&bull;</span>
                  <span>{currentStudent.Gender || 'Pupil'}</span>
                  <span aria-hidden="true">&bull;</span>
                  <span>{classTeacherName}</span>
                </div>
                <p className="text-xs text-slate-500 pt-1">
                  Enrolled student at {activeSchool.schoolName}
                </p>
              </div>
            </div>

            {/* Photo Feedback Notice */}
            {photoFeedback && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  photoFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {photoFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{photoFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Academic & Bio Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Academic Information */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-slate-600" />
                <span>Academic Record</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Student ID / Reg No:</span>
                  <strong className="font-mono text-slate-900">{currentStudent.StudentID}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Current Class:</span>
                  <strong className="text-slate-900">{currentStudent.Class}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">{isSecondary ? 'Form Master:' : 'Class Teacher:'}</span>
                  <strong className="text-slate-900">{classTeacherName}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Class Enrolment:</span>
                  <strong className="text-slate-900">{classStudents.length} Students</strong>
                </div>
              </div>
            </div>

            {/* Guardian & Contact */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-600" />
                <span>Guardian &amp; Contact</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Parent / Guardian:</span>
                  <strong className="text-slate-900">{currentStudent.ParentName || 'On File'}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Emergency Phone:</span>
                  <strong className="font-mono text-slate-900">{currentStudent.ParentPhone || 'On File'}</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Campus:</span>
                  <strong className="text-slate-900">{activeSchool.cityState || 'Main Campus'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Account Security & Password Change */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-600" />
              <span>Portal Password &amp; Security</span>
            </h3>

            {passwordFeedback && (
              <div
                className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{passwordFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Current password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono pr-8 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Min 4 chars"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="sm:col-span-3 pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isChangingPassword ? 'Saving Changes...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. FIXED BOTTOM NAVIGATION BAR (Thumb Ergonomics)                         */}
      {/* ========================================================================= */}
      <nav
        aria-label="Student Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 pb-safe shadow-lg"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          {/* Tab 1: Results */}
          <button
            type="button"
            id="bottom-tab-result"
            onClick={() => {
              setActiveTab('result');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`min-h-[46px] rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
              activeTab === 'result'
                ? 'text-slate-900 font-bold bg-slate-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className={`w-5 h-5 ${activeTab === 'result' ? 'text-amber-600' : 'text-slate-500'}`} />
            <span className="text-[11px] mt-0.5 tracking-tight">Results</span>
          </button>

          {/* Tab 2: CA Scores */}
          <button
            type="button"
            id="bottom-tab-ca"
            onClick={() => {
              setActiveTab('ca');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`min-h-[46px] rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
              activeTab === 'ca'
                ? 'text-slate-900 font-bold bg-slate-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck className={`w-5 h-5 ${activeTab === 'ca' ? 'text-amber-600' : 'text-slate-500'}`} />
            <span className="text-[11px] mt-0.5 tracking-tight">CA Scores</span>
          </button>

          {/* Tab 3: Profile */}
          <button
            type="button"
            id="bottom-tab-profile"
            onClick={() => {
              setActiveTab('profile');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`min-h-[46px] rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'text-slate-900 font-bold bg-slate-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-amber-600' : 'text-slate-500'}`} />
            <span className="text-[11px] mt-0.5 tracking-tight">Profile</span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 6. OFFICIAL REPORT CARD VIEW & PRINT MODAL                                */}
      {/* ========================================================================= */}
      {selectedResultModal && (
        <StudentReportCardModal
          isOpen={true}
          student={currentStudent}
          allClassStudents={classStudents}
          allScores={allScores}
          allSummaries={allSummaries}
          subjectsList={subjectsList}
          session={selectedResultModal.session}
          term={selectedResultModal.term}
          websiteConfig={websiteConfig}
          onClose={() => setSelectedResultModal(null)}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
