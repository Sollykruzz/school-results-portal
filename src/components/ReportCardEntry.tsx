import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Student, SubjectRule, SubjectScore, StudentSummary, TermType, AffectiveRatings, PsychomotorRatings } from '../types';
import { FirebaseService } from '../services/firebaseService';
import {
  calculateStudentOverallAverage,
  calculateSubjectTotal,
  determineClassLevel,
  getAuthoritativeSubjectsForClass,
  getGradeDetails,
  getAutoReportRemark,
  isSubjectFullyCompleted,
  isMatchingStudentId,
  getScoringConfig,
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS
} from '../utils/grading';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Activity,
  HeartHandshake,
  Award
} from 'lucide-react';

interface ReportCardEntryProps {
  student: Student;
  allClassStudents: Student[];
  session: string;
  term: TermType;
  subjectsList: SubjectRule[];
  allScores: SubjectScore[];
  allSummaries: StudentSummary[];
  onBackToRoster: () => void;
  onNavigateToStudent: (nextStudent: Student) => void;
  onSaveScores: (
    studentId: string,
    session: string,
    term: TermType,
    scores: Array<{
      Subject: string;
      CA1: number | null;
      CA2: number | null;
      Exam: number | null;
      Total: number | null;
    }>,
    summary: {
      DaysPresent: number | null;
      DaysOpened: number | null;
      TeacherComment: string;
      PrincipalComment: string;
      AffectiveRatings?: AffectiveRatings;
      PsychomotorRatings?: PsychomotorRatings;
      PromotionDecision?: string;
    }
  ) => void;
  onDeleteReportCard?: (studentId: string, session: string, term: TermType) => Promise<void>;
  onSaveSuccess: () => void;
  onOpenSubjectManager?: () => void;
  onEditingChange?: (isDirty: boolean) => void;
}

const DRAFT_STORAGE_PREFIX = 'erca_report_draft_';

function getDraftKey(studentId: string, session: string, term: TermType): string {
  return `${DRAFT_STORAGE_PREFIX}${studentId.trim().toUpperCase()}_${session.trim()}_${term.trim()}`;
}

export const ReportCardEntry: React.FC<ReportCardEntryProps> = ({
  student,
  allClassStudents,
  session,
  term,
  subjectsList,
  allScores,
  allSummaries,
  onBackToRoster,
  onNavigateToStudent,
  onSaveScores,
  onDeleteReportCard,
  onSaveSuccess,
  onOpenSubjectManager,
  onEditingChange
}) => {
  // Mobile view mode: 'cards' (touch card per subject) or 'table' (spreadsheet table)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Dynamic configured continuous assessment limits
  const scoringConfig = getScoringConfig(session, term);
  const maxCa1 = scoringConfig.maxCA1;
  const maxCa2 = scoringConfig.maxCA2;
  const maxExam = scoringConfig.maxExam;
  const maxTotal = scoringConfig.maxTotal;

  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Draft and dirty state tracking
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // Ref to track if user made changes so fresh network loads don't overwrite
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    onEditingChange?.(isDirty);
    return () => {
      onEditingChange?.(false);
    };
  }, [isDirty, onEditingChange]);

  // 1. Determine authoritative subject list assigned specifically to this student's class
  const classLevel = useMemo(() => determineClassLevel(student.Class), [student.Class]);
  const levelSubjects = useMemo(() => {
    return getAuthoritativeSubjectsForClass(student.Class, subjectsList);
  }, [student.Class, subjectsList]);

  // Build baseline scores from in-memory allScores
  const getInitialBaselineScores = useCallback(() => {
    const existing = allScores.filter(
      (s) =>
        isMatchingStudentId(s.StudentID, student.StudentID) &&
        s.Term === term &&
        (s.Session === session || !s.Session)
    );
    const map: Record<string, { ca1: string; ca2: string; exam: string }> = {};
    for (const subj of levelSubjects) {
      const found = existing.find(
        (s) => s.Subject.toLowerCase().trim() === subj.toLowerCase().trim()
      );
      map[subj] = {
        ca1: found && found.CA1 !== null && found.CA1 !== undefined ? String(found.CA1) : '',
        ca2: found && found.CA2 !== null && found.CA2 !== undefined ? String(found.CA2) : '',
        exam: found && found.Exam !== null && found.Exam !== undefined ? String(found.Exam) : ''
      };
    }
    return map;
  }, [allScores, student.StudentID, term, session, levelSubjects]);

  // Existing summary in memory
  const existingSummary = useMemo(() => {
    return allSummaries.find(
      (sm) =>
        isMatchingStudentId(sm.StudentID, student.StudentID) &&
        sm.Term === term &&
        (sm.Session === session || !sm.Session)
    );
  }, [allSummaries, student.StudentID, term, session]);

  // Form State
  const [subjectScores, setSubjectScores] = useState<Record<string, { ca1: string; ca2: string; exam: string }>>(() => {
    // Check if local draft exists
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.subjectScores) return parsed.subjectScores;
      }
    } catch {}
    return getInitialBaselineScores();
  });

  const [teacherComment, setTeacherComment] = useState<string>(() => {
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.teacherComment !== undefined) return parsed.teacherComment;
      }
    } catch {}
    return existingSummary?.TeacherComment || '';
  });

  const [principalComment, setPrincipalComment] = useState<string>(() => {
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.principalComment !== undefined) return parsed.principalComment;
      }
    } catch {}
    return existingSummary?.PrincipalComment || '';
  });

  const [daysPresent, setDaysPresent] = useState<string>(() => {
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.daysPresent !== undefined) return parsed.daysPresent;
      }
    } catch {}
    return existingSummary?.DaysPresent !== null && existingSummary?.DaysPresent !== undefined
      ? String(existingSummary.DaysPresent)
      : '';
  });

  const [daysOpened, setDaysOpened] = useState<string>(() => {
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.daysOpened !== undefined) return parsed.daysOpened;
      }
    } catch {}
    return existingSummary?.DaysOpened !== null && existingSummary?.DaysOpened !== undefined
      ? String(existingSummary.DaysOpened)
      : '';
  });

  // Affective Domain Ratings State (1 to 5)
  const [affectiveRatings, setAffectiveRatings] = useState<AffectiveRatings>(() => {
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.affectiveRatings) return parsed.affectiveRatings;
      }
    } catch {}
    if (existingSummary?.AffectiveRatings) {
      const ex = existingSummary.AffectiveRatings as any;
      return {
        punctuality: ex.punctuality ?? ex.Punctuality ?? 5,
        neatness: ex.neatness ?? ex.Neatness ?? 5,
        politeness: ex.politeness ?? ex.Politeness ?? 5,
        honesty: ex.honesty ?? ex.Honesty ?? 5,
        relationshipWithPeers: ex.relationshipWithPeers ?? ex.RelationshipWithPeers ?? 5,
        leadership: ex.leadership ?? ex.Leadership ?? 4,
        attentiveness: ex.attentiveness ?? ex.Attentiveness ?? 4,
        perseverance: ex.perseverance ?? ex.Perseverance ?? 4,
        selfControl: ex.selfControl ?? ex.SelfControl ?? 4
      };
    }
    return {
      punctuality: 5,
      neatness: 5,
      politeness: 5,
      honesty: 5,
      relationshipWithPeers: 5,
      leadership: 4,
      attentiveness: 4,
      perseverance: 4,
      selfControl: 4
    };
  });

  // Psychomotor Skills Ratings State (1 to 5)
  const [psychomotorRatings, setPsychomotorRatings] = useState<PsychomotorRatings>(() => {
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.psychomotorRatings) return parsed.psychomotorRatings;
      }
    } catch {}
    if (existingSummary?.PsychomotorRatings) {
      const ex = existingSummary.PsychomotorRatings as any;
      return {
        handwriting: ex.handwriting ?? ex.Handwriting ?? 4,
        sports: ex.sports ?? ex.sportsAndGames ?? ex.SportsAndGames ?? 4,
        drawingCrafts: ex.drawingCrafts ?? ex.craftsAndCreativity ?? ex.CraftsAndCreativity ?? 4,
        musicalSkills: ex.musicalSkills ?? ex.musicAndDrama ?? ex.MusicAndDrama ?? 4,
        practicalSkills: ex.practicalSkills ?? ex.PracticalSkills ?? 4,
        fluencySpeaking: ex.fluencySpeaking ?? ex.fluencyInSpeech ?? ex.FluencyInSpeech ?? 4
      };
    }
    return {
      handwriting: 4,
      sports: 4,
      drawingCrafts: 4,
      musicalSkills: 4,
      practicalSkills: 4,
      fluencySpeaking: 4
    };
  });

  // Promotion Decision State (Only applicable for end of term / session)
  const [promotionDecision, setPromotionDecision] = useState<string>(() => {
    try {
      const draftRaw = localStorage.getItem(getDraftKey(student.StudentID, session, term));
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.promotionDecision) return parsed.promotionDecision;
      }
    } catch {}
    return existingSummary?.PromotionDecision || (term === 'Third Term' ? 'Promoted' : '');
  });

  // Helper to persist draft to localStorage
  const saveDraftToStorage = useCallback(
    (
      newScores: Record<string, { ca1: string; ca2: string; exam: string }>,
      tComment: string,
      pComment: string,
      dPresent: string,
      dOpened: string,
      affRatings?: AffectiveRatings,
      psyRatings?: PsychomotorRatings,
      promDecision?: string
    ) => {
      try {
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const draftData = {
          studentId: student.StudentID,
          session,
          term,
          subjectScores: newScores,
          teacherComment: tComment,
          principalComment: pComment,
          daysPresent: dPresent,
          daysOpened: dOpened,
          affectiveRatings: affRatings || affectiveRatings,
          psychomotorRatings: psyRatings || psychomotorRatings,
          promotionDecision: promDecision !== undefined ? promDecision : promotionDecision,
          timestamp: now
        };
        localStorage.setItem(getDraftKey(student.StudentID, session, term), JSON.stringify(draftData));
        setIsDirty(true);
        setDraftSavedAt(now);
      } catch (err) {
        console.warn('Unable to write to localStorage draft:', err);
      }
    },
    [student.StudentID, session, term, affectiveRatings, psychomotorRatings, promotionDecision]
  );

  // Clear local draft and revert to baseline
  const handleDiscardDraft = useCallback(() => {
    try {
      localStorage.removeItem(getDraftKey(student.StudentID, session, term));
    } catch {}
    const baseScores = getInitialBaselineScores();
    setSubjectScores(baseScores);
    setTeacherComment(existingSummary?.TeacherComment || '');
    setPrincipalComment(existingSummary?.PrincipalComment || '');
    setDaysPresent(
      existingSummary?.DaysPresent !== null && existingSummary?.DaysPresent !== undefined
        ? String(existingSummary.DaysPresent)
        : ''
    );
    setDaysOpened(
      existingSummary?.DaysOpened !== null && existingSummary?.DaysOpened !== undefined
        ? String(existingSummary.DaysOpened)
        : ''
    );
    setAffectiveRatings(
      existingSummary?.AffectiveRatings
        ? {
            punctuality: (existingSummary.AffectiveRatings as any).punctuality ?? (existingSummary.AffectiveRatings as any).Punctuality ?? 5,
            neatness: (existingSummary.AffectiveRatings as any).neatness ?? (existingSummary.AffectiveRatings as any).Neatness ?? 5,
            politeness: (existingSummary.AffectiveRatings as any).politeness ?? (existingSummary.AffectiveRatings as any).Politeness ?? 5,
            honesty: (existingSummary.AffectiveRatings as any).honesty ?? (existingSummary.AffectiveRatings as any).Honesty ?? 5,
            relationshipWithPeers: (existingSummary.AffectiveRatings as any).relationshipWithPeers ?? (existingSummary.AffectiveRatings as any).RelationshipWithPeers ?? 5,
            leadership: (existingSummary.AffectiveRatings as any).leadership ?? (existingSummary.AffectiveRatings as any).Leadership ?? 4,
            attentiveness: (existingSummary.AffectiveRatings as any).attentiveness ?? (existingSummary.AffectiveRatings as any).Attentiveness ?? 4,
            perseverance: (existingSummary.AffectiveRatings as any).perseverance ?? (existingSummary.AffectiveRatings as any).Perseverance ?? 4,
            selfControl: (existingSummary.AffectiveRatings as any).selfControl ?? (existingSummary.AffectiveRatings as any).SelfControl ?? 4
          }
        : {
            punctuality: 5,
            neatness: 5,
            politeness: 5,
            honesty: 5,
            relationshipWithPeers: 5,
            leadership: 4,
            attentiveness: 4,
            perseverance: 4,
            selfControl: 4
          }
    );
    setPsychomotorRatings(
      existingSummary?.PsychomotorRatings
        ? {
            handwriting: (existingSummary.PsychomotorRatings as any).handwriting ?? (existingSummary.PsychomotorRatings as any).Handwriting ?? 4,
            sports: (existingSummary.PsychomotorRatings as any).sports ?? (existingSummary.PsychomotorRatings as any).sportsAndGames ?? (existingSummary.PsychomotorRatings as any).SportsAndGames ?? 4,
            drawingCrafts: (existingSummary.PsychomotorRatings as any).drawingCrafts ?? (existingSummary.PsychomotorRatings as any).craftsAndCreativity ?? (existingSummary.PsychomotorRatings as any).CraftsAndCreativity ?? 4,
            musicalSkills: (existingSummary.PsychomotorRatings as any).musicalSkills ?? (existingSummary.PsychomotorRatings as any).musicAndDrama ?? (existingSummary.PsychomotorRatings as any).MusicAndDrama ?? 4,
            practicalSkills: (existingSummary.PsychomotorRatings as any).practicalSkills ?? (existingSummary.PsychomotorRatings as any).PracticalSkills ?? 4,
            fluencySpeaking: (existingSummary.PsychomotorRatings as any).fluencySpeaking ?? (existingSummary.PsychomotorRatings as any).fluencyInSpeech ?? (existingSummary.PsychomotorRatings as any).FluencyInSpeech ?? 4
          }
        : {
            handwriting: 4,
            sports: 4,
            drawingCrafts: 4,
            musicalSkills: 4,
            practicalSkills: 4,
            fluencySpeaking: 4
          }
    );
    setPromotionDecision(existingSummary?.PromotionDecision || (term === 'Third Term' ? 'Promoted' : ''));
    setIsDirty(false);
    setHasRestoredDraft(false);
    setDraftSavedAt(null);
    setSaveFeedback({ message: 'Draft cleared. Reverted to saved record.', type: 'success' });
  }, [student.StudentID, session, term, getInitialBaselineScores, existingSummary]);

  // Load student data when student/term/session switches (SAFE: Checks draft first, never resets in the middle of typing)
  useEffect(() => {
    const draftKey = getDraftKey(student.StudentID, session, term);
    let foundDraft = false;

    try {
      const draftRaw = localStorage.getItem(draftKey);
      if (draftRaw) {
        const parsed = JSON.parse(draftRaw);
        if (parsed.subjectScores) {
          // Fill missing subjects from level if any
          const restoredScores: Record<string, { ca1: string; ca2: string; exam: string }> = {};
          for (const subj of levelSubjects) {
            restoredScores[subj] = parsed.subjectScores[subj] || { ca1: '', ca2: '', exam: '' };
          }
          setSubjectScores(restoredScores);
          setTeacherComment(parsed.teacherComment || '');
          setPrincipalComment(parsed.principalComment || '');
          setDaysPresent(parsed.daysPresent || '');
          setDaysOpened(parsed.daysOpened || '');
          if (parsed.affectiveRatings) setAffectiveRatings(parsed.affectiveRatings);
          if (parsed.psychomotorRatings) setPsychomotorRatings(parsed.psychomotorRatings);
          if (parsed.promotionDecision) setPromotionDecision(parsed.promotionDecision);
          setIsDirty(true);
          setHasRestoredDraft(true);
          setDraftSavedAt(parsed.timestamp || 'earlier session');
          foundDraft = true;
        }
      }
    } catch {}

    if (!foundDraft) {
      const baseScores = getInitialBaselineScores();
      setSubjectScores(baseScores);
      setTeacherComment(existingSummary?.TeacherComment || '');
      setPrincipalComment(existingSummary?.PrincipalComment || '');
      setDaysPresent(
        existingSummary?.DaysPresent !== null && existingSummary?.DaysPresent !== undefined
          ? String(existingSummary.DaysPresent)
          : ''
      );
      setDaysOpened(
        existingSummary?.DaysOpened !== null && existingSummary?.DaysOpened !== undefined
          ? String(existingSummary.DaysOpened)
          : ''
      );
      if (existingSummary?.AffectiveRatings) {
        const ex = existingSummary.AffectiveRatings as any;
        setAffectiveRatings({
          punctuality: ex.punctuality ?? ex.Punctuality ?? 5,
          neatness: ex.neatness ?? ex.Neatness ?? 5,
          politeness: ex.politeness ?? ex.Politeness ?? 5,
          honesty: ex.honesty ?? ex.Honesty ?? 5,
          relationshipWithPeers: ex.relationshipWithPeers ?? ex.RelationshipWithPeers ?? 5,
          leadership: ex.leadership ?? ex.Leadership ?? 4,
          attentiveness: ex.attentiveness ?? ex.Attentiveness ?? 4,
          perseverance: ex.perseverance ?? ex.Perseverance ?? 4,
          selfControl: ex.selfControl ?? ex.SelfControl ?? 4
        });
      }
      if (existingSummary?.PsychomotorRatings) {
        const ex = existingSummary.PsychomotorRatings as any;
        setPsychomotorRatings({
          handwriting: ex.handwriting ?? ex.Handwriting ?? 4,
          sports: ex.sports ?? ex.sportsAndGames ?? ex.SportsAndGames ?? 4,
          drawingCrafts: ex.drawingCrafts ?? ex.craftsAndCreativity ?? ex.CraftsAndCreativity ?? 4,
          musicalSkills: ex.musicalSkills ?? ex.musicAndDrama ?? ex.MusicAndDrama ?? 4,
          practicalSkills: ex.practicalSkills ?? ex.PracticalSkills ?? 4,
          fluencySpeaking: ex.fluencySpeaking ?? ex.fluencyInSpeech ?? ex.FluencyInSpeech ?? 4
        });
      }
      if (existingSummary?.PromotionDecision) {
        setPromotionDecision(existingSummary.PromotionDecision);
      }
      setIsDirty(false);
      setHasRestoredDraft(false);
      setDraftSavedAt(null);
    }
  }, [student.StudentID, session, term, levelSubjects, getInitialBaselineScores, existingSummary]);

  // Browser BeforeUnload Guard: Warn if teacher tries to close/refresh tab with unsaved scores
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved report card score entries. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Next / Previous student index for quick navigation
  const currentIndex = allClassStudents.findIndex((s) => s.StudentID === student.StudentID);
  const prevStudent = currentIndex > 0 ? allClassStudents[currentIndex - 1] : null;
  const nextStudent = currentIndex < allClassStudents.length - 1 ? allClassStudents[currentIndex + 1] : null;

  // 2. Fetch fresh data from Firebase Firestore upon opening (ONLY if no dirty draft exists)
  const loadFreshData = useCallback(async () => {
    if (!FirebaseService.isConfigured()) return;
    // Do not fetch/override if user has active unsaved local changes
    if (isDirtyRef.current) return;

    setIsLoadingFresh(true);
    try {
      const { scores, summary } = await FirebaseService.fetchFreshStudentData(
        student.StudentID,
        session,
        term,
        student.Class
      );

      // Guard again after async return: don't overwrite if user started typing
      if (isDirtyRef.current) return;

      if (scores && scores.length > 0) {
        setSubjectScores((prev) => {
          const updated = { ...prev };
          for (const subj of levelSubjects) {
            const found = scores.find(
              (s) => s.Subject.toLowerCase().trim() === subj.toLowerCase().trim()
            );
            if (found) {
              updated[subj] = {
                ca1: found.CA1 !== null && found.CA1 !== undefined ? String(found.CA1) : '',
                ca2: found.CA2 !== null && found.CA2 !== undefined ? String(found.CA2) : '',
                exam: found.Exam !== null && found.Exam !== undefined ? String(found.Exam) : ''
              };
            }
          }
          return updated;
        });
      }

      if (summary) {
        if (summary.TeacherComment) setTeacherComment(summary.TeacherComment);
        if (summary.PrincipalComment) setPrincipalComment(summary.PrincipalComment);
        if (summary.DaysPresent !== null && summary.DaysPresent !== undefined) setDaysPresent(String(summary.DaysPresent));
        if (summary.DaysOpened !== null && summary.DaysOpened !== undefined) setDaysOpened(String(summary.DaysOpened));
        if (summary.AffectiveRatings) {
          const ex = summary.AffectiveRatings as any;
          setAffectiveRatings({
            punctuality: ex.punctuality ?? ex.Punctuality ?? 5,
            neatness: ex.neatness ?? ex.Neatness ?? 5,
            politeness: ex.politeness ?? ex.Politeness ?? 5,
            honesty: ex.honesty ?? ex.Honesty ?? 5,
            relationshipWithPeers: ex.relationshipWithPeers ?? ex.RelationshipWithPeers ?? 5,
            leadership: ex.leadership ?? ex.Leadership ?? 4,
            attentiveness: ex.attentiveness ?? ex.Attentiveness ?? 4,
            perseverance: ex.perseverance ?? ex.Perseverance ?? 4,
            selfControl: ex.selfControl ?? ex.SelfControl ?? 4
          });
        }
        if (summary.PsychomotorRatings) {
          const ex = summary.PsychomotorRatings as any;
          setPsychomotorRatings({
            handwriting: ex.handwriting ?? ex.Handwriting ?? 4,
            sports: ex.sports ?? ex.sportsAndGames ?? ex.SportsAndGames ?? 4,
            drawingCrafts: ex.drawingCrafts ?? ex.craftsAndCreativity ?? ex.CraftsAndCreativity ?? 4,
            musicalSkills: ex.musicalSkills ?? ex.musicAndDrama ?? ex.MusicAndDrama ?? 4,
            practicalSkills: ex.practicalSkills ?? ex.PracticalSkills ?? 4,
            fluencySpeaking: ex.fluencySpeaking ?? ex.fluencyInSpeech ?? ex.FluencyInSpeech ?? 4
          });
        }
        if (summary.PromotionDecision) {
          setPromotionDecision(summary.PromotionDecision);
        }
      }
    } catch (err) {
      console.warn('Fresh fetch student data notice:', err);
    } finally {
      setIsLoadingFresh(false);
    }
  }, [student.StudentID, session, term, levelSubjects]);

  useEffect(() => {
    loadFreshData();
  }, [loadFreshData]);

  // Handle Score Input Change with validation & auto-save
  const handleScoreChange = (
    subject: string,
    field: 'ca1' | 'ca2' | 'exam',
    value: string
  ) => {
    // Only allow numbers or empty string
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) {
      return;
    }

    const num = parseFloat(value);
    const max = field === 'ca1' ? maxCa1 : field === 'ca2' ? maxCa2 : maxExam;

    if (!isNaN(num) && num > max) {
      // Cap at maximum allowable mark
      value = String(max);
    }

    const updated = {
      ...subjectScores,
      [subject]: {
        ...(subjectScores[subject] || { ca1: '', ca2: '', exam: '' }),
        [field]: value
      }
    };

    setSubjectScores(updated);
    saveDraftToStorage(updated, teacherComment, principalComment, daysPresent, daysOpened);
  };

  // Handle Comments and Attendance changes with auto-save
  const handleTeacherCommentChange = (value: string) => {
    setTeacherComment(value);
    saveDraftToStorage(subjectScores, value, principalComment, daysPresent, daysOpened);
  };

  const handlePrincipalCommentChange = (value: string) => {
    setPrincipalComment(value);
    saveDraftToStorage(subjectScores, teacherComment, value, daysPresent, daysOpened);
  };

  const handleDaysPresentChange = (value: string) => {
    setDaysPresent(value);
    saveDraftToStorage(subjectScores, teacherComment, principalComment, value, daysOpened);
  };

  const handleDaysOpenedChange = (value: string) => {
    setDaysOpened(value);
    saveDraftToStorage(subjectScores, teacherComment, principalComment, daysPresent, value);
  };

  // Compute live totals and overall average
  const computedList = useMemo(() => {
    return levelSubjects.map((subjectName) => {
      const entry = subjectScores[subjectName] || { ca1: '', ca2: '', exam: '' };
      const ca1Num = entry.ca1 !== '' ? parseFloat(entry.ca1) : null;
      const ca2Num = entry.ca2 !== '' ? parseFloat(entry.ca2) : null;
      const examNum = entry.exam !== '' ? parseFloat(entry.exam) : null;

      const total = calculateSubjectTotal(ca1Num, ca2Num, examNum);
      const isComplete = isSubjectFullyCompleted(ca1Num, ca2Num, examNum);
      const grade = getGradeDetails(total);

      return {
        subject: subjectName,
        ca1: ca1Num,
        ca2: ca2Num,
        exam: examNum,
        total,
        isComplete,
        grade
      };
    });
  }, [levelSubjects, subjectScores]);

  const liveAverageStats = useMemo(() => {
    return calculateStudentOverallAverage(computedList);
  }, [computedList]);

  // Attendance Percentage
  const attendancePercentage = useMemo(() => {
    const p = parseFloat(daysPresent);
    const o = parseFloat(daysOpened);
    if (!isNaN(p) && !isNaN(o) && o > 0) {
      return Math.min(100, Math.round((p / o) * 100));
    }
    return null;
  }, [daysPresent, daysOpened]);

  // Save Logic
  const performSave = async (andGoNext: boolean = false) => {
    if (isSaving) return;

    const invalidScore = computedList.some((score) =>
      [score.ca1, score.ca2, score.exam].some((value, index) => {
        if (value === null) return false;
        const max = index === 0 ? maxCa1 : index === 1 ? maxCa2 : maxExam;
        return !Number.isFinite(value) || value < 0 || value > max;
      })
    );
    const present = daysPresent === '' ? null : Number(daysPresent);
    const opened = daysOpened === '' ? null : Number(daysOpened);
    if (
      invalidScore ||
      (present !== null && (!Number.isFinite(present) || present < 0)) ||
      (opened !== null && (!Number.isFinite(opened) || opened < 0)) ||
      (present !== null && opened !== null && present > opened)
    ) {
      setSaveFeedback({
        message: 'Please correct the highlighted scores and attendance values before saving.',
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const payloadScores = computedList.map((c) => ({
      Subject: c.subject,
      CA1: c.ca1,
      CA2: c.ca2,
      Exam: c.exam,
      Total: c.total
    }));

    const remarksPayload = {
      TeacherComment: teacherComment.trim(),
      PrincipalComment: principalComment.trim(),
      DaysPresent: daysPresent !== '' ? parseFloat(daysPresent) : null,
      DaysOpened: daysOpened !== '' ? parseFloat(daysOpened) : null,
      AffectiveRatings: affectiveRatings,
      PsychomotorRatings: psychomotorRatings,
      PromotionDecision: promotionDecision.trim()
    };

    // 1. Immediately update in-memory state in App so progress is preserved in session
    onSaveScores(student.StudentID, session, term, payloadScores, remarksPayload);

    // 2. Transmit in real-time to Firebase Firestore
    const result = await FirebaseService.saveStudentReportCard({
      studentId: student.StudentID,
      className: student.Class,
      session,
      term,
      scores: payloadScores,
      summary: remarksPayload,
      affectiveRatings,
      psychomotorRatings,
      promotionDecision: promotionDecision.trim()
    });

    setIsSaving(false);

    if (result.success) {
      // Clear local draft since it's now safely recorded
      try {
        localStorage.removeItem(getDraftKey(student.StudentID, session, term));
      } catch {}
      setIsDirty(false);
      setHasRestoredDraft(false);
      setDraftSavedAt(null);

      setSaveFeedback({ message: result.message || 'Report card saved successfully!', type: 'success' });
      onSaveSuccess();

      if (andGoNext && nextStudent) {
        setTimeout(() => {
          onNavigateToStudent(nextStudent);
        }, 300);
      }
    } else {
      setSaveFeedback({ message: result.message || 'Failed to save scores to Firebase. Your local draft is preserved safely.', type: 'error' });
    }
  };

  // Safe Navigation Handler: auto-saves in memory if dirty before leaving
  const handleSafeBackToRoster = () => {
    if (isDirty) {
      const payloadScores = computedList.map((c) => ({
        Subject: c.subject,
        CA1: c.ca1,
        CA2: c.ca2,
        Exam: c.exam,
        Total: c.total
      }));
      const remarksPayload = {
        TeacherComment: teacherComment.trim(),
        PrincipalComment: principalComment.trim(),
        DaysPresent: daysPresent !== '' ? parseFloat(daysPresent) : null,
        DaysOpened: daysOpened !== '' ? parseFloat(daysOpened) : null,
        AffectiveRatings: affectiveRatings,
        PsychomotorRatings: psychomotorRatings,
        PromotionDecision: promotionDecision.trim()
      };
      onSaveScores(student.StudentID, session, term, payloadScores, remarksPayload);
    }
    onBackToRoster();
  };

  const handleSafeNavigateToStudent = (targetStudent: Student) => {
    if (isDirty) {
      const payloadScores = computedList.map((c) => ({
        Subject: c.subject,
        CA1: c.ca1,
        CA2: c.ca2,
        Exam: c.exam,
        Total: c.total
      }));
      const remarksPayload = {
        TeacherComment: teacherComment.trim(),
        PrincipalComment: principalComment.trim(),
        DaysPresent: daysPresent !== '' ? parseFloat(daysPresent) : null,
        DaysOpened: daysOpened !== '' ? parseFloat(daysOpened) : null,
        AffectiveRatings: affectiveRatings,
        PsychomotorRatings: psychomotorRatings,
        PromotionDecision: promotionDecision.trim()
      };
      onSaveScores(student.StudentID, session, term, payloadScores, remarksPayload);
    }
    onNavigateToStudent(targetStudent);
  };

  // Trait rating updater
  const handleAffectiveRatingChange = (trait: string, rating: number) => {
    const updated = { ...affectiveRatings, [trait]: rating };
    setAffectiveRatings(updated);
    setIsDirty(true);
    saveDraftToStorage(subjectScores, teacherComment, principalComment, daysPresent, daysOpened, updated, psychomotorRatings, promotionDecision);
  };

  const handlePsychomotorRatingChange = (skill: string, rating: number) => {
    const updated = { ...psychomotorRatings, [skill]: rating };
    setPsychomotorRatings(updated);
    setIsDirty(true);
    saveDraftToStorage(subjectScores, teacherComment, principalComment, daysPresent, daysOpened, affectiveRatings, updated, promotionDecision);
  };

  const handlePromotionDecisionChange = (decision: string) => {
    setPromotionDecision(decision);
    setIsDirty(true);
    saveDraftToStorage(subjectScores, teacherComment, principalComment, daysPresent, daysOpened, affectiveRatings, psychomotorRatings, decision);
  };

  // Quick Comment Presets categorized by student achievement
  const isThirdTerm = term === 'Third Term';
  const quickTeacherComments = [
    'An outstanding, brilliant performance! Hearty congratulations on this sterling achievement. Keep flying high!',
    'A commendable and very good academic performance! You have shown remarkable dedication and good character.',
    'A fair effort with a credit pass, but you must work harder, pay closer attention in class, and revise regularly.',
    'A borderline pass. You need to work much harder and put in extra study hours across all weak subjects.',
    'An unsatisfactory performance. You must sit up immediately, eliminate all distractions, and get serious with your education.',
    ...(isThirdTerm
      ? [
          'Promoted to the next class with distinction. Keep up the high standards!',
          'Promoted to the next class. Advised to work harder in the new grade.',
          'Advised to repeat the class to build a stronger foundational understanding.'
        ]
      : [])
  ];

  const [isDeletingResult, setIsDeletingResult] = useState(false);
  const [showDeleteResultModal, setShowDeleteResultModal] = useState(false);

  // Delete Result logic
  const handleConfirmDeleteResult = async () => {
    setIsDeletingResult(true);
    try {
      // Clear draft
      try {
        localStorage.removeItem(getDraftKey(student.StudentID, session, term));
      } catch {}

      if (onDeleteReportCard) {
        await onDeleteReportCard(student.StudentID, session, term);
      } else {
        await FirebaseService.deleteStudentReportCard({
          studentId: student.StudentID,
          className: student.Class,
          session,
          term
        });
      }

      // Reset local score form
      const blankMap: Record<string, { ca1: string; ca2: string; exam: string }> = {};
      for (const subj of levelSubjects) {
        blankMap[subj] = { ca1: '', ca2: '', exam: '' };
      }
      setSubjectScores(blankMap);
      setTeacherComment('');
      setPrincipalComment('');
      setDaysPresent('');
      setDaysOpened('');
      setIsDirty(false);
      setHasRestoredDraft(false);
      setDraftSavedAt(null);

      setShowDeleteResultModal(false);
      setSaveFeedback({
        message: `Report card result for ${student.FullName} (${term}, ${session}) was deleted.`,
        type: 'success'
      });
      onSaveSuccess();
    } catch (err: any) {
      setSaveFeedback({
        message: `Failed to delete result: ${err?.message || 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setIsDeletingResult(false);
    }
  };

  return (
    <div className="space-y-4 pb-28 md:pb-12">
      {/* Top Mobile/Desktop Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-2.5 no-print">
        <button
          id="back-to-roster-btn"
          type="button"
          onClick={handleSafeBackToRoster}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Pupils</span>
        </button>

        {/* Pupil Carousel Navigation Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="prev-student-btn"
            type="button"
            disabled={!prevStudent || isSaving}
            onClick={() => prevStudent && handleSafeNavigateToStudent(prevStudent)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors cursor-pointer"
            title={prevStudent ? `Go to ${prevStudent.FullName}` : 'First pupil'}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <span className="text-[11px] font-mono font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded-md">
            {currentIndex + 1} / {allClassStudents.length}
          </span>

          <button
            id="next-student-btn"
            type="button"
            disabled={!nextStudent || isSaving}
            onClick={() => nextStudent && handleSafeNavigateToStudent(nextStudent)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-colors cursor-pointer"
            title={nextStudent ? `Go to ${nextStudent.FullName}` : 'Last pupil'}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* View Layout Toggle (Card vs Table) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-1.5 sm:px-2.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
              viewMode === 'cards'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Card View (Mobile optimized)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 sm:px-2.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Table View (Spreadsheet format)"
          >
            <List className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* Auto-Save & Draft Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-[11px]">
              <HardDrive className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Unsaved changes protected (Draft auto-saved {draftSavedAt ? `@ ${draftSavedAt}` : 'locally'})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>All progress synchronized</span>
            </span>
          )}
        </div>

        {hasRestoredDraft && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Restored unsubmitted draft from your previous session
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold underline flex items-center gap-1 cursor-pointer"
              title="Discard draft and restore original scores"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Discard Draft</span>
            </button>
          </div>
        )}
      </div>

      {/* Save Feedback Banner */}
      {saveFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in ${
            saveFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{saveFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold px-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Pupil Profile Card & Live Metrics */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-xs font-mono font-bold tracking-wider uppercase bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {student.StudentID}
              </span>
              <span className="text-slate-400 text-xs">&bull;</span>
              <span className="text-slate-300 text-xs font-semibold">
                {student.Class} ({classLevel === 'JuniorSecondary' ? 'Junior Sec' : classLevel === 'Nursery' ? 'Nursery' : 'Primary'})
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {student.FullName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 pt-0.5">
              <span>{term}</span>
              <span>&bull;</span>
              <span>{session}</span>
              <span>&bull;</span>
              <span>{levelSubjects.length} Subjects</span>
            </div>
          </div>

          {/* Live Average Metric */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 sm:p-4 text-center sm:text-right min-w-36">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
              Average Score
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
              {liveAverageStats.average !== null ? `${liveAverageStats.average}%` : '—'}
            </div>
            <div className="text-[10px] text-slate-300 mt-0.5 font-medium">
              {liveAverageStats.completedCount}/{levelSubjects.length} Completed
            </div>
          </div>
        </div>
      </div>

      {/* Continuous Assessment Scores Area */}
      {isLoadingFresh ? (
        <div className="bg-white border border-slate-200 rounded-xl py-16 text-center text-slate-500 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-800 mb-2" />
          <p className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
            Fetching Fresh Pupil Data From Google Sheet...
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* MOBILE CARD VIEW: Subject Touch Cards */
        <div className="space-y-3">
          {computedList.map((item, idx) => {
            const raw = subjectScores[item.subject] || { ca1: '', ca2: '', exam: '' };
            return (
              <div
                key={item.subject}
                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3"
              >
                {/* Header: Subject Name, Total & Grade Badge */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      {item.subject}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block leading-tight uppercase font-semibold">Total</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {item.total !== null ? `${item.total}/100` : '—'}
                      </span>
                    </div>
                    <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${item.grade.badgeColor}`}>
                      {item.grade.grade}
                    </span>
                  </div>
                </div>

                {/* Score Input Boxes: CA1, CA2, Exam */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                  {/* CA1 */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">
                      1st CA ({maxCa1})
                    </label>
                    <input
                      id={`card-score-${item.subject}-ca1`}
                      type="text"
                      inputMode="numeric"
                      value={raw.ca1}
                      onChange={(e) => handleScoreChange(item.subject, 'ca1', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="—"
                      className="w-full text-center py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-900"
                    />
                  </div>

                  {/* CA2 */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">
                      2nd CA ({maxCa2})
                    </label>
                    <input
                      id={`card-score-${item.subject}-ca2`}
                      type="text"
                      inputMode="numeric"
                      value={raw.ca2}
                      onChange={(e) => handleScoreChange(item.subject, 'ca2', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="—"
                      className="w-full text-center py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-900"
                    />
                  </div>

                  {/* Exam */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-center">
                      Exam ({maxExam})
                    </label>
                    <input
                      id={`card-score-${item.subject}-exam`}
                      type="text"
                      inputMode="numeric"
                      value={raw.exam}
                      onChange={(e) => handleScoreChange(item.subject, 'exam', e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="—"
                      className="w-full text-center py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:bg-white text-slate-900"
                    />
                  </div>
                </div>

                {/* Footer remark and status */}
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-50">
                  <span>Remark: <strong className="text-slate-700 font-medium">{item.grade.remark}</strong></span>
                  {item.isComplete && (
                    <span className="text-emerald-700 text-[10px] font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Complete
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (Spreadsheet format) */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-10 text-center">#</th>
                  <th className="py-2.5 px-4">Subject Name</th>
                  <th className="py-2.5 px-3 w-28 text-center">CA 1 ({maxCa1})</th>
                  <th className="py-2.5 px-3 w-28 text-center">CA 2 ({maxCa2})</th>
                  <th className="py-2.5 px-3 w-28 text-center">Exam ({maxExam})</th>
                  <th className="py-2.5 px-3 w-24 text-center">Total ({maxTotal})</th>
                  <th className="py-2.5 px-3 w-24 text-center">Grade</th>
                  <th className="py-2.5 px-4 w-32">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {computedList.map((item, idx) => {
                  const raw = subjectScores[item.subject] || { ca1: '', ca2: '', exam: '' };
                  return (
                    <tr key={item.subject} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {item.subject}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          id={`score-${item.subject}-ca1`}
                          type="text"
                          inputMode="numeric"
                          value={raw.ca1}
                          onChange={(e) => handleScoreChange(item.subject, 'ca1', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder="—"
                          className="w-18 mx-auto text-center py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          id={`score-${item.subject}-ca2`}
                          type="text"
                          inputMode="numeric"
                          value={raw.ca2}
                          onChange={(e) => handleScoreChange(item.subject, 'ca2', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder="—"
                          className="w-18 mx-auto text-center py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          id={`score-${item.subject}-exam`}
                          type="text"
                          inputMode="numeric"
                          value={raw.exam}
                          onChange={(e) => handleScoreChange(item.subject, 'exam', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                          placeholder="—"
                          className="w-18 mx-auto text-center py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 text-sm">
                        {item.total !== null ? item.total : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${item.grade.badgeColor}`}>
                          {item.grade.grade}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 text-[11px] font-medium">
                        {item.grade.remark}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance & Comment Presets Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attendance Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Term Attendance (Optional)
            </h3>
            {attendancePercentage !== null && (
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                Rate: {attendancePercentage}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Days Present
              </label>
              <input
                id="attendance-present-input"
                type="number"
                min="0"
                value={daysPresent}
                onChange={(e) => handleDaysPresentChange(e.target.value)}
                placeholder="e.g. 58"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Days Opened
              </label>
              <input
                id="attendance-opened-input"
                type="number"
                min="0"
                value={daysOpened}
                onChange={(e) => handleDaysOpenedChange(e.target.value)}
                placeholder="e.g. 60"
                className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Quick Comment helper */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Comments</span>
            </h3>
            <span className="text-[10px] text-slate-400">Tap to insert</span>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto">
            {quickTeacherComments.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTeacherCommentChange(preset)}
                className="text-[11px] text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
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
          {/* Affective Domain Traits */}
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

          {/* Psychomotor Skills */}
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

        {/* Promotion Decision Selection (Particularly prominent for 3rd Term or Annual Finalization) */}
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

      {/* Free Text Comments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Class Teacher's Comment */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-2">
          <label className="block font-bold text-slate-900 text-xs uppercase tracking-wider">
            Class Teacher&apos;s Remark / Comment
          </label>
          <textarea
            id="teacher-comment-textarea"
            rows={3}
            value={teacherComment}
            onChange={(e) => handleTeacherCommentChange(e.target.value)}
            placeholder="e.g. An exceptional and diligent pupil who demonstrates high cognitive capacity..."
            className="w-full text-xs text-slate-900 p-3 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 leading-relaxed"
          />
        </div>

        {/* Head Teacher / Principal's Comment */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs space-y-2">
          <label className="block font-bold text-slate-900 text-xs uppercase tracking-wider">
            Head Teacher / Principal&apos;s Remark (Optional)
          </label>
          <textarea
            id="principal-comment-textarea"
            rows={3}
            value={principalComment}
            onChange={(e) => handlePrincipalCommentChange(e.target.value)}
            placeholder="e.g. A commendable academic standing. Approved for promotion..."
            className="w-full text-xs text-slate-900 p-3 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 leading-relaxed"
          />
        </div>
      </div>

      {/* Sticky Bottom Action Bar (Fixed above mobile bottom nav) */}
      <div className="sticky bottom-16 md:bottom-0 bg-white/95 backdrop-blur-md border border-slate-300 p-3 sm:p-4 rounded-xl shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 z-20">
        <div className="flex items-center justify-between sm:justify-start gap-2 text-xs text-slate-600">
          <div>
            <span className="font-bold text-slate-900">Completed: </span>
            <span>{liveAverageStats.completedCount} of {levelSubjects.length}</span>
          </div>
          <span>&bull;</span>
          <div>
            <span className="font-bold text-slate-900">Average: </span>
            <strong className="text-slate-900 font-mono">{liveAverageStats.average !== null ? `${liveAverageStats.average}%` : '—'}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Delete / Clear Result Button */}
          <button
            type="button"
            id="delete-result-trigger-btn"
            disabled={isSaving || isDeletingResult || isLoadingFresh}
            onClick={() => setShowDeleteResultModal(true)}
            className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            title={`Delete ${student.FullName}'s ${term} ${session} result`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete Result</span>
          </button>

          <button
            type="button"
            id="save-report-btn"
            disabled={isSaving || isDeletingResult || isLoadingFresh}
            onClick={() => performSave(false)}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save</span>
          </button>

          {nextStudent ? (
            <button
              type="button"
              id="save-and-next-btn"
              disabled={isSaving || isDeletingResult || isLoadingFresh}
              onClick={() => performSave(true)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              title={`Save and proceed directly to ${nextStudent.FullName}`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Save &amp; Next Pupil</span>
            </button>
          ) : (
            <button
              type="button"
              id="save-and-finish-btn"
              disabled={isSaving || isDeletingResult || isLoadingFresh}
              onClick={() => performSave(false)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Save (Last Pupil)</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Result Confirmation Modal */}
      {showDeleteResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete Student Result?</h3>
                <p className="text-xs text-slate-500">
                  {student.FullName} ({student.StudentID})
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 space-y-1">
              <p className="font-bold">This will permanently delete:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-rose-800">
                <li>All subject scores for <strong>{term}</strong> ({session})</li>
                <li>Teacher and Principal remarks</li>
                <li>Attendance records (Days Present / Days Opened)</li>
              </ul>
              <p className="pt-1 text-[11px] text-rose-700">
                This deletion syncs directly with Google Sheets.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingResult}
                onClick={() => setShowDeleteResultModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-result-btn"
                disabled={isDeletingResult}
                onClick={handleConfirmDeleteResult}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeletingResult ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeletingResult ? 'Deleting...' : 'Yes, Delete Result'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

