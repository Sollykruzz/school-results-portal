import React, { useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../services/supabaseFirestore';
import {
  Award,
  BookOpen,
  Calendar,
  Layers,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ChevronDown,
  FileCheck
} from 'lucide-react';

// Reuse the application-wide client so auth/session storage is consistent.
export const defaultSupabase: SupabaseClient = db.client;

export interface CheckCAScoreProps {
  /** The unique student identifier. Maps to student_id in the database query. */
  studentId: string;
  /** The current academic term (e.g., 'First Term', 'Second Term', 'Third Term'). */
  currentTerm: string;
  /** The current academic session (e.g., '2026/2027'). */
  currentSession: string;
  /** List of subjects enrolled by the student to populate the subject select dropdown. */
  enrolledSubjects: string[];
  /** Optional custom Supabase client instance (defaults to preconfigured defaultSupabase). */
  supabaseClient?: SupabaseClient;
  /** Optional overarching published check or rule. */
  isPublished?: boolean | ((subject: string, assessment: 'ca1' | 'ca2') => boolean);
  /** Optional container CSS class name */
  className?: string;
  /** Optional variant: 'modal' button or 'embedded' card */
  variant?: 'modal' | 'embedded';
}

export const CheckCAScore: React.FC<CheckCAScoreProps> = ({
  studentId,
  currentTerm,
  currentSession,
  enrolledSubjects = [],
  supabaseClient = defaultSupabase,
  isPublished,
  className = '',
  variant = 'modal'
}) => {
  // State Management
  const [isOpen, setIsOpen] = useState<boolean>(variant === 'embedded');
  const [selectedCA, setSelectedCA] = useState<'ca1' | 'ca2' | ''>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [fetchedScore, setFetchedScore] = useState<number | string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset or close the panel
  const handleClose = () => {
    if (variant === 'modal') {
      setIsOpen(false);
    }
    setError(null);
  };

  // Trigger Supabase query on button click
  const handleFetchCAScore = async () => {
    if (!selectedCA || !selectedSubject) return;

    setIsLoading(true);
    setError(null);
    setFetchedScore(null);

    const assessmentLabel = selectedCA.toUpperCase(); // 'CA1' or 'CA2'

    // Overarching published gatekeeper check (if applicable)
    let hasOverarchingPublishPermission = true;
    if (typeof isPublished === 'boolean') {
      hasOverarchingPublishPermission = isPublished;
    } else if (typeof isPublished === 'function') {
      hasOverarchingPublishPermission = isPublished(selectedSubject, selectedCA as 'ca1' | 'ca2');
    }

    if (!hasOverarchingPublishPermission) {
      setError(`Your ${assessmentLabel} score for ${selectedSubject} has not been published yet.`);
      setIsLoading(false);
      return;
    }

    try {
      // Execute the exact query structure requested
      const { data, error: queryError } = await supabaseClient
        .from('scores')
        .select('ca1, ca2')
        .eq('student_id', studentId)
        .eq('term', currentTerm)
        .eq('session', currentSession)
        .eq('subject', selectedSubject)
        .single();

      // Row missing or query error:
      if (queryError || !data) {
        setFetchedScore(null);
        setError(`Your ${assessmentLabel} score for ${selectedSubject} has not been published yet.`);
        return;
      }

      // Check the specifically requested CA assessment column
      const rawScore = selectedCA === 'ca1' ? data.ca1 : data.ca2;

      if (rawScore === null || rawScore === undefined || rawScore === '') {
        setFetchedScore(null);
        setError(`Your ${assessmentLabel} score for ${selectedSubject} has not been published yet.`);
      } else {
        const numericScore = Number(rawScore);
        setFetchedScore(isNaN(numericScore) ? rawScore : numericScore);
        setError(null);
      }
    } catch (err: any) {
      console.warn('Supabase CA check notice:', err);
      setFetchedScore(null);
      setError(`Your ${assessmentLabel} score for ${selectedSubject} has not been published yet.`);
    } finally {
      setIsLoading(false);
    }
  };

  const displayAssessmentLabel = selectedCA ? selectedCA.toUpperCase() : '';

  // The inner lookup form and score card
  const contentBody = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Assessment Type */}
        <div>
          <label
            htmlFor="ca-select-assessment"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Assessment Type <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              id="ca-select-assessment"
              value={selectedCA}
              onChange={(e) => {
                setSelectedCA(e.target.value as 'ca1' | 'ca2' | '');
                setError(null);
                setFetchedScore(null);
              }}
              className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 pr-9 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors cursor-pointer"
            >
              <option value="">Select Assessment</option>
              <option value="ca1">CA1 (Continuous Assessment 1)</option>
              <option value="ca2">CA2 (Continuous Assessment 2)</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Subject */}
        <div>
          <label
            htmlFor="ca-select-subject"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Subject <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              id="ca-select-subject"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setError(null);
                setFetchedScore(null);
              }}
              className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm font-medium rounded-lg px-3 py-2 pr-9 focus:outline-hidden focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors cursor-pointer"
            >
              <option value="">Select Subject</option>
              {enrolledSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Action Button: View Score */}
      <button
        type="button"
        id="ca-view-score-btn"
        onClick={handleFetchCAScore}
        disabled={!selectedCA || !selectedSubject || isLoading}
        className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Fetching Score...</span>
          </>
        ) : (
          <>
            <BookOpen className="w-4 h-4 text-white" />
            <span>View Score</span>
          </>
        )}
      </button>

      {/* ------------------------------------------------------------- */}
      {/* DISPLAY CARD: Clean, Institutional Presentation              */}
      {/* Strictly hides the other CA, Exam, and Total                  */}
      {/* ------------------------------------------------------------- */}
      {fetchedScore !== null && (
        <div
          id="ca-result-card"
          className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Official CA Assessment
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                {selectedSubject}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                {displayAssessmentLabel} Assessment Record &bull; {currentTerm}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[11px] font-medium text-slate-500 block">
                Marks Obtained
              </span>
              <div className="flex items-baseline justify-end gap-1 font-mono tabular-nums">
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {fetchedScore}
                </span>
                <span className="text-xs text-slate-500 font-bold">/ 20</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span className="font-medium text-slate-800">
              {selectedSubject} {displayAssessmentLabel} Score: {fetchedScore}/20
            </span>
            <span className="font-mono text-slate-500 text-[11px]">
              ID: {studentId}
            </span>
          </div>
        </div>
      )}

      {/* Not Published or Error Notice */}
      {error && (
        <div
          id="ca-error-banner"
          className="mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-950">Notice</p>
            <p className="text-amber-800">{error}</p>
          </div>
        </div>
      )}
    </div>
  );

  // If embedded in a parent page (like the CA tab)
  if (variant === 'embedded') {
    return (
      <div className={`bg-white rounded-2xl p-5 border border-slate-200 ${className}`}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <FileCheck className="w-5 h-5 text-slate-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Individual Subject CA Lookup
            </h3>
            <p className="text-xs text-slate-500">
              Query specific CA1 or CA2 scores released for {currentTerm} ({currentSession})
            </p>
          </div>
        </div>
        {contentBody}
      </div>
    );
  }

  // Otherwise, render as clean trigger button + dignified modal
  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button: Clean, dignified, anti-AI */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <FileCheck className="w-3.5 h-3.5 text-slate-200" />
        <span>Check CA Score</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-slate-900"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Check CA Score
                  </h3>
                  <p className="text-xs text-slate-300">
                    {currentTerm} &bull; {currentSession}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">{contentBody}</div>

            {/* Footer */}
            <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Continuous Assessment Lookup</span>
              <button
                type="button"
                onClick={handleClose}
                className="font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckCAScore;
