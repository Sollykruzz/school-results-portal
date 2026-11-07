import {
  ClassRankingItem,
  EducationLevel,
  GradingScaleItem,
  ScoringConfig,
  Student,
  SubjectRule,
  SubjectScore,
  SubjectStats,
  TermType,
} from '../types';
import { getActiveSchoolConfig } from '../config/schoolConfig';
import { safeStorage } from './safeStorage';

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  maxCA1: 20,
  maxCA2: 20,
  maxExam: 60,
  maxTotal: 100,
};

// In-memory scoring config cache keyed by session_term (e.g., "2026/2027_First Term")
const inMemoryScoringConfigs: Record<string, ScoringConfig> = {};

export const DEFAULT_CURRENT_SESSION = '2026/2027';
export const DEFAULT_CURRENT_TERM: TermType = 'First Term';
export const SESSIONS_LIST = ['2026/2027', '2027/2028', '2025/2026', '2024/2025', '2023/2024'];
export const TERMS_LIST: TermType[] = ['First Term', 'Second Term', 'Third Term'];

/**
 * Normalizes academic session and term to ensure consistent keys across components and storage
 */
export function normalizeSessionAndTerm(
  session?: string,
  term?: string | TermType
): { session: string; term: TermType } {
  const normSession = (session || DEFAULT_CURRENT_SESSION).trim().replace(/\s+/g, '');
  const cleanTerm = (term || DEFAULT_CURRENT_TERM).trim().replace(/\s+/g, ' ').toLowerCase();
  let normTerm: TermType = 'First Term';
  if (cleanTerm.includes('second') || cleanTerm === '2' || cleanTerm.includes('2nd')) {
    normTerm = 'Second Term';
  } else if (cleanTerm.includes('third') || cleanTerm === '3' || cleanTerm.includes('3rd')) {
    normTerm = 'Third Term';
  }
  return { session: normSession, term: normTerm };
}

export function getScoringConfigKey(session?: string, term?: string | TermType): string {
  const { session: s, term: t } = normalizeSessionAndTerm(session, term);
  return `${s}_${t}`;
}

/**
 * Returns the configured score limits for the specified session and term.
 * If no configuration exists for this term, falls back to DEFAULT_SCORING_CONFIG (CA1: 20, CA2: 20, Exam: 60).
 * This ensures historical terms retain the limits with which they were graded.
 */
export function getScoringConfig(
  session?: string,
  term?: string | TermType
): ScoringConfig {
  const { session: s, term: t } = normalizeSessionAndTerm(session, term);
  const key = `${s}_${t}`;
  const altKey = `${s.replace(/\//g, '_')}_${t.replace(/\s+/g, '_')}`;

  // 1. Check in-memory store
  if (inMemoryScoringConfigs[key]) {
    return inMemoryScoringConfigs[key];
  }
  if (inMemoryScoringConfigs[altKey]) {
    return inMemoryScoringConfigs[altKey];
  }

  // 2. Hydrate from safeStorage if available
  try {
    const raw = safeStorage.getItem('school_portal_scoring_configs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(inMemoryScoringConfigs, parsed);
        if (inMemoryScoringConfigs[key]) return inMemoryScoringConfigs[key];
        if (inMemoryScoringConfigs[altKey]) return inMemoryScoringConfigs[altKey];
      }
    }
  } catch {}

  // 3. Fallback to default limits
  return { ...DEFAULT_SCORING_CONFIG };
}

/**
 * Updates cache for a specific session and term in memory and safeStorage
 */
export function setCachedScoringConfig(
  session: string,
  term: string | TermType,
  config: ScoringConfig
): void {
  const { session: s, term: t } = normalizeSessionAndTerm(session, term);
  const key = `${s}_${t}`;
  const validConfig: ScoringConfig = {
    maxCA1: Number(config.maxCA1),
    maxCA2: Number(config.maxCA2),
    maxExam: Number(config.maxExam),
    maxTotal: Number(config.maxCA1) + Number(config.maxCA2) + Number(config.maxExam)
  };
  inMemoryScoringConfigs[key] = validConfig;
  try {
    safeStorage.setItem('school_portal_scoring_configs', JSON.stringify(inMemoryScoringConfigs));
  } catch {}
}

/**
 * Hydrates all cached scoring configs
 */
export function setAllCachedScoringConfigs(configs: Record<string, ScoringConfig>): void {
  if (!configs || typeof configs !== 'object') return;
  Object.entries(configs).forEach(([key, cfg]) => {
    if (cfg && typeof cfg === 'object') {
      inMemoryScoringConfigs[key] = {
        maxCA1: Number(cfg.maxCA1 ?? 20),
        maxCA2: Number(cfg.maxCA2 ?? 20),
        maxExam: Number(cfg.maxExam ?? 60),
        maxTotal: Number(cfg.maxTotal ?? 100)
      };
    }
  });
  try {
    safeStorage.setItem('school_portal_scoring_configs', JSON.stringify(inMemoryScoringConfigs));
  } catch {}
}

// Standard School Affective Domain (Character & Behavior Traits)
export const AFFECTIVE_TRAITS = [
  { key: 'punctuality', label: 'Punctuality', description: 'Regularity and arriving on time' },
  { key: 'neatness', label: 'Neatness & Cleanliness', description: 'Personal hygiene and uniform care' },
  { key: 'politeness', label: 'Politeness & Courtesy', description: 'Respect towards teachers and peers' },
  { key: 'honesty', label: 'Honesty & Integrity', description: 'Truthfulness in words and conduct' },
  { key: 'selfControl', label: 'Self Control & Discipline', description: 'Emotional maturity and obedience' },
  { key: 'relationshipWithPeers', label: 'Relationship with Peers', description: 'Friendliness, teamwork and empathy' },
  { key: 'attentiveness', label: 'Attentiveness in Class', description: 'Focus and active class participation' },
  { key: 'leadership', label: 'Leadership & Initiative', description: 'Responsibility and positive influence' }
] as const;

// Standard School Psychomotor Domain (Skills & Physical Development)
export const PSYCHOMOTOR_SKILLS = [
  { key: 'handwriting', label: 'Handwriting & Legibility', description: 'Neat, clear and fluent writing' },
  { key: 'sports', label: 'Sports & Games', description: 'Physical agility, sportsmanship and athletics' },
  { key: 'drawingCrafts', label: 'Drawing & Crafts', description: 'Artistic creativity and handcrafting' },
  { key: 'musicalSkills', label: 'Musical & Performing Skills', description: 'Singing, rhythm and drama' },
  { key: 'practicalSkills', label: 'Practical & Lab Work', description: 'Hands-on scientific & technical skills' },
  { key: 'fluencySpeaking', label: 'Fluency & Public Speaking', description: 'Clarity in speech and presentation' }
] as const;

// 1. General Standard School Scale
export const DEFAULT_GENERAL_GRADING_SCALE: GradingScaleItem[] = [
  { id: 'scale_gen_a', minScore: 70, maxScore: 100, grade: 'A', remark: 'Excellent', gpaPoint: 5.0, section: 'All', description: 'Distinction / Outstanding mastery' },
  { id: 'scale_gen_b', minScore: 60, maxScore: 69.9, grade: 'B', remark: 'Very Good', gpaPoint: 4.0, section: 'All', description: 'Commendable understanding' },
  { id: 'scale_gen_c', minScore: 50, maxScore: 59.9, grade: 'C', remark: 'Good / Credit', gpaPoint: 3.0, section: 'All', description: 'Satisfactory understanding' },
  { id: 'scale_gen_d', minScore: 45, maxScore: 49.9, grade: 'D', remark: 'Pass', gpaPoint: 2.0, section: 'All', description: 'Fair / Borderline pass' },
  { id: 'scale_gen_f', minScore: 0, maxScore: 44.9, grade: 'F', remark: 'Fail', gpaPoint: 0.0, section: 'All', description: 'Unsatisfactory / Needs improvement' }
];

// 2. Secondary Section (WAEC / NECO Standard 9-Point Scale)
export const DEFAULT_SECONDARY_WAEC_SCALE: GradingScaleItem[] = [
  { id: 'scale_sec_a1', minScore: 75, maxScore: 100, grade: 'A1', remark: 'Excellent', gpaPoint: 5.0, section: 'Secondary', description: 'Distinction' },
  { id: 'scale_sec_b2', minScore: 70, maxScore: 74.9, grade: 'B2', remark: 'Very Good', gpaPoint: 4.5, section: 'Secondary', description: 'Very Good' },
  { id: 'scale_sec_b3', minScore: 65, maxScore: 69.9, grade: 'B3', remark: 'Good', gpaPoint: 4.0, section: 'Secondary', description: 'Good' },
  { id: 'scale_sec_c4', minScore: 60, maxScore: 64.9, grade: 'C4', remark: 'Credit', gpaPoint: 3.5, section: 'Secondary', description: 'Credit' },
  { id: 'scale_sec_c5', minScore: 55, maxScore: 59.9, grade: 'C5', remark: 'Credit', gpaPoint: 3.0, section: 'Secondary', description: 'Credit' },
  { id: 'scale_sec_c6', minScore: 50, maxScore: 54.9, grade: 'C6', remark: 'Credit', gpaPoint: 2.5, section: 'Secondary', description: 'Credit' },
  { id: 'scale_sec_d7', minScore: 45, maxScore: 49.9, grade: 'D7', remark: 'Pass', gpaPoint: 2.0, section: 'Secondary', description: 'Pass' },
  { id: 'scale_sec_e8', minScore: 40, maxScore: 44.9, grade: 'E8', remark: 'Pass', gpaPoint: 1.0, section: 'Secondary', description: 'Pass' },
  { id: 'scale_sec_f9', minScore: 0, maxScore: 39.9, grade: 'F9', remark: 'Fail', gpaPoint: 0.0, section: 'Secondary', description: 'Fail' }
];

// 3. Early Years & Nursery Section Scale
export const DEFAULT_EARLY_YEARS_SCALE: GradingScaleItem[] = [
  { id: 'scale_ey_star', minScore: 80, maxScore: 100, grade: 'A*', remark: 'Distinction', gpaPoint: 5.0, section: 'EarlyYears', description: 'Exceeding developmental goals' },
  { id: 'scale_ey_a', minScore: 70, maxScore: 79.9, grade: 'A', remark: 'Excellent', gpaPoint: 4.0, section: 'EarlyYears', description: 'Mastering learning goals' },
  { id: 'scale_ey_b', minScore: 60, maxScore: 69.9, grade: 'B', remark: 'Good Progress', gpaPoint: 3.0, section: 'EarlyYears', description: 'Meeting learning goals' },
  { id: 'scale_ey_c', minScore: 50, maxScore: 59.9, grade: 'C', remark: 'Developing', gpaPoint: 2.0, section: 'EarlyYears', description: 'Emerging skills with guidance' },
  { id: 'scale_ey_d', minScore: 0, maxScore: 49.9, grade: 'D', remark: 'Needs Support', gpaPoint: 1.0, section: 'EarlyYears', description: 'Requires extra guidance' }
];

// Mutable in-memory active grading scale items
let activeCustomGradingScales: GradingScaleItem[] = [...DEFAULT_GENERAL_GRADING_SCALE];

export function getActiveGradingScales(): GradingScaleItem[] {
  return activeCustomGradingScales;
}

export function setActiveGradingScales(scales: GradingScaleItem[]) {
  if (scales && scales.length > 0) {
    activeCustomGradingScales = [...scales];
  }
}

// 1. Kindergarten / Early Years (KG 1, KG 2)
export const DEFAULT_KG_SUBJECTS = [
  'Letter Work / Phonics',
  'Number Work / Numeracy',
  'Rhymes & Songs',
  'Social Habits',
  'Health & Hygiene',
  'Basic Science / Nature',
  'Creative Arts & Colouring',
  'Handwriting & Tracing',
];

// 2. Nursery (Nursery 1, Nursery 2, Nursery 3)
export const DEFAULT_NURSERY_SUBJECTS = [
  'Literacy / Letter Work',
  'Numeracy / Number Work',
  'Elementary Science',
  'Social Habits & Civics',
  'Health Habits',
  'Rhymes & Poems',
  'Cultural & Creative Arts (CCA)',
  'Handwriting & Motor Skills',
  'Christian Religious Studies (CRS)',
];

// 3. Lower Primary (Primary 1 - 3 / Basic 1 - 3)
export const DEFAULT_LOWER_PRIMARY_SUBJECTS = [
  'English Language',
  'Mathematics',
  'Basic Science & Technology',
  'Social & Citizenship Studies',
  'Civic Education',
  'Cultural & Creative Arts (CCA)',
  'Physical & Health Education (PHE)',
  'Christian Religious Studies (CRS)',
  'Basic Digital Literacy / ICT',
  'Verbal Reasoning',
  'Quantitative Reasoning',
  'Handwriting',
];

// 4. Upper Primary (Primary 4 - 6 / Basic 4 - 6)
export const DEFAULT_UPPER_PRIMARY_SUBJECTS = [
  'English Language',
  'Mathematics',
  'Basic Science & Technology',
  'Pre-Vocational Studies (Agric & Home Econs)',
  'Social Studies',
  'Civic Education',
  'Nigerian History',
  'Cultural & Creative Arts (CCA)',
  'Physical & Health Education (PHE)',
  'Christian Religious Studies (CRS)',
  'French Language',
  'Basic Digital Literacy / ICT',
  'Verbal Reasoning',
  'Quantitative Reasoning',
];

// Legacy alias for full primary suite
export const DEFAULT_PRIMARY_SUBJECTS = DEFAULT_UPPER_PRIMARY_SUBJECTS;

// 5. Junior Secondary School (JSS 1 - 3 / Basic 7 - 9)
export const DEFAULT_JSS_SUBJECTS = [
  'English Studies',
  'Mathematics',
  'Basic Science',
  'Basic Technology',
  'Information & Communication Tech (ICT)',
  'Business Studies',
  'Social Studies',
  'Civic Education',
  'Agricultural Science',
  'Home Economics',
  'Physical & Health Education (PHE)',
  'Cultural & Creative Arts (CCA)',
  'Christian Religious Studies (CRS)',
  'French Language',
];

// 6. Senior Secondary School (SS 1 - 3)
export const DEFAULT_SS_SUBJECTS = [
  'English Language',
  'General Mathematics',
  'Civic Education',
  'Biology',
  'Chemistry',
  'Physics',
  'Agricultural Science',
  'Economics',
  'Financial Accounting / Commerce',
  'Literature in English',
  'Government',
  'Further Mathematics',
  'Computer Studies / Data Processing',
  'Christian Religious Studies (CRS)',
];

/**
 * Get the official School ID prefix dynamically from active school config
 */
export function getSchoolIdPrefix(className?: string): string {
  try {
    if (className) {
      const c = className.trim().toUpperCase();
      if (
        c.startsWith('JSS') ||
        c.startsWith('J.S.S') ||
        c.includes('JUNIOR') ||
        c.startsWith('JS ') ||
        c.startsWith('BASIC 7') ||
        c.startsWith('BASIC 8') ||
        c.startsWith('BASIC 9') ||
        c.startsWith('BASIC7') ||
        c.startsWith('BASIC8') ||
        c.startsWith('BASIC9') ||
        c.startsWith('SS') ||
        c.startsWith('S.S') ||
        c.startsWith('SSS') ||
        c.includes('SENIOR')
      ) {
        return 'DSS';
      }
    }
    const active = getActiveSchoolConfig();
    const prefix = (active.acronym || active.shortName || 'DNPS').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (prefix && prefix !== 'DGS' && prefix !== 'SCH') return prefix;
  } catch {}
  return 'DNPS';
}

/**
 * Normalize and match class names flexibly (e.g., 'KG 1', 'Nursery 2', 'P1', 'Primary 1', 'JSS 2', 'SS 3')
 */
export function normalizeClassIdentifier(str: string): string {
  if (!str) return '';
  const s = String(str).toLowerCase().replace(/[\s._-]/g, '');
  if (s === 'kg1' || s === 'kindergarten1') return 'kg1';
  if (s === 'kg2' || s === 'kindergarten2') return 'kg2';
  if (s === 'nursery1' || s === 'nur1') return 'nursery1';
  if (s === 'nursery2' || s === 'nur2') return 'nursery2';
  if (s === 'nursery3' || s === 'nur3') return 'nursery3';
  if (/^p(ri|rimary|)?1$/.test(s) || s === 'basic1') return 'primary1';
  if (/^p(ri|rimary|)?2$/.test(s) || s === 'basic2') return 'primary2';
  if (/^p(ri|rimary|)?3$/.test(s) || s === 'basic3') return 'primary3';
  if (/^p(ri|rimary|)?4$/.test(s) || s === 'basic4') return 'primary4';
  if (/^p(ri|rimary|)?5$/.test(s) || s === 'basic5') return 'primary5';
  if (/^p(ri|rimary|)?6$/.test(s) || s === 'basic6') return 'primary6';
  if (/^jss1$|^junior1$|^js1$|^basic7$/.test(s)) return 'jss1';
  if (/^jss2$|^junior2$|^js2$|^basic8$/.test(s)) return 'jss2';
  if (/^jss3$|^junior3$|^js3$|^basic9$/.test(s)) return 'jss3';
  if (/^ss1$|^sss1$|^senior1$/.test(s)) return 'ss1';
  if (/^ss2$|^sss2$|^senior2$/.test(s)) return 'ss2';
  if (/^ss3$|^sss3$|^senior3$/.test(s)) return 'ss3';
  if (s.includes('nur')) return 'nursery';
  if (s.includes('kg')) return 'kg';
  return s;
}

export function isMatchingClass(classA: string, classB: string): boolean {
  if (!classA || !classB) return false;
  classA = String(classA);
  classB = String(classB);
  if (classA.trim().toLowerCase() === classB.trim().toLowerCase()) return true;
  return normalizeClassIdentifier(classA) === normalizeClassIdentifier(classB);
}

/**
 * Flexible match for Student IDs (handles variations like DNPS/0001, DSS/0001, DOM/PRI/001, etc.)
 */
export function isMatchingStudentId(idA?: string | null, idB?: string | null): boolean {
  if (!idA || !idB) return false;
  const cleanA = String(idA).trim().toLowerCase().replace(/[\s._\/-]/g, '');
  const cleanB = String(idB).trim().toLowerCase().replace(/[\s._\/-]/g, '');
  return cleanA === cleanB;
}

/**
 * Determine if a class is Kindergarten, Nursery, LowerPrimary, UpperPrimary, JuniorSecondary, or SeniorSecondary
 */
export function determineClassLevel(className: string): EducationLevel {
  const norm = (className || '').toLowerCase().trim();
  const clean = norm.replace(/[\s._-]/g, '');

  // Senior Secondary
  if (
    clean === 'ss1' ||
    clean === 'ss2' ||
    clean === 'ss3' ||
    clean === 'sss1' ||
    clean === 'sss2' ||
    clean === 'sss3' ||
    norm.includes('ss 1') ||
    norm.includes('ss 2') ||
    norm.includes('ss 3') ||
    norm.includes('senior')
  ) {
    return 'SeniorSecondary';
  }

  // Junior Secondary
  if (
    clean === 'jss1' ||
    clean === 'jss2' ||
    clean === 'jss3' ||
    clean === 'js1' ||
    clean === 'js2' ||
    clean === 'js3' ||
    norm.includes('jss') ||
    norm.includes('junior') ||
    norm.includes('basic 7') ||
    norm.includes('basic 8') ||
    norm.includes('basic 9')
  ) {
    return 'JuniorSecondary';
  }

  // Kindergarten
  if (
    clean === 'kg1' ||
    clean === 'kg2' ||
    clean === 'kg' ||
    norm.includes('kg 1') ||
    norm.includes('kg 2') ||
    norm.includes('kindergarten') ||
    norm.includes('creche') ||
    norm.includes('reception') ||
    norm.includes('playgroup')
  ) {
    return 'Kindergarten';
  }

  // Nursery
  if (
    clean === 'nursery1' ||
    clean === 'nursery2' ||
    clean === 'nursery3' ||
    clean === 'nur1' ||
    clean === 'nur2' ||
    clean === 'nur3' ||
    clean === 'nursery' ||
    norm.includes('nursery 1') ||
    norm.includes('nursery 2') ||
    norm.includes('nursery 3') ||
    norm.includes('nursery') ||
    norm.includes('transition')
  ) {
    return 'Nursery';
  }

  // Lower Primary (Primary 1, 2, 3 / Basic 1, 2, 3)
  if (
    clean === 'primary1' ||
    clean === 'primary2' ||
    clean === 'primary3' ||
    clean === 'p1' ||
    clean === 'p2' ||
    clean === 'p3' ||
    clean === 'basic1' ||
    clean === 'basic2' ||
    clean === 'basic3' ||
    norm.includes('primary 1') ||
    norm.includes('primary 2') ||
    norm.includes('primary 3') ||
    norm.includes('lower')
  ) {
    return 'LowerPrimary';
  }

  // Upper Primary (Primary 4, 5, 6 / Basic 4, 5, 6)
  if (
    clean === 'primary4' ||
    clean === 'primary5' ||
    clean === 'primary6' ||
    clean === 'p4' ||
    clean === 'p5' ||
    clean === 'p6' ||
    clean === 'basic4' ||
    clean === 'basic5' ||
    clean === 'basic6' ||
    norm.includes('primary 4') ||
    norm.includes('primary 5') ||
    norm.includes('primary 6') ||
    norm.includes('upper')
  ) {
    return 'UpperPrimary';
  }

  return 'LowerPrimary';
}

/**
 * Returns the exact list of subjects assigned specifically to a given class.
 */
export function getAuthoritativeSubjectsForClass(
  className: string,
  subjectsList: SubjectRule[] = []
): string[] {
  const level = determineClassLevel(className);

  // 1. Direct match on specific class if configured (e.g., Class equals "Primary 1" or "SS 2")
  const specificClassMatches = subjectsList.filter((s) => {
    if (s.Class && isMatchingClass(s.Class, className)) return true;
    if (s.Level && isMatchingClass(s.Level, className)) return true;
    return false;
  });

  if (specificClassMatches.length > 0) {
    return Array.from(new Set(specificClassMatches.map((s) => String(s.SubjectName ?? '').trim()).filter(Boolean)));
  }

  // 2. Match by specific level: Kindergarten, Nursery, LowerPrimary, UpperPrimary, JuniorSecondary, SeniorSecondary
  const levelMatches = subjectsList.filter((s) => {
    const sLevel = (s.Level || '').toLowerCase().replace(/[\s._-]/g, '');
    if (level === 'Kindergarten' && (sLevel === 'kindergarten' || sLevel === 'kg' || sLevel === 'earlyyears')) return true;
    if (level === 'Nursery' && (sLevel === 'nursery' || sLevel === 'nur')) return true;
    if (level === 'LowerPrimary' && (sLevel === 'lowerprimary' || sLevel === 'lower' || sLevel === 'primary13')) return true;
    if (level === 'UpperPrimary' && (sLevel === 'upperprimary' || sLevel === 'upper' || sLevel === 'primary46')) return true;
    if (level === 'JuniorSecondary' && (sLevel === 'juniorsecondary' || sLevel === 'jss' || sLevel === 'secondary')) return true;
    if (level === 'SeniorSecondary' && (sLevel === 'seniorsecondary' || sLevel === 'ss' || sLevel === 'sss' || sLevel === 'senior')) return true;
    return false;
  });

  if (levelMatches.length > 0) {
    return Array.from(new Set(levelMatches.map((s) => String(s.SubjectName ?? '').trim()).filter(Boolean)));
  }

  // 3. Curricula Fallbacks based on level
  switch (level) {
    case 'Kindergarten':
      return DEFAULT_KG_SUBJECTS;
    case 'Nursery':
      return DEFAULT_NURSERY_SUBJECTS;
    case 'LowerPrimary':
      return DEFAULT_LOWER_PRIMARY_SUBJECTS;
    case 'UpperPrimary':
      return DEFAULT_UPPER_PRIMARY_SUBJECTS;
    case 'JuniorSecondary':
      return DEFAULT_JSS_SUBJECTS;
    case 'SeniorSecondary':
      return DEFAULT_SS_SUBJECTS;
    default:
      return DEFAULT_LOWER_PRIMARY_SUBJECTS;
  }
}

/**
 * Helper to assign color styling for grades
 */
export function getColorAndBadgeForGrade(grade: string, remark = ''): {
  color: string;
  badgeBg: string;
  badgeColor: string;
} {
  const g = (grade || '').toUpperCase().trim();
  const r = (remark || '').toLowerCase();

  if (g.startsWith('A') || r.includes('distinction') || r.includes('excellent')) {
    return {
      color: 'text-emerald-700 font-bold',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
      badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold'
    };
  }
  if (g.startsWith('B') || r.includes('very good') || r.includes('good progress')) {
    return {
      color: 'text-blue-700 font-bold',
      badgeBg: 'bg-blue-50 text-blue-800 border border-blue-300',
      badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300 font-bold'
    };
  }
  if (g.startsWith('C') || r.includes('credit') || r.includes('good') || r.includes('developing')) {
    return {
      color: 'text-sky-700 font-medium',
      badgeBg: 'bg-sky-50 text-sky-800 border border-sky-300',
      badgeColor: 'bg-sky-100 text-sky-900 border border-sky-300 font-medium'
    };
  }
  if (g.startsWith('D') || g.startsWith('E') || r.includes('pass') || r.includes('needs support')) {
    return {
      color: 'text-amber-700 font-medium',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-300',
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 font-medium'
    };
  }
  return {
    color: 'text-rose-700 font-bold',
    badgeBg: 'bg-rose-50 text-rose-800 border border-rose-300',
    badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300 font-bold'
  };
}

/**
 * Official School Dynamic Grading System:
 * Evaluates against configurable grading scales or default section scales
 */
export function getGradeAndRemark(
  score: number | null | undefined,
  customScales?: GradingScaleItem[],
  classLevelOrName?: string
): {
  grade: string;
  remark: string;
  color: string;
  badgeBg: string;
  badgeColor: string;
  gpaPoint?: number;
} {
  if (score === null || score === undefined || isNaN(score)) {
    return {
      grade: '—',
      remark: 'No score entered',
      color: 'text-slate-400',
      badgeBg: 'bg-slate-100 text-slate-500 border border-slate-200',
      badgeColor: 'bg-slate-100 text-slate-500 border border-slate-200',
      gpaPoint: 0
    };
  }

  const rounded = Math.round(score * 10) / 10;
  const scalesToUse = customScales && customScales.length > 0 ? customScales : activeCustomGradingScales;

  // 1. Filter applicable scale items if classLevelOrName provided
  let filteredScales = scalesToUse;
  if (classLevelOrName) {
    const level = determineClassLevel(classLevelOrName);
    const specific = scalesToUse.filter(
      (s) => !s.section || s.section === 'All' || s.section === level || s.section.toLowerCase() === level.toLowerCase()
    );
    if (specific.length > 0) {
      filteredScales = specific;
    }
  }

  // Sort descending by minScore
  const sorted = [...filteredScales].sort((a, b) => b.minScore - a.minScore);

  for (const item of sorted) {
    if (rounded >= item.minScore && (item.maxScore === undefined || rounded <= item.maxScore + 0.05)) {
      const styles = getColorAndBadgeForGrade(item.grade, item.remark);
      return {
        grade: item.grade,
        remark: item.remark,
        color: styles.color,
        badgeBg: styles.badgeBg,
        badgeColor: styles.badgeColor,
        gpaPoint: item.gpaPoint ?? 0
      };
    }
  }

  // Fallback defaults
  if (rounded >= 70) {
    return {
      grade: 'A',
      remark: 'Excellent',
      color: 'text-emerald-700 font-bold',
      badgeBg: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
      badgeColor: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold',
      gpaPoint: 5.0
    };
  }
  if (rounded >= 60) {
    return {
      grade: 'B',
      remark: 'Very Good',
      color: 'text-blue-700 font-bold',
      badgeBg: 'bg-blue-100 text-blue-900 border border-blue-300',
      badgeColor: 'bg-blue-100 text-blue-900 border border-blue-300 font-bold',
      gpaPoint: 4.0
    };
  }
  if (rounded >= 50) {
    return {
      grade: 'C',
      remark: 'Good / Credit',
      color: 'text-sky-700 font-medium',
      badgeBg: 'bg-sky-100 text-sky-900 border border-sky-300',
      badgeColor: 'bg-sky-100 text-sky-900 border border-sky-300 font-medium',
      gpaPoint: 3.0
    };
  }
  if (rounded >= 45) {
    return {
      grade: 'D',
      remark: 'Pass',
      color: 'text-amber-700 font-medium',
      badgeBg: 'bg-amber-100 text-amber-900 border border-amber-300',
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 font-medium',
      gpaPoint: 2.0
    };
  }
  return {
    grade: 'F',
    remark: 'Fail',
    color: 'text-rose-700 font-bold',
    badgeBg: 'bg-rose-100 text-rose-900 border border-rose-300',
    badgeColor: 'bg-rose-100 text-rose-900 border border-rose-300 font-bold',
    gpaPoint: 0.0
  };
}

export const getGradeDetails = getGradeAndRemark;

/**
 * Format standard ordinal ranking (1st, 2nd, 3rd, 4th, ...)
 */
export function formatOrdinalPosition(n: number): string {
  if (n <= 0) return '—';
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Check if a subject has all three components entered
 */
export function isSubjectFullyCompleted(
  ca1: number | null | undefined,
  ca2: number | null | undefined,
  exam: number | null | undefined
): boolean {
  return (
    ca1 !== null &&
    ca1 !== undefined &&
    !isNaN(ca1) &&
    ca2 !== null &&
    ca2 !== undefined &&
    !isNaN(ca2) &&
    exam !== null &&
    exam !== undefined &&
    !isNaN(exam)
  );
}

/**
 * Calculate dynamic subject total from CA1 + CA2 + Exam
 */
export function calculateSubjectTotal(
  ca1: number | null | undefined,
  ca2: number | null | undefined,
  exam: number | null | undefined
): number | null {
  const hasCa1 = ca1 !== null && ca1 !== undefined && !isNaN(ca1);
  const hasCa2 = ca2 !== null && ca2 !== undefined && !isNaN(ca2);
  const hasExam = exam !== null && exam !== undefined && !isNaN(exam);

  if (!hasCa1 && !hasCa2 && !hasExam) return null;

  const sum = (hasCa1 ? ca1 : 0) + (hasCa2 ? ca2 : 0) + (hasExam ? exam : 0);
  return Math.round(sum * 10) / 10;
}

/**
 * Calculate student overall average for a term.
 * If a CA or Exam field is left blank, that subject's Total is EXCLUDED from average, not counted as zero.
 */
export function calculateStudentOverallAverage(
  subjectScores: Array<{ subject: string; total: number | null; isComplete?: boolean }>
): {
  completedCount: number;
  totalMarks: number;
  average: number | null;
} {
  let completedCount = 0;
  let totalMarks = 0;

  for (const s of subjectScores) {
    if (
      s.isComplete !== false &&
      s.total !== null &&
      s.total !== undefined &&
      !isNaN(s.total)
    ) {
      totalMarks += s.total;
      completedCount += 1;
    }
  }

  if (completedCount === 0) {
    return { completedCount: 0, totalMarks: 0, average: null };
  }

  const average = Math.round((totalMarks / completedCount) * 100) / 100;
  return { completedCount, totalMarks, average };
}

/**
 * Calculate positions and rankings across a class with ties handled gracefully
 */
export function computeClassRankings(
  classStudents: Student[] = [],
  allScores: SubjectScore[] = [],
  session: string,
  term: TermType,
  authoritativeSubjects: string[] = []
): ClassRankingItem[] {
  const validStudents = (classStudents || []).filter((s) => s && s.StudentID);
  const totalSubjectsAvailable = authoritativeSubjects?.length || 0;

  const rawList = validStudents.map((student) => {
    const studentScores = (allScores || []).filter(
      (s) =>
        s &&
        isMatchingStudentId(s.StudentID, student.StudentID) &&
        s.Term === term &&
        (s.Session === session || !s.Session)
    );

    let completedSubjectsCount = 0;
    let totalScore = 0;

    for (const score of studentScores) {
      const scoreTotal =
        score && score.Total !== null && score.Total !== undefined && !isNaN(Number(score.Total))
          ? Number(score.Total)
          : score
          ? calculateSubjectTotal(score.CA1, score.CA2, score.Exam)
          : null;
      if (scoreTotal !== null && !isNaN(scoreTotal)) {
        totalScore += scoreTotal;
        completedSubjectsCount += 1;
      }
    }

    const hasCompleted = completedSubjectsCount > 0;
    const averageScore = hasCompleted
      ? Number((totalScore / completedSubjectsCount).toFixed(1))
      : 0;

    // A student is only eligible for a class position once every subject expected
    // for this class has been scored. Ranking someone on 6 of 14 subjects against
    // a classmate on 13 of 14 compares averages over different subject counts,
    // which produces misleading positions while data entry is still in progress.
    // Fall back to "has at least one score" only when no authoritative subject
    // list was supplied to this call, so ranking doesn't break entirely.
    const isComplete =
      totalSubjectsAvailable > 0
        ? completedSubjectsCount === totalSubjectsAvailable
        : hasCompleted;

    const grade = getGradeAndRemark(hasCompleted ? averageScore : null);

    return {
      student,
      completedSubjectsCount,
      totalSubjectsAvailable,
      totalScore,
      averageScore,
      positionNumber: 0,
      positionLabel: '—',
      isComplete,
      gradeLabel: grade.grade,
    };
  });

  // Sort descending by average score, then alphabetically
  const sorted = [...rawList].sort((a, b) => {
    const nameA = a.student?.FullName || '';
    const nameB = b.student?.FullName || '';
    if (!a.isComplete && !b.isComplete) {
      return nameA.localeCompare(nameB);
    }
    if (!a.isComplete) return 1;
    if (!b.isComplete) return -1;
    if (b.averageScore !== a.averageScore) {
      return b.averageScore - a.averageScore;
    }
    return nameA.localeCompare(nameB);
  });

  // Rank with ties handled (1st, 2nd, 2nd [Joint], 4th...)
  let currentPosition = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].isComplete) {
      sorted[i].positionNumber = 0;
      sorted[i].positionLabel = '—';
      continue;
    }

    if (
      i > 0 &&
      sorted[i - 1].isComplete &&
      sorted[i].averageScore === sorted[i - 1].averageScore
    ) {
      sorted[i].positionNumber = sorted[i - 1].positionNumber;
      sorted[i].positionLabel = sorted[i - 1].positionLabel;
    } else {
      sorted[i].positionNumber = currentPosition;
      sorted[i].positionLabel = formatOrdinalPosition(currentPosition);
    }
    currentPosition++;
  }

  return sorted;
}

export const calculateClassPositions = computeClassRankings;

/**
 * Compute Subject-level class statistics (Average, Highest, Lowest)
 */
export function computeSubjectStatistics(
  subjects: string[],
  scores: SubjectScore[],
  term: TermType,
  session: string,
  classStudentIds: Set<string>
): SubjectStats[] {
  return subjects.map((subject) => {
    const relevantScores: number[] = [];
    for (const s of scores) {
      if (
        classStudentIds.has(s.StudentID) &&
        s.Subject === subject &&
        s.Term === term &&
        (s.Session === session || !s.Session)
      ) {
        const val =
          s.Total !== null && s.Total !== undefined && !isNaN(Number(s.Total))
            ? Number(s.Total)
            : calculateSubjectTotal(s.CA1, s.CA2, s.Exam);
        if (val !== null && !isNaN(val)) {
          relevantScores.push(val);
        }
      }
    }

    if (relevantScores.length === 0) {
      return {
        subject,
        average: 0,
        highest: 0,
        lowest: 0,
        enrolledCount: classStudentIds.size,
        gradedCount: 0,
      };
    }

    const sum = relevantScores.reduce((a, b) => a + b, 0);
    const avg = Number((sum / relevantScores.length).toFixed(1));
    const max = Math.max(...relevantScores);
    const min = Math.min(...relevantScores);

    return {
      subject,
      average: avg,
      highest: max,
      lowest: min,
      enrolledCount: classStudentIds.size,
      gradedCount: relevantScores.length,
    };
  });
}

export function calculateSubjectClassStats(
  subjects: string[],
  scores: SubjectScore[],
  session: string,
  term: TermType,
  classStudentIds: Set<string>
): Array<{
  subjectName: string;
  totalRecorded: number;
  totalClassStudents: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}> {
  return subjects.map((subject) => {
    const relevantScores: number[] = [];
    for (const s of scores) {
      if (
        classStudentIds.has(s.StudentID) &&
        s.Subject === subject &&
        s.Term === term &&
        (s.Session === session || !s.Session)
      ) {
        const val =
          s.Total !== null && s.Total !== undefined && !isNaN(Number(s.Total))
            ? Number(s.Total)
            : calculateSubjectTotal(s.CA1, s.CA2, s.Exam);
        if (val !== null && !isNaN(val)) {
          relevantScores.push(val);
        }
      }
    }

    if (relevantScores.length === 0) {
      return {
        subjectName: subject,
        totalRecorded: 0,
        totalClassStudents: classStudentIds.size,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
      };
    }

    const sum = relevantScores.reduce((a, b) => a + b, 0);
    const avg = Number((sum / relevantScores.length).toFixed(1));
    const max = Math.max(...relevantScores);
    const min = Math.min(...relevantScores);

    return {
      subjectName: subject,
      totalRecorded: relevantScores.length,
      totalClassStudents: classStudentIds.size,
      averageScore: avg,
      highestScore: max,
      lowestScore: min,
    };
  });
}

/**
 * Compute the student's class position for each individual subject (e.g. 1st in Mathematics, 2nd in English)
 * Returns a map of normalized subject name -> position label (e.g. "1st", "2nd", "3rd", "—")
 */
export function computeSubjectPositionsForStudent(
  student?: Student | null,
  classStudents: Student[] = [],
  allScores: SubjectScore[] = [],
  session: string = '',
  term: TermType = 'First Term'
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!student || !student.StudentID || !classStudents || classStudents.length === 0) return result;

  // Filter classmates in same class
  const peers = classStudents.filter((s) => s && isMatchingClass(s.Class, student.Class));
  const peerIds = peers.map((p) => p.StudentID);

  // Group all scores in this class for the term & session by subject
  const subjectScoresMap: Record<string, Array<{ studentId: string; total: number }>> = {};

  for (const s of (allScores || [])) {
    if (
      s &&
      s.Subject &&
      s.Term === term &&
      (s.Session === session || !s.Session) &&
      s.Total !== null &&
      s.Total !== undefined &&
      !isNaN(Number(s.Total))
    ) {
      const isPeer = peerIds.some((pId) => isMatchingStudentId(pId, s.StudentID));
      if (isPeer) {
        const subjKey = String(s.Subject).trim().toLowerCase();
        if (!subjectScoresMap[subjKey]) {
          subjectScoresMap[subjKey] = [];
        }
        subjectScoresMap[subjKey].push({
          studentId: s.StudentID,
          total: Number(s.Total),
        });
      }
    }
  }

  // Calculate ranks per subject
  for (const [subjKey, scoreList] of Object.entries(subjectScoresMap)) {
    // Sort descending by total score
    scoreList.sort((a, b) => b.total - a.total);

    let currentRank = 1;
    for (let i = 0; i < scoreList.length; i++) {
      let rankLabel = '—';
      if (i > 0 && scoreList[i].total === scoreList[i - 1].total) {
        // Tied with previous
        const prevStudentId = scoreList[i - 1].studentId;
        const prevKey = `${subjKey}__${prevStudentId}`;
        rankLabel = result[prevKey] || formatOrdinalPosition(currentRank - 1);
      } else {
        rankLabel = formatOrdinalPosition(currentRank);
      }

      const entryKey = `${subjKey}__${scoreList[i].studentId}`;
      result[entryKey] = rankLabel;

      // If this entry belongs to target student
      if (isMatchingStudentId(scoreList[i].studentId, student.StudentID)) {
        result[subjKey] = rankLabel;
      }

      currentRank++;
    }
  }

  return result;
}

/**
 * Determine next class for promotional progression
 * Supports standard Nigerian designations:
 * - Basic 1 → Basic 2, Basic 2 → Basic 3 ... Basic 6 → JSS 1
 * - Primary 1 → Primary 2 ... Primary 6 → JSS 1
 * - JSS 1 → JSS 2, JSS 2 → JSS 3, JSS 3 (Basic 9) → SSS 1
 * - SSS 1 (SS 1) → SSS 2 (SS 2), SSS 2 → SSS 3
 * - SSS 3 (SS 3) → Graduated (Alumni)
 * - KG 1 → KG 2, KG 2 → Nursery 1
 * - Nursery 1 → Nursery 2, Nursery 2 → Nursery 3, Nursery 3 → Primary 1
 */
export function getNextClassName(currentClass: string): string {
  const norm = (currentClass || '').trim().toLowerCase();
  const clean = norm.replace(/[\s._-]/g, '');

  // Early Years
  if (clean === 'creche' || clean === 'playgroup' || clean === 'reception') return 'KG 1';
  if (clean === 'kg1' || clean === 'kindergarten1' || norm.includes('kg 1')) return 'KG 2';
  if (clean === 'kg2' || clean === 'kindergarten2' || norm.includes('kg 2')) return 'Nursery 1';
  if (clean === 'nursery1' || clean === 'nur1' || (norm.includes('nur') && norm.includes('1'))) return 'Nursery 2';
  if (clean === 'nursery2' || clean === 'nur2' || (norm.includes('nur') && norm.includes('2'))) return 'Nursery 3';
  if (clean === 'nursery3' || clean === 'nur3' || (norm.includes('nur') && norm.includes('3'))) return 'Primary 1';
  if (clean === 'kg' || clean === 'kindergarten') return 'Primary 1';

  // Basic / Primary Series (Basic 1 → Basic 2 ... Basic 6 → JSS 1)
  if (clean === 'basic1' || norm.includes('basic 1')) return 'Basic 2';
  if (clean === 'basic2' || norm.includes('basic 2')) return 'Basic 3';
  if (clean === 'basic3' || norm.includes('basic 3')) return 'Basic 4';
  if (clean === 'basic4' || norm.includes('basic 4')) return 'Basic 5';
  if (clean === 'basic5' || norm.includes('basic 5')) return 'Basic 6';
  if (clean === 'basic6' || norm.includes('basic 6')) return 'JSS 1';

  if (clean === 'primary1' || clean === 'p1' || norm.includes('primary 1') || norm.includes('pri 1')) return 'Primary 2';
  if (clean === 'primary2' || clean === 'p2' || norm.includes('primary 2') || norm.includes('pri 2')) return 'Primary 3';
  if (clean === 'primary3' || clean === 'p3' || norm.includes('primary 3') || norm.includes('pri 3')) return 'Primary 4';
  if (clean === 'primary4' || clean === 'p4' || norm.includes('primary 4') || norm.includes('pri 4')) return 'Primary 5';
  if (clean === 'primary5' || clean === 'p5' || norm.includes('primary 5') || norm.includes('pri 5')) return 'Primary 6';
  if (clean === 'primary6' || clean === 'p6' || norm.includes('primary 6') || norm.includes('pri 6')) return 'JSS 1';

  // Junior Secondary (JSS 1 → JSS 2 → JSS 3 → SSS 1)
  if (clean === 'jss1' || clean === 'js1' || clean === 'basic7' || norm.includes('jss 1') || norm.includes('basic 7')) return 'JSS 2';
  if (clean === 'jss2' || clean === 'js2' || clean === 'basic8' || norm.includes('jss 2') || norm.includes('basic 8')) return 'JSS 3';
  if (clean === 'jss3' || clean === 'js3' || clean === 'basic9' || norm.includes('jss 3') || norm.includes('basic 9')) return 'SSS 1';

  // Senior Secondary (SSS 1 → SSS 2 → SSS 3 → Graduated)
  if (clean === 'sss1' || clean === 'ss1' || norm.includes('sss 1') || norm.includes('ss 1') || norm.includes('senior 1')) return 'SSS 2';
  if (clean === 'sss2' || clean === 'ss2' || norm.includes('sss 2') || norm.includes('ss 2') || norm.includes('senior 2')) return 'SSS 3';
  if (clean === 'sss3' || clean === 'ss3' || norm.includes('sss 3') || norm.includes('ss 3') || norm.includes('senior 3')) return 'Graduated (Alumni)';

  return 'Next Class';
}

/**
 * Check if a class is the final graduating tier in senior secondary (e.g. SSS 3 / SS 3)
 */
export function isGraduatingClass(className: string): boolean {
  const norm = (className || '').toLowerCase().trim();
  const clean = norm.replace(/[\s._-]/g, '');
  return (
    clean === 'sss3' ||
    clean === 'ss3' ||
    clean === 'senior3' ||
    norm.includes('sss 3') ||
    norm.includes('ss 3') ||
    norm.includes('graduating') ||
    norm.includes('alumni')
  );
}

/**
 * Compute recommended next session (e.g. "2026/2027" -> "2027/2028")
 */
export function getNextSession(currentSession: string): string {
  const match = (currentSession || '').match(/^(\d{4})\/(\d{4})$/);
  if (match) {
    const y1 = parseInt(match[1], 10) + 1;
    const y2 = parseInt(match[2], 10) + 1;
    return `${y1}/${y2}`;
  }
  return '2027/2028';
}

export interface AnnualSubjectCumulative {
  subject: string;
  firstTermTotal: number | null;
  secondTermTotal: number | null;
  thirdTermTotal: number | null;
  cumulativeTotal: number | null;
  cumulativeAverage: number | null;
  grade: string;
  remark: string;
}

export interface AnnualStudentCumulativeSummary {
  firstTermAverage: number | null;
  secondTermAverage: number | null;
  thirdTermAverage: number | null;
  annualCumulativeAverage: number | null;
  annualGrade: string;
  annualRemark: string;
  promotionStatus: string;
  promotedToClass: string;
  subjectBreakdown: AnnualSubjectCumulative[];
  hasFirstTermData: boolean;
  hasSecondTermData: boolean;
  hasThirdTermData: boolean;
}

/**
 * Compute the complete 3-term Annual Cumulative Summary for a student
 */
export function computeAnnualCumulativeForStudent(
  studentId: string,
  session: string = '',
  allScores: SubjectScore[] = [],
  authoritativeSubjects: string[] = [],
  currentClass: string = ''
): AnnualStudentCumulativeSummary {
  const cleanId = String(studentId || '').trim().toLowerCase();
  const safeSubjects = (authoritativeSubjects || []).filter(Boolean);

  // Helper to calculate a term's average for this student
  const getTermSubjectScores = (term: TermType) => {
    return (allScores || []).filter(
      (s) =>
        s &&
        isMatchingStudentId(s.StudentID, cleanId) &&
        s.Term === term &&
        (s.Session === session || !s.Session)
    );
  };

  const firstTermScores = getTermSubjectScores('First Term');
  const secondTermScores = getTermSubjectScores('Second Term');
  const thirdTermScores = getTermSubjectScores('Third Term');

  const calcTermAvg = (scores: SubjectScore[]) => {
    const valid = scores.filter((s) => s && s.Total !== null && s.Total !== undefined && !isNaN(Number(s.Total)));
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, cur) => acc + Number(cur.Total), 0);
    return Math.round((sum / valid.length) * 10) / 10;
  };

  const firstTermAvg = calcTermAvg(firstTermScores);
  const secondTermAvg = calcTermAvg(secondTermScores);
  const thirdTermAvg = calcTermAvg(thirdTermScores);

  const subjectBreakdown: AnnualSubjectCumulative[] = safeSubjects.map((subj) => {
    const findScore = (scores: SubjectScore[]) => {
      const match = scores.find(
        (s) => s && s.Subject && String(s.Subject).trim().toLowerCase() === String(subj).trim().toLowerCase()
      );
      return match && match.Total !== null && match.Total !== undefined && !isNaN(Number(match.Total))
        ? Number(match.Total)
        : null;
    };

    const t1 = findScore(firstTermScores);
    const t2 = findScore(secondTermScores);
    const t3 = findScore(thirdTermScores);

    const availableTerms = [t1, t2, t3].filter((val): val is number => val !== null);
    const cumTotal = availableTerms.length > 0 ? availableTerms.reduce((a, b) => a + b, 0) : null;
    const cumAvg = availableTerms.length > 0 ? Math.round((cumTotal! / availableTerms.length) * 10) / 10 : null;
    const gradeInfo = getGradeAndRemark(cumAvg);

    return {
      subject: subj,
      firstTermTotal: t1,
      secondTermTotal: t2,
      thirdTermTotal: t3,
      cumulativeTotal: cumTotal,
      cumulativeAverage: cumAvg,
      grade: gradeInfo.grade,
      remark: gradeInfo.remark,
    };
  });

  // Calculate annual cumulative average from graded subjects
  const gradedSubjects = subjectBreakdown.filter((s) => s.cumulativeAverage !== null);
  let annualCumulativeAverage: number | null = null;
  if (gradedSubjects.length > 0) {
    const totalAvgSum = gradedSubjects.reduce((acc, cur) => acc + (cur.cumulativeAverage || 0), 0);
    annualCumulativeAverage = Math.round((totalAvgSum / gradedSubjects.length) * 10) / 10;
  }

  const annualGradeInfo = getGradeAndRemark(annualCumulativeAverage);
  const nextClass = getNextClassName(currentClass);
  const isPassed = annualCumulativeAverage !== null && annualCumulativeAverage >= 50;
  const promotionStatus =
    annualCumulativeAverage === null
      ? 'Awaiting Full Assessment'
      : isPassed
      ? `Promoted to ${nextClass}`
      : `Advised to Repeat ${currentClass || 'Current Class'}`;

  return {
    firstTermAverage: firstTermAvg,
    secondTermAverage: secondTermAvg,
    thirdTermAverage: thirdTermAvg,
    annualCumulativeAverage,
    annualGrade: annualGradeInfo.grade,
    annualRemark: annualGradeInfo.remark,
    promotionStatus,
    promotedToClass: nextClass,
    subjectBreakdown,
    hasFirstTermData: firstTermScores.length > 0,
    hasSecondTermData: secondTermScores.length > 0,
    hasThirdTermData: thirdTermScores.length > 0,
  };
}

/**
 * Generate automatic official remarks based on student's average score:
 * - A (70-100%): Happy, celebratory, praised for excellence & brilliance
 * - B (60-69%): Happy, commendable achievement, encouraged to keep flying high
 * - C (50-59%): Clear feedback that they have potential but must work harder
 * - D (45-49%): Borderline pass, firm encouragement that serious hard work is required
 * - F (0-44%): Failed, firm directive that they must sit up immediately and get serious
 */
export function getAutoReportRemark(
  average: number | null | undefined,
  isThirdTerm: boolean = false,
  isPromoted: boolean = true
): string {
  if (average === null || average === undefined || isNaN(average)) {
    return 'Academic assessment in progress. Attend all classes regularly and participate actively.';
  }

  const score = Math.round(average * 10) / 10;

  if (isThirdTerm) {
    if (score >= 70) {
      return `Outstanding academic performance! Hearty congratulations on this sterling annual result. Promoted with distinction to the next class. Keep shining and aiming higher!`;
    }
    if (score >= 60) {
      return `A very good and commendable academic year! You have worked consistently well and earned your promotion. Maintain this enthusiasm and aim for top honors in the new class!`;
    }
    if (score >= 50) {
      return `Promoted to the next class. While this is a credit pass, you have the potential for higher grades. You must work much harder and take your studies more seriously in the new class.`;
    }
    if (score >= 45) {
      return `Borderline pass. Advised to put in intensive study hours during the holidays to prepare adequately for the higher academic demands ahead.`;
    }
    return `An unsatisfactory annual performance. Advised to repeat the class to build a solid academic foundation. You must sit up immediately, eliminate distractions, and work diligently.`;
  }

  // First & Second Terms
  if (score >= 70) {
    return 'An outstanding, brilliant performance! Hearty congratulations on this sterling achievement. You have demonstrated exceptional diligence and intellectual brilliance. Keep flying high!';
  }
  if (score >= 60) {
    return 'A commendable and very good academic performance! You have shown remarkable dedication, consistency, and good character. Keep up this momentum and strive for the top grade next term!';
  }
  if (score >= 50) {
    return 'A fair effort with a credit pass, but you are capable of doing much better. You have good potential, but you must work harder, pay closer attention in class, and dedicate more time to personal study.';
  }
  if (score >= 45) {
    return 'A borderline pass. You need to work much harder and take your academic work more seriously. Put in extra study hours across all weak subjects and avoid all distractions.';
  }
  return 'An unsatisfactory performance. You must sit up immediately and get serious with your education. Immediate improvement, consistent attendance, and rigorous home revision are strongly required.';
}

/**
 * Compute the average of an array of subject scores
 */
export function computeOverallStudentAverage(scores: SubjectScore[]): number {
  if (!scores || scores.length === 0) return 0;
  const valid = scores.filter((s) => s && typeof s.Total === 'number' && !isNaN(s.Total));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, curr) => acc + curr.Total, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

/**
 * Calculate standard promotion status based on student annual performance
 */
export function calculateAnnualPromotionStatus(
  annualAverage: number,
  currentClass: string
): {
  decision: 'Promote' | 'Repeat' | 'Promote on Trial' | 'Graduate';
  nextClass: string;
  reason: string;
} {
  const graduating = isGraduatingClass(currentClass);
  const next = getNextClassName(currentClass);

  if (graduating) {
    return {
      decision: 'Graduate',
      nextClass: 'Alumni / Graduated',
      reason:
        annualAverage >= 50
          ? 'Completed final academic level requirements successfully'
          : 'Completed final academic term'
    };
  }

  if (annualAverage >= 50) {
    return {
      decision: 'Promote',
      nextClass: next,
      reason: `Passed with annual average of ${annualAverage.toFixed(1)}% (Pass mark: 50%)`
    };
  } else if (annualAverage >= 45) {
    return {
      decision: 'Promote on Trial',
      nextClass: next,
      reason: `Borderline pass with annual average of ${annualAverage.toFixed(1)}% (Trial promotion)`
    };
  } else {
    return {
      decision: 'Repeat',
      nextClass: currentClass,
      reason: `Failed to meet 50% pass mark (Annual average: ${annualAverage.toFixed(1)}%)`
    };
  }
}

