import React, { useMemo, useState } from 'react';
import { Student, SubjectRule, SubjectScore, Teacher, TermType } from '../types';
import {
  calculateClassPositions,
  calculateSubjectClassStats,
  determineClassLevel,
  getAuthoritativeSubjectsForClass,
  getGradeDetails,
  isMatchingClass
} from '../utils/grading';
import {
  ArrowLeft,
  Award,
  LayoutGrid,
  List,
  Printer,
  TrendingDown,
  TrendingUp,
  Users,
  Globe,
  Send,
  Lock,
  Loader2,
  CheckCircle2,
  EyeOff
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { SchoolStamp } from './SchoolStamp';
import { printElementDirectly } from '../utils/printHelper';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import { WebsiteConfig } from '../types';

interface ClassSummaryProps {
  currentTeacher: Teacher;
  students: Student[];
  allScores: SubjectScore[];
  session: string;
  term: TermType;
  subjectsList: SubjectRule[];
  onBackToRoster: () => void;
  onSelectStudent: (student: Student) => void;
  isPublished?: boolean;
  onTogglePublish?: (isPublished: boolean) => Promise<any> | void;
  websiteConfig?: WebsiteConfig;
}

export const ClassSummary: React.FC<ClassSummaryProps> = ({
  currentTeacher,
  students,
  allScores,
  session,
  term,
  subjectsList,
  onBackToRoster,
  onSelectStudent,
  isPublished = false,
  onTogglePublish,
  websiteConfig
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
      })
    : getActiveSchoolConfig();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'published' | 'unpublished';
    message: string;
  } | null>(null);

  const handlePublishToggle = async () => {
    if (!onTogglePublish) return;
    setIsPublishing(true);
    setFeedback(null);
    try {
      const willPublish = !isPublished;
      await onTogglePublish(willPublish);
      setFeedback({
        type: willPublish ? 'published' : 'unpublished',
        message: willPublish
          ? `Result Published! Results for ${currentTeacher.ClassAssigned} (${term}, ${session}) are now immediately available on the Student Portal.`
          : `Result Unpublished! Results for ${currentTeacher.ClassAssigned} (${term}, ${session}) have been taken down and are now hidden from the Student Portal.`
      });
      setTimeout(() => setFeedback(null), 6000);
    } finally {
      setIsPublishing(false);
    }
  };

  // 1. Filter students in this class
  const classStudents = useMemo(() => {
    return students.filter(
      (s) => isMatchingClass(s.Class, currentTeacher.ClassAssigned)
    );
  }, [students, currentTeacher.ClassAssigned]);

  const classLevel = useMemo(() => determineClassLevel(currentTeacher.ClassAssigned), [currentTeacher.ClassAssigned]);

  // 2. Authoritative subject names assigned to this class
  const authoritativeSubjectNames = useMemo(() => {
    return getAuthoritativeSubjectsForClass(currentTeacher.ClassAssigned, subjectsList);
  }, [subjectsList, currentTeacher.ClassAssigned]);

  // 3. Calculate ranked positions & averages
  const rankedStudentSummary = useMemo(() => {
    return calculateClassPositions(
      classStudents,
      allScores,
      session,
      term,
      authoritativeSubjectNames
    );
  }, [classStudents, allScores, session, term, authoritativeSubjectNames]);

  // 4. Calculate subject class-level statistics (Average, Highest, Lowest)
  const subjectStats = useMemo(() => {
    const studentIdSet = new Set<string>(classStudents.map((s) => s.StudentID));
    return calculateSubjectClassStats(
      authoritativeSubjectNames,
      allScores,
      session,
      term,
      studentIdSet
    );
  }, [authoritativeSubjectNames, allScores, session, term, classStudents]);

  // 5. Class-wide aggregate metrics
  const completedAverages = rankedStudentSummary
    .filter((s) => s.averageScore !== null)
    .map((s) => s.averageScore as number);

  const classMeanAverage =
    completedAverages.length > 0
      ? Math.round((completedAverages.reduce((a, b) => a + b, 0) / completedAverages.length) * 100) / 100
      : null;

  const highestClassAverage = completedAverages.length > 0 ? Math.max(...completedAverages) : null;
  const lowestClassAverage = completedAverages.length > 0 ? Math.min(...completedAverages) : null;

  const completedCount = rankedStudentSummary.filter((s) => s.isComplete).length;
  const totalCount = classStudents.length;

  const handlePrint = () => {
    printElementDirectly(
      'printable-class-summary',
      `Class_Summary_${(currentTeacher.ClassAssigned || 'Class').replace(/[^a-zA-Z0-9]/g, '_')}_${(term || '').replace(/[^a-zA-Z0-9]/g, '_')}`
    );
  };

  return (
    <div className="space-y-4 pb-28 md:pb-12">
      {/* Top Action Bar (hidden on print) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        <button
          id="summary-back-btn"
          onClick={onBackToRoster}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Pupils</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {onTogglePublish && (
            <button
              onClick={handlePublishToggle}
              disabled={isPublishing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                isPublished
                  ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {isPublishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isPublished ? (
                <Globe className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isPublished ? 'Published Live' : 'Publish Results'}</span>
            </button>
          )}

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 sm:px-2.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 sm:px-2.5 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            id="print-summary-btn"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Print Broadsheet</span>
          </button>
        </div>
      </div>

      {/* Visible Feedback Banner for Publish/Unpublish */}
      {feedback && (
        <div
          id="class-summary-feedback-banner"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-200 ${
            feedback.type === 'published'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
              : 'bg-amber-50 text-amber-950 border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'published' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <EyeOff className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-800 px-2 py-1 rounded-md text-[11px] font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Printable Master Container */}
      <div id="printable-class-summary" className="space-y-4">
        {/* Official Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="text-center pb-3 border-b border-slate-200 flex flex-col items-center">
          <SchoolLogo size="xl" src={activeSchool.logoUrl} alt={activeSchool.schoolName} className="w-28 h-28 sm:w-36 sm:h-36 mb-2.5 object-contain" />
          <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight uppercase font-serif">
            {activeSchool.schoolName}
          </h1>
          <p className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-widest font-mono mt-0.5">
            Motto: {activeSchool.motto}
          </p>
          <p className="text-xs text-slate-700 font-bold uppercase tracking-wider mt-1">
            Official Termly Broadsheet &amp; Position Summary
          </p>
        </div>

        {/* Meta Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
          <div>
            <span className="block text-slate-500 uppercase font-semibold text-[10px]">Class / Level</span>
            <span className="font-bold text-slate-900">{currentTeacher.ClassAssigned} ({classLevel})</span>
          </div>
          <div>
            <span className="block text-slate-500 uppercase font-semibold text-[10px]">Academic Session</span>
            <span className="font-bold text-slate-900">{session}</span>
          </div>
          <div>
            <span className="block text-slate-500 uppercase font-semibold text-[10px]">Academic Term</span>
            <span className="font-bold text-slate-900">{term}</span>
          </div>
          <div>
            <span className="block text-slate-500 uppercase font-semibold text-[10px]">Class Teacher</span>
            <span className="font-bold text-slate-900">{currentTeacher.FullName || currentTeacher.Username}</span>
          </div>
        </div>
      </div>

      {/* Class Metric Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Class Mean</span>
            <Award className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
            {classMeanAverage !== null ? `${classMeanAverage}%` : '—'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Mean of completed averages</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase">Highest Avg</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 font-mono mt-0.5">
            {highestClassAverage !== null ? `${highestClassAverage}%` : '—'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Top score in class</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Lowest Avg</span>
            <TrendingDown className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-700 font-mono mt-0.5">
            {lowestClassAverage !== null ? `${lowestClassAverage}%` : '—'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Lowest recorded in class</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Completed</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono mt-0.5">
            {completedCount} / {totalCount}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Pupils fully graded</p>
        </div>
      </div>

      {/* Main Student Rankings (Card vs Table) */}
      {viewMode === 'cards' ? (
        <div className="space-y-3">
          <div className="px-1 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Pupil Performance &amp; Positions ({rankedStudentSummary.length})
            </h2>
            <span className="text-[10px] text-slate-500">Joint ties supported</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rankedStudentSummary.map((item) => {
              const grade = getGradeDetails(item.averageScore);
              const isTopThree = item.positionNumber <= 3 && item.averageScore !== null;

              return (
                <div
                  key={item.student.StudentID}
                  className={`bg-white border rounded-xl p-3.5 shadow-xs flex flex-col justify-between gap-3 ${
                    isTopThree ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {item.student.StudentID}
                        </span>
                        {item.positionLabel !== '—' && (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.positionNumber === 1
                                ? 'bg-amber-200 text-amber-900 border border-amber-300'
                                : item.positionNumber === 2
                                ? 'bg-slate-200 text-slate-800'
                                : item.positionNumber === 3
                                ? 'bg-orange-100 text-orange-900'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.positionLabel}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">
                        {item.student.FullName}
                      </h3>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-extrabold font-mono text-slate-900">
                        {item.averageScore !== null ? `${item.averageScore}%` : '—'}
                      </div>
                      <span className={`inline-block font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${grade.badgeColor}`}>
                        Grade {grade.grade}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      Completed: <strong className="text-slate-700">{item.completedSubjectsCount}/{item.totalSubjectsAvailable}</strong>
                    </span>
                    <button
                      onClick={() => onSelectStudent(item.student)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      Edit Scores
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* TABLE VIEW (Broadsheet spreadsheet) */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Student Broadsheet &amp; Computed Positions
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              Ties are handled with joint positions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-28 text-center">Position</th>
                  <th className="py-2.5 px-4">Student ID</th>
                  <th className="py-2.5 px-4">Pupil Full Name</th>
                  <th className="py-2.5 px-3 text-center">Completed Subjects</th>
                  <th className="py-2.5 px-3 text-right">Total Marks</th>
                  <th className="py-2.5 px-3 text-right font-bold">Average</th>
                  <th className="py-2.5 px-3 text-center">Grade</th>
                  <th className="py-2.5 px-4 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rankedStudentSummary.map((item) => {
                  const grade = getGradeDetails(item.averageScore);
                  const isTopThree = item.positionNumber <= 3 && item.averageScore !== null;

                  return (
                    <tr
                      key={item.student.StudentID}
                      className={`hover:bg-slate-50 transition-colors ${
                        isTopThree ? 'bg-amber-50/20' : 'bg-white'
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center font-bold">
                        {item.positionLabel !== '—' ? (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-xs ${
                              item.positionNumber === 1
                                ? 'bg-amber-200 text-amber-900 border border-amber-300 font-extrabold'
                                : item.positionNumber === 2
                                ? 'bg-slate-200 text-slate-800 font-bold'
                                : item.positionNumber === 3
                                ? 'bg-orange-100 text-orange-900 font-bold'
                                : 'text-slate-700 font-semibold'
                            }`}
                          >
                            {item.positionLabel}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">Pending</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-600">
                        {item.student.StudentID}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {item.student.FullName}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                        {item.completedSubjectsCount} / {item.totalSubjectsAvailable}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        {item.totalScore > 0 ? item.totalScore : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900 text-sm">
                        {item.averageScore !== null ? `${item.averageScore}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${grade.badgeColor}`}>
                          {grade.grade}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center no-print">
                        <button
                          onClick={() => onSelectStudent(item.student)}
                          className="text-xs text-slate-700 hover:text-slate-900 font-semibold underline cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subject Breakdown & Analysis Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
            Subject-by-Subject Class Analysis
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[11px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-10 text-center">#</th>
                <th className="py-2.5 px-4">Subject Name</th>
                <th className="py-2.5 px-3 text-center">Pupils Recorded</th>
                <th className="py-2.5 px-3 text-center">Class Average</th>
                <th className="py-2.5 px-3 text-center text-emerald-800">Highest Score</th>
                <th className="py-2.5 px-3 text-center text-slate-700">Lowest Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subjectStats.map((stat, index) => (
                <tr key={stat.subjectName} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">
                    {stat.subjectName}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                    {stat.totalRecorded} / {classStudents.length}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                    {stat.totalRecorded > 0 ? `${stat.averageScore}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                    {stat.totalRecorded > 0 ? `${stat.highestScore}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                    {stat.totalRecorded > 0 ? `${stat.lowestScore}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Signatures Section for Printed Submissions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs mt-4 relative overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 text-xs">
          <div className="border-t border-slate-400 pt-3">
            <p className="font-bold text-slate-900 uppercase">Class Teacher&apos;s Signature &amp; Date</p>
            <p className="text-slate-600 text-[11px] mt-0.5">
              {currentTeacher.FullName || currentTeacher.Username} &bull; {currentTeacher.ClassAssigned}
            </p>
          </div>
          <div className="border-t border-slate-400 pt-3 relative">
            <p className="font-bold text-slate-900 uppercase">Head Teacher / Principal&apos;s Endorsement</p>
            <p className="text-slate-600 text-[11px] mt-0.5">{activeSchool.shortName || activeSchool.schoolName} Administration</p>
            <div className="sm:absolute sm:right-2 sm:-top-6 mt-2 sm:mt-0 flex justify-end">
              <SchoolStamp
                size="sm"
                schoolName={activeSchool.stampTopText || activeSchool.schoolName}
                bottomText={activeSchool.stampBottomText || activeSchool.motto}
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
