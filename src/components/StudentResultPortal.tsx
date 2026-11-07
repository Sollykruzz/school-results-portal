import React, { useState } from 'react';
import { Student, SubjectRule, SubjectScore, StudentSummary, TermType, PublishedRecord, WebsiteConfig } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import {
  LogIn,
  GraduationCap,
  ShieldCheck,
  MapPin,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

interface StudentResultPortalProps {
  students: Student[];
  allScores: SubjectScore[];
  allSummaries: StudentSummary[];
  subjectsList: SubjectRule[];
  publishedRecords: PublishedRecord[];
  isClassResultPublished: (className: string, term: TermType, session: string) => boolean;
  onOpenStaffLogin: () => void;
  onOpenStudentLogin?: () => void;
  onOpenAdminSetup: () => void;
  onRefreshData?: () => Promise<void> | void;
  onBackToHome?: () => void;
  isLiveSheet?: boolean;
  isLoading?: boolean;
  websiteConfig?: WebsiteConfig;
}

export const StudentResultPortal: React.FC<StudentResultPortalProps> = ({
  students,
  allScores,
  allSummaries,
  subjectsList,
  publishedRecords,
  onOpenStaffLogin,
  onOpenStudentLogin,
  onOpenAdminSetup,
  onRefreshData,
  onBackToHome,
  isLiveSheet,
  isLoading,
  websiteConfig
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

  return (
    <div className="space-y-6 pb-12">
      {/* Return to Homepage Button */}
      {onBackToHome && (
        <div className="flex justify-start">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#0a1e3f] bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-700" />
            <span>Back to School Homepage</span>
          </button>
        </div>
      )}

      {/* Top Banner & School Crest Hero */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 p-6 sm:p-10 shadow-xl relative overflow-hidden text-center text-slate-900">
        {/* Subtle Decorative Background Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* School Crest Logo */}
        <div className="flex justify-center mb-4">
          <div
            className="select-none"
            title={activeSchool.schoolName}
          >
            <SchoolLogo
              size="2xl"
              src={activeSchool.logoUrl}
              alt={activeSchool.schoolName}
              className="w-36 h-36 sm:w-48 sm:h-48 object-contain filter drop-shadow-md"
            />
          </div>
        </div>

        {/* School Name & Titles */}
        <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-[#0a1e3f] tracking-tight uppercase font-serif break-words leading-tight px-2">
          {activeSchool.schoolName}
        </h1>

        <p className="text-xs sm:text-sm font-black text-amber-600 uppercase tracking-wider sm:tracking-widest font-mono mt-2 px-2">
          Motto: {activeSchool.motto}
        </p>

        <p className="text-xs sm:text-sm font-semibold text-slate-600 tracking-wide mt-1 px-2 flex items-center justify-center gap-1.5 break-words">
          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{activeSchool.campusAddress}{activeSchool.cityState ? `, ${activeSchool.cityState}` : ''}</span>
        </p>

        {/* Dual Primary Portals: Student Login & Staff Login */}
        <div className="mt-8 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          {/* 1. Student Portal Card */}
          <div className="bg-amber-50/70 border-2 border-amber-300 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-all">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold mb-3 shadow-xs">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Student Portal</h2>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                Log in with your <strong>Student ID</strong> and <strong>Password</strong> to check your termly results, cumulative summaries, and print official report cards.
              </p>
            </div>

            <button
              id="student-portal-login-btn"
              onClick={onOpenStudentLogin}
              className="mt-5 w-full py-3 px-4 rounded-xl text-xs font-extrabold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-500 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <LogIn className="w-4 h-4" />
              <span>Student Login</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Staff & Admin Portal Card */}
          <div className="bg-slate-50 border-2 border-slate-200 hover:border-blue-700 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#0a1e3f] text-amber-400 flex items-center justify-center font-bold mb-3 shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-[#0a1e3f]">Staff & Admin Portal</h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Dedicated gateway for teachers and administrators to manage continuous assessments, student scores, and records.
              </p>
            </div>

            <button
              id="staff-portal-login-btn"
              onClick={onOpenStaffLogin}
              className="mt-5 w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#0a1e3f] hover:bg-[#132c57] border border-blue-900 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Staff Login</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* School Contact & Address Footer Card */}
      <div className="bg-[#0a1e3f] border border-blue-900 rounded-2xl p-6 text-white text-xs shadow-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SchoolLogo size="lg" src={activeSchool.logoUrl} alt={activeSchool.schoolName} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 object-contain" />
            <div>
              <p className="font-bold text-sm text-white">{activeSchool.schoolName}</p>
              <p className="text-slate-300 text-[11px] flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{activeSchool.campusAddress}{activeSchool.cityState ? `, ${activeSchool.cityState}` : ''}</span>
              </p>
              <p className="text-amber-300 text-[10px] font-bold font-mono uppercase tracking-wider mt-0.5">
                Motto: {activeSchool.motto}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenStudentLogin}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all cursor-pointer"
            >
              Student Portal
            </button>
            <button
              onClick={onOpenStaffLogin}
              className="px-4 py-2 rounded-xl bg-blue-900/60 hover:bg-blue-800 text-slate-200 font-bold border border-blue-700 transition-all cursor-pointer"
            >
              Access Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
