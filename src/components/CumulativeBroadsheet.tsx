import React, { useMemo, useState } from 'react';
import {
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  Teacher,
  TermType
} from '../types';
import {
  computeAnnualCumulativeForStudent,
  getAuthoritativeSubjectsForClass,
  isMatchingClass,
  getGradeAndRemark,
  formatOrdinalPosition
} from '../utils/grading';
import {
  Printer,
  Download,
  Award,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Search,
  Filter,
  Layers,
  GraduationCap
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { SchoolStamp } from './SchoolStamp';
import { printElementDirectly } from '../utils/printHelper';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import { WebsiteConfig } from '../types';

interface CumulativeBroadsheetProps {
  className: string;
  session: string;
  students: Student[];
  allScores: SubjectScore[];
  allSummaries?: StudentSummary[];
  subjectsList: SubjectRule[];
  currentTeacher?: Teacher | null;
  onBack?: () => void;
  onSelectStudent?: (student: Student) => void;
  websiteConfig?: WebsiteConfig;
}

export const CumulativeBroadsheet: React.FC<CumulativeBroadsheetProps> = ({
  className,
  session,
  students,
  allScores,
  allSummaries = [],
  subjectsList,
  currentTeacher,
  onBack,
  onSelectStudent,
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
  const [filterDecision, setFilterDecision] = useState<'all' | 'promoted' | 'trial' | 'repeat'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter students in this class
  const classStudents = useMemo(() => {
    return students.filter((s) => isMatchingClass(s.Class, className));
  }, [students, className]);

  // 2. Authoritative subjects for this class
  const authoritativeSubjects = useMemo(() => {
    return getAuthoritativeSubjectsForClass(className, subjectsList);
  }, [className, subjectsList]);

  // 3. Compute annual cumulative metrics for each student in the class
  const studentCumulativeRows = useMemo(() => {
    const list = classStudents.map((st) => {
      const summary = computeAnnualCumulativeForStudent(
        st.StudentID,
        session,
        allScores,
        authoritativeSubjects,
        st.Class || className
      );

      // Check if custom promotion decision was manually entered in 3rd term summary
      const savedSum = allSummaries.find(
        (sm) =>
          sm.StudentID?.toLowerCase() === st.StudentID?.toLowerCase() &&
          (sm.Session === session || !sm.Session) &&
          sm.Term === 'Third Term'
      );

      const decision = savedSum?.PromotionDecision || summary.promotionStatus;

      return {
        student: st,
        summary,
        decision,
        cumAvg: summary.annualCumulativeAverage
      };
    });

    // Sort descending by cumulative average
    list.sort((a, b) => (b.cumAvg || 0) - (a.cumAvg || 0));

    // Assign positions
    return list.map((item, index) => ({
      ...item,
      positionNumber: index + 1,
      positionLabel: formatOrdinalPosition(index + 1)
    }));
  }, [classStudents, session, allScores, authoritativeSubjects, className, allSummaries]);

  // Statistics
  const totalEnrolled = studentCumulativeRows.length;
  const promotedCount = studentCumulativeRows.filter((r) =>
    r.decision.toLowerCase().includes('promoted') && !r.decision.toLowerCase().includes('trial')
  ).length;
  const trialCount = studentCumulativeRows.filter((r) =>
    r.decision.toLowerCase().includes('trial')
  ).length;
  const repeatCount = studentCumulativeRows.filter((r) =>
    r.decision.toLowerCase().includes('repeat')
  ).length;

  const validAverages = studentCumulativeRows
    .map((r) => r.cumAvg)
    .filter((v): v is number => v !== null && !isNaN(v));

  const classMeanCumulative =
    validAverages.length > 0
      ? Math.round((validAverages.reduce((a, b) => a + b, 0) / validAverages.length) * 10) / 10
      : null;

  // Filtered rows
  const filteredRows = studentCumulativeRows.filter((r) => {
    const matchesSearch =
      r.student.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.student.StudentID.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterDecision === 'promoted') {
      return r.decision.toLowerCase().includes('promoted') && !r.decision.toLowerCase().includes('trial');
    }
    if (filterDecision === 'trial') {
      return r.decision.toLowerCase().includes('trial');
    }
    if (filterDecision === 'repeat') {
      return r.decision.toLowerCase().includes('repeat');
    }
    return true;
  });

  const handlePrint = () => {
    printElementDirectly(
      'printable-master-broadsheet',
      `Master_Broadsheet_${(className || 'Class').replace(/[^a-zA-Z0-9]/g, '_')}_${(session || '').replace(/[^a-zA-Z0-9]/g, '_')}`
    );
  };

  const handleExportCSV = () => {
    const headers = [
      'Position',
      'Student ID',
      'Full Name',
      'Gender',
      ...authoritativeSubjects.flatMap((subj) => [
        `${subj} (1st)`,
        `${subj} (2nd)`,
        `${subj} (3rd)`,
        `${subj} (Cum Avg)`
      ]),
      '1st Term Avg',
      '2nd Term Avg',
      '3rd Term Avg',
      'Annual Cumulative Avg',
      'Annual Grade',
      'Promotion Decision'
    ];

    const rows = studentCumulativeRows.map((r) => {
      const subjectCols = authoritativeSubjects.flatMap((subj) => {
        const item = r.summary.subjectBreakdown.find(
          (s) => s.subject.toLowerCase() === subj.toLowerCase()
        );
        return [
          item?.firstTermTotal ?? '',
          item?.secondTermTotal ?? '',
          item?.thirdTermTotal ?? '',
          item?.cumulativeAverage ?? ''
        ];
      });

      return [
        r.positionNumber,
        r.student.StudentID,
        `"${r.student.FullName}"`,
        r.student.Gender || '',
        ...subjectCols,
        r.summary.firstTermAverage ?? '',
        r.summary.secondTermAverage ?? '',
        r.summary.thirdTermAverage ?? '',
        r.summary.annualCumulativeAverage ?? '',
        r.summary.annualGrade,
        `"${r.decision}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${className}_Annual_Broadsheet_${session.replace('/', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top action header (Hidden on Print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-md">
                Annual Broadsheet
              </span>
              <h2 className="text-lg font-bold text-slate-900">{className} — Promotion Summary</h2>
            </div>
            <p className="text-xs text-slate-500">
              Academic Session: {session} • 3-Term Cumulative Performance Matrix
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Broadsheet</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (Hidden on Print) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:hidden">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Enrolled</span>
          <span className="text-xl font-black text-slate-800">{totalEnrolled}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Promoted</span>
          <span className="text-xl font-black text-emerald-700">{promotedCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Promoted on Trial</span>
          <span className="text-xl font-black text-amber-700">{trialCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 shadow-xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Advised to Repeat</span>
          <span className="text-xl font-black text-rose-700">{repeatCount}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/30 shadow-xs">
          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Class Mean Avg</span>
          <span className="text-xl font-black text-indigo-700">
            {classMeanCumulative !== null ? `${classMeanCumulative}%` : '—'}
          </span>
        </div>
      </div>

      {/* Filters & Search (Hidden on Print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pupil name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterDecision('all')}
            className={`px-3 py-1 rounded-lg transition ${
              filterDecision === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({totalEnrolled})
          </button>
          <button
            type="button"
            onClick={() => setFilterDecision('promoted')}
            className={`px-3 py-1 rounded-lg transition ${
              filterDecision === 'promoted' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Promoted ({promotedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterDecision('trial')}
            className={`px-3 py-1 rounded-lg transition ${
              filterDecision === 'trial' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Trial ({trialCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterDecision('repeat')}
            className={`px-3 py-1 rounded-lg transition ${
              filterDecision === 'repeat' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Repeat ({repeatCount})
          </button>
        </div>
      </div>

      {/* Printable Master Broadsheet */}
      <div id="printable-master-broadsheet" className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 print:p-0 print:border-none print:shadow-none">
        {/* Printable Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <SchoolLogo size="lg" src={activeSchool.logoUrl} alt={activeSchool.schoolName} className="w-24 h-24 sm:w-30 sm:h-30 shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase font-serif">
                {activeSchool.schoolName}
              </h1>
              <p className="text-xs sm:text-sm font-bold text-amber-800 tracking-wider uppercase font-mono">
                Motto: {activeSchool.motto}
              </p>
              <p className="text-xs font-bold text-slate-700 tracking-wider uppercase mt-0.5">
                ANNUAL CUMULATIVE MASTER BROADSHEET • {session} SESSION
              </p>
              <div className="flex items-center space-x-4 mt-1.5 text-xs text-slate-700">
                <span><strong>Class:</strong> {className}</span>
                <span><strong>Class Teacher:</strong> {currentTeacher?.FullName || 'Assigned Staff'}</span>
                <span><strong>Total Pupils:</strong> {totalEnrolled}</span>
              </div>
            </div>
          </div>

          <div className="text-right hidden sm:block print:block">
            <SchoolStamp
              size="md"
              schoolName={activeSchool.stampTopText || activeSchool.schoolName}
              bottomText={activeSchool.stampBottomText || activeSchool.motto}
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-900 text-white font-bold">
                <th className="py-2 px-2 border border-slate-700 text-center w-8">Pos</th>
                <th className="py-2 px-2 border border-slate-700 w-24">Pupil ID</th>
                <th className="py-2 px-3 border border-slate-700 min-w-[140px]">Full Name</th>
                {authoritativeSubjects.map((subj) => (
                  <th
                    key={subj}
                    className="py-2 px-1 border border-slate-700 text-center max-w-[65px] truncate"
                    title={subj}
                  >
                    {subj.length > 8 ? `${subj.slice(0, 7)}.` : subj}
                  </th>
                ))}
                <th className="py-2 px-1.5 border border-slate-700 text-center bg-slate-800">1st Term</th>
                <th className="py-2 px-1.5 border border-slate-700 text-center bg-slate-800">2nd Term</th>
                <th className="py-2 px-1.5 border border-slate-700 text-center bg-slate-800">3rd Term</th>
                <th className="py-2 px-2 border border-slate-700 text-center bg-indigo-900">Annual Avg</th>
                <th className="py-2 px-1.5 border border-slate-700 text-center bg-indigo-900">Grade</th>
                <th className="py-2 px-3 border border-slate-700 text-center bg-slate-800 min-w-[130px]">
                  Promotion Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredRows.map((r) => {
                const isPromoted = r.decision.toLowerCase().includes('promoted') && !r.decision.toLowerCase().includes('trial');
                const isTrial = r.decision.toLowerCase().includes('trial');
                const isRepeat = r.decision.toLowerCase().includes('repeat');

                return (
                  <tr
                    key={r.student.StudentID}
                    onClick={() => onSelectStudent && onSelectStudent(r.student)}
                    className="hover:bg-indigo-50/40 transition cursor-pointer"
                  >
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-bold">
                      {r.positionLabel}
                    </td>
                    <td className="py-1.5 px-2 border border-slate-300 font-mono text-[10px] text-slate-600">
                      {r.student.StudentID}
                    </td>
                    <td className="py-1.5 px-3 border border-slate-300 font-bold text-slate-900">
                      {r.student.FullName}
                    </td>

                    {/* Subject Cumulative Averages */}
                    {authoritativeSubjects.map((subj) => {
                      const item = r.summary.subjectBreakdown.find(
                        (s) => s.subject.toLowerCase() === subj.toLowerCase()
                      );
                      const avg = item?.cumulativeAverage;
                      return (
                        <td
                          key={subj}
                          className="py-1.5 px-1 border border-slate-300 text-center font-medium"
                        >
                          {avg !== null && avg !== undefined ? Math.round(avg) : '—'}
                        </td>
                      );
                    })}

                    {/* Term Averages */}
                    <td className="py-1.5 px-1.5 border border-slate-300 text-center font-semibold text-slate-700 bg-slate-50/50">
                      {r.summary.firstTermAverage !== null ? `${r.summary.firstTermAverage}%` : '—'}
                    </td>
                    <td className="py-1.5 px-1.5 border border-slate-300 text-center font-semibold text-slate-700 bg-slate-50/50">
                      {r.summary.secondTermAverage !== null ? `${r.summary.secondTermAverage}%` : '—'}
                    </td>
                    <td className="py-1.5 px-1.5 border border-slate-300 text-center font-semibold text-slate-700 bg-slate-50/50">
                      {r.summary.thirdTermAverage !== null ? `${r.summary.thirdTermAverage}%` : '—'}
                    </td>

                    {/* Annual Cumulative Average & Grade */}
                    <td className="py-1.5 px-2 border border-slate-300 text-center font-black text-indigo-900 bg-indigo-50/40">
                      {r.cumAvg !== null ? `${r.cumAvg}%` : '—'}
                    </td>
                    <td className="py-1.5 px-1.5 border border-slate-300 text-center font-bold text-indigo-800 bg-indigo-50/40">
                      {r.summary.annualGrade}
                    </td>

                    {/* Promotion Decision */}
                    <td className="py-1.5 px-3 border border-slate-300 text-center font-bold text-[10px]">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full ${
                          isPromoted
                            ? 'bg-emerald-100 text-emerald-900'
                            : isTrial
                            ? 'bg-amber-100 text-amber-900'
                            : isRepeat
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.decision}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Broadsheet Signatures & Seal (For Print) */}
        <div className="mt-8 pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-700 text-center">
          <div>
            <div className="h-10 border-b border-dashed border-slate-400 mx-auto w-40" />
            <p className="mt-1 font-bold">Class Teacher's Signature & Date</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-slate-400 mx-auto w-40" />
            <p className="mt-1 font-bold">Head of Academics / Exam Officer</p>
          </div>
          <div>
            <div className="h-10 border-b border-dashed border-slate-400 mx-auto w-40" />
            <p className="mt-1 font-bold">Principal's Signature & Official Seal</p>
          </div>
        </div>
      </div>
    </div>
  );
};
