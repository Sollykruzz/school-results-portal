/**
 * Core Types for School Management Portal
 * Report Card Management System & School Website CMS
 */

export type EducationLevel =
  | 'Kindergarten'
  | 'Nursery'
  | 'LowerPrimary'
  | 'UpperPrimary'
  | 'Primary'
  | 'JuniorSecondary'
  | 'SeniorSecondary';

export type TermType = 'First Term' | 'Second Term' | 'Third Term';

export interface Teacher {
  id?: string;
  Username: string;
  Password: string;
  ClassAssigned: string;
  FullName?: string;
  Role?: 'admin' | 'teacher';
  PhotoURL?: string;
  Phone?: string;
  PreviousUsernames?: string[];
}

export interface Student {
  StudentID: string;
  FullName: string;
  Class: string;
  Gender?: 'Male' | 'Female' | string;
  DOB?: string;
  ParentName?: string;
  ParentPhone?: string;
  Address?: string;
  GuardianEmail?: string;
  Password?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  PhotoURL?: string;
  PassportUrl?: string;
}

export interface SubjectRule {
  id?: string;
  Level: string; // 'LowerPrimary' | 'UpperPrimary' | 'JuniorSecondary' | 'SeniorSecondary' | 'Nursery' | 'Kindergarten' or specific Class name
  SubjectName: string;
  Class?: string;
}

export interface SubjectScore {
  StudentID: string;
  Term: TermType;
  Session: string; // e.g. "2024/2025"
  Subject: string;
  CA1: number | null; // configured limit (default 20)
  CA2: number | null; // configured limit (default 20)
  Exam: number | null; // configured limit (default 60)
  Total: number | null; // sum of entered components (max 100)
}

export interface AffectiveRatings {
  punctuality?: number; // 1-5
  neatness?: number; // 1-5
  politeness?: number; // 1-5
  honesty?: number; // 1-5
  selfControl?: number; // 1-5
  relationshipWithPeers?: number; // 1-5
  attentiveness?: number; // 1-5
  leadership?: number; // 1-5
  perseverance?: number;
  [key: string]: number | undefined;
}

export interface PsychomotorRatings {
  handwriting?: number; // 1-5
  sports?: number; // 1-5
  drawingCrafts?: number; // 1-5
  musicalSkills?: number; // 1-5
  practicalSkills?: number; // 1-5
  fluencySpeaking?: number; // 1-5
  sportsAndGames?: number;
  craftsAndCreativity?: number;
  handlingTools?: number;
  musicAndDrama?: number;
  [key: string]: number | undefined;
}

export interface StudentSummary {
  StudentID: string;
  Term: TermType;
  Session: string;
  DaysPresent?: number | null;
  DaysOpened?: number | null;
  TeacherComment?: string;
  PrincipalComment?: string;
  AffectiveRatings?: AffectiveRatings;
  PsychomotorRatings?: PsychomotorRatings;
  PromotionDecision?: 'Promoted' | 'Promoted on Trial' | 'Advised to Repeat' | 'Graduated' | string;
  UpdatedAt?: string;
}

export interface GradingScaleItem {
  id?: string;
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string;
  gpaPoint?: number;
  section?: 'All' | 'EarlyYears' | 'Primary' | 'JuniorSecondary' | 'SeniorSecondary' | string;
  description?: string;
}

export interface PublishedRecord {
  classKey: string; // e.g. "Primary 4_First Term_2024/2025" or class name
  className: string;
  term: TermType;
  session: string;
  isPublished: boolean;
  publishedAt?: string;
  publishedBy?: string;
  status?: 'draft' | 'pending_approval' | 'approved';
  teacherSubmitted?: boolean;
  teacherSubmittedAt?: string;
  teacherSubmittedBy?: string;
  adminApproved?: boolean;
  adminApprovedAt?: string;
  adminApprovedBy?: string;
}

export interface ClassRankingItem {
  student: Student;
  completedSubjectsCount: number;
  totalSubjectsAvailable: number;
  totalScore: number;
  averageScore: number;
  positionNumber: number;
  positionLabel: string;
  isComplete: boolean;
  gradeLabel: string;
}

export interface SubjectStats {
  subject: string;
  average: number;
  highest: number;
  lowest: number;
  enrolledCount: number;
  gradedCount: number;
}

export interface ScoringConfig {
  maxCA1: number;
  maxCA2: number;
  maxExam: number;
  maxTotal: number;
}

export interface SchoolSettings {
  schoolName: string;
  motto: string;
  address: string;
  principalName: string;
  defaultDaysOpened: number;
  nextTermResumption: string;
  currentSession: string;
  currentTerm: TermType;
}

export type ClassCategory = 'KG' | 'Nursery' | 'Primary' | 'Junior Secondary' | 'Senior Secondary' | 'Other';

export interface ClassRecord {
  id?: string;
  name: string;
  category: ClassCategory;
  order?: number;
  classTeacher?: string;
  teacherUsername?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

export interface AttendanceEntry {
  studentId: string;
  studentName?: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface DailyAttendanceRecord {
  id?: string;
  className: string;
  session: string;
  term: TermType;
  date: string; // YYYY-MM-DD
  dayOfWeek?: string;
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalExcused: number;
  entries: AttendanceEntry[];
  recordedBy?: string;
  updatedAt?: string;
}

export interface StudentAttendanceTally {
  studentId: string;
  studentName: string;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysExcused: number;
  totalDaysRecorded: number;
  attendancePercentage: number;
}

export interface RolloverStudentDecision {
  studentId: string;
  studentName: string;
  currentClass: string;
  targetClass: string;
  action: 'Promote' | 'PromoteOnTrial' | 'Repeat' | 'Graduate' | 'Custom' | 'Skip';
  annualAverage: number | null;
  thirdTermAverage: number | null;
  promotionDecisionText: string;
  isCustomOverride?: boolean;
}

export interface RolloverHistoryRecord {
  id?: string;
  timestamp: string;
  fromSession: string;
  toSession: string;
  promotedCount: number;
  repeatedCount: number;
  graduatedCount: number;
  executedBy: string;
  notes?: string;
}

export interface FacilityItem {
  id: string;
  title: string;
  category: 'Academics' | 'STEM & Tech' | 'Sports' | 'Safety & Transit' | 'Early Years' | 'Amenities' | 'Campus';
  description: string;
  imageUrl: string;
  badge?: string;
  features: string[];
  order?: number;
  highlight?: boolean;
}

export interface AcademicProgrammeItem {
  id: string;
  name: string;
  ageGroup: string;
  classes: string;
  description: string;
  highlights: string[];
  colorTheme?: string;
}

export interface CoreValueItem {
  id: string;
  title: string;
  shortDesc: string;
  description: string;
  iconName?: string;
}

export interface WebsiteNewsItem {
  id: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  urgent?: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  category?: string;
  caption?: string;
  date?: string;
  order?: number;
}

export interface WebsiteConfig {
  schoolName: string;
  shortName: string;
  acronym?: string;
  motto: string;
  subMotto?: string;
  logoUrl?: string;
  stampLogoUrl?: string;
  stampTopText?: string;
  stampBottomText?: string;
  principalName?: string;
  principalTitle?: string;
  country?: string;
  portalTitle?: string;
  welcomeHeadline: string;
  welcomeSubheadline: string;
  aboutText: string;
  campusAddress: string;
  cityState: string;
  phonePrimary: string;
  phoneSecondary?: string;
  emailContact: string;
  whatsAppNumber: string;
  visitingHours: string;
  admissionStatus: string;
  facilities: FacilityItem[];
  enableFacilities?: boolean; // Toggle visibility of facilities section on public website (default false)
  gallery?: GalleryItem[];
  enableGallery?: boolean; // Toggle visibility of photo gallery section on public website (default false)
  programmes: AcademicProgrammeItem[];
  values: CoreValueItem[];
  announcements: WebsiteNewsItem[];
  adminSecretCode?: string; // 5-tap crest admin access code (default 'ecra')
  lastPublishedAt?: string;
  lastPublishedBy?: string;
}


