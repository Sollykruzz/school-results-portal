import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Student, SubjectRule, SubjectScore, StudentSummary, TermType, WebsiteConfig } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { SchoolStamp } from './SchoolStamp';
import { printElementDirectly } from '../utils/printHelper';
import { FirebaseService } from '../services/firebaseService';
import { processPassportPhoto } from '../utils/imageUpload';
import { safeStorage, safeSessionStorage } from '../utils/safeStorage';
import {
  getGradeAndRemark,
  getAutoReportRemark,
  getNextClassName,
  calculateSubjectTotal,
  getScoringConfig,
  calculateStudentOverallAverage,
  computeClassRankings,
  computeSubjectPositionsForStudent,
  computeAnnualCumulativeForStudent,
  getAuthoritativeSubjectsForClass,
  isMatchingClass,
  isMatchingStudentId,
  DEFAULT_CURRENT_SESSION
} from '../utils/grading';
import {
  Printer,
  X,
  User,
  Camera,
  FileCheck
} from 'lucide-react';
import { getActiveSchoolConfig, SchoolTemplateConfig } from '../config/schoolConfig';

interface StudentReportCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  allClassStudents?: Student[];
  allScores?: SubjectScore[];
  allSummaries?: StudentSummary[];
  subjectsList?: SubjectRule[];
  session?: string;
  term?: TermType;
  publishedDate?: string;
  websiteConfig?: WebsiteConfig;
  schoolConfig?: Partial<SchoolTemplateConfig>;
}

export const StudentReportCardModal: React.FC<StudentReportCardModalProps> = ({
  isOpen,
  onClose,
  student,
  allClassStudents = [],
  allScores = [],
  allSummaries = [],
  subjectsList = [],
  session = DEFAULT_CURRENT_SESSION,
  term = 'First Term',
  publishedDate,
  websiteConfig,
  schoolConfig
}) => {
  const activeSchool = websiteConfig
    ? getActiveSchoolConfig({
        schoolName: websiteConfig.schoolName,
        shortName: websiteConfig.shortName,
        motto: websiteConfig.motto,
        subMotto: websiteConfig.subMotto,
        logoUrl: websiteConfig.logoUrl,
        stampTopText: websiteConfig.stampTopText,
        stampBottomText: websiteConfig.stampBottomText,
        campusAddress: websiteConfig.campusAddress,
        cityState: websiteConfig.cityState,
        phonePrimary: websiteConfig.phonePrimary,
        ...schoolConfig
      })
    : getActiveSchoolConfig(schoolConfig);

  const cleanStudentId = useMemo(() => {
    return (student?.StudentID || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }, [student?.StudentID]);

  const scoringConfig = useMemo(() => getScoringConfig(session, term), [session, term]);

  const resolveStudentPhoto = (studentRecord: Partial<Student> | undefined, fallbackId?: string) => {
    const storedFallback = safeStorage.getItem(`student_photo_${fallbackId || cleanStudentId}`) || '';
    return studentRecord?.PhotoURL || studentRecord?.PassportUrl || (studentRecord as any)?.photoUrl || storedFallback;
  };

  const [studentPhoto, setStudentPhoto] = useState<string>(() => resolveStudentPhoto(student, cleanStudentId));
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    const nextPhoto = resolveStudentPhoto(student, cleanStudentId);
    setStudentPhoto(nextPhoto);
  }, [student, cleanStudentId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selected file is not an image. Please choose a valid image file (JPG or PNG).');
      return;
    }

    if (file.size > 100 * 1024) {
      alert(
        `Passport photograph must be 100KB or lower. Selected file is ${(file.size / 1024).toFixed(1)}KB.`
      );
      return;
    }

    try {
      setIsUploadingPhoto(true);
      const dataUrl = await processPassportPhoto(file, 100 * 1024);
      const studentIdValue = student.StudentID || '';
      const cId = studentIdValue.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

      setStudentPhoto(dataUrl);
      safeStorage.setItem(`student_photo_${cId}`, dataUrl);

      const updatedStudent = { ...student, PhotoURL: dataUrl, PassportUrl: dataUrl };

      try {
        const savedAuth = safeSessionStorage.getItem('school_portal_student_auth');
        if (savedAuth) {
          const authStudent = JSON.parse(savedAuth);
          if (authStudent?.StudentID?.toUpperCase() === studentIdValue.toUpperCase()) {
            safeSessionStorage.setItem(
              'school_portal_student_auth',
              JSON.stringify({ ...authStudent, PhotoURL: dataUrl, PassportUrl: dataUrl })
            );
          }
        }
      } catch {}

      try {
        await FirebaseService.saveStudent(updatedStudent);
      } catch (saveErr) {
        console.warn('Could not persist student photo in database:', saveErr);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to process passport photograph.');
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  if (!isOpen || !student) return null;

  const safeFullName = student.FullName || 'Pupil';
  const safeStudentId = student.StudentID || '—';
  const safeClass = student.Class || '—';
  const safeGender = student.Gender || 'Pupil';
  const safeSession = session || DEFAULT_CURRENT_SESSION;
  const safeTerm: TermType = (term as TermType) || 'First Term';

  const authoritativeSubjects = useMemo(() => {
    try {
      return getAuthoritativeSubjectsForClass(safeClass, subjectsList) || [];
    } catch {
      return [];
    }
  }, [safeClass, subjectsList]);

  const subjectPositions = useMemo(() => {
    try {
      return computeSubjectPositionsForStudent(
        student,
        allClassStudents,
        allScores,
        safeSession,
        safeTerm
      );
    } catch (e) {
      console.error('Failed to compute subject positions:', e);
      return {};
    }
  }, [student, allClassStudents, allScores, safeSession, safeTerm]);

  const studentScores = useMemo(() => {
    return (allScores || []).filter(
      (s) =>
        s &&
        isMatchingStudentId(s.StudentID, safeStudentId) &&
        s.Term === safeTerm &&
        (s.Session === safeSession || !s.Session)
    );
  }, [allScores, safeStudentId, safeTerm, safeSession]);

  const scoreRows = useMemo(() => {
    return authoritativeSubjects.map((subjectName) => {
      const matched = studentScores.find(
        (s) => s && s.Subject && String(s.Subject).trim().toLowerCase() === String(subjectName).trim().toLowerCase()
      );
      const ca1 = matched?.CA1 ?? null;
      const ca2 = matched?.CA2 ?? null;
      const exam = matched?.Exam ?? null;
      const total = matched?.Total ?? calculateSubjectTotal(ca1, ca2, exam);
      const gradeInfo = getGradeAndRemark(total);
      const subjPos = total !== null ? (subjectPositions[String(subjectName).trim().toLowerCase()] || '—') : '—';

      return {
        subject: subjectName,
        ca1,
        ca2,
        exam,
        total,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        position: subjPos
      };
    });
  }, [authoritativeSubjects, studentScores, subjectPositions]);

  const displayRows = scoreRows;

  const overallStats = useMemo(() => {
    try {
      return calculateStudentOverallAverage(
        displayRows.map((r) => ({ subject: r.subject, total: r.total }))
      );
    } catch {
      return { completedCount: 0, totalMarks: 0, average: null };
    }
  }, [displayRows]);

  const summaryRecord = useMemo(() => {
    return (allSummaries || []).find(
      (s) =>
        s &&
        isMatchingStudentId(s.StudentID, safeStudentId) &&
        s.Term === safeTerm &&
        (s.Session === safeSession || !s.Session)
    );
  }, [allSummaries, safeStudentId, safeTerm, safeSession]);

  const classPeers = useMemo(() => {
    return (allClassStudents || []).filter((s) => s && isMatchingClass(s.Class, safeClass));
  }, [allClassStudents, safeClass]);

  const classRankings = useMemo(() => {
    try {
      return computeClassRankings(
        classPeers,
        allScores,
        safeSession,
        safeTerm,
        authoritativeSubjects
      );
    } catch {
      return [];
    }
  }, [classPeers, allScores, safeSession, safeTerm, authoritativeSubjects]);

  const studentRanking = useMemo(() => {
    return classRankings.find((r) => r?.student && isMatchingStudentId(r.student.StudentID, safeStudentId));
  }, [classRankings, safeStudentId]);

  const daysPresent = summaryRecord?.DaysPresent ?? null;
  const daysOpened = summaryRecord?.DaysOpened ?? null;
  const attendanceRate =
    daysPresent !== null && daysOpened !== null && daysOpened > 0
      ? Math.min(100, Math.round((Number(daysPresent) / Number(daysOpened)) * 100))
      : null;

  const annualCumulative = useMemo(() => {
    try {
      return computeAnnualCumulativeForStudent(
        safeStudentId,
        safeSession,
        allScores,
        authoritativeSubjects,
        safeClass
      );
    } catch {
      return {
        firstTermAverage: null,
        secondTermAverage: null,
        thirdTermAverage: null,
        annualCumulativeAverage: null,
        annualGrade: '—',
        annualRemark: '—',
        promotionStatus: 'Awaiting Full Assessment',
        promotedToClass: 'Next Class',
        subjectBreakdown: [],
        hasFirstTermData: false,
        hasSecondTermData: false,
        hasThirdTermData: false,
      };
    }
  }, [safeStudentId, safeSession, allScores, authoritativeSubjects, safeClass]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('report-card-modal-open');
    return () => {
      document.body.classList.remove('report-card-modal-open');
    };
  }, [isOpen]);

  const handlePrint = () => {
    try {
      const docTitle = `Report_Card_${(safeFullName || 'Student').replace(/[^a-zA-Z0-9]/g, '_')}_${(safeClass || '').replace(/[^a-zA-Z0-9]/g, '_')}_${(safeTerm || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
      printElementDirectly('printable-report-sheet', docTitle);
    } catch (e) {
      console.warn('Direct print error, falling back:', e);
      window.print();
    }
  };

  const isThirdTerm =
    safeTerm === 'Third Term' ||
    String(safeTerm).toLowerCase().includes('3rd') ||
    String(safeTerm).toLowerCase().includes('third');

  const effectiveAverage =
    overallStats.average !== null ? overallStats.average : annualCumulative.annualCumulativeAverage;

  const isPromoted = effectiveAverage !== null ? effectiveAverage >= 50 : false;
  const nextClass = annualCumulative.promotedToClass || getNextClassName(safeClass);

  const autoGeneratedRemark = getAutoReportRemark(effectiveAverage, isThirdTerm, isPromoted);

  const displayRemark =
    summaryRecord?.TeacherComment?.trim() && summaryRecord?.PrincipalComment?.trim()
      ? `${summaryRecord.TeacherComment.trim()} ${summaryRecord.PrincipalComment.trim()}`
      : summaryRecord?.TeacherComment?.trim() ||
        summaryRecord?.PrincipalComment?.trim() ||
        autoGeneratedRemark;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return new Date().toLocaleDateString();
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString();
    } catch {
      return new Date().toLocaleDateString();
    }
  };

  return createPortal(
    <div
      id="report-card-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex justify-center items-start overflow-y-auto p-0 sm:p-4 md:p-6"
    >
      <div
        id="report-card-modal-container"
        className="bg-white rounded-none sm:rounded-2xl shadow-2xl max-w-4xl w-full my-0 sm:my-3 overflow-hidden border-0 sm:border border-slate-200 flex flex-col min-h-screen sm:min-h-0"
      >
        <div className="no-print bg-slate-950 text-white px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between border-b border-slate-800 shrink-0 sticky top-0 z-30 shadow-md">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase truncate">
                {safeFullName}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {safeStudentId} &bull; {safeClass} &bull; {safeTerm} &bull; {safeSession}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <label
              htmlFor="modal-photo-upload-input"
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Upload / Change Student Passport Photograph"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{studentPhoto ? 'Change Photo' : 'Add Photo'}</span>
              <input
                id="modal-photo-upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>

            <button
              id="print-report-card-btn"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 transition-all shadow-lg"
              title="Print or save as 1-page A4 PDF"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Print / PDF</span>
            </button>

            <button
              id="close-report-modal-btn"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-90 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-2 sm:p-4 md:p-5 overflow-y-auto bg-slate-100/80 print:bg-white print:p-0 print:overflow-visible flex-1">
          <div
            id="printable-report-sheet"
            className="bg-white border border-slate-300 print:border-none rounded-lg p-2 sm:p-2.5 print:p-0 shadow-sm print:shadow-none mx-auto w-full max-w-[780px] text-slate-900 box-border"
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-slate-950 pb-3 mb-3.5">
              <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] print:w-[68px] print:h-[68px] shrink-0 flex items-center justify-center">
                <SchoolLogo
                  size="lg"
                  src={activeSchool.logoUrl}
                  alt={activeSchool.schoolName}
                  className="w-16 h-16 sm:w-[72px] sm:h-[72px] print:w-[68px] print:h-[68px] object-contain"
                />
              </div>

              <div className="flex-1 text-center min-w-0 px-1">
                <h1 className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-950 uppercase font-serif leading-none truncate sm:whitespace-normal">
                  {activeSchool.schoolName}
                </h1>
                <p className="text-[11px] sm:text-[12px] font-bold text-slate-800 uppercase tracking-wider mt-0.5">
                  MOTTO: {activeSchool.motto}
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-600 tracking-tight mt-0.5 truncate">
                  {activeSchool.campusAddress}{activeSchool.cityState ? `, ${activeSchool.cityState}` : ''} • Tel: {activeSchool.phonePrimary}
                </p>
                <div className="mt-1 inline-block bg-slate-900 text-white px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-widest">
                  CONTINUOUS ASSESSMENT &amp; TERMINAL REPORT SHEET
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center">
                <div
                  className="w-[66px] h-[80px] sm:w-[72px] sm:h-[86px] border-2 border-slate-400 bg-slate-100 rounded-md relative overflow-hidden flex flex-col items-center justify-center text-center"
                  title="Student Passport Photograph"
                >
                  {studentPhoto ? (
                    <img src={studentPhoto} alt={safeFullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-1 text-slate-400">
                      <User className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 mb-0.5" />
                      <span className="text-[9px] font-black uppercase text-slate-600 leading-tight tracking-tighter">
                        PASSPORT
                      </span>
                      <span className="text-[8.5px] text-slate-400 uppercase tracking-tighter">PHOTO</span>
                    </div>
                  )}

                  <label
                    htmlFor="card-direct-photo-upload"
                    className="no-print absolute inset-0 bg-slate-950/75 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer p-1"
                  >
                    <Camera className="w-3 h-3 mb-0.5 text-amber-300" />
                    <span className="text-[9px] font-bold leading-tight">{studentPhoto ? 'Change' : 'Upload'}</span>
                    <input
                      id="card-direct-photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                </div>
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-tight mt-0.5">
                  STUDENT PHOTO
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-x-2.5 gap-y-2 text-[12px] bg-slate-50 border border-slate-300 rounded-md p-3 mb-3.5 text-slate-900">
              <div className="col-span-2 sm:col-span-3">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Pupil's Full Name</span>
                <strong className="text-slate-950 font-bold text-[12px] block truncate">{safeFullName}</strong>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Admission No / ID</span>
                <strong className="text-slate-950 font-mono font-bold text-[12px] block">{safeStudentId}</strong>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Class / Grade</span>
                <strong className="text-slate-950 font-bold text-[12px] block">{safeClass}</strong>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Gender</span>
                <strong className="text-slate-950 font-bold text-[12px] block">{safeGender}</strong>
              </div>

              <div className="col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Academic Session</span>
                <strong className="text-slate-900 font-bold block text-[11px]">{safeSession}</strong>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Term</span>
                <strong className="text-slate-900 font-bold block text-[11px]">{safeTerm}</strong>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Attendance</span>
                <strong className="text-slate-900 font-bold block text-[11px]">
                  {daysPresent !== null && daysOpened ? `${daysPresent}/${daysOpened} (${attendanceRate}%)` : 'Regular'}
                </strong>
              </div>
              <div className="col-span-1 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Position</span>
                <strong className="text-amber-900 font-bold block text-[11px]">
                  {studentRanking ? studentRanking.positionLabel : '—'}{classPeers.length > 0 ? `/${classPeers.length}` : ''}
                </strong>
              </div>
              <div className="col-span-1 sm:col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Average</span>
                <strong className="text-slate-950 font-mono font-bold block text-[11px]">
                  {overallStats.average !== null ? `${overallStats.average}%` : '—'}
                </strong>
              </div>
            </div>

            <div className="mb-3.5 border border-slate-300 rounded-md overflow-hidden">
              <table className="w-full text-left text-[12px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10.5px]">
                    <th className="py-1 px-1.5 border-r border-slate-700 w-6 text-center">S/N</th>
                    <th className="py-1 px-2 border-r border-slate-700">Subject</th>
                    <th className="py-1 px-1 border-r border-slate-700 text-center w-12">CA 1 ({scoringConfig.maxCA1})</th>
                    <th className="py-1 px-1 border-r border-slate-700 text-center w-12">CA 2 ({scoringConfig.maxCA2})</th>
                    <th className="py-1 px-1 border-r border-slate-700 text-center w-12">Exam ({scoringConfig.maxExam})</th>
                    <th className="py-1 px-1 border-r border-slate-700 text-center w-14 bg-slate-800 text-amber-300">Total ({scoringConfig.maxTotal})</th>
                    <th className="py-1 px-1 border-r border-slate-700 text-center w-10">Grade</th>
                    <th className="py-1 px-1 border-r border-slate-700 text-center w-10 text-amber-300">Pos.</th>
                    <th className="py-1 px-1.5 text-left min-w-[80px]">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {displayRows.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                      <td className="py-1 px-1.5 border-r border-slate-200 text-center text-slate-500 font-sans">{idx + 1}</td>
                      <td className="py-1 px-2 border-r border-slate-200 font-sans font-medium text-slate-900">{row.subject}</td>
                      <td className="py-1 px-1 border-r border-slate-200 text-center text-slate-700">{row.ca1 !== null ? row.ca1 : '—'}</td>
                      <td className="py-1 px-1 border-r border-slate-200 text-center text-slate-700">{row.ca2 !== null ? row.ca2 : '—'}</td>
                      <td className="py-1 px-1 border-r border-slate-200 text-center text-slate-700">{row.exam !== null ? row.exam : '—'}</td>
                      <td className="py-1 px-1 border-r border-slate-200 text-center font-bold text-slate-950 bg-slate-100/60 font-mono">{row.total !== null ? row.total : '—'}</td>
                      <td className="py-1 px-1 border-r border-slate-200 text-center font-sans font-black text-slate-900">{row.grade}</td>
                      <td className="py-1 px-1 border-r border-slate-200 text-center font-sans font-bold text-amber-900 bg-amber-50/40">{row.position}</td>
                      <td className="py-1 px-1.5 font-sans text-slate-700 text-[10px]">{row.remark}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t border-slate-300 text-[11px]">
                    <td colSpan={5} className="py-1 px-2 text-right font-sans uppercase text-slate-700">Total Marks Aggregate:</td>
                    <td className="py-1 px-1 text-center font-mono text-slate-950 font-black">{overallStats.totalMarks}</td>
                    <td colSpan={3} className="py-1 px-1.5 text-left font-sans text-slate-700 text-[10px]">
                      {overallStats.completedCount} of {displayRows.length} Subjects Graded &bull; Average: {overallStats.average !== null ? `${overallStats.average}%` : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-3 text-[10px]">
              <div className="border border-slate-300 rounded-md p-2.5 bg-slate-50/60 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1 mb-1">
                    Grading Scale
                  </h4>
                  <div className="space-y-0.5 text-[9.5px] text-slate-700 leading-snug">
                    <div className="flex justify-between"><span><strong>A (70-100%):</strong> Excellent</span><span><strong>B (60-69%):</strong> V. Good</span></div>
                    <div className="flex justify-between"><span><strong>C (50-59%):</strong> Credit</span><span><strong>D (45-49%):</strong> Pass</span></div>
                    <div><span><strong>F (0-44%):</strong> Fail</span></div>
                  </div>
                </div>

                <div className="mt-1.5 pt-1 border-t border-slate-200">
                  <h5 className="font-bold text-slate-800 uppercase text-[9.5px] tracking-wider mb-0.5">Conduct Traits (1 - 5)</h5>
                  <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[9px] text-slate-700">
                    <div className="flex justify-between"><span>Conduct:</span><strong>5</strong></div>
                    <div className="flex justify-between"><span>Punctuality:</span><strong>5</strong></div>
                    <div className="flex justify-between"><span>Neatness:</span><strong>5</strong></div>
                    <div className="flex justify-between"><span>Attentive:</span><strong>5</strong></div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-300 rounded-md p-2.5 bg-slate-50/60 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider border-b border-slate-200 pb-1 mb-1">
                    Academic Summary
                  </h4>
                  <div className="space-y-0.5 text-[10px] text-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Term Average:</span>
                      <strong className="font-mono">{overallStats.average !== null ? `${overallStats.average}%` : '—'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Class Position:</span>
                      <strong className="text-amber-900">{studentRanking ? studentRanking.positionLabel : '—'} {classPeers.length > 0 ? `of ${classPeers.length}` : ''}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Marks:</span>
                      <strong className="font-mono">{overallStats.totalMarks}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 pt-1 border-t border-slate-200">
                  <span className="text-[9.5px] text-slate-500 uppercase font-semibold block">Decision / Status</span>
                  {isThirdTerm ? (
                    <div className={`mt-0.5 py-1 px-1.5 rounded text-center font-black text-[10px] uppercase tracking-wider border ${
                      isPromoted ? 'bg-emerald-100 text-emerald-950 border-emerald-500' : 'bg-rose-100 text-rose-950 border-rose-500'
                    }`}>
                      {isPromoted ? `PROMOTED TO ${nextClass.toUpperCase()}` : `TO REPEAT ${safeClass.toUpperCase()}`}
                    </div>
                  ) : (
                    <div className="mt-0.5 py-1 px-1.5 rounded text-center font-bold text-[9.5px] uppercase tracking-wider bg-indigo-50 text-indigo-950 border border-indigo-200">
                      Satisfactory Academic Standing
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-slate-300 rounded-md p-2.5 bg-white flex flex-col justify-between relative overflow-hidden">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-1">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Remarks &amp; Endorsement</h4>
                    <span className="text-[9.5px] text-slate-500 font-mono">{formatDate(publishedDate)}</span>
                  </div>
                  <p
                    className="text-slate-800 italic text-[10px] leading-snug"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    "{displayRemark}"
                  </p>
                </div>

                <div className="mt-1.5 pt-1 border-t border-slate-200 relative">
                  <div className="text-[9.5px] text-slate-600">
                    <div>Signature: ___________________</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Principal / Head of School</div>
                  </div>

                  <div className="absolute right-0 -bottom-1 pointer-events-none scale-[0.58] origin-bottom-right opacity-95">
                    <SchoolStamp
                      date={formatDate(publishedDate)}
                      size="sm"
                      schoolName={activeSchool.stampTopText || activeSchool.schoolName}
                      bottomText={activeSchool.stampBottomText || activeSchool.motto}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 text-center text-[9.5px] text-slate-500 border-t border-slate-200 flex items-center justify-between">
              <span>{activeSchool.schoolName} &bull; Official Continuous Assessment Report</span>
              <span>Verified Academic Record</span>
              <span>Session: {safeSession}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
