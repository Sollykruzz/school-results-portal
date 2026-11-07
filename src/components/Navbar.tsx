import React, { useState, useEffect, useRef } from 'react';
import { Teacher } from '../types';
import {
  Award,
  BookOpen,
  Database,
  LogOut,
  RefreshCw,
  Settings,
  User,
  Users,
  ShieldCheck,
  ChevronDown,
  Layers,
  Sparkles,
  Globe
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { ALL_SCHOOL_CLASSES } from '../services/firebaseService';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import { WebsiteConfig } from '../types';

interface NavbarProps {
  currentTeacher: Teacher;
  currentView: 'admin' | 'roster' | 'website';
  onSelectView?: (view: 'admin' | 'roster' | 'website') => void;
  onNavigate?: (view: 'admin' | 'roster' | 'website') => void;
  hasSelectedStudent: boolean;
  onLogout: () => void;
  onOpenSheetGuide: () => void;
  onRefreshData: () => void;
  isLoading: boolean;
  isLiveSheet: boolean;
  onOpenSubjectManager?: () => void;
  onSwitchClass?: (className: string) => void;
  classesList?: string[];
  websiteConfig?: WebsiteConfig;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTeacher,
  currentView,
  onSelectView,
  onNavigate,
  hasSelectedStudent,
  onLogout,
  onOpenSheetGuide,
  onRefreshData,
  isLoading,
  isLiveSheet,
  onOpenSubjectManager,
  onSwitchClass,
  classesList,
  websiteConfig
}) => {
  const activeSchool = websiteConfig
    ? getActiveSchoolConfig({
        schoolName: websiteConfig.schoolName,
        shortName: websiteConfig.shortName,
        motto: websiteConfig.motto,
        subMotto: websiteConfig.subMotto,
        logoUrl: websiteConfig.logoUrl,
      })
    : getActiveSchoolConfig();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const availableClasses = classesList && classesList.length > 0 ? classesList : ALL_SCHOOL_CLASSES;
  const handleViewChange = onNavigate || onSelectView || (() => {});

  const isAdmin =
    currentTeacher.Role === 'admin' ||
    String(currentTeacher.Username ?? '').toLowerCase() === 'admin';

  const displayName =
    currentTeacher.FullName &&
    !currentTeacher.FullName.toLowerCase().includes('administrator')
      ? currentTeacher.FullName
      : isAdmin
      ? 'Portal Administrator'
      : currentTeacher.Username;

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  const [logoTapCount, setLogoTapCount] = useState(0);
  const handleSecretLogoTap = () => {
    setLogoTapCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        if (isAdmin) {
          handleViewChange('admin');
        } else {
          onOpenSheetGuide();
        }
        return 0;
      }
      return next;
    });
    setTimeout(() => {
      setLogoTapCount(0);
    }, 3000);
  };

  return (
    <>
      {/* Top Mobile & Desktop App Bar */}
      <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md no-print pt-safe">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Left: School Brand & Insignia */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 mr-2">
            <div
              onClick={handleSecretLogoTap}
              className="cursor-pointer select-none active:scale-95 transition-transform shrink-0"
              title={activeSchool.schoolName}
            >
              <SchoolLogo size="md" src={activeSchool.logoUrl} alt={activeSchool.schoolName} className="w-11 h-11 sm:w-14 sm:h-14 shrink-0 object-contain" />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black tracking-tight text-xs sm:text-sm md:text-base lg:text-lg text-white uppercase font-serif leading-tight break-words">
                  {activeSchool.schoolName}
                </span>

                {/* Class Badge or Admin Switcher */}
                {isAdmin ? (
                  currentView === 'admin' ? (
                    <span className="bg-amber-400 text-slate-950 text-[11px] font-black px-2 py-0.5 rounded uppercase tracking-wider font-mono shrink-0">
                      Admin
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="bg-amber-400/20 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-amber-400/40">
                        {currentTeacher.ClassAssigned}
                      </span>
                      {onSwitchClass && (
                        <select
                          value={currentTeacher.ClassAssigned}
                          onChange={(e) => onSwitchClass(e.target.value)}
                          className="bg-slate-900 text-amber-300 text-[11px] font-bold px-1.5 py-0.5 rounded border border-slate-700 cursor-pointer focus:outline-hidden"
                          title="Switch Class"
                        >
                          {availableClasses.map((cls) => (
                            <option key={cls} value={cls}>
                              {cls}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )
                ) : (
                  <span className="bg-amber-400/20 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded border border-amber-400/30 shrink-0">
                    {currentTeacher.ClassAssigned}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-400 font-medium hidden md:flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                <span className="italic font-bold text-amber-300">&quot;{activeSchool.motto}&quot;</span>
              </p>
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {isAdmin && (
              <button
                onClick={() => handleViewChange('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </button>
            )}

            <button
              onClick={() => handleViewChange('roster')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === 'roster'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Pupil Roster</span>
            </button>

            <button
              onClick={() => handleViewChange('website')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                currentView === 'website'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="View Public School Website with Facilities & Gallery"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>School Website</span>
            </button>
          </nav>

          {/* Right: Quick Actions & Return to Dashboard */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Admin Back to Command Center button when inspecting class */}
            {isAdmin && currentView !== 'admin' && (
              <button
                onClick={() => handleViewChange('admin')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-xs transition-colors cursor-pointer"
                title="Return to Admin Dashboard"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {/* Manage Subjects Button */}
            {onOpenSubjectManager && (
              <button
                onClick={onOpenSubjectManager}
                className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                title="Add or remove curriculum subjects"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Subjects</span>
              </button>
            )}

            {/* Quick Sync Button */}
            <button
              onClick={onRefreshData}
              disabled={isLoading}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Sync with Firebase Firestore"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading ? 'animate-spin text-amber-400' : 'text-slate-400'
                }`}
              />
              <span className="hidden xl:inline">{isLoading ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Firebase Status Pill */}
            <div
              id="navbar-sheet-status-indicator"
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-800 select-none"
              title="Firebase Firestore Cloud Status"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isLiveSheet ? 'bg-emerald-400 ring-2 ring-emerald-400/30' : 'bg-amber-400'
                }`}
              />
              <span className="hidden md:inline text-[11px]">
                {isLiveSheet ? 'Firebase Online' : 'Local Storage'}
              </span>
            </div>

            {/* Profile & Logout button */}
            <div ref={profileMenuRef} className="relative flex items-center gap-1 pl-1 border-l border-slate-800">
              <button
                id="navbar-profile-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                  isMobileMenuOpen
                    ? 'bg-amber-400/20 text-amber-400 border-amber-400/50'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Account Menu"
              >
                <User className="w-4 h-4" />
              </button>

              <button
                id="navbar-logout-btn"
                onClick={onLogout}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-rose-950/80 hover:border-rose-800 border border-slate-800 rounded-lg transition-all cursor-pointer"
                title="Sign out of Portal"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden md:inline">Sign Out</span>
              </button>

              {/* Account Dropdown Menu (Floating Popover) */}
              {isMobileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <SchoolLogo size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate" title={displayName}>
                          {displayName}
                        </p>
                        <p className="text-[10px] text-amber-400 font-mono">
                          {isAdmin ? 'Administrator' : `Class: ${currentTeacher.ClassAssigned}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-900 text-amber-400 font-bold px-2 py-0.5 rounded border border-slate-800 shrink-0">
                      {isAdmin ? 'Admin' : 'Staff'}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2 text-xs space-y-1 font-mono">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Username:</span>
                      <span className="text-slate-200 font-bold">@{currentTeacher.Username}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Account Role:</span>
                      <span className="text-amber-300 font-bold uppercase">{currentTeacher.Role || (isAdmin ? 'Admin' : 'Teacher')}</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleViewChange('admin');
                      }}
                      className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Admin Dashboard / Logins</span>
                    </button>
                  )}

                  {onOpenSubjectManager && (
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenSubjectManager();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold border border-slate-800 transition-colors cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Curriculum Subjects</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full py-2 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

    </>
  );
};

