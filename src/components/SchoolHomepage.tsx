import React, { useState, useMemo } from 'react';
import { SchoolLogo } from './SchoolLogo';
import {
  ShieldCheck,
  Phone,
  MessageCircle,
  ArrowRight,
  LogIn,
  MapPin,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  User,
  ArrowLeft,
  Image as ImageIcon,
  ZoomIn,
  X
} from 'lucide-react';
import {
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  PublishedRecord,
  TermType,
  WebsiteConfig,
  GalleryItem
} from '../types';
import { DEFAULT_WEBSITE_CONFIG, DEFAULT_GALLERY_PRESETS } from '../data/websiteDefaults';

interface SchoolHomepageProps {
  config?: WebsiteConfig;
  websiteConfig?: WebsiteConfig;
  currentUser?: { role?: string; name?: string; username?: string } | null;
  isAdminLoggedIn?: boolean;
  onNavigateToAdmin?: () => void;
  onUpdateWebsiteConfig?: (newConfig: WebsiteConfig) => Promise<any> | void;
  students?: Student[];
  allScores?: SubjectScore[];
  allSummaries?: StudentSummary[];
  subjectsList?: SubjectRule[];
  publishedRecords?: PublishedRecord[];
  isClassResultPublished?: (className: string, term: TermType, session: string) => boolean;
  onOpenStaffLogin: () => void;
  onOpenStudentLogin: () => void;
  onStudentLogin?: (student: Student) => void;
  onOpenAdminSetup: () => void;
}

export const SchoolHomepage: React.FC<SchoolHomepageProps> = ({
  config: propConfig,
  websiteConfig,
  currentUser,
  isAdminLoggedIn: propIsAdminLoggedIn,
  onNavigateToAdmin,
  students = [],
  onOpenStaffLogin,
  onOpenStudentLogin,
  onStudentLogin
}) => {
  const config = websiteConfig || propConfig || DEFAULT_WEBSITE_CONFIG;

  // Direct Motto from school settings
  const cleanMotto = config.motto?.trim() || '';

  // Determine if Admin is logged in
  const isAdmin = Boolean(
    propIsAdminLoggedIn ||
    currentUser?.role === 'admin' ||
    currentUser?.username?.toLowerCase() === 'admin'
  );

  // Interactive Tab State: 'student' | 'staff' | 'admissions'
  const [activeGateway, setActiveGateway] = useState<'student' | 'staff' | 'admissions'>('student');

  // Interactive Quick Result Lookup State: 'id' -> 'password'
  const [lookupStep, setLookupStep] = useState<'id' | 'password'>('id');
  const [quickRegNo, setQuickRegNo] = useState('');
  const [quickPassword, setQuickPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Admissions Enquiry State
  const [enquiryCategory, setEnquiryCategory] = useState<string>('Primary School Enrolment');

  // School Highlights Photo Gallery States
  const [selectedHighlightCategory, setSelectedHighlightCategory] = useState<string>('All');
  const [activeLightboxItem, setActiveLightboxItem] = useState<GalleryItem | null>(null);

  // Gallery Highlights dataset (from school website configuration with defaults)
  const galleryItems = useMemo(() => {
    return (config.gallery && config.gallery.length > 0)
      ? config.gallery
      : DEFAULT_GALLERY_PRESETS;
  }, [config.gallery]);

  const highlightCategories = useMemo(() => {
    const cats = new Set<string>();
    galleryItems.forEach((item) => {
      if (item.category && item.category.trim()) {
        cats.add(item.category.trim());
      }
    });
    return ['All', ...Array.from(cats)];
  }, [galleryItems]);

  const filteredHighlights = useMemo(() => {
    if (selectedHighlightCategory.toLowerCase() === 'all') return galleryItems;
    return galleryItems.filter(
      (item) => item.category?.toLowerCase() === selectedHighlightCategory.toLowerCase()
    );
  }, [galleryItems, selectedHighlightCategory]);

  // Interactive FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  // Dynamic Phone & WhatsApp Link Dispatcher
  const phone = config.phonePrimary || '08168986994';
  const rawWa = (config.whatsAppNumber || config.phonePrimary || '2348168986994').replace(/\D/g, '');
  const cleanWa = rawWa.startsWith('0') ? '234' + rawWa.slice(1) : (rawWa || '2348168986994');

  const getWhatsAppLink = (customText?: string) => {
    const text =
      customText ||
      `Hello ${config.schoolName || 'Admissions Office'}, I would like to make an enquiry regarding ${enquiryCategory}.`;
    return `https://wa.me/${cleanWa}?text=${encodeURIComponent(text)}`;
  };

  // Handle Step 1: Pupil enters Student ID and clicks Check Result
  const handleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const cleanId = quickRegNo.trim();

    if (!cleanId) {
      setLookupError('Please enter your student registration ID.');
      return;
    }

    const normalizedInput = cleanId.toLowerCase().replace(/[\s/_-]/g, '');
    const found = students.find((s) => {
      const sId = s.StudentID.trim().toLowerCase().replace(/[\s/_-]/g, '');
      return sId === normalizedInput || s.StudentID.toLowerCase() === cleanId.toLowerCase();
    });

    if (found) {
      setMatchedStudent(found);
      setLookupStep('password');
      setLookupError(null);
    } else if (students.length > 0) {
      setLookupError(`Student ID "${cleanId}" was not found in the roster. Please double-check your ID or contact the school.`);
    } else {
      // If roster is syncing, allow proceeding to password entry
      setMatchedStudent(null);
      setLookupStep('password');
    }
  };

  // Handle Step 2: Pupil enters Password and submits to log in
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    const cleanPwd = quickPassword.trim();

    if (!cleanPwd) {
      setLookupError('Please enter your password.');
      return;
    }

    setIsAuthenticating(true);

    const targetStudent =
      matchedStudent ||
      students.find((s) => {
        const sId = s.StudentID.trim().toLowerCase().replace(/[\s/_-]/g, '');
        const normalizedInput = quickRegNo.trim().toLowerCase().replace(/[\s/_-]/g, '');
        return sId === normalizedInput || s.StudentID.toLowerCase() === quickRegNo.trim().toLowerCase();
      });

    if (!targetStudent) {
      setIsAuthenticating(false);
      setLookupError('Student record not found. Please verify your Student ID.');
      return;
    }

    const actualPass = (targetStudent.Password || 'password').trim();
    const isMatch = cleanPwd === actualPass;

    if (isMatch) {
      setTimeout(() => {
        setIsAuthenticating(false);
        if (onStudentLogin) {
          onStudentLogin(targetStudent);
        } else {
          onOpenStudentLogin();
        }
      }, 300);
    } else {
      setTimeout(() => {
        setIsAuthenticating(false);
        setLookupError('Incorrect password entered. Please check your password and try again.');
      }, 350);
    }
  };

  const handleResetLookup = () => {
    setLookupStep('id');
    setQuickPassword('');
    setLookupError(null);
  };

  const faqs = [
    {
      q: 'How do pupils and parents check their terminal report cards?',
      a: 'Enter your student registration number above and enter your password. You will immediately access your official terminal report card with full subject scores and teacher remarks.'
    },
    {
      q: 'How are the continuous assessments and terminal scores calculated?',
      a: 'Assessments follow official academic weightings: Continuous Assessment 1 (20%), Continuous Assessment 2 (20%), and Terminal Examination (60%), totalling 100% with automated rankings.'
    },
    {
      q: 'How do users access the assessment portal?',
      a: 'Click "LOGIN" or "Check Student Results" at the top, then sign in with your credentials to view reports or record continuous assessment scores.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-slate-900 font-sans selection:bg-amber-400 selection:text-slate-950 flex flex-col justify-between">
      
      <div>
        {/* 1. TOP INSTITUTIONAL STATUS & CONTACT STRIP */}
        <div className="bg-[#061426] text-slate-200 border-b border-blue-950/80 text-xs py-2 px-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-end">
            <a
              id="topbar-phone-contact"
              href={`tel:${phone}`}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-amber-300 transition-colors"
              title="Call Campus Helpline"
            >
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-amber-300 font-bold tracking-tight">{phone}</span>
            </a>
          </div>
        </div>

        {/* ADMIN DISCREET BAR (ONLY VISIBLE WHEN LOGGED IN AS ADMIN) */}
        {isAdmin && onNavigateToAdmin && (
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-4 py-2 border-b border-amber-600/30 shadow-xs">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs font-bold">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-950 shrink-0" />
                <span>Administrator Mode Active &bull; Configure branding and settings in the Admin Dashboard.</span>
              </div>
              <button
                onClick={onNavigateToAdmin}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 text-xs font-black rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                Open Admin Dashboard &rarr;
              </button>
            </div>
          </div>
        )}

        {/* 2. INSTITUTIONAL NAVIGATION HEADER (HEADING GIVEN FULL SPACE, NO REPEATED RESULT ICON AT TOP) */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 sm:gap-4">
            
            {/* School Branding Crest & Full Heading */}
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
              <div className="shrink-0 flex items-center justify-center">
                <SchoolLogo src={config.logoUrl} size="md" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg md:text-xl lg:text-2xl font-black text-[#0a1e3f] font-serif tracking-tight leading-snug sm:leading-tight uppercase break-words">
                  {config.schoolName || 'STANDARD ACADEMY'}
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5 break-words">
                  {cleanMotto || 'Official Academic Assessment & Result Portal'}
                </p>
              </div>
            </div>

            {/* Access / Admin Portal Button */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                id="header-staff-login-btn"
                onClick={isAdmin && onNavigateToAdmin ? onNavigateToAdmin : onOpenStaffLogin}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-[#0a1e3f] hover:bg-[#132c57] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden xs:inline">Admin Dashboard</span>
                    <span className="xs:hidden">Admin</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold tracking-wide">LOGIN</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </header>

        {/* 3. HERO SHOWCASE WITH CORNER MOTION & DIRECT CHECK RESULT */}
        <section className="relative overflow-hidden pt-10 pb-14 sm:pt-14 sm:pb-18 bg-radial from-slate-50 via-white to-blue-50/30 border-b border-slate-200/70">
          
          {/* Subtle Institutional Grid Texture */}
          <div className="absolute inset-0 bg-[radial-gradient(#0a1e3f08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

          {/* ======================================================== */}
          {/* CORNERS WITH MOTION: ANIMATED CORNER ACCENTS            */}
          {/* ======================================================== */}
          
          {/* Top-Left Animated Corner */}
          <div className="absolute top-3 left-3 sm:top-6 sm:left-6 pointer-events-none z-10">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-l-2 border-amber-400 rounded-tl-xl relative">
              <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
          </div>

          {/* Top-Right Animated Corner */}
          <div className="absolute top-3 right-3 sm:top-6 sm:right-6 pointer-events-none z-10">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-t-2 border-r-2 border-amber-400 rounded-tr-xl relative">
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
          </div>

          {/* Bottom-Left Animated Corner */}
          <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 pointer-events-none z-10">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-l-2 border-amber-400 rounded-bl-xl relative">
              <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
          </div>

          {/* Bottom-Right Animated Corner */}
          <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 pointer-events-none z-10">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-b-2 border-r-2 border-amber-400 rounded-br-xl relative">
              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-pulse" />
            </div>
          </div>
          
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-4">

              {/* Main Welcome Headline */}
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#0a1e3f] font-serif tracking-tight leading-[1.15] break-words">
                {config.welcomeHeadline || 'Academic Assessment Portal'}
              </h2>

              <p className="text-sm sm:text-base text-slate-600 font-normal max-w-xl mx-auto leading-relaxed">
                {config.welcomeSubheadline || 'Continuous assessment tracking, official terminal reports, and student examination records.'}
              </p>

              {/* ========================================================== */}
              {/* INTERACTIVE CHECK RESULT: TAKE ID -> ASK PASSWORD -> LOG IN */}
              {/* ========================================================== */}
              <div className="pt-3 max-w-xl mx-auto">
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-lg relative">
                  
                  {/* Subtle Corner Accents on Check Result Box */}
                  <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-400" />
                  <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-400" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-400" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-400" />

                  {/* STEP 1: ENTER STUDENT ID */}
                  {lookupStep === 'id' ? (
                    <form
                      key="step-id"
                      onSubmit={handleIdSubmit}
                      className="space-y-3 transition-opacity duration-200"
                    >
                      <div className="text-left">
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#0a1e3f] mb-1.5">
                          Check Student Result
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute left-3 text-amber-500">
                            <Search className="w-5 h-5" />
                          </div>
                          <input
                            type="text"
                            placeholder="Enter Student ID (e.g., STB/2024/001)..."
                            value={quickRegNo}
                            onChange={(e) => setQuickRegNo(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 transition-all"
                          />
                        </div>
                      </div>

                      {lookupError && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 text-left">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{lookupError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <span>Check Result</span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </button>
                    </form>
                  ) : (
                    /* STEP 2: ASK PASSWORD & LOG IN DIRECTLY */
                    <form
                      key="step-password"
                      onSubmit={handlePasswordSubmit}
                      className="space-y-3 text-left transition-opacity duration-200"
                    >
                      {/* Selected Student Confirmation Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-[#0a1e3f] truncate">
                              {matchedStudent ? matchedStudent.FullName : quickRegNo}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              ID: {matchedStudent ? matchedStudent.StudentID : quickRegNo}
                              {matchedStudent?.Class && ` • ${matchedStudent.Class}`}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetLookup}
                          className="text-xs text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Change ID</span>
                        </button>
                      </div>

                      {/* Password Input */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#0a1e3f] mb-1.5">
                          Enter Password for Result Access
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute left-3 text-amber-500">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your student password..."
                            value={quickPassword}
                            onChange={(e) => setQuickPassword(e.target.value)}
                            autoFocus
                            className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {lookupError && (
                        <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2 text-left">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{lookupError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isAuthenticating}
                        className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                      >
                        {isAuthenticating ? (
                          <span>Logging In...</span>
                        ) : (
                          <>
                            <GraduationCap className="w-4 h-4 text-slate-950" />
                            <span>Log In &amp; View Result</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 4. CONCISE PORTAL GATEWAY HUB (SHORT, NO EXCESS INFO) */}
        <section className="py-8 sm:py-12 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Interactive Switcher */}
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 shadow-2xs gap-1 max-w-full overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveGateway('student')}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeGateway === 'student'
                      ? 'bg-[#0a1e3f] text-amber-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Pupil &amp; Parent</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveGateway('staff')}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeGateway === 'staff'
                      ? 'bg-[#0a1e3f] text-amber-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Staff Login</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveGateway('admissions')}
                  className={`px-4 sm:px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    activeGateway === 'admissions'
                      ? 'bg-[#0a1e3f] text-amber-300 shadow-sm'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Admissions</span>
                </button>
              </div>
            </div>

            {/* GATEWAY DISPLAY - KEPT SHORT AND CONCISE */}
            <div className="max-w-2xl mx-auto">
              
              {/* TAB 1: PUPIL & PARENT */}
              {activeGateway === 'student' && (
                <div className="bg-amber-50/40 rounded-2xl border border-amber-300/80 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div>
                    <h3 className="text-base font-bold text-[#0a1e3f]">
                      Pupil &amp; Parent Portal
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Direct access to official term report cards, continuous assessments, and grades.
                    </p>
                  </div>
                  <button
                    onClick={onOpenStudentLogin}
                    className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 active:scale-95 shrink-0"
                  >
                    <span>Open Student Login</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TAB 2: STAFF & TEACHER PORTAL */}
              {activeGateway === 'staff' && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div>
                    <h3 className="text-base font-bold text-[#0a1e3f]">
                      Staff &amp; Teacher Portal
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      Portal for staff, teachers, and administrators to record continuous assessments, attendance, and student reports.
                    </p>
                  </div>
                  <button
                    onClick={isAdmin && onNavigateToAdmin ? onNavigateToAdmin : onOpenStaffLogin}
                    className="px-5 py-2.5 bg-[#0a1e3f] hover:bg-[#132c57] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 active:scale-95 shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isAdmin ? 'Open Admin Console' : 'Open Staff Login'}</span>
                  </button>
                </div>
              )}

              {/* TAB 3: ADMISSIONS & ENQUIRIES */}
              {activeGateway === 'admissions' && (
                <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200 p-5 sm:p-6 shadow-sm space-y-4 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-[#0a1e3f]">
                        Admissions &amp; Enquiries Desk
                      </h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Direct assistance for new pupil enrolments and admissions enquiries.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={getWhatsAppLink()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={`tel:${phone}`}
                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition-all inline-flex items-center gap-1.5"
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-800" />
                        <span>Call</span>
                      </a>
                    </div>
                  </div>

                  {/* Category Chips */}
                  <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start pt-1">
                    {['Primary Enrolment', 'Nursery Admission', 'Secondary Admission', 'Result Card Help'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setEnquiryCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          enquiryCategory === cat
                            ? 'bg-emerald-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
        </section>

        {/* 5. SCHOOL HIGHLIGHTS PHOTO GALLERY SECTION */}
        {(config.enableGallery !== false || isAdmin) && galleryItems.length > 0 && (
          <section id="school-highlights" className="py-12 sm:py-16 bg-slate-50/70 border-t border-slate-200/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-[#0a1e3f] font-serif tracking-tight">
                    School Highlights
                  </h3>
                </div>

                {/* If Admin is logged in, link directly to upload / manage */}
                {isAdmin && onNavigateToAdmin && (
                  <button
                    onClick={onNavigateToAdmin}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0a1e3f] hover:bg-[#132c57] text-white text-xs font-bold shadow-xs transition-all cursor-pointer self-start md:self-auto shrink-0 active:scale-95"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Manage Highlights</span>
                  </button>
                )}
              </div>

              {/* Admin Notice if gallery is disabled in settings but visible to admin */}
              {config.enableGallery === false && isAdmin && (
                <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Notice:</strong> This gallery is currently set to hidden in website settings. As an administrator, you are seeing this preview.
                  </span>
                </div>
              )}

              {/* Category Filter Tabs - Mature Editorial Underline Style */}
              {highlightCategories.length > 2 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 border-b border-slate-200">
                  {highlightCategories.map((cat) => {
                    const isSelected = selectedHighlightCategory.toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedHighlightCategory(cat)}
                        className={`px-3.5 py-2 text-xs transition-all whitespace-nowrap cursor-pointer border-b-2 -mb-[1px] ${
                          isSelected
                            ? 'border-[#0a1e3f] text-[#0a1e3f] font-black'
                            : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Photos Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredHighlights.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setActiveLightboxItem(item)}
                    className="group bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        onError={(e) => {
                          // Fallback if custom URL fails to load
                          (e.currentTarget as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=1200&auto=format&fit=crop';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                        <span className="text-white text-xs font-bold flex items-center gap-1">
                          <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                          <span>View Full Photo</span>
                        </span>
                      </div>

                      {item.category && (
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-1 rounded-lg bg-[#0a1e3f]/90 backdrop-blur-xs text-amber-300 text-[11px] font-bold tracking-wide uppercase shadow-xs">
                            {item.category}
                          </span>
                        </div>
                      )}

                      {item.date && (
                        <div className="absolute top-3 right-3">
                          <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-slate-200 text-[10px] font-mono">
                            {item.date}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-[#0a1e3f] group-hover:text-amber-600 transition-colors line-clamp-1">
                          {item.title}
                        </h4>
                        {item.caption && (
                          <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                            {item.caption}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>{config.shortName || config.schoolName || 'School Highlight'}</span>
                        <span className="text-amber-600 font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                          Enlarge &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </section>
        )}

        {/* 6. CONCISE FREQUENTLY ASKED QUESTIONS */}
        <section className="py-8 bg-slate-50/50 border-t border-slate-200/70">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-base sm:text-lg font-bold text-[#0a1e3f] font-serif text-center mb-4">
              Frequently Asked Questions
            </h3>

            <div className="space-y-2">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(index)}
                      className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="text-xs sm:text-sm font-bold text-[#0a1e3f]">
                        {faq.q}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-3.5 sm:px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-2.5">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>

      {/* 6. COPYRIGHT & INSTITUTIONAL FOOTER */}
      <footer className="bg-[#061426] text-white py-6 border-t border-blue-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-300">
            
            <div className="flex items-center gap-2 text-center md:text-left">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {config.campusAddress || config.cityState || 'Main Campus'} &bull; {config.cityState || 'Nigeria'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-[11px]">
                &copy; {new Date().getFullYear()} {config.schoolName || 'Academic Portal'}.
              </span>
              <button
                onClick={isAdmin && onNavigateToAdmin ? onNavigateToAdmin : onOpenStaffLogin}
                className="text-[11px] text-amber-300 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                {isAdmin ? 'Admin Console' : 'Staff Login'}
              </button>
            </div>

          </div>
        </div>
      </footer>

      {/* 7. LIGHTBOX MODAL FOR HIGHLIGHT PHOTO ENLARGEMENT */}
      {activeLightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setActiveLightboxItem(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-black aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center overflow-hidden">
              <img
                src={activeLightboxItem.imageUrl}
                alt={activeLightboxItem.title}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1580582932707-520aed937b7b?q=80&w=1200&auto=format&fit=crop';
                }}
              />
              <button
                type="button"
                onClick={() => setActiveLightboxItem(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors cursor-pointer"
                title="Close Lightbox"
              >
                <X className="w-5 h-5" />
              </button>
              {activeLightboxItem.category && (
                <div className="absolute top-3 left-3">
                  <span className="px-3 py-1 rounded-xl bg-[#0a1e3f]/90 text-amber-300 text-xs font-bold uppercase tracking-wider">
                    {activeLightboxItem.category}
                  </span>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 space-y-2 overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg sm:text-xl font-black text-[#0a1e3f]">
                  {activeLightboxItem.title}
                </h3>
                {activeLightboxItem.date && (
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {activeLightboxItem.date}
                  </span>
                )}
              </div>
              {activeLightboxItem.caption && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {activeLightboxItem.caption}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
