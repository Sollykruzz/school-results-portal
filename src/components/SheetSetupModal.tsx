import React, { useState, useEffect } from 'react';
import {
  FirebaseService,
  INITIAL_DEFAULT_TEACHERS,
  INITIAL_DEFAULT_SUBJECTS,
  INITIAL_DEFAULT_STUDENTS,
  getDatabaseStats
} from '../services/firebaseService';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import { getScoringConfig } from '../utils/grading';
import { firebaseConfig, HARDCODED_DATABASE_ID } from '../services/firebase';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Server,
  CloudCheck,
  Users,
  BookOpen,
  Award,
  ShieldCheck,
  Download,
  Copy,
  Check
} from 'lucide-react';

interface SheetSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => Promise<void>;
  isLive: boolean;
}

export const SheetSetupModal: React.FC<SheetSetupModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  isLive,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'accounts' | 'seed' | 'backup'>('status');
  const [stats, setStats] = useState<{
    teachersCount: number;
    studentsCount: number;
    subjectsCount: number;
    scoresCount: number;
    summariesCount: number;
    publishedCount: number;
  }>({
    teachersCount: 0,
    studentsCount: 0,
    subjectsCount: 0,
    scoresCount: 0,
    summariesCount: 0,
    publishedCount: 0
  });

  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [seedingStatus, setSeedingStatus] = useState<{
    running: boolean;
    success?: boolean;
    message?: string;
  }>({ running: false });

  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await getDatabaseStats();
      setStats(data);
    } catch {
      // Handled
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSeedDatabase = async (force: boolean = false) => {
    setSeedingStatus({ running: true });
    try {
      const res = await FirebaseService.seedInitialDatabase(force);
      if (res.success) {
        setSeedingStatus({
          running: false,
          success: true,
          message: res.message || 'Database successfully seeded in Firebase Firestore!'
        });
        await onRefreshData();
        await fetchStats();
      } else {
        setSeedingStatus({
          running: false,
          success: false,
          message: res.message || 'Failed to seed database.'
        });
      }
    } catch (err: any) {
      setSeedingStatus({
        running: false,
        success: false,
        message: err.message || 'An unexpected error occurred.'
      });
    }
  };

  const handleCopyCredentials = (username: string, pass: string) => {
    navigator.clipboard.writeText(`Username: ${username} | Password: ${pass}`);
    setCopiedAccount(username);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  const handleExportBackup = async () => {
    const schoolConfig = getActiveSchoolConfig();
    const schoolSlug = (schoolConfig.acronym || schoolConfig.shortName || 'school').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const data = await FirebaseService.loadAllData(true);
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schoolSlug}_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="firebase-setup-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="bg-slate-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Firebase Cloud Database Center</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full">
                  Firestore Active
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {(getActiveSchoolConfig().schoolName || 'School Management Portal')} &bull; Cloud Persistence & Account Control
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'border-amber-500 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Cloud Status & Stats
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'accounts'
                ? 'border-amber-500 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Staff Accounts ({INITIAL_DEFAULT_TEACHERS.length})
          </button>

          <button
            onClick={() => setActiveTab('seed')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'seed'
                ? 'border-amber-500 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Data Tools & Reset
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'backup'
                ? 'border-amber-500 text-slate-950 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            JSON Backup
          </button>
        </div>

        {/* Tab 1: Cloud Status & Live Collections */}
        {activeTab === 'status' && (
          <div className="p-5 sm:p-6 space-y-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  Supabase Cloud Database Connected
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  All student profiles, Continuous Assessment (CA1 & CA2), exam scores, remarks, and publication flags are synchronized with the Supabase database.
                </p>
                {(() => {
                  const activeScoring = getScoringConfig();
                  return (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono text-emerald-900">
                      <span className="bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                        Provider: Supabase
                      </span>
                      <span className="bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                        Table: {HARDCODED_DATABASE_ID}
                      </span>
                      <span className="bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                        Active Weights: CA1 ({activeScoring.maxCA1}) / CA2 ({activeScoring.maxCA2}) / Exam ({activeScoring.maxExam}) = {activeScoring.maxTotal}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Collection Metrics */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Firestore Collections Overview
                </h4>
                <button
                  onClick={fetchStats}
                  disabled={isLoadingStats}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
                  <span>Refresh Counts</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {stats.studentsCount}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pupils Enrolled</span>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {stats.scoresCount}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Recorded Scores</span>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {stats.teachersCount}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Teachers / Staff</span>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {stats.subjectsCount}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Subjects in Syllabus</span>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {stats.summariesCount}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Terminal Summaries</span>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                  <p className="text-2xl font-black text-slate-900 font-mono">
                    {stats.publishedCount}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Class Terms Published</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Staff Accounts Reference */}
        {activeTab === 'accounts' && (
          <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
              <p className="font-bold mb-1">Registered Teacher Credentials</p>
              <p>
                Click any staff credential below to copy. Teachers can sign in to manage continuous assessment scores for their respective classes.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {INITIAL_DEFAULT_TEACHERS.map((t) => (
                <div
                  key={t.Username}
                  onClick={() => handleCopyCredentials(t.Username, t.Password)}
                  className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{t.FullName}</span>
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {t.ClassAssigned}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Username: <span className="font-bold text-slate-700">{t.Username}</span> &bull; Password: <span className="font-bold text-slate-700">{t.Password}</span>
                    </div>
                  </div>

                  <div className="text-slate-400 hover:text-slate-600 p-1.5">
                    {copiedAccount === t.Username ? (
                      <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copied
                      </span>
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Seeding & Reset */}
        {activeTab === 'seed' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-2">
              <h4 className="font-bold text-slate-900 text-sm">Database Seeding Tools</h4>
              <p>
                Use these tools to populate initial sample rosters, curriculum rules for Nigerian basic education (Nursery, Primary 1-6, JSS 1-3), and sample pupils for your school.
              </p>
            </div>

            {seedingStatus.message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  seedingStatus.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}
              >
                {seedingStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{seedingStatus.message}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => handleSeedDatabase(false)}
                disabled={seedingStatus.running}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{seedingStatus.running ? 'Processing...' : 'Seed Initial School Data'}</span>
              </button>

              <button
                onClick={() => handleSeedDatabase(true)}
                disabled={seedingStatus.running}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-slate-700"
              >
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Force Overwrite / Refresh</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Backup */}
        {activeTab === 'backup' && (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
              <h4 className="font-bold text-slate-900 text-sm mb-1">Export JSON School Backup</h4>
              <p>
                Download a complete, offline JSON snapshot of all school data currently stored in Firebase Firestore (pupils, teachers, subjects, continuous assessment scores, and remarks).
              </p>
            </div>

            <button
              onClick={handleExportBackup}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Download Full School Backup (.json)</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Firebase Firestore Synchronized</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
