import React, { useState, useEffect } from 'react';
import { Teacher, Student, WebsiteConfig } from '../types';
import {
  Lock,
  User,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  GraduationCap,
  Eye,
  EyeOff,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';
import { isMatchingClass } from '../utils/grading';
import { getActiveSchoolConfig } from '../config/schoolConfig';

interface LoginScreenProps {
  teachers: Teacher[];
  students?: Student[];
  onLogin: (teacher: Teacher) => void;
  onStudentLogin?: (student: Student) => void;
  isLive: boolean;
  onOpenSetup: () => void;
  isLoading?: boolean;
  onBackToStudentPortal?: () => void;
  initialTab?: 'staff' | 'student';
  websiteConfig?: WebsiteConfig;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  teachers,
  students = [],
  onLogin,
  onStudentLogin,
  isLive,
  onOpenSetup,
  isLoading = false,
  onBackToStudentPortal,
  initialTab = 'student',
  websiteConfig
}) => {
  const [authRole, setAuthRole] = useState<'staff' | 'student'>(initialTab);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync tab with initialTab when it changes
  useEffect(() => {
    setAuthRole(initialTab);
    setError(null);
    setUsername('');
    setPassword('');
  }, [initialTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Please enter both your login ID/username and password.');
      return;
    }

    setIsSubmitting(true);

    if (authRole === 'staff') {
      const isTryingMasterAdmin = cleanUsername.toLowerCase() === 'admin';

      // 1. Master Administrator check (Username: 'admin')
      if (isTryingMasterAdmin) {
        const adminAccount =
          teachers.find((t) => String(t.Username ?? '').trim().toLowerCase() === 'admin' && t.Role === 'admin') ||
          teachers.find((t) => String(t.Username ?? '').trim().toLowerCase() === 'admin') ||
          teachers.find((t) => t.Role === 'admin') || {
            Username: 'admin',
            Password: 'admin',
            ClassAssigned: 'Admin',
            FullName: 'Portal Administrator',
            Role: 'admin' as const
          };

        const actualAdminPass = String(adminAccount.Password ?? 'admin').trim();
        const isCorrectAdminPassword = cleanPassword === actualAdminPass;

        if (isCorrectAdminPassword) {
          setTimeout(() => {
            setIsSubmitting(false);
            onLogin({
              ...adminAccount,
              Role: 'admin',
              ClassAssigned: 'Admin'
            });
          }, 200);
          return;
        } else {
          setTimeout(() => {
            setIsSubmitting(false);
            setError('Incorrect administrator password. Please try again.');
          }, 300);
          return;
        }
      }

      // 2. Teacher & Staff Authentication with Identity-Based Class Tracking
      // Find teacher by:
      // A. Exact current username (case-insensitive)
      let matched = teachers.find(
        (t) => String(t.Username ?? '').trim().toLowerCase() === cleanUsername.toLowerCase()
      );

      // B. Previous username (in case teacher changed username)
      if (!matched) {
        matched = teachers.find((t) =>
          t.PreviousUsernames?.some((u) => u.toLowerCase() === cleanUsername.toLowerCase())
        );
      }

      // C. Class alias / handle fallback (e.g. "primary 6", "teacher_primary6", "teacher_p6")
      if (!matched) {
        const normalizedInput = cleanUsername.toLowerCase().replace(/[\s._-]/g, '').replace(/^teacher/, '');
        matched = teachers.find((t) => {
          if (t.Role === 'admin') return false;
          const normalizedClass = String(t.ClassAssigned ?? '').toLowerCase().replace(/[\s._-]/g, '');
          return (
            normalizedClass === normalizedInput ||
            isMatchingClass(t.ClassAssigned, cleanUsername) ||
            cleanUsername.toLowerCase() === `teacher_${normalizedClass}`
          );
        });
      }

      if (matched) {
        // If matched account is an admin account, enforce admin password
        if (matched.Role === 'admin') {
          const actualAdminPass = (matched.Password || 'admin').trim();
          const isCorrectAdminPassword = cleanPassword === actualAdminPass;

          if (isCorrectAdminPassword) {
            setTimeout(() => {
              setIsSubmitting(false);
              onLogin({ ...matched, Role: 'admin', ClassAssigned: 'Admin' });
            }, 200);
            return;
          } else {
            setTimeout(() => {
              setIsSubmitting(false);
              setError('Incorrect administrator password. Please try again.');
            }, 300);
            return;
          }
        }

        // Standard Class Teacher Authentication:
        // Teacher password check
        const actualTeacherPass = String(matched.Password ?? 'password123').trim();
        if (cleanPassword === actualTeacherPass) {
          // Success! Teacher is authenticated for their specific assigned class.
          const teacherObj: Teacher = {
            ...matched,
            Role: 'teacher',
            ClassAssigned: matched.ClassAssigned
          };
          setTimeout(() => {
            setIsSubmitting(false);
            onLogin(teacherObj);
          }, 200);
          return;
        } else {
          setTimeout(() => {
            setIsSubmitting(false);
            setError('Incorrect password. Please verify your credentials and try again.');
          }, 300);
          return;
        }
      }

      // Check if user accidentally typed their Student ID on the Staff tab
      const cleanStudentInputId = cleanUsername.toLowerCase().replace(/[\s/_-]/g, '');
      const potentialStudent = students.find((s) => {
        const sId = String(s.StudentID ?? '').trim().toLowerCase().replace(/[\s/_-]/g, '');
        return sId === cleanStudentInputId || String(s.StudentID ?? '').toLowerCase() === cleanUsername.toLowerCase();
      });

      if (potentialStudent && onStudentLogin) {
        const actualPass = String(potentialStudent.Password ?? 'password').trim();
        if (cleanPassword === actualPass) {
          setTimeout(() => {
            setIsSubmitting(false);
            onStudentLogin(potentialStudent);
          }, 200);
          return;
        } else {
          setTimeout(() => {
            setIsSubmitting(false);
            setAuthRole('student');
            setError('Incorrect password. Please try again.');
          }, 250);
          return;
        }
      }

      // No matching staff account found
      setTimeout(() => {
        setIsSubmitting(false);
        setError('Staff account not found. Please verify your username and password.');
      }, 300);
      return;
    } else {
      // -------------------------------------------------------------
      // Student Login with Student ID & Password
      // -------------------------------------------------------------
      const cleanId = cleanUsername.toLowerCase().replace(/[\s/_-]/g, '');

      // 1. First check if user accidentally entered Staff / Admin credentials on the Student tab
      const isTryingAdmin = cleanUsername.toLowerCase() === 'admin';

      if (isTryingAdmin) {
        const adminAccount =
          teachers.find((t) => String(t.Username ?? '').trim().toLowerCase() === 'admin' && t.Role === 'admin') ||
          teachers.find((t) => String(t.Username ?? '').trim().toLowerCase() === 'admin') ||
          teachers.find((t) => t.Role === 'admin') || {
            Username: 'admin',
            Password: 'admin',
            ClassAssigned: 'Admin',
            FullName: 'Portal Administrator',
            Role: 'admin' as const
          };
        const actualAdminPass = String(adminAccount.Password ?? 'admin').trim();
        const isCorrectAdminPassword = cleanPassword === actualAdminPass;

        if (isCorrectAdminPassword) {
          setTimeout(() => {
            setIsSubmitting(false);
            onLogin({ ...adminAccount, Role: 'admin', ClassAssigned: 'Admin' });
          }, 200);
          return;
        } else {
          setTimeout(() => {
            setIsSubmitting(false);
            setAuthRole('staff');
            setError('Incorrect administrator password. Please try again.');
          }, 250);
          return;
        }
      }

      // Check if user entered a teacher username on the Student tab
      const potentialTeacher = teachers.find(
        (t) =>
          String(t.Username ?? '').trim().toLowerCase() === cleanUsername.toLowerCase() ||
          cleanUsername.toLowerCase() === `teacher_${String(t.ClassAssigned ?? '').toLowerCase().replace(/[\s._-]/g, '')}` ||
          isMatchingClass(t.ClassAssigned, cleanUsername)
      );

      if (potentialTeacher) {
        const actualTeacherPass = (potentialTeacher.Password || 'password123').trim();
        if (cleanPassword === actualTeacherPass) {
          setTimeout(() => {
            setIsSubmitting(false);
            onLogin({ ...potentialTeacher, Role: 'teacher', ClassAssigned: potentialTeacher.ClassAssigned });
          }, 200);
          return;
        } else {
          setTimeout(() => {
            setIsSubmitting(false);
            setAuthRole('staff');
            setError('Incorrect password. Please try again.');
          }, 250);
          return;
        }
      }

      // 2. Check if students list is empty in the database
      if (!students || students.length === 0) {
        setTimeout(() => {
          setIsSubmitting(false);
          setError(
            'No student records have been registered in the database yet. If you are an administrator, switch to the "Staff Login" tab and log in as "admin" to enroll students first.'
          );
        }, 300);
        return;
      }

      // 3. Search for student by ID
      const matchedStudent = students.find((s) => {
        const sId = String(s.StudentID ?? '').trim().toLowerCase().replace(/[\s/_-]/g, '');
        return sId === cleanId || String(s.StudentID ?? '').toLowerCase() === cleanUsername.toLowerCase();
      });

      if (!matchedStudent) {
        setTimeout(() => {
          setIsSubmitting(false);
          setError(
            `Student ID "${cleanUsername}" was not found in the registry. Please check your ID or contact the school.`
          );
        }, 300);
        return;
      }

      // 4. Verify password for matched student
      const actualPass = String(matchedStudent.Password ?? 'password').trim();
      const pwdMatches = cleanPassword === actualPass;

      if (pwdMatches && onStudentLogin) {
        setTimeout(() => {
          setIsSubmitting(false);
          onStudentLogin(matchedStudent);
        }, 200);
      } else {
        setTimeout(() => {
          setIsSubmitting(false);
          setError('Incorrect password entered. Please check your password and try again.');
        }, 300);
      }
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-6 sm:py-8 sm:px-6 lg:px-8 select-none">
      {/* Return to Landing Page Button */}
      {onBackToStudentPortal && (
        <div className="sm:mx-auto sm:w-full sm:max-w-md mb-4 flex justify-start px-4 sm:px-0">
          <button
            id="back-to-landing-btn"
            onClick={onBackToStudentPortal}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-[#0a1e3f] bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-700" />
            <span>Back to School Homepage</span>
          </button>
        </div>
      )}

      {/* Top School Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center px-4">
        {(() => {
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
            <>
              <div className="flex justify-center mb-3.5">
                <div
                  className="select-none"
                  title={activeSchool.schoolName}
                >
                  <SchoolLogo
                    size="2xl"
                    src={activeSchool.logoUrl}
                    alt={activeSchool.schoolName}
                    className="w-36 h-36 sm:w-48 sm:h-48 md:w-52 md:h-52 object-contain filter drop-shadow-md"
                  />
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#0a1e3f] tracking-tight uppercase font-serif break-words leading-tight px-2">
                {activeSchool.schoolName}
              </h1>

              <p className="text-xs sm:text-sm font-black text-amber-600 uppercase tracking-widest font-mono mt-1.5 break-words">
                Motto: {activeSchool.motto}
              </p>

              <p className="text-xs sm:text-sm font-semibold text-slate-600 tracking-wide mt-1 flex items-center justify-center gap-1.5 break-words">
                <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{activeSchool.campusAddress}{activeSchool.cityState ? `, ${activeSchool.cityState}` : ''}</span>
              </p>
            </>
          );
        })()}
      </div>

      {/* Main Login Box */}
      <div className="mt-5 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-6 sm:py-7 px-5 sm:px-8 shadow-xl border-2 border-slate-200 rounded-3xl">
          {/* Portal Switcher Tabs: Student vs Staff */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5 border border-slate-200">
            <button
              type="button"
              id="tab-student-login"
              onClick={() => {
                setAuthRole('student');
                setError(null);
                setUsername('');
                setPassword('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authRole === 'student'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student Login</span>
            </button>

            <button
              type="button"
              id="tab-staff-login"
              onClick={() => {
                setAuthRole('staff');
                setError(null);
                setUsername('');
                setPassword('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authRole === 'staff'
                  ? 'bg-[#0a1e3f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Staff Login</span>
            </button>
          </div>

          {/* Form Header Info */}
          <div className="mb-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
              {authRole === 'student' ? 'Student Portal Login' : 'Staff Portal Login'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {authRole === 'student'
                ? 'Enter your Student ID and password to access your result.'
                : 'Enter your assigned staff username and password to proceed.'}
            </p>
          </div>

          <form className="space-y-3.5" onSubmit={handleSubmit}>
            {error && (
              <div
                id="login-error-alert"
                className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl text-xs flex items-start gap-2 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Username / Student ID Input */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                {authRole === 'student' ? 'Student ID / Admission Number' : 'Username'}
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  {authRole === 'student' ? <GraduationCap className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={authRole === 'student' ? 'e.g. DNPS/0001 or DSS/0001' : 'Enter username'}
                  className={`block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
                    authRole === 'student' ? 'font-mono uppercase font-bold text-amber-950' : 'font-mono text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-offset-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  authRole === 'student'
                    ? 'text-slate-950 bg-amber-400 hover:bg-amber-300 focus:ring-amber-500'
                    : 'text-white bg-slate-900 hover:bg-slate-800 focus:ring-slate-900'
                }`}
              >
                {isSubmitting ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>{authRole === 'student' ? 'Access Student Results' : 'Sign In'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
