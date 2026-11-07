import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  Teacher,
  TermType,
  PublishedRecord,
  AffectiveRatings,
  PsychomotorRatings
} from '../types';
import {
  isMatchingClass,
  isMatchingStudentId,
  getAuthoritativeSubjectsForClass,
  calculateSubjectTotal,
  getGradeAndRemark,
  getScoringConfig,
  calculateStudentOverallAverage,
  computeClassRankings,
  getSchoolIdPrefix,
  normalizeClassIdentifier,
  SESSIONS_LIST,
  TERMS_LIST,
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS
} from '../utils/grading';
import { printElementDirectly } from '../utils/printHelper';
import { processPassportPhoto } from '../utils/imageUpload';
import {
  Users,
  UserCheck,
  Award,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Plus,
  Edit3,
  Trash2,
  Save,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Lock,
  Globe,
  AlertCircle,
  FileText,
  User,
  Phone,
  Camera,
  Upload,
  Check,
  Send,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Table as TableIcon,
  HeartHandshake,
  Activity
} from 'lucide-react';
import { FirebaseService } from '../services/firebaseService';
import { StudentReportCardModal } from './StudentReportCardModal';
import { SchoolLogo } from './SchoolLogo';
import { QuickSubjectScoreSheet } from './QuickSubjectScoreSheet';
import { AttendanceRegister } from './AttendanceRegister';
import { CumulativeBroadsheet } from './CumulativeBroadsheet';

interface TeacherDashboardProps {
  currentTeacher: Teacher;
  students: Student[];
  allScores: SubjectScore[];
  subjectsList: SubjectRule[];
  allSummaries: StudentSummary[];
  publishedRecords: PublishedRecord[];
  session: string;
  term: TermType;
  onSessionChange: (newSession: string) => void;
  onTermChange: (newTerm: TermType) => void;
  onRefreshData: () => Promise<void> | void;
  onAddStudent: (newStudent: {
    studentId: string;
    fullName: string;
    className: string;
    gender: 'Male' | 'Female';
  }) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
  onUpdateTeacher: (teacher: Teacher) => void;
  isLoading?: boolean;
  onOpenSubjectManager?: () => void;
  onEditingChange?: (isEditing: boolean) => void;
  onSelectStudent?: (student: Student) => void;
  onTogglePublish?: (isPublishing: boolean) => Promise<any>;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentTeacher,
  students,
  allScores,
  subjectsList,
  allSummaries,
  publishedRecords,
  session,
  term,
  onSessionChange,
  onTermChange,
  onRefreshData,
  onAddStudent,
  onDeleteStudent,
  onUpdateTeacher,
  isLoading = false,
  onOpenSubjectManager,
  onEditingChange,
  onSelectStudent,
  onTogglePublish
}) => {
  // Navigation Tabs
  // Bottom nav has 3 destinations: 'students' (Pupils), 'attendance' (Attendance),
  // and a "Result" group that contains 3 sub-tabs: 'report', 'quick_scores', 'broadsheet'.
  const [activeTab, setActiveTab] = useState<'students' | 'quick_scores' | 'attendance' | 'report' | 'broadsheet'>('students');
  const isResultGroupActive = activeTab === 'report' || activeTab === 'quick_scores' || activeTab === 'broadsheet';

  // Subject CA Sheet and Attendance are separate child components that fully
  // unmount when you leave their tab, silently discarding any unsaved local
  // state. Route every tab switch through this so the teacher gets a chance
  // to cancel first.
  const switchTab = (newTab: 'students' | 'quick_scores' | 'attendance' | 'report' | 'broadsheet') => {
    if (activeTab === 'quick_scores' && newTab !== 'quick_scores' && quickScoresDirtyRef.current) {
      if (!window.confirm('You have unsaved Subject CA Sheet scores. Leave this tab and discard them?')) return;
    }
    if (activeTab === 'attendance' && newTab !== 'attendance' && attendanceDirtyRef.current) {
      if (!window.confirm('You have unsaved attendance marks for today. Leave this tab and discard them?')) return;
    }
    setActiveTab(newTab);
  };
  const [broadsheetViewMode, setBroadsheetViewMode] = useState<'termly' | 'cumulative'>('termly');

  // Notifications & Visible Feedback
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Prominent Modal / Banner for Published / Unpublished Visible Feedback
  const [publishFeedbackModal, setPublishFeedbackModal] = useState<{
    type: 'published' | 'unpublished';
    title: string;
    message: string;
    details: string;
  } | null>(null);

  // Filter students for the current teacher's class
  const classStudents = useMemo(() => {
    const list = students.filter((s) => isMatchingClass(s.Class, currentTeacher.ClassAssigned));
    return list.sort((a, b) => a.FullName.localeCompare(b.FullName));
  }, [students, currentTeacher.ClassAssigned]);

  // Subjects for this class
  const classSubjects = useMemo(() => {
    return getAuthoritativeSubjectsForClass(currentTeacher.ClassAssigned, subjectsList);
  }, [currentTeacher.ClassAssigned, subjectsList]);

  // Publication Status for this class, term, session
  const currentPublishRecord = useMemo(() => {
    const cleanClass = normalizeClassIdentifier(currentTeacher.ClassAssigned);
    const cleanTerm = (term || '').trim().toLowerCase();
    const cleanSess = (session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

    for (let i = (publishedRecords || []).length - 1; i >= 0; i--) {
      const r = publishedRecords[i];
      const rClass = normalizeClassIdentifier(r.className);
      const rTerm = (r.term || '').trim().toLowerCase();
      const rSession = (r.session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

      const classMatches = rClass === cleanClass || isMatchingClass(r.className, currentTeacher.ClassAssigned);
      const termMatches = !rTerm || !cleanTerm || rTerm === cleanTerm;
      const sessMatches = !rSession || !cleanSess || rSession === cleanSess;

      if (classMatches && termMatches && sessMatches) {
        return r;
      }
    }
    return undefined;
  }, [publishedRecords, currentTeacher.ClassAssigned, term, session]);

  const isPublished = useMemo(() => {
    if (currentPublishRecord !== undefined) {
      return Boolean(currentPublishRecord.isPublished);
    }
    return FirebaseService.isClassResultPublished(currentTeacher.ClassAssigned, term, session);
  }, [currentPublishRecord, currentTeacher.ClassAssigned, term, session]);

  const publishStatus = useMemo(() => {
    if (isPublished) return 'approved';
    if (!currentPublishRecord) return 'draft';
    return currentPublishRecord.status || 'draft';
  }, [isPublished, currentPublishRecord]);

  // =========================================================================
  // 1. TEACHER PROFILE EDIT STATE & HANDLERS
  // =========================================================================
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(currentTeacher.FullName || '');
  const [profilePhone, setProfilePhone] = useState(currentTeacher.Phone || '');
  const [profilePhoto, setProfilePhoto] = useState(currentTeacher.PhotoURL || '');
  const [profileUsername, setProfileUsername] = useState(currentTeacher.Username || '');
  const [profilePassword, setProfilePassword] = useState(currentTeacher.Password || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    setProfileName(currentTeacher.FullName || '');
    setProfilePhone(currentTeacher.Phone || '');
    setProfilePhoto(currentTeacher.PhotoURL || '');
    setProfileUsername(currentTeacher.Username || '');
    setProfilePassword(currentTeacher.Password || '');
  }, [currentTeacher]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      showToast('Please enter your full name', 'error');
      return;
    }
    if (!profileUsername.trim()) {
      showToast('Username cannot be empty', 'error');
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await FirebaseService.updateTeacherCredentials(currentTeacher.Username, {
        Username: profileUsername.trim(),
        Password: profilePassword.trim() || currentTeacher.Password || 'password123',
        FullName: profileName.trim(),
        Phone: profilePhone.trim(),
        PhotoURL: profilePhoto.trim(),
        ClassAssigned: currentTeacher.ClassAssigned,
        Role: 'teacher'
      });
      if (res.success && res.teacher) {
        onUpdateTeacher(res.teacher);
        showToast('Teacher profile and credentials updated successfully!');
        setIsProfileModalOpen(false);
        await onRefreshData();
      } else {
        showToast(res.message || 'Failed to update profile', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG or PNG)', 'error');
      return;
    }
    if (file.size > 100 * 1024) {
      showToast(
        `Teacher photo must be 100KB or lower (selected: ${(file.size / 1024).toFixed(1)}KB)`,
        'error'
      );
      return;
    }
    try {
      const dataUrl = await processPassportPhoto(file, 100 * 1024);
      setProfilePhoto(dataUrl);
      showToast('Photo selected (under 100KB). Click "Save Profile" to persist to Firebase.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to process photo', 'error');
    }
  };

  // =========================================================================
  // 2. STUDENT CRUD (ADD, EDIT, DELETE)
  // =========================================================================
  const [studentSearch, setStudentSearch] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);

  // Student Form State
  const [studentFormName, setStudentFormName] = useState('');
  const [studentFormId, setStudentFormId] = useState('');
  const [studentFormGender, setStudentFormGender] = useState<'Male' | 'Female'>('Male');
  const [studentFormParentName, setStudentFormParentName] = useState('');
  const [studentFormParentPhone, setStudentFormParentPhone] = useState('');
  const [studentFormAddress, setStudentFormAddress] = useState('');
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  const openAddStudentModal = () => {
    setStudentFormId(FirebaseService.getNextStudentIdPreview(students, currentTeacher.ClassAssigned));
    setStudentFormName('');
    setStudentFormGender('Male');
    setStudentFormParentName('');
    setStudentFormParentPhone('');
    setStudentFormAddress('');
    setIsAddStudentOpen(true);
  };

  const openEditStudentModal = (student: Student) => {
    setEditingStudent(student);
    setStudentFormId(student.StudentID);
    setStudentFormName(student.FullName);
    setStudentFormGender((student.Gender as 'Male' | 'Female') || 'Male');
    setStudentFormParentName(student.ParentName || '');
    setStudentFormParentPhone(student.ParentPhone || '');
    setStudentFormAddress(student.Address || '');
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingStudent) return;
    if (!studentFormName.trim() || (editingStudent && !studentFormId.trim())) {
      showToast('Student Full Name and ID are required', 'error');
      return;
    }
    // Guard against ID collisions with any OTHER pupil, school-wide — only when editing
    if (editingStudent) {
      const targetId = studentFormId.trim().toLowerCase();
      const collidingStudent = students.find(
        (s) =>
          s.StudentID.trim().toLowerCase() === targetId &&
          s.StudentID.trim().toLowerCase() !== editingStudent.StudentID.trim().toLowerCase()
      );
      if (collidingStudent) {
        showToast(
          `Student ID "${studentFormId.trim()}" is already used by ${collidingStudent.FullName} (${collidingStudent.Class}). Please choose a different ID.`,
          'error'
        );
        return;
      }
    }
    setIsSavingStudent(true);
    try {
      if (editingStudent) {
        // Edit existing student
        const res = await FirebaseService.saveStudent({
          StudentID: studentFormId.trim(),
          FullName: studentFormName.trim(),
          Class: currentTeacher.ClassAssigned,
          Gender: studentFormGender,
          ParentName: studentFormParentName.trim(),
          ParentPhone: studentFormParentPhone.trim(),
          Address: studentFormAddress.trim()
        });
        if (res.success) {
          showToast(`Student ${studentFormName} updated successfully!`);
          setEditingStudent(null);
          await onRefreshData();
        } else {
          showToast(res.message || 'Failed to update student', 'error');
        }
      } else {
        // Add new student with atomic auto-assigned next school-wide ID (or user modified ID)
        const res = await FirebaseService.createStudentWithNextId({
          studentId: studentFormId.trim(),
          fullName: studentFormName,
          className: currentTeacher.ClassAssigned,
          gender: studentFormGender,
          parentName: studentFormParentName,
          parentPhone: studentFormParentPhone,
          address: studentFormAddress
        });
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
        showToast(`${studentFormName.trim()} enrolled successfully. Student ID: ${res.student?.StudentID || ''}`);
        setIsAddStudentOpen(false);
        await onRefreshData();
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving student', 'error');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    setIsSavingStudent(true);
    try {
      await onDeleteStudent(deletingStudent.StudentID);
      showToast(`Student ${deletingStudent.FullName} deleted.`);
      setDeletingStudent(null);
      await onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error deleting student', 'error');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return classStudents;
    const q = studentSearch.toLowerCase();
    return classStudents.filter(
      (s) => s.FullName.toLowerCase().includes(q) || s.StudentID.toLowerCase().includes(q)
    );
  }, [classStudents, studentSearch]);

  // =========================================================================
  // 4. SIMPLEST REPORT CARD SYSTEM STATE & HANDLERS
  // =========================================================================
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return classStudents[0]?.StudentID || '';
  });

  // Keep selectedStudentId valid
  useEffect(() => {
    if (classStudents.length > 0 && !classStudents.some((s) => s.StudentID === selectedStudentId)) {
      setSelectedStudentId(classStudents[0].StudentID);
    }
  }, [classStudents, selectedStudentId]);

  const activeStudent = useMemo(() => {
    return classStudents.find((s) => s.StudentID === selectedStudentId) || classStudents[0] || null;
  }, [classStudents, selectedStudentId]);

  // Scores state for the selected student: Subject -> { ca1: number | null, ca2: number | null, exam: number | null }
  const [studentSubjectScores, setStudentSubjectScores] = useState<
    Record<string, { ca1: number | null; ca2: number | null; exam: number | null }>
  >({});
  const [teacherCommentInput, setTeacherCommentInput] = useState('');
  const [principalCommentInput, setPrincipalCommentInput] = useState('');
  const [daysPresentInput, setDaysPresentInput] = useState<number | null>(null);
  const [daysOpenedScoreInput, setDaysOpenedScoreInput] = useState<number | null>(60);
  const [affectiveRatings, setAffectiveRatings] = useState<AffectiveRatings>({
    punctuality: 5, neatness: 5, politeness: 5, honesty: 5,
    relationshipWithPeers: 5, leadership: 4, attentiveness: 4,
    perseverance: 4, selfControl: 4
  });
  const [psychomotorRatings, setPsychomotorRatings] = useState<PsychomotorRatings>({
    handwriting: 4, sports: 4, drawingCrafts: 4,
    musicalSkills: 4, practicalSkills: 4, fluencySpeaking: 4
  });
  const [promotionDecision, setPromotionDecision] = useState<string>('');
  const [isSavingScores, setIsSavingScores] = useState(false);
  const [previewReportCardStudent, setPreviewReportCardStudent] = useState<Student | null>(null);

  // Unsaved changes & Draft protection
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const currentStudentIdRef = useRef<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Synchronize isDirtyRef and report editing state
  const quickScoresDirtyRef = useRef(false);
  const attendanceDirtyRef = useRef(false);

  const notifyEditingState = useCallback(() => {
    onEditingChange?.(isDirtyRef.current || quickScoresDirtyRef.current || attendanceDirtyRef.current);
  }, [onEditingChange]);

  const handleQuickScoresEditingChange = useCallback((editing: boolean) => {
    quickScoresDirtyRef.current = editing;
    notifyEditingState();
  }, [notifyEditingState]);

  const handleAttendanceEditingChange = useCallback((editing: boolean) => {
    attendanceDirtyRef.current = editing;
    notifyEditingState();
  }, [notifyEditingState]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
    notifyEditingState();
  }, [isDirty, notifyEditingState]);

  // Prevent accidental window unload or tab close when entering results
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = 'You have unsaved score entries. Are you sure you want to leave without saving?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const getScoreDraftKey = (studentId: string, sess: string, trm: string) =>
    `school_score_draft_${studentId.toLowerCase().trim()}_${sess.trim()}_${trm.trim()}`;

  const saveDraftToStorage = useCallback(
    (
      studentId: string,
      targetSession: string,
      targetTerm: TermType,
      scores: Record<string, { ca1: number | null; ca2: number | null; exam: number | null }>,
      teacherComment: string,
      principalComment: string,
      daysPresent: number | null,
      daysOpened: number | null
    ) => {
      try {
        const key = getScoreDraftKey(studentId, targetSession, targetTerm);
        const draft = {
          studentId,
          session: targetSession,
          term: targetTerm,
          scores,
          teacherComment,
          principalComment,
          daysPresent,
          daysOpened,
          timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(draft));
      } catch (e) {
        console.warn('Could not cache score draft:', e);
      }
    },
    []
  );

  const removeDraftFromStorage = useCallback((studentId: string, targetSession: string, targetTerm: TermType) => {
    try {
      localStorage.removeItem(getScoreDraftKey(studentId, targetSession, targetTerm));
    } catch {}
  }, []);

  const loadScoresFromDatabase = useCallback(
    (student: Student) => {
      const map: Record<string, { ca1: number | null; ca2: number | null; exam: number | null }> = {};
      classSubjects.forEach((subName) => {
        const found = allScores.find(
          (sc) =>
            isMatchingStudentId(sc.StudentID, student.StudentID) &&
            sc.Term === term &&
            (sc.Session === session || !sc.Session) &&
            sc.Subject.toLowerCase().trim() === subName.toLowerCase().trim()
        );
        if (found) {
          map[subName] = {
            ca1: found.CA1 !== undefined && found.CA1 !== null ? Number(found.CA1) : null,
            ca2: found.CA2 !== undefined && found.CA2 !== null ? Number(found.CA2) : null,
            exam: found.Exam !== undefined && found.Exam !== null ? Number(found.Exam) : null
          };
        } else {
          map[subName] = { ca1: null, ca2: null, exam: null };
        }
      });
      setStudentSubjectScores(map);

      // Summary (comments & attendance)
      const sum = allSummaries.find(
        (sm) =>
          isMatchingStudentId(sm.StudentID, student.StudentID) &&
          sm.Term === term &&
          (sm.Session === session || !sm.Session)
      );
      if (sum) {
        setTeacherCommentInput(sum.TeacherComment || '');
        setPrincipalCommentInput(sum.PrincipalComment || '');
        setDaysPresentInput(sum.DaysPresent !== undefined ? sum.DaysPresent : null);
        setDaysOpenedScoreInput(sum.DaysOpened !== undefined ? sum.DaysOpened : 60);
        setAffectiveRatings({
          punctuality: 5, neatness: 5, politeness: 5, honesty: 5,
          relationshipWithPeers: 5, leadership: 4, attentiveness: 4,
          perseverance: 4, selfControl: 4,
          ...(sum.AffectiveRatings || {})
        });
        setPsychomotorRatings({
          handwriting: 4, sports: 4, drawingCrafts: 4,
          musicalSkills: 4, practicalSkills: 4, fluencySpeaking: 4,
          ...(sum.PsychomotorRatings || {})
        });
        setPromotionDecision(sum.PromotionDecision || (term === 'Third Term' ? 'Promoted' : ''));
      } else {
        setTeacherCommentInput('');
        setPrincipalCommentInput('');
        setDaysPresentInput(null);
        setDaysOpenedScoreInput(60);
        setAffectiveRatings({
          punctuality: 5, neatness: 5, politeness: 5, honesty: 5,
          relationshipWithPeers: 5, leadership: 4, attentiveness: 4,
          perseverance: 4, selfControl: 4
        });
        setPsychomotorRatings({
          handwriting: 4, sports: 4, drawingCrafts: 4,
          musicalSkills: 4, practicalSkills: 4, fluencySpeaking: 4
        });
        setPromotionDecision(term === 'Third Term' ? 'Promoted' : '');
      }
    },
    [allScores, allSummaries, classSubjects, session, term]
  );

  // Load existing scores or restored draft for the active student
  useEffect(() => {
    if (!activeStudent) {
      setStudentSubjectScores({});
      currentStudentIdRef.current = null;
      setIsDirty(false);
      isDirtyRef.current = false;
      return;
    }

    // CRITICAL: If the teacher is currently filling data for this student, DO NOT OVERWRITE with background polling!
    if (isDirtyRef.current && currentStudentIdRef.current === activeStudent.StudentID) {
      return;
    }

    // Check if there is an uncommitted local draft for this student
    const draftKey = getScoreDraftKey(activeStudent.StudentID, session, term);
    let loadedFromDraft = false;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.scores) {
          setStudentSubjectScores(parsed.scores);
          setTeacherCommentInput(parsed.teacherComment || '');
          setPrincipalCommentInput(parsed.principalComment || '');
          setDaysPresentInput(parsed.daysPresent !== undefined ? parsed.daysPresent : null);
          setDaysOpenedScoreInput(parsed.daysOpened !== undefined ? parsed.daysOpened : 60);

          // Drafts predate Affective/Psychomotor/Promotion — pull those 3 fields
          // from the database directly so they don't carry over from whichever
          // student was viewed previously.
          const draftSum = allSummaries.find(
            (sm) =>
              isMatchingStudentId(sm.StudentID, activeStudent.StudentID) &&
              sm.Term === term &&
              (sm.Session === session || !sm.Session)
          );
          setAffectiveRatings({
            punctuality: 5, neatness: 5, politeness: 5, honesty: 5,
            relationshipWithPeers: 5, leadership: 4, attentiveness: 4,
            perseverance: 4, selfControl: 4,
            ...(draftSum?.AffectiveRatings || {})
          });
          setPsychomotorRatings({
            handwriting: 4, sports: 4, drawingCrafts: 4,
            musicalSkills: 4, practicalSkills: 4, fluencySpeaking: 4,
            ...(draftSum?.PsychomotorRatings || {})
          });
          setPromotionDecision(draftSum?.PromotionDecision || (term === 'Third Term' ? 'Promoted' : ''));

          setIsDirty(true);
          isDirtyRef.current = true;
          setHasRestoredDraft(true);
          loadedFromDraft = true;
        }
      }
    } catch {}

    if (!loadedFromDraft) {
      loadScoresFromDatabase(activeStudent);
      setIsDirty(false);
      isDirtyRef.current = false;
      setHasRestoredDraft(false);
    }

    currentStudentIdRef.current = activeStudent.StudentID;
  }, [activeStudent, classSubjects, allScores, allSummaries, term, session, loadScoresFromDatabase]);

  const scoringConfig = useMemo(() => getScoringConfig(session, term), [session, term]);
  const maxCa1 = scoringConfig.maxCA1;
  const maxCa2 = scoringConfig.maxCA2;
  const maxExam = scoringConfig.maxExam;

  // Handle score change for a subject with dynamic score limits
  const handleScoreChange = (
    subjectName: string,
    field: 'ca1' | 'ca2' | 'exam',
    valueStr: string
  ) => {
    let val: number | null = null;
    if (valueStr.trim() !== '') {
      const num = Number(valueStr);
      if (!isNaN(num)) {
        const maxLimit = field === 'ca1' ? maxCa1 : field === 'ca2' ? maxCa2 : maxExam;
        val = Math.min(maxLimit, Math.max(0, num));
      }
    }
    const updated = {
      ...studentSubjectScores,
      [subjectName]: {
        ...(studentSubjectScores[subjectName] || { ca1: null, ca2: null, exam: null }),
        [field]: val
      }
    };
    setStudentSubjectScores(updated);
    setIsDirty(true);
    isDirtyRef.current = true;

    if (activeStudent) {
      saveDraftToStorage(
        activeStudent.StudentID,
        session,
        term,
        updated,
        teacherCommentInput,
        principalCommentInput,
        daysPresentInput,
        daysOpenedScoreInput
      );
    }
  };

  const handleTeacherCommentChange = (val: string) => {
    setTeacherCommentInput(val);
    setIsDirty(true);
    isDirtyRef.current = true;
    if (activeStudent) {
      saveDraftToStorage(
        activeStudent.StudentID,
        session,
        term,
        studentSubjectScores,
        val,
        principalCommentInput,
        daysPresentInput,
        daysOpenedScoreInput
      );
    }
  };

  const handlePrincipalCommentChange = (val: string) => {
    setPrincipalCommentInput(val);
    setIsDirty(true);
    isDirtyRef.current = true;
    if (activeStudent) {
      saveDraftToStorage(
        activeStudent.StudentID,
        session,
        term,
        studentSubjectScores,
        teacherCommentInput,
        val,
        daysPresentInput,
        daysOpenedScoreInput
      );
    }
  };

  const handleDaysPresentChange = (val: number | null) => {
    setDaysPresentInput(val);
    setIsDirty(true);
    isDirtyRef.current = true;
    if (activeStudent) {
      saveDraftToStorage(
        activeStudent.StudentID,
        session,
        term,
        studentSubjectScores,
        teacherCommentInput,
        principalCommentInput,
        val,
        daysOpenedScoreInput
      );
    }
  };

  const handleDaysOpenedChange = (val: number | null) => {
    setDaysOpenedScoreInput(val);
    setIsDirty(true);
    isDirtyRef.current = true;
    if (activeStudent) {
      saveDraftToStorage(
        activeStudent.StudentID,
        session,
        term,
        studentSubjectScores,
        teacherCommentInput,
        principalCommentInput,
        daysPresentInput,
        val
      );
    }
  };

  const handleAffectiveRatingChange = (key: string, val: number) => {
    setAffectiveRatings((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const handlePsychomotorRatingChange = (key: string, val: number) => {
    setPsychomotorRatings((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const handlePromotionDecisionChange = (val: string) => {
    setPromotionDecision(val);
    setIsDirty(true);
    isDirtyRef.current = true;
  };

  const handleDiscardDraft = () => {
    if (!activeStudent) return;
    removeDraftFromStorage(activeStudent.StudentID, session, term);
    setHasRestoredDraft(false);
    setIsDirty(false);
    isDirtyRef.current = false;
    loadScoresFromDatabase(activeStudent);
    showToast('Unsaved draft discarded and reverted to database records.');
  };

  // Real-time compiled totals for the current active student
  const compiledCurrentStudent = useMemo(() => {
    if (!activeStudent) return null;
    let totalMarks = 0;
    let totalPossible = 0;
    let enteredCount = 0;

    classSubjects.forEach((subName) => {
      const sc = studentSubjectScores[subName] || { ca1: null, ca2: null, exam: null };
      const ca1 = sc.ca1 !== null ? sc.ca1 : 0;
      const ca2 = sc.ca2 !== null ? sc.ca2 : 0;
      const exam = sc.exam !== null ? sc.exam : 0;
      const hasEntry = sc.ca1 !== null || sc.ca2 !== null || sc.exam !== null;
      if (hasEntry) {
        totalMarks += ca1 + ca2 + exam;
        totalPossible += 100;
        enteredCount++;
      }
    });

    const average = totalPossible > 0 ? Number(((totalMarks / totalPossible) * 100).toFixed(1)) : null;

    // Default remarks based on average
    let autoRemark = 'Good performance. Keep putting in your best.';
    if (average !== null) {
      if (average >= 80) autoRemark = 'An exceptionally brilliant and commendable academic performance. Excellent!';
      else if (average >= 70) autoRemark = 'A very good and admirable academic performance. Keep it up!';
      else if (average >= 60) autoRemark = 'A good effort with commendable consistency. Strive for higher laurels.';
      else if (average >= 50) autoRemark = 'A satisfactory result with great room for improvement.';
      else autoRemark = 'Below expected benchmark. Needs intensive academic coaching and focused study.';
    }

    // Dynamic Class Position calculation
    const classRankings = computeClassRankings(classStudents, allScores, session, term, classSubjects);
    const myRank = classRankings.find((r) => isMatchingStudentId(r.student.StudentID, activeStudent.StudentID));
    const positionLabel = myRank ? myRank.positionLabel : 'Pending';

    return {
      totalMarks,
      totalPossible,
      average,
      enteredCount,
      autoRemark,
      positionLabel,
      totalPupils: classStudents.length
    };
  }, [activeStudent, classSubjects, studentSubjectScores, classStudents, allScores, term, session]);

  // Save Report Card for Active Student
  const handleSaveReportCard = async () => {
    if (!activeStudent) return;
    setIsSavingScores(true);
    try {
      const scoresPayload = classSubjects.map((subName) => {
        const entry = studentSubjectScores[subName] || { ca1: null, ca2: null, exam: null };
        const ca1 = entry.ca1 !== null ? Number(entry.ca1) : null;
        const ca2 = entry.ca2 !== null ? Number(entry.ca2) : null;
        const exam = entry.exam !== null ? Number(entry.exam) : null;
        let total = null;
        if (ca1 !== null || ca2 !== null || exam !== null) {
          total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
        }
        return {
          studentId: activeStudent.StudentID,
          subject: subName,
          ca1: ca1,
          ca2: ca2,
          exam: exam,
          total: total
        };
      });

      // Save Student Summary (remarks & attendance) + Subject Scores atomically with field-level merging
      const teacherComment = teacherCommentInput.trim() || compiledCurrentStudent?.autoRemark || 'Good effort.';
      const principalComment =
        principalCommentInput.trim() ||
        (compiledCurrentStudent?.average && compiledCurrentStudent.average >= 70
          ? 'A very impressive result. Approved for commendation.'
          : 'Approved.');

      const saveResult = await FirebaseService.saveStudentReportCard({
        studentId: activeStudent.StudentID,
        session,
        term,
        scores: scoresPayload.map((s) => ({
          Subject: s.subject,
          CA1: s.ca1,
          CA2: s.ca2,
          Exam: s.exam,
          Total: s.total
        })),
        summary: {
          DaysPresent: daysPresentInput,
          DaysOpened: daysOpenedScoreInput || 60,
          TeacherComment: teacherComment,
          PrincipalComment: principalComment,
          AffectiveRatings: affectiveRatings,
          PsychomotorRatings: psychomotorRatings,
          PromotionDecision: promotionDecision.trim()
        },
        affectiveRatings,
        psychomotorRatings,
        promotionDecision: promotionDecision.trim()
      });

      if (!saveResult.success) {
        throw new Error(saveResult.message || 'Failed to save report card');
      }

      // Successfully saved (or queued offline) - remove draft and clear dirty status
      removeDraftFromStorage(activeStudent.StudentID, session, term);
      setIsDirty(false);
      isDirtyRef.current = false;
      setHasRestoredDraft(false);

      showToast(
        saveResult.queuedOffline
          ? `Saved to Offline Queue for ${activeStudent.FullName} — will auto-sync when online!`
          : `Results compiled and saved for ${activeStudent.FullName}!`
      );
      await onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Error saving report card', 'error');
    } finally {
      setIsSavingScores(false);
    }
  };

  // Navigate to Next/Previous Pupil in Report Card View
  const handleNavigatePupil = (direction: 'next' | 'prev') => {
    const currentIndex = classStudents.findIndex((s) => s.StudentID === selectedStudentId);
    if (currentIndex === -1) return;
    if (direction === 'next' && currentIndex < classStudents.length - 1) {
      setSelectedStudentId(classStudents[currentIndex + 1].StudentID);
    } else if (direction === 'prev' && currentIndex > 0) {
      setSelectedStudentId(classStudents[currentIndex - 1].StudentID);
    }
  };

  // =========================================================================
  // 5. PUBLICATION & ADMIN APPROVAL WORKFLOW
  // =========================================================================
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [publishModalAction, setPublishModalAction] = useState<'publish' | 'unpublish' | null>(null);

  // Teacher Publishes Class Results Immediately (No Admin Approval Required)
  const handlePublishNow = () => {
    if (classStudents.length === 0) {
      showToast(
        `Cannot publish: No pupils are currently enrolled in ${currentTeacher.ClassAssigned}. Please add or enroll pupils first in the Pupils Roster tab.`,
        'error'
      );
      return;
    }
    setPublishModalAction('publish');
  };

  // Teacher Unpublishes Class Results (in case changes need to be made)
  const handleUnpublish = () => {
    setPublishModalAction('unpublish');
  };

  // Execute publication to Firebase and in-memory cache
  const handleConfirmPublish = async () => {
    setPublishModalAction(null);
    setIsSubmittingApproval(true);
    try {
      let res;
      if (onTogglePublish) {
        res = await onTogglePublish(true);
      } else {
        res = await FirebaseService.setClassPublishStatus(
          currentTeacher.ClassAssigned,
          term,
          session,
          true, // Published immediately!
          currentTeacher.FullName || currentTeacher.Username,
          {
            status: 'approved',
            teacherSubmitted: true,
            teacherSubmittedBy: currentTeacher.FullName || currentTeacher.Username,
            adminApproved: true,
            adminApprovedBy: currentTeacher.FullName || currentTeacher.Username
          }
        );
      }
      if (res && res.success) {
        await onRefreshData();

        // Prominent Visible Feedback Modal & Notification
        setPublishFeedbackModal({
          type: 'published',
          title: 'Result Published',
          message: `Results for ${currentTeacher.ClassAssigned} (${term}, ${session}) are now PUBLISHED and immediately available on the Student Portal!`,
          details: `All ${classStudents.length} enrolled pupils and their parents can now log into the Student Portal to view their terminal results, examination grades, ranked positions, and print official report cards.`
        });
        showToast(`Result Published! Available on Student Portal immediately.`, 'success');
      } else {
        showToast(res?.message || 'Failed to publish results', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error publishing results', 'error');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Execute unpublishing
  const handleConfirmUnpublish = async () => {
    setPublishModalAction(null);
    setIsSubmittingApproval(true);
    try {
      let res;
      if (onTogglePublish) {
        res = await onTogglePublish(false);
      } else {
        res = await FirebaseService.setClassPublishStatus(
          currentTeacher.ClassAssigned,
          term,
          session,
          false, // Unpublished!
          currentTeacher.FullName || currentTeacher.Username,
          {
            status: 'draft',
            teacherSubmitted: false,
            adminApproved: false
          }
        );
      }
      if (res && res.success) {
        await onRefreshData();

        // Prominent Visible Feedback Modal & Notification
        setPublishFeedbackModal({
          type: 'unpublished',
          title: 'Result Unpublished',
          message: `Results for ${currentTeacher.ClassAssigned} (${term}, ${session}) have been UNPUBLISHED and taken down from the Student Portal.`,
          details: `Class results are now reverted to Unpublished Draft mode. Pupils cannot view or print their report cards on the portal while you make score corrections.`
        });
        showToast(`Result Unpublished! Results taken down from Student Portal.`, 'success');
      } else {
        showToast(res?.message || 'Failed to unpublish results', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error unpublishing results', 'error');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  // Class broadsheet rankings
  const classBroadsheetRankings = useMemo(() => {
    return computeClassRankings(classStudents, allScores, session, term, classSubjects);
  }, [classStudents, allScores, session, term, classSubjects]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ========================================================================= */}
      {/* FLOATING NOTIFICATION TOAST */}
      {/* ========================================================================= */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-900/95 text-emerald-100 border-emerald-700'
              : 'bg-rose-900/95 text-rose-100 border-rose-700'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TEACHER PROFILE & CLASS HEADER CARD */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Teacher Profile Info */}
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              {currentTeacher.PhotoURL ? (
                <img
                  src={currentTeacher.PhotoURL}
                  alt={currentTeacher.FullName || 'Teacher'}
                  className="w-16 h-16 md:w-20 md:md:h-20 rounded-2xl object-cover border-2 border-amber-400 shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-amber-100 text-amber-900 border-2 border-amber-300 flex items-center justify-center font-black text-2xl font-serif shadow-sm">
                  {(currentTeacher.FullName || currentTeacher.Username).charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                title="Edit teacher photo & profile"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-md border border-white cursor-pointer transition-transform group-hover:scale-110"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-serif break-words">
                  {currentTeacher.FullName || 'Staff Teacher'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  {currentTeacher.ClassAssigned}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-600 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentTeacher.Phone || 'No phone set'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-800">{classStudents.length} Pupils Enrolled</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer text-xs"
                >
                  Edit Profile
                </button>
                {onOpenSubjectManager && (
                  <button
                    type="button"
                    onClick={onOpenSubjectManager}
                    className="text-slate-600 hover:text-slate-900 font-bold underline cursor-pointer text-xs"
                  >
                    Manage Subjects
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right: Academic Term & Session Controls & Publication Status — Result tab only */}
          {isResultGroupActive && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Term & Session Selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-xs">
              <select
                value={term}
                onChange={(e) => onTermChange(e.target.value as TermType)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {TERMS_LIST.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={session}
                onChange={(e) => onSessionChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {SESSIONS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Publication Status & Action */}
            <div className="flex items-center gap-2">
              {isPublished ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Published &amp; Live</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleUnpublish}
                    disabled={isSubmittingApproval}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 hover:text-rose-900 border border-rose-200 bg-white hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1"
                    title="Unpublish to edit scores or hide from students"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                    <span>Unpublish</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handlePublishNow}
                  disabled={isSubmittingApproval}
                  className="px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer transform active:scale-98 disabled:opacity-60"
                  title="Publish results immediately to students"
                >
                  {isSubmittingApproval ? (
                    <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-950" />
                  )}
                  <span>{isSubmittingApproval ? 'Publishing...' : 'Publish Now'}</span>
                </button>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Notice Banner: Prominent Live Result Visibility State — Result tab only */}
        {isResultGroupActive && (
        <div
          id="teacher-publish-status-banner"
          className={`mt-4 p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
            isPublished
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
              : 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isPublished
                  ? 'bg-emerald-200/80 text-emerald-800'
                  : 'bg-amber-200/80 text-amber-800'
              }`}
            >
              {isPublished ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              ) : (
                <EyeOff className="w-5 h-5 text-amber-700" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <strong className={`font-black uppercase tracking-wider text-[11px] ${
                  isPublished ? 'text-emerald-900' : 'text-amber-900'
                }`}>
                  {isPublished ? '✓ Result Published & Live on Student Portal' : '⚠️ Result Unpublished (Draft Mode)'}
                </strong>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isPublished
                      ? 'bg-emerald-200 text-emerald-900 border border-emerald-400'
                      : 'bg-amber-200 text-amber-900 border border-amber-400'
                  }`}
                >
                  {isPublished ? 'Live for Students' : 'Hidden from Students'}
                </span>
              </div>
              <p className={`mt-0.5 leading-relaxed text-[11px] ${
                isPublished ? 'text-emerald-800' : 'text-amber-800'
              }`}>
                {isPublished
                  ? `Report cards for ${currentTeacher.ClassAssigned} (${term}, ${session}) are published. All ${classStudents.length} pupils can now log in and view or print their report cards.`
                  : `Results for ${currentTeacher.ClassAssigned} (${term}, ${session}) are currently unpublished and hidden from the Student Portal while you enter or correct scores.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {isPublished ? (
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={isSubmittingApproval}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
                title="Take down results from Student Portal"
              >
                <EyeOff className="w-3.5 h-3.5 text-rose-600" />
                <span>Unpublish Results</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublishNow}
                disabled={isSubmittingApproval}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all transform active:scale-98 disabled:opacity-50"
                title="Publish results immediately to Student Portal"
              >
                <Globe className="w-3.5 h-3.5 text-slate-950" />
                <span>Publish Result Now</span>
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* RESULT SUB-TABS — only shown while inside the Result group */}
      {/* ========================================================================= */}
      {isResultGroupActive && (
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-sm">
        <button
          type="button"
          onClick={() => switchTab('report')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'report'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>Enter Scores</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('quick_scores')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'quick_scores'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
          title="Fast Continuous Assessment entry by subject for the entire class"
        >
          <TableIcon className="w-4 h-4 text-emerald-400" />
          <span>Subject CA Sheet</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('broadsheet')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'broadsheet'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <TableIcon className="w-4 h-4 text-sky-400" />
          <span>Broadsheet &amp; Rankings</span>
        </button>
      </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: PUPILS ROSTER (CRUD) */}
      {/* ========================================================================= */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search pupil by name or ID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
              />
            </div>

            <button
              type="button"
              onClick={openAddStudentModal}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Pupil</span>
            </button>
          </div>

          {/* Pupils Cards Grid */}
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              <p className="font-bold text-slate-700 text-sm">No pupils found in {currentTeacher.ClassAssigned}</p>
              <p className="mt-1 text-slate-500">Click &quot;Add New Pupil&quot; to enroll your first student.</p>
              <button
                type="button"
                onClick={openAddStudentModal}
                className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg cursor-pointer"
              >
                Enroll Pupil Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map((pupil, idx) => {
                // Check score count
                const studentScores = allScores.filter(
                  (s) =>
                    isMatchingStudentId(s.StudentID, pupil.StudentID) &&
                    s.Term === term &&
                    (s.Session === session || !s.Session)
                );
                const hasScores = studentScores.some(
                  (s) => (s.Total !== null && s.Total > 0) || s.CA1 !== null || s.Exam !== null
                );

                return (
                  <div
                    key={pupil.StudentID}
                    className="bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-all p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      {/* Pupil Card Header */}
                      <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                              pupil.Gender === 'Female'
                                ? 'bg-pink-100 text-pink-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {pupil.FullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm truncate">{pupil.FullName}</h3>
                            <span className="font-mono text-[11px] text-slate-500 font-medium">
                              {pupil.StudentID}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            hasScores
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {hasScores ? 'Graded' : 'Pending'}
                        </span>
                      </div>

                      {/* Pupil Card Details */}
                      <div className="space-y-1 text-xs text-slate-600 mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Gender:</span>
                          <span className="font-medium text-slate-800">{pupil.Gender || 'Male'}</span>
                        </div>
                        {pupil.ParentPhone && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Parent Phone:</span>
                            <span className="font-medium text-slate-800">{pupil.ParentPhone}</span>
                          </div>
                        )}
                        {pupil.ParentName && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Parent Name:</span>
                            <span className="font-medium text-slate-800 truncate max-w-[160px]">
                              {pupil.ParentName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentId(pupil.StudentID);
                            setActiveTab('report');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Award className="w-3 h-3 text-amber-400" />
                          <span>Report Card</span>
                        </button>
                        {onSelectStudent && (
                          <button
                            type="button"
                            onClick={() => onSelectStudent(pupil)}
                            className="px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Open in comprehensive score sheet editor"
                          >
                            <FileText className="w-3 h-3 text-amber-600" />
                            <span>Full Sheet</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditStudentModal(pupil)}
                          title="Edit pupil"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingStudent(pupil)}
                          title="Delete pupil"
                          className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: QUICK CA SCORE SHEET (SPREADSHEET MODE) */}
      {/* ========================================================================= */}
      {activeTab === 'quick_scores' && (
        <div className="space-y-4">
          <QuickSubjectScoreSheet
            currentTeacher={currentTeacher}
            classStudents={classStudents}
            authoritativeSubjects={classSubjects}
            allScores={allScores}
            session={session}
            term={term}
            onRefreshData={onRefreshData}
            onEditingChange={handleQuickScoresEditingChange}
            onViewStudentReport={(student) => {
              setSelectedStudentId(student.StudentID);
              switchTab('report');
              if (onSelectStudent) {
                onSelectStudent(student);
              }
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY ATTENDANCE & ATTENDANCE REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <AttendanceRegister
            currentClass={currentTeacher.ClassAssigned}
            session={session}
            term={term}
            studentsList={students}
            currentTeacher={currentTeacher}
            onRefreshData={onRefreshData}
            onSessionChange={onSessionChange}
            onTermChange={onTermChange}
            onEditingChange={handleAttendanceEditingChange}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SIMPLEST REPORT CARD SYSTEM */}
      {/* ========================================================================= */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          {classStudents.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              <p className="font-bold text-slate-700">No pupils available to grade in this class.</p>
              <button
                type="button"
                onClick={() => switchTab('students')}
                className="mt-3 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-lg cursor-pointer"
              >
                Enroll Pupils First
              </button>
            </div>
          ) : (
            <>
              {/* Pupil Selector Header */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <label className="text-xs font-bold text-slate-500 shrink-0">Select Pupil:</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer min-w-[220px]"
                  >
                    {classStudents.map((p) => (
                      <option key={p.StudentID} value={p.StudentID}>
                        {p.FullName} ({p.StudentID})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nav & Print Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {hasRestoredDraft && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
                      <span>Restored draft</span>
                      <button
                        type="button"
                        onClick={handleDiscardDraft}
                        className="underline font-bold text-[11px] hover:text-blue-950 cursor-pointer ml-1"
                      >
                        Discard
                      </button>
                    </div>
                  )}

                  {isDirty && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Unsaved Changes</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavigatePupil('prev')}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Previous pupil"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigatePupil('next')}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Next pupil"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {activeStudent && (
                    <button
                      type="button"
                      onClick={() => setPreviewReportCardStudent(activeStudent)}
                      className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-600" />
                      <span>Preview &amp; Print Card</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveReportCard}
                    disabled={isSavingScores}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingScores ? 'Saving...' : 'Save & Compile Result'}</span>
                  </button>

                </div>
              </div>

              {/* Pupil Score Entry Sheet */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-4 bg-amber-50/40 border-b border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-slate-900 font-serif">
                      {activeStudent?.FullName}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      ID: {activeStudent?.StudentID} • Class: {currentTeacher.ClassAssigned} • {term}, {session}
                    </p>
                  </div>

                  {/* Real-Time Compiled Metrics Pill */}
                  {compiledCurrentStudent && (
                    <div className="flex items-center gap-3 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Marks</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {compiledCurrentStudent.totalMarks} / {compiledCurrentStudent.totalPossible}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Average</span>
                        <span className="font-black text-amber-600 font-mono">
                          {compiledCurrentStudent.average !== null ? `${compiledCurrentStudent.average}%` : '—'}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Class Rank</span>
                        <span className="font-bold text-slate-800">{compiledCurrentStudent.positionLabel}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Score Input Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Subject Name</th>
                        <th className="py-2.5 px-2 w-24 text-center">1st CA (Max {maxCa1})</th>
                        <th className="py-2.5 px-2 w-24 text-center">2nd CA (Max {maxCa2})</th>
                        <th className="py-2.5 px-2 w-24 text-center">Exam (Max {maxExam})</th>
                        <th className="py-2.5 px-2 w-20 text-center">Total (100)</th>
                        <th className="py-2.5 px-2 w-16 text-center">Grade</th>
                        <th className="py-2.5 px-3 min-w-[120px]">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classSubjects.map((subName, idx) => {
                        const sc = studentSubjectScores[subName] || { ca1: null, ca2: null, exam: null };
                        const ca1Val = sc.ca1 !== null ? sc.ca1 : '';
                        const ca2Val = sc.ca2 !== null ? sc.ca2 : '';
                        const examVal = sc.exam !== null ? sc.exam : '';

                        let totalVal: number | null = null;
                        if (sc.ca1 !== null || sc.ca2 !== null || sc.exam !== null) {
                          totalVal = (sc.ca1 || 0) + (sc.ca2 || 0) + (sc.exam || 0);
                        }

                        const gradeInfo = totalVal !== null ? getGradeAndRemark(totalVal) : { grade: '—', remark: '—' };

                        return (
                          <tr key={subName} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{subName}</td>

                            {/* CA1 Input (0-{maxCa1}) */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxCa1}
                                placeholder={`0 - ${maxCa1}`}
                                value={ca1Val}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.preventDefault();
                                }}
                                onChange={(e) => handleScoreChange(subName, 'ca1', e.target.value)}
                                className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-center font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                              />
                            </td>

                            {/* CA2 Input (0-{maxCa2}) */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxCa2}
                                placeholder={`0 - ${maxCa2}`}
                                value={ca2Val}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.preventDefault();
                                }}
                                onChange={(e) => handleScoreChange(subName, 'ca2', e.target.value)}
                                className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-center font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                              />
                            </td>

                            {/* Exam Input (0-{maxExam}) */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxExam}
                                placeholder={`0 - ${maxExam}`}
                                value={examVal}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.preventDefault();
                                }}
                                onChange={(e) => handleScoreChange(subName, 'exam', e.target.value)}
                                className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-center font-mono font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                              />
                            </td>

                            {/* Computed Total */}
                            <td className="py-2 px-2 text-center font-mono font-black text-slate-900 text-sm">
                              {totalVal !== null ? (
                                <span className={totalVal >= 50 ? 'text-emerald-700' : 'text-rose-600'}>
                                  {totalVal}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Grade Pill */}
                            <td className="py-2 px-2 text-center">
                              {totalVal !== null ? (
                                <span
                                  className={`px-2 py-0.5 rounded-md font-mono font-black text-xs ${
                                    totalVal >= 75
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : totalVal >= 50
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {gradeInfo.grade}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Remark */}
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {gradeInfo.remark}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Remarks & Attendance Section */}
                <div className="p-5 bg-slate-50 border-t border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Class Teacher&apos;s Remark:
                      </label>
                      <textarea
                        rows={2}
                        value={teacherCommentInput}
                        onChange={(e) => handleTeacherCommentChange(e.target.value)}
                        placeholder={compiledCurrentStudent?.autoRemark || 'Enter teacher remarks...'}
                        className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Principal&apos;s Remark:
                      </label>
                      <textarea
                        rows={2}
                        value={principalCommentInput}
                        onChange={(e) => handlePrincipalCommentChange(e.target.value)}
                        placeholder="An admirable performance. Approved."
                        className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* Affective & Psychomotor Domains + Promotion Decision */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-2">
                        <HeartHandshake className="w-4 h-4 text-rose-600" />
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                          Affective &amp; Psychomotor Development Ratings
                        </h3>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Scale: <strong>5</strong>: Excellent | <strong>4</strong>: Good | <strong>3</strong>: Fair | <strong>2</strong>: Poor | <strong>1</strong>: Very Poor
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Affective Domain (Character &amp; Social Habits)</span>
                        </div>
                        <div className="space-y-1.5 pt-1">
                          {AFFECTIVE_TRAITS.map((trait) => {
                            const currentVal = (affectiveRatings as any)[trait.key] || 5;
                            return (
                              <div
                                key={trait.key}
                                className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/80 transition-colors text-xs"
                              >
                                <span className="font-medium text-slate-800 text-[11px] sm:text-xs truncate max-w-[140px] sm:max-w-[200px]">
                                  {trait.label}
                                </span>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => handleAffectiveRatingChange(trait.key, val)}
                                      className={`w-6 h-6 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                                        currentVal === val
                                          ? 'bg-slate-900 text-amber-300 shadow-xs scale-105'
                                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-200/60'
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
                          <Activity className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Psychomotor Skills (Practical &amp; Physical)</span>
                        </div>
                        <div className="space-y-1.5 pt-1">
                          {PSYCHOMOTOR_SKILLS.map((skill) => {
                            const currentVal = (psychomotorRatings as any)[skill.key] || 4;
                            return (
                              <div
                                key={skill.key}
                                className="flex items-center justify-between py-1 px-2 rounded-lg bg-slate-50/70 hover:bg-slate-100/80 transition-colors text-xs"
                              >
                                <span className="font-medium text-slate-800 text-[11px] sm:text-xs truncate max-w-[140px] sm:max-w-[200px]">
                                  {skill.label}
                                </span>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => handlePsychomotorRatingChange(skill.key, val)}
                                      className={`w-6 h-6 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                                        currentVal === val
                                          ? 'bg-indigo-900 text-white shadow-xs scale-105'
                                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-200/60'
                                      }`}
                                    >
                                      {val}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-amber-600" />
                          <div>
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                              Official Promotion / Terminal Decision
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Select official promotional status for this student
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { label: 'Promoted', val: 'Promoted', color: 'emerald' },
                            { label: 'Promoted on Trial', val: 'Promoted on Trial', color: 'amber' },
                            { label: 'Advised to Repeat', val: 'Advised to Repeat', color: 'rose' },
                            { label: 'Graduated', val: 'Graduated', color: 'blue' }
                          ].map((item) => {
                            const isSelected = promotionDecision.toLowerCase() === item.val.toLowerCase();
                            return (
                              <button
                                key={item.val}
                                type="button"
                                onClick={() => handlePromotionDecisionChange(item.val)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? item.color === 'emerald'
                                      ? 'bg-emerald-700 text-white shadow-xs'
                                      : item.color === 'amber'
                                      ? 'bg-amber-600 text-white shadow-xs'
                                      : item.color === 'rose'
                                      ? 'bg-rose-700 text-white shadow-xs'
                                      : 'bg-blue-700 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                                }`}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Attendance info on Report Card */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-600">Days Present:</span>
                        <input
                          type="number"
                          value={daysPresentInput !== null ? daysPresentInput : ''}
                          onChange={(e) => handleDaysPresentChange(e.target.value ? Number(e.target.value) : null)}
                          placeholder="e.g. 58"
                          className="w-20 px-2 py-1 rounded-md border border-slate-200 bg-white text-center font-bold"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-600">Days Opened:</span>
                        <input
                          type="number"
                          value={daysOpenedScoreInput !== null ? daysOpenedScoreInput : 60}
                          onChange={(e) => handleDaysOpenedChange(Number(e.target.value) || 60)}
                          className="w-20 px-2 py-1 rounded-md border border-slate-200 bg-white text-center font-bold"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveReportCard}
                      disabled={isSavingScores}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save &amp; Compile Result for {activeStudent?.FullName}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CLASS BROADSHEET & RESULTS APPROVAL */}
      {/* ========================================================================= */}
      {activeTab === 'broadsheet' && (
        <div className="space-y-4">
          {/* Sub-view toggle: Termly Broadsheet vs Annual Cumulative Broadsheet */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Broadsheet Mode:</span>
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBroadsheetViewMode('termly')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    broadsheetViewMode === 'termly'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Termly Broadsheet ({term})
                </button>
                <button
                  type="button"
                  onClick={() => setBroadsheetViewMode('cumulative')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    broadsheetViewMode === 'cumulative'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Annual Cumulative (All Terms &amp; Promotions)
                </button>
              </div>
            </div>
            <span className="text-xs text-slate-500">
              {broadsheetViewMode === 'termly'
                ? `Results and positions for ${term}`
                : 'Aggregated 1st, 2nd & 3rd Term averages, annual positions, and promotion decisions'}
            </span>
          </div>

          {broadsheetViewMode === 'cumulative' ? (
            <CumulativeBroadsheet
              className={currentTeacher.ClassAssigned}
              session={session}
              students={students}
              allScores={allScores}
              allSummaries={allSummaries}
              subjectsList={subjectsList}
              currentTeacher={currentTeacher}
              onSelectStudent={(st) => {
                setSelectedStudentId(st.StudentID);
                setActiveTab('report');
                if (onSelectStudent) {
                  onSelectStudent(st);
                }
              }}
            />
          ) : (
            <>
              {/* Status & Broadsheet Container */}
              <div id="printable-teacher-broadsheet" className="space-y-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-slate-900 font-serif">
                      Class Summary Broadsheet — {currentTeacher.ClassAssigned}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Session: {session} • Term: {term} • Total Enrolled: {classStudents.length} Pupils
                    </p>
                  </div>

              <div className="no-print flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printElementDirectly('printable-teacher-broadsheet', `Broadsheet_${(currentTeacher.ClassAssigned || 'Class').replace(/[^a-zA-Z0-9]/g, '_')}_${(term || '').replace(/[^a-zA-Z0-9]/g, '_')}`)}
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-600" />
                  <span>Print Broadsheet</span>
                </button>
            </div>
          </div>

          {/* Broadsheet Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="py-3 px-3 w-14 text-center">Rank</th>
                    <th className="py-3 px-4">Pupil Name</th>
                    <th className="py-3 px-3 font-mono">Student ID</th>
                    <th className="py-3 px-3 text-center">Subjects Graded</th>
                    <th className="py-3 px-3 text-center">Total Score</th>
                    <th className="py-3 px-3 text-center">Average (%)</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classBroadsheetRankings.map((row) => (
                    <tr key={row.student.StudentID} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] ${
                            row.positionNumber === 1
                              ? 'bg-amber-100 text-amber-900 font-black'
                              : row.positionNumber === 2
                              ? 'bg-slate-200 text-slate-800'
                              : row.positionNumber === 3
                              ? 'bg-amber-50 text-amber-800'
                              : 'text-slate-600'
                          }`}
                        >
                          {row.positionLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{row.student.FullName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{row.student.StudentID}</td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                        {row.completedSubjectsCount} / {row.totalSubjectsAvailable}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                        {row.totalScore}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-amber-600">
                        {row.averageScore ? `${row.averageScore}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewReportCardStudent(row.student);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                        >
                          View Card
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TEACHER PROFILE EDITOR (NAME, PICTURE, PHONE NUMBER) */}
      {/* ========================================================================= */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider font-serif">
                  Edit Teacher Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              {/* Photo Preview & Upload */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <label className="text-xs font-bold text-slate-700 block">Teacher Picture (Max 100KB):</label>
                  <label className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                    <span>Upload from Device (≤100KB)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[10px] text-slate-500">File size must be 100KB or lower. Saved to Firebase.</p>
                  {profilePhoto && (
                    <button
                      type="button"
                      onClick={() => setProfilePhoto('')}
                      className="text-[11px] text-rose-600 hover:underline block cursor-pointer"
                    >
                      Remove picture
                    </button>
                  )}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Teacher Full Name:
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="e.g. Mr. Emmanuel Solomon"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-semibold"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Phone Number:
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-semibold"
                />
              </div>

              {/* Login Credentials Section */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Portal Login Credentials
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Username:
                    </label>
                    <input
                      type="text"
                      required
                      value={profileUsername}
                      onChange={(e) => setProfileUsername(e.target.value)}
                      placeholder="e.g. teacher_p6"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Password:
                    </label>
                    <input
                      type="text"
                      required
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Class Assigned (Read-only badge with automated tracking notice) */}
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/70 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-amber-900 font-bold">Assigned Class:</span>
                  <span className="font-black text-amber-950 bg-amber-200/70 px-2.5 py-0.5 rounded-md font-mono">
                    {currentTeacher.ClassAssigned}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-tight">
                  Your identity is permanently linked to <span className="font-bold">{currentTeacher.ClassAssigned}</span>. Even if you change your username, the system automatically preserves and loads your class and pupil records.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-xs transition-colors"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / EDIT PUPIL MODAL */}
      {/* ========================================================================= */}
      {(isAddStudentOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm uppercase tracking-wider font-serif">
                  {editingStudent ? 'Edit Pupil Details' : 'Enroll New Pupil'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddStudentOpen(false);
                  setEditingStudent(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Pupil Full Name:
                  </label>
                  <input
                    type="text"
                    required
                    value={studentFormName}
                    onChange={(e) => setStudentFormName(e.target.value)}
                    placeholder="e.g. David Chukwuma Adebayo"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-semibold"
                  />
                </div>

                {/* Student ID */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {editingStudent ? (
                      <>Student ID: <span className="text-slate-400 font-normal normal-case">(cannot be changed — used as the record key)</span></>
                    ) : (
                      'Student ID (Recommended / Editable):'
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingStudent)}
                    readOnly={Boolean(editingStudent)}
                    value={studentFormId}
                    onChange={(e) => setStudentFormId(e.target.value)}
                    placeholder={FirebaseService.isSecondaryClass(currentTeacher.ClassAssigned) ? 'e.g. DSS/001' : 'e.g. DNPS/0012'}
                    className={`w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold ${
                      editingStudent
                        ? 'text-slate-500 bg-slate-100 cursor-not-allowed'
                        : 'text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500'
                    }`}
                  />
                  {!editingStudent && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Auto-recommended in sequence. You can modify this ID if needed.
                    </p>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Gender:</label>
                  <select
                    value={studentFormGender}
                    onChange={(e) => setStudentFormGender(e.target.value as 'Male' | 'Female')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                {/* Parent Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Parent / Guardian Name:
                  </label>
                  <input
                    type="text"
                    value={studentFormParentName}
                    onChange={(e) => setStudentFormParentName(e.target.value)}
                    placeholder="e.g. Mrs. Adebayo"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Parent Phone */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Parent Phone Number:
                  </label>
                  <input
                    type="tel"
                    value={studentFormParentPhone}
                    onChange={(e) => setStudentFormParentPhone(e.target.value)}
                    placeholder="e.g. 08034567890"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Home Address */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Residential Address:
                  </label>
                  <input
                    type="text"
                    value={studentFormAddress}
                    onChange={(e) => setStudentFormAddress(e.target.value)}
                    placeholder="e.g. 14 School Road, City, State"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddStudentOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-xs transition-colors"
                >
                  {isSavingStudent ? 'Saving...' : editingStudent ? 'Update Pupil' : 'Enroll Pupil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Delete Pupil?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <span className="font-bold text-slate-800">{deletingStudent.FullName}</span> ({deletingStudent.StudentID}) from the class roster?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                disabled={isSavingStudent}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                {isSavingStudent ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IN-APP CONFIRMATION FOR PUBLISH & UNPUBLISH */}
      {/* ========================================================================= */}
      {publishModalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              {publishModalAction === 'publish' ? (
                <div className="p-3 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
                  <Globe className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-3 rounded-full bg-rose-100 text-rose-600 border border-rose-200">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {publishModalAction === 'publish' ? 'Publish Class Results' : 'Unpublish Class Results'}
                </h3>
                <p className="text-xs text-slate-500">
                  {currentTeacher.ClassAssigned} • {term} ({session})
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-2 text-slate-700">
              {publishModalAction === 'publish' ? (
                <>
                  <p>
                    Are you ready to publish results for <strong className="text-slate-900">{currentTeacher.ClassAssigned}</strong>?
                  </p>
                  <p className="text-slate-600">
                    Once published, all <strong className="text-emerald-700">{classStudents.length} enrolled pupils</strong> and their parents can immediately log in to the Student Portal to view and print their terminal report cards.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Are you sure you want to unpublish results for <strong className="text-slate-900">{currentTeacher.ClassAssigned}</strong>?
                  </p>
                  <p className="text-slate-600">
                    This will revert results to <strong>Draft</strong> and hide report cards from pupils on their portal so you can make score corrections.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPublishModalAction(null)}
                disabled={isSubmittingApproval}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              {publishModalAction === 'publish' ? (
                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  disabled={isSubmittingApproval}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingApproval ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-950" />
                  )}
                  <span>{isSubmittingApproval ? 'Publishing Live...' : 'Yes, Publish Live Now'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmUnpublish}
                  disabled={isSubmittingApproval}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingApproval ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-white" />
                  )}
                  <span>{isSubmittingApproval ? 'Unpublishing...' : 'Yes, Unpublish (Draft)'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROMINENT VISIBLE FEEDBACK (RESULT PUBLISHED / UNPUBLISHED) */}
      {/* ========================================================================= */}
      {publishFeedbackModal && (
        <div
          id="publish-feedback-modal-overlay"
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPublishFeedbackModal(null)}
        >
          <div
            id="publish-feedback-modal-card"
            className={`bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border relative text-center space-y-4 transform transition-all ${
              publishFeedbackModal.type === 'published'
                ? 'border-emerald-200'
                : 'border-amber-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated Status Icon */}
            <div className="flex justify-center pt-2">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ${
                  publishFeedbackModal.type === 'published'
                    ? 'bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50'
                    : 'bg-amber-100 text-amber-600 ring-8 ring-amber-50'
                }`}
              >
                {publishFeedbackModal.type === 'published' ? (
                  <CheckCircle2 className="w-9 h-9 animate-bounce" />
                ) : (
                  <EyeOff className="w-9 h-9" />
                )}
              </div>
            </div>

            {/* Status Pill */}
            <div className="flex justify-center">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  publishFeedbackModal.type === 'published'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    publishFeedbackModal.type === 'published' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {publishFeedbackModal.type === 'published'
                  ? 'Live on Student Portal'
                  : 'Hidden from Student Portal'}
              </span>
            </div>

            {/* Title & Message */}
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-serif">
                {publishFeedbackModal.title}
              </h3>
              <p className="text-sm font-semibold text-slate-800 leading-snug">
                {publishFeedbackModal.message}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed pt-1">
                {publishFeedbackModal.details}
              </p>
            </div>

            {/* Quick Action Button */}
            <div className="pt-3">
              <button
                type="button"
                id="publish-feedback-dismiss-btn"
                onClick={() => setPublishFeedbackModal(null)}
                className={`w-full py-3 px-5 rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer transform active:scale-98 ${
                  publishFeedbackModal.type === 'published'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-200'
                    : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-200'
                }`}
              >
                Got It, Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: FULL OFFICIAL REPORT CARD PREVIEW & PRINT */}
      {/* ========================================================================= */}
      {previewReportCardStudent && (
        <StudentReportCardModal
          isOpen={Boolean(previewReportCardStudent)}
          onClose={() => setPreviewReportCardStudent(null)}
          student={previewReportCardStudent}
          allClassStudents={classStudents}
          allScores={allScores}
          allSummaries={allSummaries}
          subjectsList={subjectsList}
          session={session}
          term={term}
        />
      )}

      {/* ========================================================================= */}
      {/* SINGLE BOTTOM NAVIGATION — Pupils / Attendance / Result */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800 px-2 pt-2 pb-safe no-print shadow-2xl">
        <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => switchTab('students')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'students'
                ? 'bg-amber-400/20 text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Pupils</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('attendance')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-amber-400/20 text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isResultGroupActive) switchTab('report');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
              isResultGroupActive
                ? 'bg-amber-400/20 text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Result</span>
          </button>
        </div>
      </div>
    </div>
  );
};
