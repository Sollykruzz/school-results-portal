/**
 * Supabase data service
 * School Management Portal
 * Shared portal records backed by Supabase
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  runTransaction,
  getDocsFromServer
} from './supabaseFirestore';
import { db, handleSupabaseError } from './supabaseFirestore';
import { safeStorage, safeSessionStorage } from '../utils/safeStorage';
import {
  enqueueOfflineOperation,
  getOfflineQueueItems,
  removeOfflineQueueItem,
  updateOfflineQueueItem,
  subscribeToOfflineQueue,
  setOfflineSyncingState,
  OfflineQueueItem
} from '../utils/offlineQueue';

export const STUDENT_ID_PREFIX = 'DNPS';
export const SECONDARY_STUDENT_ID_PREFIX = 'DSS';

export function isSecondaryClass(className?: string): boolean {
  if (!className) return false;
  const c = className.trim().toUpperCase();
  if (
    c.startsWith('JSS') ||
    c.startsWith('J.S.S') ||
    c.includes('JUNIOR') ||
    /^JS[\s\-_0-9]/i.test(c) ||
    c === 'JS1' || c === 'JS2' || c === 'JS3' ||
    c.startsWith('BASIC 7') ||
    c.startsWith('BASIC 8') ||
    c.startsWith('BASIC 9') ||
    c.startsWith('BASIC7') ||
    c.startsWith('BASIC8') ||
    c.startsWith('BASIC9')
  ) {
    return true;
  }
  if (
    c.startsWith('SSS') ||
    c.startsWith('S.S.S') ||
    c.startsWith('SS') ||
    c.startsWith('S.S') ||
    c.includes('SENIOR')
  ) {
    return true;
  }
  const cat = detectClassCategory(className);
  return cat === 'Junior Secondary' || cat === 'Senior Secondary';
}
import {
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  Teacher,
  TermType,
  PublishedRecord,
  ClassRecord,
  ClassCategory,
  GradingScaleItem,
  AffectiveRatings,
  PsychomotorRatings,
  DailyAttendanceRecord,
  AttendanceEntry,
  StudentAttendanceTally,
  RolloverStudentDecision,
  RolloverHistoryRecord,
  WebsiteConfig,
  FacilityItem,
  ScoringConfig
} from '../types';
import { DEFAULT_WEBSITE_CONFIG } from '../data/websiteDefaults';
import { saveSchoolBrandingLocally } from '../config/schoolConfig';
import {
  DEFAULT_KG_SUBJECTS,
  DEFAULT_NURSERY_SUBJECTS,
  DEFAULT_LOWER_PRIMARY_SUBJECTS,
  DEFAULT_UPPER_PRIMARY_SUBJECTS,
  DEFAULT_JSS_SUBJECTS,
  DEFAULT_SS_SUBJECTS,
  DEFAULT_CURRENT_SESSION,
  DEFAULT_CURRENT_TERM,
  DEFAULT_GENERAL_GRADING_SCALE,
  DEFAULT_SECONDARY_WAEC_SCALE,
  DEFAULT_EARLY_YEARS_SCALE,
  DEFAULT_SCORING_CONFIG,
  setActiveGradingScales,
  getActiveGradingScales,
  getScoringConfig,
  setCachedScoringConfig,
  setAllCachedScoringConfigs,
  normalizeSessionAndTerm,
  getScoringConfigKey,
  isMatchingClass,
  normalizeClassIdentifier
} from '../utils/grading';

const LIVE_DATA_CACHE_KEY = 'school_portal_supabase_cache';
const WEBSITE_CACHE_KEY = 'school_portal_website_cache';

export function detectClassCategory(className: string): ClassCategory {
  const c = String(className ?? '').trim().toUpperCase();
  if (c.startsWith('KG') || c.includes('KINDERGARTEN') || c.includes('PLAYGROUP') || c.includes('CRECHE')) return 'KG';
  if (c.startsWith('NURSERY') || c.startsWith('NUR')) return 'Nursery';
  if (c.startsWith('BASIC')) {
    if (c.includes('7') || c.includes('8') || c.includes('9')) return 'Junior Secondary';
    return 'Primary';
  }
  if (c.startsWith('PRIMARY') || c.startsWith('GRADE')) return 'Primary';
  if (c.startsWith('JSS') || c.startsWith('J.S.S') || c.includes('JUNIOR') || /^JS[\s\-_0-9]/i.test(c)) return 'Junior Secondary';
  if (c.startsWith('SSS') || c.startsWith('S.S.S') || c.startsWith('SS') || c.startsWith('S.S') || c.includes('SENIOR')) return 'Senior Secondary';
  return 'Other';
}

export const INITIAL_DEFAULT_CLASSES: ClassRecord[] = [
  { id: 'class_kg_1', name: 'KG 1', category: 'KG', order: 1 },
  { id: 'class_kg_2', name: 'KG 2', category: 'KG', order: 2 },
  { id: 'class_nursery_1', name: 'Nursery 1', category: 'Nursery', order: 3 },
  { id: 'class_nursery_2', name: 'Nursery 2', category: 'Nursery', order: 4 },
  { id: 'class_primary_1', name: 'Primary 1', category: 'Primary', order: 5 },
  { id: 'class_primary_2', name: 'Primary 2', category: 'Primary', order: 6 },
  { id: 'class_primary_3', name: 'Primary 3', category: 'Primary', order: 7 },
  { id: 'class_primary_4', name: 'Primary 4', category: 'Primary', order: 8 },
  { id: 'class_primary_5', name: 'Primary 5', category: 'Primary', order: 9 },
  { id: 'class_primary_6', name: 'Primary 6', category: 'Primary', order: 10 },
  { id: 'class_jss_1', name: 'JSS 1', category: 'Junior Secondary', order: 11 },
  { id: 'class_jss_2', name: 'JSS 2', category: 'Junior Secondary', order: 12 },
  { id: 'class_jss_3', name: 'JSS 3', category: 'Junior Secondary', order: 13 },
  { id: 'class_ss_1', name: 'SS 1', category: 'Senior Secondary', order: 14 },
  { id: 'class_ss_2', name: 'SS 2', category: 'Senior Secondary', order: 15 },
  { id: 'class_ss_3', name: 'SS 3', category: 'Senior Secondary', order: 16 }
];

// Mutable exported array synchronized with Firestore
export let ALL_SCHOOL_CLASSES: string[] = INITIAL_DEFAULT_CLASSES.map((c) => c.name);

export function getSchoolClasses(): string[] {
  return ALL_SCHOOL_CLASSES;
}


export const INITIAL_DEFAULT_TEACHERS: Teacher[] = [
  {
    Username: 'admin',
    Password: 'admin',
    ClassAssigned: 'Admin',
    FullName: 'Portal Administrator',
    Role: 'admin'
  },
  {
    Username: 'teacher_kg1',
    Password: 'password123',
    ClassAssigned: 'KG 1',
    FullName: 'Mrs. Joy Ali',
    Role: 'teacher'
  },
  {
    Username: 'teacher_kg2',
    Password: 'password123',
    ClassAssigned: 'KG 2',
    FullName: 'Mrs. Deborah Attah',
    Role: 'teacher'
  },
  {
    Username: 'teacher_nur1',
    Password: 'password123',
    ClassAssigned: 'Nursery 1',
    FullName: 'Mrs. Grace Adebayo',
    Role: 'teacher'
  },
  {
    Username: 'teacher_nur2',
    Password: 'password123',
    ClassAssigned: 'Nursery 2',
    FullName: 'Mrs. Comfort Daniel',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p1',
    Password: 'password123',
    ClassAssigned: 'Primary 1',
    FullName: 'Mr. Paul Ibrahim',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p2',
    Password: 'password123',
    ClassAssigned: 'Primary 2',
    FullName: 'Mrs. Mary Oche',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p3',
    Password: 'password123',
    ClassAssigned: 'Primary 3',
    FullName: 'Mr. David Okolo',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p4',
    Password: 'password123',
    ClassAssigned: 'Primary 4',
    FullName: 'Mr. Emmanuel Solomon',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p5',
    Password: 'password123',
    ClassAssigned: 'Primary 5',
    FullName: 'Mrs. Esther Audu',
    Role: 'teacher'
  },
  {
    Username: 'teacher_p6',
    Password: 'password123',
    ClassAssigned: 'Primary 6',
    FullName: 'Mr. Samuel Ochigbo',
    Role: 'teacher'
  },
  {
    Username: 'teacher_jss1',
    Password: 'password123',
    ClassAssigned: 'JSS 1',
    FullName: 'Mr. Gabriel Musa',
    Role: 'teacher'
  },
  {
    Username: 'teacher_jss2',
    Password: 'password123',
    ClassAssigned: 'JSS 2',
    FullName: 'Mrs. Ruth Sunday',
    Role: 'teacher'
  },
  {
    Username: 'teacher_jss3',
    Password: 'password123',
    ClassAssigned: 'JSS 3',
    FullName: 'Mr. Timothy Usman',
    Role: 'teacher'
  },
  {
    Username: 'teacher_ss1',
    Password: 'password123',
    ClassAssigned: 'SS 1',
    FullName: 'Mr. Philip Abah',
    Role: 'teacher'
  },
  {
    Username: 'teacher_ss2',
    Password: 'password123',
    ClassAssigned: 'SS 2',
    FullName: 'Mrs. Martha Daniel',
    Role: 'teacher'
  },
  {
    Username: 'teacher_ss3',
    Password: 'password123',
    ClassAssigned: 'SS 3',
    FullName: 'Mr. Joseph Onoja',
    Role: 'teacher'
  }
];

export const INITIAL_DEFAULT_SUBJECTS: SubjectRule[] = [
  ...DEFAULT_KG_SUBJECTS.map((name) => ({ Level: 'Kindergarten' as const, SubjectName: name })),
  ...DEFAULT_NURSERY_SUBJECTS.map((name) => ({ Level: 'Nursery' as const, SubjectName: name })),
  ...DEFAULT_LOWER_PRIMARY_SUBJECTS.map((name) => ({ Level: 'LowerPrimary' as const, SubjectName: name })),
  ...DEFAULT_UPPER_PRIMARY_SUBJECTS.map((name) => ({ Level: 'UpperPrimary' as const, SubjectName: name })),
  ...DEFAULT_JSS_SUBJECTS.map((name) => ({ Level: 'JuniorSecondary' as const, SubjectName: name })),
  ...DEFAULT_SS_SUBJECTS.map((name) => ({ Level: 'SeniorSecondary' as const, SubjectName: name }))
];

export const INITIAL_DEFAULT_STUDENTS: Student[] = [];

export const INITIAL_DEFAULT_SCORES: SubjectScore[] = [];

export const INITIAL_DEFAULT_SUMMARIES: StudentSummary[] = [];

export const INITIAL_DEFAULT_PUBLISHED: PublishedRecord[] = [];

export interface CachedSchoolData {
  teachers: Teacher[];
  students: Student[];
  subjects: SubjectRule[];
  scores: SubjectScore[];
  summaries: StudentSummary[];
  published: PublishedRecord[];
  classes?: ClassRecord[];
  classNames?: string[];
  gradingScales?: GradingScaleItem[];
  scoringConfigs?: Record<string, ScoringConfig>;
  timestamp: number;
}

const asText = (v: any): string => (v === undefined || v === null ? '' : String(v));
const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? v : []);

/**
 * Repairs malformed records (missing or non text fields) so one bad row in the
 * database or in the browser cache can never crash the dashboards.
 */
export function sanitizeSchoolData<T extends {
  teachers?: any[];
  students?: any[];
  subjects?: any[];
  scores?: any[];
  summaries?: any[];
  published?: any[];
  classes?: any[];
  classNames?: any[];
}>(data: T): T {
  const teachers = asArray<any>(data.teachers)
    .filter((t) => t && typeof t === 'object')
    .map((t) => ({
      ...t,
      Username: asText(t.Username),
      Password: asText(t.Password),
      ClassAssigned: asText(t.ClassAssigned),
      FullName: asText(t.FullName) || undefined,
      PhotoURL: typeof t.PhotoURL === 'string' ? t.PhotoURL : ''
    }));
  const students = asArray<any>(data.students)
    .filter((s) => s && typeof s === 'object' && asText(s.StudentID).trim() !== '')
    .map((s) => ({
      ...s,
      StudentID: asText(s.StudentID),
      FullName: asText(s.FullName),
      Class: asText(s.Class),
      Password: asText(s.Password) || 'password'
    }));
  const subjects = asArray<any>(data.subjects)
    .filter((s) => s && typeof s === 'object' && asText(s.SubjectName).trim() !== '')
    .map((s) => ({
      ...s,
      SubjectName: asText(s.SubjectName),
      Level: asText(s.Level),
      Class: s.Class === undefined || s.Class === null ? undefined : asText(s.Class)
    }));
  const scores = asArray<any>(data.scores)
    .filter((s) => s && typeof s === 'object' && asText(s.StudentID) !== '' && asText(s.Subject) !== '')
    .map((s) => ({
      ...s,
      StudentID: asText(s.StudentID),
      Subject: asText(s.Subject),
      Session: asText(s.Session),
      Term: asText(s.Term)
    }));
  const summaries = asArray<any>(data.summaries)
    .filter((s) => s && typeof s === 'object' && asText(s.StudentID) !== '')
    .map((s) => ({ ...s, StudentID: asText(s.StudentID) }));
  const published = asArray<any>(data.published)
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      ...r,
      className: asText(r.className),
      term: asText(r.term),
      session: asText(r.session)
    }));
  const classes = asArray<any>(data.classes)
    .filter((c) => c && typeof c === 'object' && asText(c.name).trim() !== '')
    .map((c) => ({ ...c, name: asText(c.name) }));
  const classNames = asArray<any>(data.classNames)
    .map((n) => asText(n).trim())
    .filter((n) => n !== '');

  return { ...data, teachers, students, subjects, scores, summaries, published, classes, classNames } as T;
}

export function getCachedSchoolData(): CachedSchoolData | null {
  try {
    const raw = safeStorage.getItem(LIVE_DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return sanitizeSchoolData(parsed) as CachedSchoolData;
  } catch {
    return null;
  }
}

export function setCachedSchoolData(data: Omit<CachedSchoolData, 'timestamp'>): void {
  try {
    safeStorage.setItem(
      LIVE_DATA_CACHE_KEY,
      JSON.stringify({
        ...data,
        timestamp: Date.now()
      })
    );
  } catch {}
}

// In-memory published cache
let inMemoryPublished: PublishedRecord[] = [];

export function getPublishedRecords(): PublishedRecord[] {
  return inMemoryPublished;
}

export function isClassResultPublished(className: string, term: TermType, session: string): boolean {
  if (!className) return false;
  const cleanTargetClass = normalizeClassIdentifier(className);
  const cleanTargetTerm = (term || '').trim().toLowerCase();
  const cleanTargetSession = (session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

  // Search in reverse order (newest records first)
  for (let i = inMemoryPublished.length - 1; i >= 0; i--) {
    const r = inMemoryPublished[i];
    const rClass = normalizeClassIdentifier(r.className);
    const rTerm = (r.term || '').trim().toLowerCase();
    const rSession = (r.session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

    const classMatches = rClass === cleanTargetClass || isMatchingClass(r.className, className);
    const termMatches =
      !rTerm ||
      !cleanTargetTerm ||
      rTerm === cleanTargetTerm ||
      rTerm.includes(cleanTargetTerm) ||
      cleanTargetTerm.includes(rTerm);
    const sessionMatches =
      !rSession ||
      !cleanTargetSession ||
      rSession === cleanTargetSession ||
      rSession.includes(cleanTargetSession) ||
      cleanTargetSession.includes(rSession);

    if (classMatches && termMatches && sessionMatches) {
      return Boolean(r.isPublished);
    }
  }
  return false;
}

/**
 * Real-time listener for Published records changes in Firestore
 */
export function subscribeToPublishedRecords(
  callback: (records: PublishedRecord[]) => void
): () => void {
  try {
    const pubCol = collection(db, 'published');
    const unsubscribe = onSnapshot(
      pubCol,
      (snapshot) => {
        const records: PublishedRecord[] = [];
        snapshot.forEach((d) => {
          records.push(d.data() as PublishedRecord);
        });
        if (records.length > 0) {
          inMemoryPublished = records;
          try {
            const currentCache = getCachedSchoolData();
            if (currentCache) {
              setCachedSchoolData({
                ...currentCache,
                published: records
              });
            }
          } catch {}
          callback(records);
        }
      },
      (err) => {
        console.warn('Real-time published listener notice:', err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to published records:', err);
    return () => {};
  }
}

/**
 * Generate sanitized deterministic Firestore document IDs
 */
function getClassDocId(className: string): string {
  return 'class_' + className.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function getScoreDocId(studentId: string, session: string, term: string, subject: string): string {
  const cleanStudent = studentId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanSession = session.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${cleanStudent}_${cleanSession}_${cleanTerm}_${cleanSubject}`;
}

function getSummaryDocId(studentId: string, session: string, term: string): string {
  const cleanStudent = studentId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const cleanSession = session.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${cleanStudent}_${cleanSession}_${cleanTerm}`;
}

function getStudentDocId(studentId: string): string {
  return studentId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

/**
 * Pure helper for previewing the next available Student ID.
 * - For Secondary classes (JSS 1-3, SSS 1-3, etc.):
 *   Recommends starting from DSS/001 and automatically increments to the next highest value in sequence (3-digit padding).
 * - For Primary / Nursery / KG:
 *   Recommends starting from DNPS/0001 (or next highest DNPS/XXXX, 4-digit padding).
 */
export function getNextStudentIdPreview(students: { StudentID?: string }[], className?: string): string {
  const isSecondary = isSecondaryClass(className);
  const prefix = isSecondary ? SECONDARY_STUDENT_ID_PREFIX : STUDENT_ID_PREFIX;
  const padLength = isSecondary ? 3 : 4;
  const regex = new RegExp(`^${prefix}[\\/\\-_\\s]+(\\d+)`, 'i');

  let max = 0;
  if (Array.isArray(students)) {
    for (const s of students) {
      if (!s || !s.StudentID) continue;
      const clean = s.StudentID.trim();
      const match = clean.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > max) {
          max = num;
        }
      }
    }
  }
  return `${prefix}/${String(max + 1).padStart(padLength, '0')}`;
}

class StudentIdCollisionError extends Error {
  nextAttempted: number;
  constructor(next: number) {
    super(`COLLISION:${next}`);
    this.name = 'StudentIdCollisionError';
    this.nextAttempted = next;
  }
}

/**
 * Race-safe school-wide Student ID assignment and pupil enrollment.
 * Uses a transactional counter in Firestore and server-fetched student list.
 * Supports DSS/001 for secondary and DNPS/0001 for primary with collision-proof transactions.
 * If a custom/modified studentId is provided in the input, validates uniqueness and uses it.
 */
export async function createStudentWithNextId(input: {
  fullName: string;
  className: string;
  studentId?: string;
  gender?: string;
  dob?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  password?: string;
}): Promise<{ success: boolean; message: string; student?: Student }> {
  // 1. Trim name and class. If either is empty, return failure and write nothing.
  const trimmedName = (input.fullName || '').trim();
  const trimmedClass = (input.className || '').trim();
  if (!trimmedName || !trimmedClass) {
    return {
      success: false,
      message: 'Student Full Name and Class are required.'
    };
  }

  const isSecondary = isSecondaryClass(trimmedClass);
  const prefix = isSecondary ? SECONDARY_STUDENT_ID_PREFIX : STUDENT_ID_PREFIX;
  const padLength = isSecondary ? 3 : 4;
  const regex = new RegExp(`^${prefix}[\\/\\-_\\s]+(\\d+)`, 'i');

  let customId = (input.studentId || '').trim().toUpperCase();

  // If registering a secondary student (JSS/SSS) and a stale DNPS/ default ID was passed,
  // or registering a primary student and a stale DSS/ default ID was passed, auto-assign the proper prefix sequence
  if (isSecondary && /^DNPS[\/\-_\s]+\d+$/i.test(customId)) {
    customId = '';
  } else if (!isSecondary && /^DSS[\/\-_\s]+\d+$/i.test(customId)) {
    customId = '';
  }

  // If user provided or modified the Student ID:
  if (customId) {
    const studentDocId = getStudentDocId(customId);
    const studentRef = doc(db, 'students', studentDocId);

    // Collision check
    try {
      const existingSnap = await getDoc(studentRef);
      if (existingSnap.exists() && String(existingSnap.data()?.StudentID ?? '').trim() !== '') {
        return {
          success: false,
          message: `Student ID "${customId}" is already assigned to another student in the system. Please choose a different ID.`
        };
      }
    } catch {
      return {
        success: false,
        message: 'Could not reach the school database to verify Student ID. Please check your internet connection.'
      };
    }

    const now = new Date().toISOString();
    const record: Student = {
      StudentID: customId,
      FullName: trimmedName,
      Class: trimmedClass,
      Gender: input.gender && input.gender.trim() ? input.gender.trim() : 'Male',
      DOB: input.dob && input.dob.trim() ? input.dob.trim() : '',
      ParentName: input.parentName && input.parentName.trim() ? input.parentName.trim() : '',
      ParentPhone: input.parentPhone && input.parentPhone.trim() ? input.parentPhone.trim() : '',
      Address: input.address && input.address.trim() ? input.address.trim() : '',
      GuardianEmail: '',
      Password: input.password && input.password.trim() ? input.password.trim() : 'password',
      PhotoURL: '',
      PassportUrl: '',
      CreatedAt: now,
      UpdatedAt: now
    };

    try {
      await setDoc(studentRef, record);
    } catch (writeErr: any) {
      return {
        success: false,
        message: writeErr?.message ? `Failed to register student: ${writeErr.message}` : 'Failed to save student record.'
      };
    }

    // Keep sequence counter synchronized if custom ID matches sequence
    const seqMatch = customId.match(regex);
    if (seqMatch) {
      const num = parseInt(seqMatch[1], 10);
      if (!isNaN(num)) {
        const counterDocId = isSecondary ? 'student_id_counter_dss' : 'student_id_counter';
        const counterRef = doc(db, 'settings', counterDocId);
        try {
          const counterSnap = await getDoc(counterRef);
          const currentLast = counterSnap.exists() ? Number(counterSnap.data()?.lastNumber) || 0 : 0;
          if (num > currentLast) {
            await setDoc(counterRef, { prefix, lastNumber: num, updatedAt: now }, { merge: true });
          }
        } catch {}
      }
    }

    // Update local cache
    const cached = getCachedSchoolData();
    if (cached && cached.students) {
      const updatedStudents = cached.students.filter(
        (s) => s.StudentID.toUpperCase().trim() !== record.StudentID
      );
      updatedStudents.push(record);
      setCachedSchoolData({ ...cached, students: updatedStudents });
    }

    return {
      success: true,
      message: `Pupil ${trimmedName} registered with ID ${record.StudentID}.`,
      student: record
    };
  }

  // 2. Otherwise auto-assign next ID from counter
  // Counter document ref: separate counters for secondary and primary
  const counterDocId = isSecondary ? 'student_id_counter_dss' : 'student_id_counter';
  const counterRef = doc(db, 'settings', counterDocId);

  // 3. Fetch ALL students with getDocsFromServer, not cache.
  let maxExisting = 0;
  try {
    const studentsSnap = await getDocsFromServer(collection(db, 'students'));
    studentsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const sid = (data?.StudentID || '').trim();
      const match = sid.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxExisting) {
          maxExisting = num;
        }
      }
    });
  } catch {
    return {
      success: false,
      message: 'Could not reach the school database. Nothing was saved. Check your internet and try again.'
    };
  }

  // 4. Loop up to 5 attempts with transactional counter read & write
  let savedRecord: Student | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    let attemptedNext = 0;
    try {
      savedRecord = await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const counterData = counterSnap.exists() ? (counterSnap.data() as any) : null;
        const last = counterData ? Number(counterData.lastNumber) || 0 : 0;
        const next = Math.max(last, maxExisting) + 1;
        attemptedNext = next;
        const id = `${prefix}/${String(next).padStart(padLength, '0')}`;
        const studentRef = doc(db, 'students', getStudentDocId(id));

        const studentSnap = await tx.get(studentRef);
        if (studentSnap.exists()) {
          throw new StudentIdCollisionError(next);
        }

        const now = new Date().toISOString();
        const record: Student = {
          StudentID: id,
          FullName: trimmedName,
          Class: trimmedClass,
          Gender: input.gender && input.gender.trim() ? input.gender.trim() : 'Male',
          DOB: input.dob && input.dob.trim() ? input.dob.trim() : '',
          ParentName: input.parentName && input.parentName.trim() ? input.parentName.trim() : '',
          ParentPhone: input.parentPhone && input.parentPhone.trim() ? input.parentPhone.trim() : '',
          Address: input.address && input.address.trim() ? input.address.trim() : '',
          GuardianEmail: '',
          Password: input.password && input.password.trim() ? input.password.trim() : 'password',
          PhotoURL: '',
          PassportUrl: '',
          CreatedAt: now,
          UpdatedAt: now
        };

        tx.set(
          counterRef,
          {
            prefix,
            lastNumber: next,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );

        tx.set(studentRef, record);

        return record;
      });

      if (savedRecord) {
        break;
      }
    } catch (err: any) {
      if (err instanceof StudentIdCollisionError || (err && (err as any).name === 'StudentIdCollisionError')) {
        const colNext = (err as any).nextAttempted || attemptedNext;
        maxExisting = Math.max(maxExisting, colNext);
        continue;
      }
      return {
        success: false,
        message: err?.message ? `Failed to save pupil: ${err.message}` : 'Database transaction error.'
      };
    }
  }

  // 6. On failure after all attempts
  if (!savedRecord) {
    return {
      success: false,
      message: 'Could not assign a Student ID. Nothing was saved. Please try again.'
    };
  }

  // 5. On success, update local cache
  const cached = getCachedSchoolData();
  if (cached && cached.students) {
    const updatedStudents = cached.students.map((s) =>
      s.StudentID.toUpperCase().trim() === savedRecord!.StudentID ? { ...s, ...savedRecord! } : s
    );
    if (!updatedStudents.some((s) => s.StudentID.toUpperCase().trim() === savedRecord!.StudentID)) {
      updatedStudents.push(savedRecord);
    }
    setCachedSchoolData({ ...cached, students: updatedStudents });
  }

  return {
    success: true,
    message: `Pupil ${trimmedName} registered with ID ${savedRecord.StudentID}.`,
    student: savedRecord
  };
}

function getTeacherDocId(username: string): string {
  return username.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function getPublishDocId(className: string, session: string, term: string): string {
  const cleanClass = normalizeClassIdentifier(className).replace(/[^a-zA-Z0-9]/g, '_');
  const cleanSession = (session || '').toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim().replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = (term || '').toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
  return `pub_${cleanClass}_${cleanTerm}_${cleanSession}`;
}

const CATEGORY_WEIGHTS: Record<ClassCategory, number> = {
  'KG': 1,
  'Nursery': 2,
  'Primary': 3,
  'Junior Secondary': 4,
  'Senior Secondary': 5,
  'Other': 6
};

export function sortSchoolClasses(classes: ClassRecord[]): ClassRecord[] {
  return [...classes].sort((a, b) => {
    const catA = a.category || detectClassCategory(a.name);
    const catB = b.category || detectClassCategory(b.name);
    const weightA = CATEGORY_WEIGHTS[catA] || 99;
    const weightB = CATEGORY_WEIGHTS[catB] || 99;
    if (weightA !== weightB) return weightA - weightB;

    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      return a.order - b.order;
    }

    // Extract numerical digits if any
    const numA = parseInt((String(a.name ?? '').match(/\d+/) || ['0'])[0], 10);
    const numB = parseInt((String(b.name ?? '').match(/\d+/) || ['0'])[0], 10);
    if (numA !== numB) return numA - numB;

    return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function sortClassNames(classNames: string[]): string[] {
  const records = classNames.map((name) => ({
    name,
    category: detectClassCategory(name)
  }));
  return sortSchoolClasses(records).map((r) => r.name);
}

/**
 * Seed initial school data if Firestore collections are empty
 */
export async function seedInitialDatabase(force = false): Promise<{ success: boolean; message: string }> {
  try {
    const teachersSnapshot = await getDocs(collection(db, 'teachers'));
    if (!force && !teachersSnapshot.empty) {
      return { success: true, message: 'Database already has data.' };
    }

    const batch = writeBatch(db);

    // 1. Seed Classes
    INITIAL_DEFAULT_CLASSES.forEach((cls) => {
      const docRef = doc(db, 'classes', getClassDocId(cls.name));
      batch.set(docRef, {
        ...cls,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    // 2. Seed Teachers
    INITIAL_DEFAULT_TEACHERS.forEach((teacher) => {
      const docRef = doc(db, 'teachers', getTeacherDocId(teacher.Username));
      batch.set(docRef, teacher, { merge: true });
    });

    // 3. Seed Subjects (Curriculum rules)
    INITIAL_DEFAULT_SUBJECTS.forEach((subj) => {
      const id = `${subj.Level}_${subj.SubjectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const docRef = doc(db, 'subjects', id);
      batch.set(docRef, subj, { merge: true });
    });

    await batch.commit();
    return { success: true, message: 'School classes, staff roster, and academic curriculum initialized in Firebase.' };
  } catch (err: any) {
    console.error('Failed to seed database in Firebase:', err);
    return { success: false, message: `Seeding error: ${err.message || 'Firebase permission error'}` };
  }
}

/**
 * Helper: Overlay any pending IndexedDB offline queue items onto scores and summaries arrays
 * Guarantees that a background refresh never overwrites unsynced offline edits
 */
async function overlayPendingOfflineQueueOnData(
  baseScores: SubjectScore[],
  baseSummaries: StudentSummary[]
): Promise<{ scores: SubjectScore[]; summaries: StudentSummary[] }> {
  try {
    const queueItems = await getOfflineQueueItems();
    if (!queueItems || queueItems.length === 0) {
      return { scores: baseScores, summaries: baseSummaries };
    }

    const scoreMap = new Map<string, SubjectScore>();
    baseScores.forEach((s) => {
      const k = `${s.StudentID}_${s.Session}_${s.Term}_${s.Subject}`.toLowerCase();
      scoreMap.set(k, s);
    });

    const summaryMap = new Map<string, StudentSummary>();
    baseSummaries.forEach((sm) => {
      const k = `${sm.StudentID}_${sm.Session}_${sm.Term}`.toLowerCase();
      summaryMap.set(k, sm);
    });

    for (const item of queueItems) {
      if (item.type === 'SAVE_REPORT_CARD' && item.payload) {
        const p = item.payload;
        for (const sc of p.scores || []) {
          const subj = String(sc.Subject || '').trim();
          if (!subj) continue;
          const k = `${p.studentId}_${p.session}_${p.term}_${subj}`.toLowerCase();
          const prev = scoreMap.get(k);
          const ca1 = sc.CA1 !== null && sc.CA1 !== undefined ? Number(sc.CA1) : sc.clearCA1 ? null : (prev?.CA1 ?? null);
          const ca2 = sc.CA2 !== null && sc.CA2 !== undefined ? Number(sc.CA2) : sc.clearCA2 ? null : (prev?.CA2 ?? null);
          const exam = sc.Exam !== null && sc.Exam !== undefined ? Number(sc.Exam) : sc.clearExam ? null : (prev?.Exam ?? null);
          if (ca1 === null && ca2 === null && exam === null && !prev) continue;
          const total =
            ca1 !== null || ca2 !== null || exam !== null
              ? (ca1 || 0) + (ca2 || 0) + (exam || 0)
              : null;
          scoreMap.set(k, {
            StudentID: p.studentId,
            Session: p.session,
            Term: p.term,
            Subject: subj,
            CA1: ca1,
            CA2: ca2,
            Exam: exam,
            Total: total
          });
        }
        if (p.summary) {
          const summKey = `${p.studentId}_${p.session}_${p.term}`.toLowerCase();
          const prevSum = summaryMap.get(summKey);
          summaryMap.set(summKey, {
            StudentID: p.studentId,
            Session: p.session,
            Term: p.term,
            DaysPresent: p.summary.DaysPresent ?? prevSum?.DaysPresent ?? null,
            DaysOpened: p.summary.DaysOpened ?? prevSum?.DaysOpened ?? null,
            TeacherComment: p.summary.TeacherComment || prevSum?.TeacherComment || '',
            PrincipalComment: p.summary.PrincipalComment || prevSum?.PrincipalComment || '',
            AffectiveRatings: p.summary.AffectiveRatings || p.affectiveRatings || prevSum?.AffectiveRatings,
            PsychomotorRatings: p.summary.PsychomotorRatings || p.psychomotorRatings || prevSum?.PsychomotorRatings,
            PromotionDecision: p.summary.PromotionDecision || p.promotionDecision || prevSum?.PromotionDecision
          });
        }
      } else if (item.type === 'SAVE_BATCH_SCORES' && item.payload) {
        const p = item.payload;
        for (const sc of p.scores || []) {
          const subj = String(sc.subject || '').trim();
          const studentId = String(sc.studentId || '').trim();
          if (!subj || !studentId) continue;
          const k = `${studentId}_${p.session}_${p.term}_${subj}`.toLowerCase();
          const prev = scoreMap.get(k);
          const ca1 = sc.ca1 !== null && sc.ca1 !== undefined ? Number(sc.ca1) : sc.clearCA1 ? null : (prev?.CA1 ?? null);
          const ca2 = sc.ca2 !== null && sc.ca2 !== undefined ? Number(sc.ca2) : sc.clearCA2 ? null : (prev?.CA2 ?? null);
          const exam = sc.exam !== null && sc.exam !== undefined ? Number(sc.exam) : sc.clearExam ? null : (prev?.Exam ?? null);
          if (ca1 === null && ca2 === null && exam === null && !prev) continue;
          const total =
            ca1 !== null || ca2 !== null || exam !== null
              ? (ca1 || 0) + (ca2 || 0) + (exam || 0)
              : null;
          scoreMap.set(k, {
            StudentID: studentId,
            Session: p.session,
            Term: p.term,
            Subject: subj,
            CA1: ca1,
            CA2: ca2,
            Exam: exam,
            Total: total
          });
        }
      }
    }

    return {
      scores: Array.from(scoreMap.values()),
      summaries: Array.from(summaryMap.values())
    };
  } catch {
    return { scores: baseScores, summaries: baseSummaries };
  }
}

/**
 * Fetch all data from Firebase Firestore in Real Time
 */
async function loadAllDataUnsafe(forceFresh = false): Promise<{
  teachers: Teacher[];
  students: Student[];
  subjects: SubjectRule[];
  scores: SubjectScore[];
  summaries: StudentSummary[];
  published: PublishedRecord[];
  classes: ClassRecord[];
  classNames: string[];
  gradingScales: GradingScaleItem[];
  isLive: boolean;
  error?: string;
}> {
  try {
    // Flush any queued offline score/attendance writes before reading from Firestore
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      try {
        await processOfflineSyncQueue();
      } catch {}
    }

    const cached = getCachedSchoolData();

    // Fetch all primary collections in parallel with a timeout guard
    const fetchCollections = Promise.allSettled([
      getDocs(collection(db, 'classes')),
      getDocs(collection(db, 'teachers')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'subjects')),
      getDocs(collection(db, 'scores')),
      getDocs(collection(db, 'summaries')),
      getDocs(collection(db, 'published')),
      getDoc(doc(db, 'settings', 'academic_grading')),
      getDoc(doc(db, 'settings', 'scoring_configs'))
    ]);

    let timerId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error('Firestore backend response timed out.')), 10000);
      if (typeof timerId === 'object' && timerId && typeof timerId.unref === 'function') {
        timerId.unref();
      }
    });

    let raceResult;
    try {
      raceResult = await Promise.race([fetchCollections, timeoutPromise]);
    } finally {
      if (timerId) clearTimeout(timerId);
    }
    const [
      clsRes,
      tRes,
      stRes,
      subRes,
      scRes,
      sumRes,
      pubRes,
      gradingRes,
      scoringRes
    ] = raceResult;

    const isConnected =
      clsRes.status === 'fulfilled' ||
      tRes.status === 'fulfilled' ||
      stRes.status === 'fulfilled' ||
      subRes.status === 'fulfilled';

    if (!isConnected) {
      throw new Error('Firestore connection unavailable.');
    }

    let clsSnap = clsRes.status === 'fulfilled' ? clsRes.value : null;
    let tSnap = tRes.status === 'fulfilled' ? tRes.value : null;
    const stSnap = stRes.status === 'fulfilled' ? stRes.value : null;
    const subSnap = subRes.status === 'fulfilled' ? subRes.value : null;
    const scSnap = scRes.status === 'fulfilled' ? scRes.value : null;
    const sumSnap = sumRes.status === 'fulfilled' ? sumRes.value : null;
    const pubSnap = pubRes.status === 'fulfilled' ? pubRes.value : null;
    const gradingSnap = gradingRes.status === 'fulfilled' ? gradingRes.value : null;
    const scoringSnap = scoringRes.status === 'fulfilled' ? scoringRes.value : null;

    // If classes and teachers are completely empty in a newly provisioned project, initialize foundation
    if (clsSnap && tSnap && clsSnap.empty && tSnap.empty) {
      await seedInitialDatabase(false);
      try {
        const [refreshedClasses, refreshedTeachers] = await Promise.all([
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'teachers'))
        ]);
        clsSnap = refreshedClasses;
        tSnap = refreshedTeachers;
      } catch {}
    }

    let gradingScales: GradingScaleItem[] = cached?.gradingScales || [...DEFAULT_GENERAL_GRADING_SCALE];
    if (gradingSnap && gradingSnap.exists() && gradingSnap.data()?.scales) {
      gradingScales = gradingSnap.data()?.scales as GradingScaleItem[];
    }
    setActiveGradingScales(gradingScales);

    // Hydrate scoring configs
    let activeScoringConfigs: Record<string, ScoringConfig> = cached?.scoringConfigs || {};
    if (scoringSnap && scoringSnap.exists()) {
      const scoringData = scoringSnap.data();
      if (scoringData) {
        const parsedConfigs = (scoringData.configs || scoringData) as Record<string, ScoringConfig>;
        activeScoringConfigs = { ...activeScoringConfigs, ...parsedConfigs };
        setAllCachedScoringConfigs(activeScoringConfigs);
      }
    } else if (cached?.scoringConfigs) {
      setAllCachedScoringConfigs(cached.scoringConfigs);
    }

    const fetchedClasses: ClassRecord[] = [];
    if (clsSnap) {
      clsSnap.forEach((d) => {
        const data = d.data() as ClassRecord;
        fetchedClasses.push({
          ...data,
          id: d.id,
          category: data.category || detectClassCategory(data.name)
        });
      });
    } else if (cached?.classes) {
      fetchedClasses.push(...cached.classes);
    }

    const teachers: Teacher[] = [];
    if (tSnap) {
      tSnap.forEach((d) => {
        const data = d.data() as Partial<Teacher>;
        const username = String(data.Username || d.id || '').trim();
        const cleanUser = username.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const fallbackPhoto = safeStorage.getItem(`staff_photo_${cleanUser}`) || '';
        const photo = (typeof data.PhotoURL === 'string' && data.PhotoURL.trim()) || (data as any)?.photoUrl || fallbackPhoto;
        if (photo) {
          try {
            safeStorage.setItem(`staff_photo_${cleanUser}`, photo);
          } catch {}
        }
        teachers.push({
          ...data,
          PhotoURL: photo,
          Username: username,
          Password: data.Password || (username.toLowerCase() === 'admin' ? 'admin' : ''),
          Role: data.Role || (username.toLowerCase() === 'admin' ? 'admin' : 'teacher'),
          ClassAssigned: data.ClassAssigned || 'Admin'
        });
      });
    } else if (cached?.teachers) {
      teachers.push(
        ...cached.teachers.map((t) => {
          const cleanUser = (t.Username || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          const fallbackPhoto = safeStorage.getItem(`staff_photo_${cleanUser}`) || '';
          const photo = (t.PhotoURL && t.PhotoURL.trim()) || fallbackPhoto;
          return { ...t, PhotoURL: photo };
        })
      );
    }

    // Ensure primary administrator account is present with Username: 'admin' and Password: 'admin'
    let adminAccount = teachers.find(
      (t) => String(t.Username || '').toLowerCase() === 'admin' || t.Role === 'admin'
    );
    if (!adminAccount) {
      adminAccount = {
        Username: 'admin',
        Password: 'admin',
        ClassAssigned: 'Admin',
        FullName: 'Portal Administrator',
        Role: 'admin'
      };
      teachers.unshift(adminAccount);
      try {
        await setDoc(doc(db, 'teachers', getTeacherDocId('admin')), adminAccount, { merge: true });
      } catch {}
    } else {
      let needsSync = false;
      if (!adminAccount.Username) {
        adminAccount.Username = 'admin';
        needsSync = true;
      }
      if (!adminAccount.Password) {
        adminAccount.Password = 'admin';
        needsSync = true;
      }
      if (adminAccount.Role !== 'admin') {
        adminAccount.Role = 'admin';
        needsSync = true;
      }
      if (needsSync) {
        try {
          await setDoc(doc(db, 'teachers', getTeacherDocId(adminAccount.Username || 'admin')), {
            Username: adminAccount.Username || 'admin',
            Password: adminAccount.Password || 'admin',
            Role: 'admin',
            ClassAssigned: 'Admin',
            FullName: adminAccount.FullName || 'Portal Administrator'
          }, { merge: true });
        } catch {}
      }
    }

    const students: Student[] = [];
    if (stSnap) {
      stSnap.forEach((d) => {
        const data = d.data() as Student;
        const cleanId = (data.StudentID || d.id).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const fallbackPhoto = safeStorage.getItem(`student_photo_${cleanId}`) || '';
        const photo =
          (data.PhotoURL && data.PhotoURL.trim()) ||
          (data.PassportUrl && data.PassportUrl.trim()) ||
          (data as any)?.photoUrl ||
          fallbackPhoto;
        if (photo) {
          try {
            safeStorage.setItem(`student_photo_${cleanId}`, photo);
          } catch {}
        }
        students.push({
          ...data,
          PhotoURL: photo,
          PassportUrl: photo,
          Password: data.Password || 'password'
        });
      });
    } else if (cached?.students) {
      students.push(
        ...cached.students.map((s) => {
          const cleanId = (s.StudentID || '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          const fallbackPhoto = safeStorage.getItem(`student_photo_${cleanId}`) || '';
          const photo =
            (s.PhotoURL && s.PhotoURL.trim()) ||
            (s.PassportUrl && s.PassportUrl.trim()) ||
            (s as any)?.photoUrl ||
            fallbackPhoto;
          return { ...s, PhotoURL: photo, PassportUrl: photo };
        })
      );
    }

    const subjects: SubjectRule[] = [];
    if (subSnap) {
      subSnap.forEach((d) => subjects.push(d.data() as SubjectRule));
    } else if (cached?.subjects) {
      subjects.push(...cached.subjects);
    }

    const scores: SubjectScore[] = [];
    if (scSnap) {
      scSnap.forEach((d) => scores.push(d.data() as SubjectScore));
    } else if (cached?.scores) {
      scores.push(...cached.scores);
    }

    const summaries: StudentSummary[] = [];
    if (sumSnap) {
      sumSnap.forEach((d) => summaries.push(d.data() as StudentSummary));
    } else if (cached?.summaries) {
      summaries.push(...cached.summaries);
    }

    const published: PublishedRecord[] = [];
    if (pubSnap) {
      pubSnap.forEach((d) => published.push(d.data() as PublishedRecord));
    } else if (cached?.published) {
      published.push(...cached.published);
    }

    // Consolidate Classes
    let baseClasses = fetchedClasses.length > 0 ? fetchedClasses : INITIAL_DEFAULT_CLASSES;
    
    // Auto-discover any class from students or teachers not in classes collection
    const knownClassNames = new Set(baseClasses.map((c) => c.name.trim().toLowerCase()));
    students.forEach((st) => {
      const cName = (st.Class || '').trim();
      if (cName && !knownClassNames.has(cName.toLowerCase())) {
        knownClassNames.add(cName.toLowerCase());
        baseClasses.push({
          id: getClassDocId(cName),
          name: cName,
          category: detectClassCategory(cName),
          createdAt: new Date().toISOString()
        });
      }
    });

    teachers.forEach((t) => {
      const cName = (t.ClassAssigned || '').trim();
      if (cName && cName.toLowerCase() !== 'admin' && !knownClassNames.has(cName.toLowerCase())) {
        knownClassNames.add(cName.toLowerCase());
        baseClasses.push({
          id: getClassDocId(cName),
          name: cName,
          category: detectClassCategory(cName),
          createdAt: new Date().toISOString()
        });
      }
    });

    const sortedClasses = sortSchoolClasses(baseClasses);
    const sortedClassNames = sortedClasses.map((c) => c.name);

    // Synchronize mutable export ALL_SCHOOL_CLASSES
    ALL_SCHOOL_CLASSES.length = 0;
    ALL_SCHOOL_CLASSES.push(...sortedClassNames);

    const rawTeachers = teachers.length > 0 ? teachers : INITIAL_DEFAULT_TEACHERS;
    let finalTeachers = rawTeachers.map((t) => {
      const isAdmin =
        t.Role === 'admin' ||
        t.Username.toLowerCase() === 'admin';
      return {
        ...t,
        ClassAssigned: isAdmin ? 'Admin' : t.ClassAssigned,
        Password: t.Password || '',
        Role: (isAdmin ? 'admin' : 'teacher') as 'admin' | 'teacher',
        FullName:
          t.FullName ||
          (isAdmin
            ? 'Portal Administrator'
            : `Class Teacher (${t.ClassAssigned})`)
      };
    });

    // Ensure every class in the school has an assigned teacher in finalTeachers
    sortedClassNames.forEach((cls) => {
      const exists = finalTeachers.some(
        (t) => isMatchingClass(t.ClassAssigned, cls) && t.Role !== 'admin'
      );
      if (!exists) {
        const defaultMatch = INITIAL_DEFAULT_TEACHERS.find(
          (dt) => isMatchingClass(dt.ClassAssigned, cls) && dt.Role !== 'admin'
        );
        if (defaultMatch) {
          finalTeachers.push({
            ...defaultMatch,
            Role: (defaultMatch.Role || 'teacher') as 'admin' | 'teacher',
            FullName: defaultMatch.FullName || `Class Teacher (${cls})`
          });
        } else {
          finalTeachers.push({
            Username: `teacher_${cls.toLowerCase().replace(/[\s._-]/g, '')}`,
            Password: 'password123',
            ClassAssigned: cls,
            FullName: `Class Teacher (${cls})`,
            Role: 'teacher'
          });
        }
      }
    });

    const rawStudents = students;
    const finalStudents = rawStudents.map(s => ({
      ...s,
      Password: s.Password || 'password'
    }));

    const finalSubjects = subjects.length > 0 ? subjects : INITIAL_DEFAULT_SUBJECTS;

    // Intelligently merge remote published with in-memory and cached published records
    // so recently approved results in current session are never overwritten by an empty query
    const cachedBefore = getCachedSchoolData();
    const mergedPublishedMap = new Map<string, PublishedRecord>();

    (cachedBefore?.published || []).forEach((r) => {
      const k = `${normalizeClassIdentifier(r.className)}_${(r.term || '').trim().toLowerCase()}_${(r.session || '').trim().toLowerCase().replace(/session/g, '').trim()}`;
      mergedPublishedMap.set(k, r);
    });
    inMemoryPublished.forEach((r) => {
      const k = `${normalizeClassIdentifier(r.className)}_${(r.term || '').trim().toLowerCase()}_${(r.session || '').trim().toLowerCase().replace(/session/g, '').trim()}`;
      mergedPublishedMap.set(k, r);
    });
    published.forEach((r) => {
      const k = `${normalizeClassIdentifier(r.className)}_${(r.term || '').trim().toLowerCase()}_${(r.session || '').trim().toLowerCase().replace(/session/g, '').trim()}`;
      mergedPublishedMap.set(k, r);
    });

    const finalPublished = Array.from(mergedPublishedMap.values());

    inMemoryPublished = finalPublished;

    // Overlay any remaining queued offline items so unsynced local edits are never lost
    const overlaid = await overlayPendingOfflineQueueOnData(scores, summaries);
    const finalScores = overlaid.scores;
    const finalSummaries = overlaid.summaries;

    setCachedSchoolData({
      teachers: finalTeachers,
      students: finalStudents,
      subjects: finalSubjects,
      scores: finalScores,
      summaries: finalSummaries,
      published: finalPublished,
      classes: sortedClasses,
      classNames: sortedClassNames,
      gradingScales,
      scoringConfigs: activeScoringConfigs
    });

    return {
      teachers: finalTeachers,
      students: finalStudents,
      subjects: finalSubjects,
      scores: finalScores,
      summaries: finalSummaries,
      published: finalPublished,
      classes: sortedClasses,
      classNames: sortedClassNames,
      gradingScales,
      isLive: true
    };
  } catch (err: any) {
    console.warn('Firebase connection notice:', err);
    const cached = getCachedSchoolData();
    if (cached) {
      const cls = cached.classes || INITIAL_DEFAULT_CLASSES;
      const names = cached.classNames || cls.map(c => c.name);
      const scales = cached.gradingScales || DEFAULT_GENERAL_GRADING_SCALE;
      ALL_SCHOOL_CLASSES.length = 0;
      ALL_SCHOOL_CLASSES.push(...names);
      setActiveGradingScales(scales);

      const overlaidCached = await overlayPendingOfflineQueueOnData(
        cached.scores || [],
        cached.summaries || []
      );

      return {
        teachers: cached.teachers || INITIAL_DEFAULT_TEACHERS,
        students: cached.students || [],
        subjects: cached.subjects || INITIAL_DEFAULT_SUBJECTS,
        scores: overlaidCached.scores,
        summaries: overlaidCached.summaries,
        published: cached.published || [],
        classes: cls,
        classNames: names,
        gradingScales: scales,
        isLive: false,
        error: undefined
      };
    }

    return {
      teachers: INITIAL_DEFAULT_TEACHERS,
      students: [],
      subjects: INITIAL_DEFAULT_SUBJECTS,
      scores: [],
      summaries: [],
      published: [],
      classes: INITIAL_DEFAULT_CLASSES,
      classNames: INITIAL_DEFAULT_CLASSES.map(c => c.name),
      gradingScales: DEFAULT_GENERAL_GRADING_SCALE,
      isLive: false,
      error: 'Offline: Unable to connect to Firebase. Please check your internet connection.'
    };
  }
}

export async function loadAllData(forceFresh = false): ReturnType<typeof loadAllDataUnsafe> {
  const result = await loadAllDataUnsafe(forceFresh);
  const clean = sanitizeSchoolData(result);
  if (clean.classNames.length === 0) {
    clean.classNames = INITIAL_DEFAULT_CLASSES.map((c) => c.name);
    clean.classes = INITIAL_DEFAULT_CLASSES;
  }
  return clean;
}

/**
 * Fetch FRESH single student report data directly from Firebase Firestore in Real Time
 */
export async function fetchFreshStudentData(
  studentId: string,
  session: string,
  term: TermType,
  className?: string
): Promise<{
  scores: SubjectScore[];
  summary: StudentSummary | null;
  isLive: boolean;
}> {
  try {
    const scoresQuery = query(
      collection(db, 'scores'),
      where('StudentID', '==', studentId),
      where('Term', '==', term),
      where('Session', '==', session)
    );
    const scoresSnap = await getDocs(scoresQuery);
    const scores: SubjectScore[] = [];
    scoresSnap.forEach((d) => scores.push(d.data() as SubjectScore));

    const summaryDocRef = doc(db, 'summaries', getSummaryDocId(studentId, session, term));
    const summarySnap = await getDoc(summaryDocRef);
    let summary: StudentSummary | null = null;
    if (summarySnap.exists()) {
      summary = summarySnap.data() as StudentSummary;
    }

    return {
      scores,
      summary,
      isLive: true
    };
  } catch (err: any) {
    console.warn('Fresh fetch from Firebase failed:', err);
    // Robust fallback to cached scores/summary if available
    const cached = getCachedSchoolData();
    const cachedScores = (cached?.scores || []).filter(
      (s) => s.StudentID === studentId && s.Term === term && s.Session === session
    );
    const cachedSummary = (cached?.summaries || []).find(
      (s) => s.StudentID === studentId && s.Term === term && s.Session === session
    ) || null;

    return { scores: cachedScores, summary: cachedSummary, isLive: false };
  }
}

/**
 * Helper: Update local school cache optimistically for a student's report card
 */
function updateLocalCacheForReportCard(
  studentId: string,
  session: string,
  term: TermType,
  mergedScores: Array<{
    Subject: string;
    CA1: number | null;
    CA2: number | null;
    Exam: number | null;
    Total: number | null;
  }>,
  summaryPayload: {
    DaysPresent: number | null;
    DaysOpened: number | null;
    TeacherComment: string;
    PrincipalComment: string;
    AffectiveRatings?: AffectiveRatings;
    PsychomotorRatings?: PsychomotorRatings;
    PromotionDecision?: string;
  }
) {
  try {
    const currentCache = getCachedSchoolData();
    if (!currentCache) return;

    const existingScores = currentCache.scores || [];
    const scoreMap = new Map<string, SubjectScore>();
    existingScores.forEach((s) => {
      const k = `${s.StudentID}_${s.Session}_${s.Term}_${s.Subject}`.toLowerCase();
      scoreMap.set(k, s);
    });

    for (const sc of mergedScores) {
      const subj = String(sc.Subject || '').trim();
      if (!subj) continue;
      const k = `${studentId}_${session}_${term}_${subj}`.toLowerCase();
      const prev = scoreMap.get(k);

      const ca1 = sc.CA1 !== undefined && sc.CA1 !== null ? Number(sc.CA1) : null;
      const ca2 = sc.CA2 !== undefined && sc.CA2 !== null ? Number(sc.CA2) : null;
      const exam = sc.Exam !== undefined && sc.Exam !== null ? Number(sc.Exam) : null;

      // Skip overwriting existing cached score if incoming row is completely blank and had no prior edit
      if (ca1 === null && ca2 === null && exam === null && !prev) {
        continue;
      }

      let total = sc.Total !== undefined && sc.Total !== null ? Number(sc.Total) : null;
      if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
        total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
      }

      scoreMap.set(k, {
        StudentID: studentId,
        Session: session,
        Term: term,
        Subject: subj,
        CA1: ca1,
        CA2: ca2,
        Exam: exam,
        Total: total
      });
    }

    const existingSummaries = currentCache.summaries || [];
    const summaryMap = new Map<string, StudentSummary>();
    existingSummaries.forEach((sm) => {
      const k = `${sm.StudentID}_${sm.Session}_${sm.Term}`.toLowerCase();
      summaryMap.set(k, sm);
    });

    const summKey = `${studentId}_${session}_${term}`.toLowerCase();
    const prevSummary = summaryMap.get(summKey);

    summaryMap.set(summKey, {
      StudentID: studentId,
      Session: session,
      Term: term,
      DaysPresent:
        summaryPayload.DaysPresent !== null && summaryPayload.DaysPresent !== undefined
          ? summaryPayload.DaysPresent
          : (prevSummary?.DaysPresent ?? null),
      DaysOpened:
        summaryPayload.DaysOpened !== null && summaryPayload.DaysOpened !== undefined
          ? summaryPayload.DaysOpened
          : (prevSummary?.DaysOpened ?? null),
      TeacherComment: summaryPayload.TeacherComment || prevSummary?.TeacherComment || '',
      PrincipalComment: summaryPayload.PrincipalComment || prevSummary?.PrincipalComment || '',
      AffectiveRatings: summaryPayload.AffectiveRatings || prevSummary?.AffectiveRatings,
      PsychomotorRatings: summaryPayload.PsychomotorRatings || prevSummary?.PsychomotorRatings,
      PromotionDecision: summaryPayload.PromotionDecision || prevSummary?.PromotionDecision
    });

    setCachedSchoolData({
      ...currentCache,
      scores: Array.from(scoreMap.values()),
      summaries: Array.from(summaryMap.values())
    });
  } catch (cacheErr) {
    console.warn('Failed to sync cache in updateLocalCacheForReportCard:', cacheErr);
  }
}

/**
 * Save report card scores & summary directly to Firebase Firestore in Real Time
 * Includes server-side field-level merging to prevent concurrent device overwrites
 * and an IndexedDB offline queue fallback for intermittent network connections.
 */
export async function saveStudentReportCard(
  payload: {
    studentId: string;
    className?: string;
    session: string;
    term: TermType;
    scores: Array<{
      Subject: string;
      CA1: number | null;
      CA2: number | null;
      Exam: number | null;
      Total: number | null;
      explicitlyCleared?: boolean;
      clearCA1?: boolean;
      clearCA2?: boolean;
      clearExam?: boolean;
    }>;
    summary: {
      DaysPresent: number | null;
      DaysOpened: number | null;
      TeacherComment: string;
      PrincipalComment: string;
      AffectiveRatings?: AffectiveRatings;
      PsychomotorRatings?: PsychomotorRatings;
      PromotionDecision?: string;
    };
    affectiveRatings?: AffectiveRatings;
    psychomotorRatings?: PsychomotorRatings;
    promotionDecision?: string;
  },
  options?: { fromOfflineQueue?: boolean }
): Promise<{ success: boolean; message: string; queuedOffline?: boolean }> {
  // Capture baseline cached scores BEFORE updating cache so we can distinguish
  // "field was already null when user opened screen" vs "user intentionally cleared a number"
  const priorCache = getCachedSchoolData();
  const priorStudentScoreMap = new Map<string, SubjectScore>();
  (priorCache?.scores || []).forEach((s) => {
    if (
      s.StudentID.toLowerCase() === payload.studentId.toLowerCase() &&
      s.Session === payload.session &&
      s.Term === payload.term
    ) {
      priorStudentScoreMap.set(s.Subject.trim().toLowerCase(), s);
    }
  });

  // Stamp explicit field-clear flags at save time so offline replays preserve exact intent
  const annotatedScores = payload.scores.map((sc) => {
    const subjKey = String(sc.Subject || '').trim().toLowerCase();
    const priorLocal = priorStudentScoreMap.get(subjKey);
    const incomingCA1 = sc.CA1 !== undefined && sc.CA1 !== null ? Number(sc.CA1) : null;
    const incomingCA2 = sc.CA2 !== undefined && sc.CA2 !== null ? Number(sc.CA2) : null;
    const incomingExam = sc.Exam !== undefined && sc.Exam !== null ? Number(sc.Exam) : null;

    return {
      ...sc,
      CA1: incomingCA1,
      CA2: incomingCA2,
      Exam: incomingExam,
      clearCA1: Boolean(
        sc.clearCA1 ||
          sc.explicitlyCleared ||
          (!options?.fromOfflineQueue &&
            incomingCA1 === null &&
            priorLocal?.CA1 !== null &&
            priorLocal?.CA1 !== undefined)
      ),
      clearCA2: Boolean(
        sc.clearCA2 ||
          sc.explicitlyCleared ||
          (!options?.fromOfflineQueue &&
            incomingCA2 === null &&
            priorLocal?.CA2 !== null &&
            priorLocal?.CA2 !== undefined)
      ),
      clearExam: Boolean(
        sc.clearExam ||
          sc.explicitlyCleared ||
          (!options?.fromOfflineQueue &&
            incomingExam === null &&
            priorLocal?.Exam !== null &&
            priorLocal?.Exam !== undefined)
      )
    };
  });

  const enrichedPayload = {
    ...payload,
    scores: annotatedScores
  };

  const normalizedSummary = {
    DaysPresent: payload.summary.DaysPresent,
    DaysOpened: payload.summary.DaysOpened,
    TeacherComment: payload.summary.TeacherComment || '',
    PrincipalComment: payload.summary.PrincipalComment || '',
    AffectiveRatings: payload.summary.AffectiveRatings || payload.affectiveRatings,
    PsychomotorRatings: payload.summary.PsychomotorRatings || payload.psychomotorRatings,
    PromotionDecision: payload.summary.PromotionDecision || payload.promotionDecision
  };

  // If browser is offline, immediately persist to local cache + IndexedDB Offline Queue
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    updateLocalCacheForReportCard(
      payload.studentId,
      payload.session,
      payload.term,
      annotatedScores,
      normalizedSummary
    );
    if (!options?.fromOfflineQueue) {
      const dedupeKey = `SAVE_REPORT_CARD__${getScoreDocId(payload.studentId, payload.session, payload.term, 'ALL')}`;
      await enqueueOfflineOperation(
        'SAVE_REPORT_CARD',
        enrichedPayload,
        `Report card for ${payload.studentId} (${payload.term}, ${payload.session})`,
        dedupeKey
      );
    }
    return {
      success: true,
      queuedOffline: true,
      message: 'Offline mode: Scores saved to local device queue and will auto-sync when internet returns!'
    };
  }

  try {
    // 1. Fetch latest server state for this student's scores & summary (with short timeout guard)
    // so concurrent edits from another teacher/admin device are merged at the field level
    const serverScoreMap = new Map<string, SubjectScore>();
    let serverSummary: StudentSummary | null = null;

    try {
      const scoresQuery = query(
        collection(db, 'scores'),
        where('StudentID', '==', payload.studentId),
        where('Term', '==', payload.term),
        where('Session', '==', payload.session)
      );
      const summaryRefForRead = doc(
        db,
        'summaries',
        getSummaryDocId(payload.studentId, payload.session, payload.term)
      );

      const [scoresSnap, summarySnap] = await Promise.race([
        Promise.all([getDocs(scoresQuery), getDoc(summaryRefForRead)]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Server read timeout')), 6000)
        )
      ]);

      scoresSnap.forEach((d) => {
        const data = d.data() as SubjectScore;
        if (data.Subject) {
          serverScoreMap.set(data.Subject.trim().toLowerCase(), data);
        }
      });
      if (summarySnap.exists()) {
        serverSummary = summarySnap.data() as StudentSummary;
      }
    } catch (readError) {
      // Do not continue with a partial merge after a failed authoritative read.
      // Continuing could overwrite scores or summaries changed by another device.
      return {
        success: false,
        message:
          readError instanceof Error && readError.message === 'Server read timeout'
            ? 'The server took too long to load the latest report. Nothing was overwritten; please try again.'
            : 'Could not load the latest report before saving. Nothing was overwritten; please try again.'
      };
    }

    const batch = writeBatch(db);
    const mergedScoresForCache: Array<{
      Subject: string;
      CA1: number | null;
      CA2: number | null;
      Exam: number | null;
      Total: number | null;
    }> = [];

    // 2. Save individual subject score docs using field-level merging
    for (const sc of annotatedScores) {
      const subj = String(sc.Subject || '').trim();
      if (!subj) continue;
      const subjKey = subj.toLowerCase();

      const incomingCA1 = sc.CA1;
      const incomingCA2 = sc.CA2;
      const incomingExam = sc.Exam;

      const serverExisting = serverScoreMap.get(subjKey);

      const mergedCA1 =
        incomingCA1 !== null
          ? incomingCA1
          : sc.clearCA1
          ? null
          : (serverExisting?.CA1 ?? null);
      const mergedCA2 =
        incomingCA2 !== null
          ? incomingCA2
          : sc.clearCA2
          ? null
          : (serverExisting?.CA2 ?? null);
      const mergedExam =
        incomingExam !== null
          ? incomingExam
          : sc.clearExam
          ? null
          : (serverExisting?.Exam ?? null);

      // If all fields are null and nothing existed on the server or was cleared, skip writing empty doc
      if (
        mergedCA1 === null &&
        mergedCA2 === null &&
        mergedExam === null &&
        !serverExisting &&
        !sc.explicitlyCleared &&
        !sc.clearCA1 &&
        !sc.clearCA2 &&
        !sc.clearExam
      ) {
        continue;
      }

      const mergedTotal =
        mergedCA1 !== null || mergedCA2 !== null || mergedExam !== null
          ? (mergedCA1 || 0) + (mergedCA2 || 0) + (mergedExam || 0)
          : null;

      mergedScoresForCache.push({
        Subject: subj,
        CA1: mergedCA1,
        CA2: mergedCA2,
        Exam: mergedExam,
        Total: mergedTotal
      });

      const scoreDocId = getScoreDocId(payload.studentId, payload.session, payload.term, subj);
      const scoreRef = doc(db, 'scores', scoreDocId);

      batch.set(
        scoreRef,
        {
          StudentID: payload.studentId,
          Session: payload.session,
          Term: payload.term,
          Subject: subj,
          CA1: mergedCA1,
          CA2: mergedCA2,
          Exam: mergedExam,
          Total: mergedTotal,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    // 3. Save summary doc with field-level merging so concurrent attendance/principal remarks aren't wiped
    const summaryDocId = getSummaryDocId(payload.studentId, payload.session, payload.term);
    const summaryRef = doc(db, 'summaries', summaryDocId);

    const mergedDaysPresent =
      payload.summary.DaysPresent !== null && payload.summary.DaysPresent !== undefined
        ? payload.summary.DaysPresent
        : (serverSummary?.DaysPresent ?? null);
    const mergedDaysOpened =
      payload.summary.DaysOpened !== null && payload.summary.DaysOpened !== undefined
        ? payload.summary.DaysOpened
        : (serverSummary?.DaysOpened ?? null);
    const mergedTeacherComment =
      (payload.summary.TeacherComment && payload.summary.TeacherComment.trim()) ||
      serverSummary?.TeacherComment ||
      '';
    const mergedPrincipalComment =
      (payload.summary.PrincipalComment && payload.summary.PrincipalComment.trim()) ||
      serverSummary?.PrincipalComment ||
      '';

    const summaryDataToSave: Record<string, any> = {
      StudentID: payload.studentId,
      Session: payload.session,
      Term: payload.term,
      DaysPresent: mergedDaysPresent,
      DaysOpened: mergedDaysOpened,
      TeacherComment: mergedTeacherComment,
      PrincipalComment: mergedPrincipalComment,
      UpdatedAt: new Date().toISOString()
    };

    if (normalizedSummary.AffectiveRatings || serverSummary?.AffectiveRatings) {
      summaryDataToSave.AffectiveRatings = {
        ...(serverSummary?.AffectiveRatings || {}),
        ...(normalizedSummary.AffectiveRatings || {})
      };
    }
    if (normalizedSummary.PsychomotorRatings || serverSummary?.PsychomotorRatings) {
      summaryDataToSave.PsychomotorRatings = {
        ...(serverSummary?.PsychomotorRatings || {}),
        ...(normalizedSummary.PsychomotorRatings || {})
      };
    }
    if (normalizedSummary.PromotionDecision || serverSummary?.PromotionDecision) {
      summaryDataToSave.PromotionDecision =
        normalizedSummary.PromotionDecision || serverSummary?.PromotionDecision;
    }

    batch.set(summaryRef, summaryDataToSave, { merge: true });

    // Commit with timeout guard so poor connectivity falls back to offline queue instead of hanging
    await Promise.race([
      batch.commit(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Network write timed out')), 12000)
      )
    ]);

    updateLocalCacheForReportCard(
      payload.studentId,
      payload.session,
      payload.term,
      mergedScoresForCache.length > 0 ? mergedScoresForCache : payload.scores,
      {
        DaysPresent: mergedDaysPresent,
        DaysOpened: mergedDaysOpened,
        TeacherComment: mergedTeacherComment,
        PrincipalComment: mergedPrincipalComment,
        AffectiveRatings: summaryDataToSave.AffectiveRatings,
        PsychomotorRatings: summaryDataToSave.PsychomotorRatings,
        PromotionDecision: summaryDataToSave.PromotionDecision
      }
    );

    return {
      success: true,
      message: 'Scores and remarks merged and saved to Firebase Firestore in real time!'
    };
  } catch (err: any) {
    console.warn('Firestore write interrupted, queueing report card to IndexedDB offline queue:', err);

    // Optimistically update local cache and enqueue in IndexedDB so teacher never loses data
    updateLocalCacheForReportCard(
      payload.studentId,
      payload.session,
      payload.term,
      payload.scores,
      normalizedSummary
    );

    if (!options?.fromOfflineQueue) {
      const dedupeKey = `SAVE_REPORT_CARD__${getScoreDocId(payload.studentId, payload.session, payload.term, 'ALL')}`;
      await enqueueOfflineOperation(
        'SAVE_REPORT_CARD',
        enrichedPayload,
        `Report card for ${payload.studentId} (${payload.term}, ${payload.session})`,
        dedupeKey
      );
      return {
        success: true,
        queuedOffline: true,
        message: 'Network unstable: Scores saved to local Offline Queue and will auto-sync when connection stabilizes!'
      };
    }

    return {
      success: false,
      message: `Failed to save to Firebase: ${err.message || 'Database write error'}`
    };
  }
}

/**
 * Delete a student's report card (scores + summary) for a specific Term & Session
 */
export async function deleteStudentReportCard(payload: {
  studentId: string;
  className?: string;
  session: string;
  term: TermType;
}): Promise<{ success: boolean; message: string }> {
  try {
    const scoresQuery = query(
      collection(db, 'scores'),
      where('StudentID', '==', payload.studentId),
      where('Term', '==', payload.term),
      where('Session', '==', payload.session)
    );
    const scoresSnap = await getDocs(scoresQuery);

    const batch = writeBatch(db);
    scoresSnap.forEach((d) => {
      batch.delete(d.ref);
    });

    const summaryDocId = getSummaryDocId(payload.studentId, payload.session, payload.term);
    batch.delete(doc(db, 'summaries', summaryDocId));

    await batch.commit();

    return {
      success: true,
      message: 'Report card scores and remarks successfully deleted from Firebase.'
    };
  } catch (err: any) {
    console.error('Failed to delete report card from Firebase:', err);
    return {
      success: false,
      message: `Failed to delete from Firebase: ${err.message || 'Network error'}`
    };
  }
}

/**
 * Add or update a student with comprehensive profile fields in Firebase Firestore
 */
export async function saveStudent(student: {
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
  PhotoURL?: string;
  PassportUrl?: string;
}): Promise<{ success: boolean; message: string; student: Student }> {
  try {
    const studentDocId = getStudentDocId(student.StudentID);
    const docRef = doc(db, 'students', studentDocId);

    const existingSnap = await getDoc(docRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as Student) : null;

    const photo =
      (student.PhotoURL && student.PhotoURL.trim()) ||
      (student.PassportUrl && student.PassportUrl.trim()) ||
      (student as any)?.photoUrl ||
      existing?.PhotoURL ||
      existing?.PassportUrl ||
      (existing as any)?.photoUrl ||
      safeStorage.getItem(`student_photo_${studentDocId}`) ||
      '';

    if (photo) {
      try {
        safeStorage.setItem(`student_photo_${studentDocId}`, photo);
      } catch {}
    }

    const studentRecord: Student = {
      StudentID: student.StudentID.trim().toUpperCase(),
      FullName: student.FullName.trim(),
      Class: student.Class.trim(),
      Gender: student.Gender || existing?.Gender || 'Male',
      DOB: student.DOB !== undefined ? student.DOB.trim() : existing?.DOB || '',
      ParentName: student.ParentName !== undefined ? student.ParentName.trim() : existing?.ParentName || '',
      ParentPhone: student.ParentPhone !== undefined ? student.ParentPhone.trim() : existing?.ParentPhone || '',
      Address: student.Address !== undefined ? student.Address.trim() : existing?.Address || '',
      GuardianEmail: student.GuardianEmail !== undefined ? student.GuardianEmail.trim() : existing?.GuardianEmail || '',
      Password: student.Password !== undefined && student.Password.trim() ? student.Password.trim() : existing?.Password || 'password',
      PhotoURL: photo,
      PassportUrl: photo,
      UpdatedAt: new Date().toISOString(),
      CreatedAt: existing?.CreatedAt || new Date().toISOString()
    };

    await setDoc(docRef, studentRecord, { merge: true });

    // Update active student session if this student is currently logged in
    try {
      const activeStudentAuth = safeSessionStorage.getItem('school_portal_student_auth');
      if (activeStudentAuth) {
        const parsed = JSON.parse(activeStudentAuth);
        if (parsed && (parsed.StudentID || '').toUpperCase().trim() === studentRecord.StudentID) {
          safeSessionStorage.setItem(
            'school_portal_student_auth',
            JSON.stringify({ ...parsed, ...studentRecord })
          );
        }
      }
    } catch {}

    // Synchronize local cached school data
    const cached = getCachedSchoolData();
    if (cached && cached.students) {
      const updatedStudents = cached.students.map((s) =>
        s.StudentID.toUpperCase().trim() === studentRecord.StudentID ? { ...s, ...studentRecord } : s
      );
      if (!updatedStudents.some((s) => s.StudentID.toUpperCase().trim() === studentRecord.StudentID)) {
        updatedStudents.push(studentRecord);
      }
      setCachedSchoolData({ ...cached, students: updatedStudents });
    }

    return {
      success: true,
      message: `Student ${studentRecord.FullName} (${studentRecord.StudentID}) profile saved successfully in Firebase!`,
      student: studentRecord
    };
  } catch (err: any) {
    console.error('Failed to save student in Firebase:', err);
    return {
      success: false,
      message: `Failed to save student: ${err.message || 'Firebase error'}`,
      student: {
        StudentID: student.StudentID,
        FullName: student.FullName,
        Class: student.Class
      }
    };
  }
}

/**
 * Update student profile and handle StudentID / Username changes with full migration of scores and summaries
 */
export async function updateStudentProfileAndIdentifier(
  originalStudentId: string,
  updatedData: {
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
    PhotoURL?: string;
    PassportUrl?: string;
  }
): Promise<{ success: boolean; message: string; student: Student; migratedScoresCount?: number }> {
  try {
    const oldId = originalStudentId.trim().toUpperCase();
    const newId = updatedData.StudentID.trim().toUpperCase();

    if (!oldId || !newId) {
      return {
        success: false,
        message: 'Original Student ID and New Student ID are required.',
        student: {
          StudentID: newId || oldId,
          FullName: updatedData.FullName,
          Class: updatedData.Class
        }
      };
    }

    // If ID hasn't changed, simple save
    if (oldId === newId) {
      const res = await saveStudent(updatedData);
      return {
        success: res.success,
        message: res.message,
        student: res.student,
        migratedScoresCount: 0
      };
    }

    // If ID is changing, check if new ID already exists
    const newDocRef = doc(db, 'students', getStudentDocId(newId));
    const newSnap = await getDoc(newDocRef);
    if (newSnap.exists() && String(newSnap.data()?.StudentID ?? '').trim() !== '') {
      return {
        success: false,
        message: `Student ID "${newId}" is already assigned to another student in the system.`,
        student: {
          StudentID: oldId,
          FullName: updatedData.FullName,
          Class: updatedData.Class
        }
      };
    }

    // Fetch old student doc
    const oldDocRef = doc(db, 'students', getStudentDocId(oldId));
    const oldSnap = await getDoc(oldDocRef);
    const existingOldData = oldSnap.exists() ? (oldSnap.data() as Student) : null;

    const oldStudentDocId = getStudentDocId(oldId);
    const newStudentDocId = getStudentDocId(newId);
    const photo =
      (updatedData.PhotoURL && updatedData.PhotoURL.trim()) ||
      (updatedData.PassportUrl && updatedData.PassportUrl.trim()) ||
      (updatedData as any)?.photoUrl ||
      existingOldData?.PhotoURL ||
      existingOldData?.PassportUrl ||
      (existingOldData as any)?.photoUrl ||
      safeStorage.getItem(`student_photo_${oldStudentDocId}`) ||
      '';

    if (photo) {
      try {
        safeStorage.setItem(`student_photo_${newStudentDocId}`, photo);
        if (oldStudentDocId !== newStudentDocId) {
          safeStorage.removeItem(`student_photo_${oldStudentDocId}`);
        }
      } catch {}
    }

    const newStudentRecord: Student = {
      StudentID: newId,
      FullName: updatedData.FullName.trim(),
      Class: updatedData.Class.trim(),
      Gender: updatedData.Gender || existingOldData?.Gender || 'Male',
      DOB: updatedData.DOB !== undefined ? updatedData.DOB.trim() : existingOldData?.DOB || '',
      ParentName: updatedData.ParentName !== undefined ? updatedData.ParentName.trim() : existingOldData?.ParentName || '',
      ParentPhone: updatedData.ParentPhone !== undefined ? updatedData.ParentPhone.trim() : existingOldData?.ParentPhone || '',
      Address: updatedData.Address !== undefined ? updatedData.Address.trim() : existingOldData?.Address || '',
      GuardianEmail: updatedData.GuardianEmail !== undefined ? updatedData.GuardianEmail.trim() : existingOldData?.GuardianEmail || '',
      Password: updatedData.Password !== undefined && updatedData.Password.trim() ? updatedData.Password.trim() : existingOldData?.Password || 'password',
      PhotoURL: photo,
      PassportUrl: photo,
      UpdatedAt: new Date().toISOString(),
      CreatedAt: existingOldData?.CreatedAt || new Date().toISOString()
    };

    // Query all scores for old StudentID
    const scoresQuery = query(collection(db, 'scores'), where('StudentID', '==', oldId));
    const scoresSnap = await getDocs(scoresQuery);

    // Query all summaries for old StudentID
    const summariesQuery = query(collection(db, 'summaries'), where('StudentID', '==', oldId));
    const summariesSnap = await getDocs(summariesQuery);

    const batch = writeBatch(db);

    // 1. Set new student doc
    batch.set(newDocRef, newStudentRecord);

    // 2. Delete old student doc
    if (oldSnap.exists()) {
      batch.delete(oldDocRef);
    }

    // 3. Migrate scores
    let migratedScores = 0;
    scoresSnap.forEach((scoreDoc) => {
      const sc = scoreDoc.data() as SubjectScore;
      const newScoreDocId = getScoreDocId(newId, sc.Session, sc.Term, sc.Subject);
      const newScoreRef = doc(db, 'scores', newScoreDocId);
      batch.set(newScoreRef, {
        ...sc,
        StudentID: newId,
        UpdatedAt: new Date().toISOString()
      });
      batch.delete(scoreDoc.ref);
      migratedScores++;
    });

    // 4. Migrate summaries
    let migratedSummaries = 0;
    summariesSnap.forEach((sumDoc) => {
      const sum = sumDoc.data() as StudentSummary;
      const newSummaryDocId = getSummaryDocId(newId, sum.Session, sum.Term);
      const newSummaryRef = doc(db, 'summaries', newSummaryDocId);
      batch.set(newSummaryRef, {
        ...sum,
        StudentID: newId,
        UpdatedAt: new Date().toISOString()
      });
      batch.delete(sumDoc.ref);
      migratedSummaries++;
    });

    await batch.commit();

    return {
      success: true,
      message: `Pupil ID changed from "${oldId}" to "${newId}". Successfully migrated ${migratedScores} assessment score records and ${migratedSummaries} term summaries!`,
      student: newStudentRecord,
      migratedScoresCount: migratedScores
    };
  } catch (err: any) {
    console.error('Failed to update student profile and identifier:', err);
    return {
      success: false,
      message: `Failed to update pupil identifier: ${err.message || 'Firebase error'}`,
      student: {
        StudentID: updatedData.StudentID,
        FullName: updatedData.FullName,
        Class: updatedData.Class
      }
    };
  }
}

/**
 * Promote or Transfer a batch of students from one class to another
 */
export async function promoteClassStudents(
  sourceClass: string,
  targetClass: string,
  selectedStudentIds?: string[]
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const stSnap = await getDocs(collection(db, 'students'));
    const batch = writeBatch(db);
    let count = 0;

    stSnap.forEach((docSnap) => {
      const data = docSnap.data() as Student;
      const matchesClass = isMatchingClass(data.Class, sourceClass);
      const isSelected = !selectedStudentIds || selectedStudentIds.length === 0 || selectedStudentIds.includes(data.StudentID);

      if (matchesClass && isSelected) {
        batch.update(docSnap.ref, {
          Class: targetClass,
          UpdatedAt: new Date().toISOString()
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Successfully moved/promoted ${count} pupil(s) from ${sourceClass} to ${targetClass}!`,
      count
    };
  } catch (err: any) {
    console.error('Failed to promote students:', err);
    return {
      success: false,
      message: `Class promotion error: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Reset all staff/teacher passwords in one click
 */
export async function resetAllStaffPasswords(
  newPassword = 'password123'
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const tSnap = await getDocs(collection(db, 'teachers'));
    const batch = writeBatch(db);
    let count = 0;

    tSnap.forEach((docSnap) => {
      const data = docSnap.data() as Teacher;
      if (data.Role !== 'admin') {
        batch.update(docSnap.ref, { Password: newPassword });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Reset passwords for ${count} staff teachers to "${newPassword}".`,
      count
    };
  } catch (err: any) {
    console.error('Failed to reset staff passwords:', err);
    return {
      success: false,
      message: `Staff password reset error: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Add a new student to Firebase Firestore (legacy wrapper)
 */
export async function addStudent(student: {
  studentId?: string;
  StudentID?: string;
  fullName?: string;
  FullName?: string;
  className?: string;
  Class?: string;
  gender?: 'Male' | 'Female' | string;
  Gender?: 'Male' | 'Female' | string;
  dob?: string;
  DOB?: string;
  parentName?: string;
  ParentName?: string;
  parentPhone?: string;
  ParentPhone?: string;
  address?: string;
  Address?: string;
  password?: string;
  Password?: string;
  photoUrl?: string;
  PhotoURL?: string;
  passportUrl?: string;
  PassportUrl?: string;
}): Promise<{ success: boolean; message: string }> {
  const sId = student.StudentID || student.studentId || '';
  const sName = student.FullName || student.fullName || '';
  const sClass = student.Class || student.className || 'Primary 1';
  const sGender = student.Gender || student.gender || 'Male';
  const sPhoto = student.PhotoURL || student.photoUrl || student.PassportUrl || student.passportUrl || '';

  const res = await saveStudent({
    StudentID: sId,
    FullName: sName,
    Class: sClass,
    Gender: sGender,
    DOB: student.DOB || student.dob,
    ParentName: student.ParentName || student.parentName,
    ParentPhone: student.ParentPhone || student.parentPhone,
    Address: student.Address || student.address,
    Password: student.Password || student.password,
    PhotoURL: sPhoto,
    PassportUrl: sPhoto
  });

  return { success: res.success, message: res.message };
}

/**
 * Bulk upload students from Sheet / CSV into Firebase Firestore
 */
export async function bulkUploadStudents(
  students: Student[]
): Promise<{ success: boolean; count: number; message: string; errors?: string[] }> {
  try {
    if (!students || students.length === 0) {
      return { success: false, count: 0, message: 'No student records provided for upload.' };
    }

    // Firestore batch limit is 500 writes
    const CHUNK_SIZE = 400;
    let totalImported = 0;

    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const chunk = students.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const st of chunk) {
        const cleanId = String(st.StudentID || '').trim().toUpperCase();
        const cleanName = String(st.FullName || '').trim();
        const cleanClass = String(st.Class || '').trim();

        if (!cleanId || !cleanName || !cleanClass) continue;

        const docId = getStudentDocId(cleanId);
        const docRef = doc(db, 'students', docId);

        const record: Student = {
          StudentID: cleanId,
          FullName: cleanName,
          Class: cleanClass,
          Gender: st.Gender || 'Male',
          DOB: st.DOB || '',
          ParentName: st.ParentName || '',
          ParentPhone: st.ParentPhone || '',
          Address: st.Address || '',
          GuardianEmail: st.GuardianEmail || '',
          Password: st.Password || 'password',
          UpdatedAt: new Date().toISOString(),
          CreatedAt: st.CreatedAt || new Date().toISOString()
        };

        batch.set(docRef, record, { merge: true });
        totalImported++;
      }

      await batch.commit();
    }

    return {
      success: true,
      count: totalImported,
      message: `Successfully uploaded and synced ${totalImported} students to Firebase Firestore!`
    };
  } catch (err: any) {
    console.error('Failed to bulk upload students to Firebase:', err);
    return {
      success: false,
      count: 0,
      message: `Bulk upload error: ${err.message || 'Database write error'}`
    };
  }
}

/**
 * Build a complete backup from every portal collection and settings document.
 * This keeps credentials, classes, attendance, website configuration, grading rules,
 * scoring configurations, and future settings additions in the backup.
 */
export async function exportSchoolBackup(): Promise<Record<string, any>> {
  const [classesSnap, teachersSnap, studentsSnap, subjectsSnap, scoresSnap, summariesSnap, publishedSnap, attendanceSnap, settingsSnap] = await Promise.all([
    getDocs(collection(db, 'classes')),
    getDocs(collection(db, 'teachers')),
    getDocs(collection(db, 'students')),
    getDocs(collection(db, 'subjects')),
    getDocs(collection(db, 'scores')),
    getDocs(collection(db, 'summaries')),
    getDocs(collection(db, 'published')),
    getDocs(collection(db, 'attendance')),
    getDocs(collection(db, 'settings'))
  ]);

  const readCollection = (snapshot: any) => snapshot.docs.map((item: any) => ({
    id: item.id,
    ...item.data()
  }));

  return {
    version: '3.0',
    exportedAt: new Date().toISOString(),
    teachers: readCollection(teachersSnap),
    students: readCollection(studentsSnap),
    subjects: readCollection(subjectsSnap),
    scores: readCollection(scoresSnap),
    summaries: readCollection(summariesSnap),
    published: readCollection(publishedSnap),
    classes: readCollection(classesSnap),
    attendance: readCollection(attendanceSnap),
    settings: settingsSnap.docs.map((item: any) => ({ id: item.id, data: item.data() }))
  };
}

/**
 * Restore complete school database from a JSON backup file
 */
export async function restoreSchoolBackup(backupData: {
  teachers?: Teacher[];
  students?: Student[];
  subjects?: SubjectRule[];
  scores?: SubjectScore[];
  summaries?: StudentSummary[];
  published?: PublishedRecord[];
  [key: string]: any;
}): Promise<{ success: boolean; message: string; stats: Record<string, number> }> {
  try {
    const stats: Record<string, number> = {
      teachers: 0,
      students: 0,
      subjects: 0,
      scores: 0,
      summaries: 0,
      published: 0,
      classes: 0,
      attendance: 0,
      settings: 0
    };

    // Normalize keys in case of variant exports
    const rawTeachers: Teacher[] =
      backupData.teachers || (backupData as any).teachersList || [];
    const rawStudents: Student[] =
      backupData.students || (backupData as any).studentsList || (backupData as any).pupils || [];
    const rawSubjects: SubjectRule[] =
      backupData.subjects || (backupData as any).subjectsList || [];
    const rawScores: SubjectScore[] =
      backupData.scores || (backupData as any).allScores || (backupData as any).scoresList || [];
    const rawSummaries: StudentSummary[] =
      backupData.summaries || (backupData as any).allSummaries || (backupData as any).summariesList || [];
    const rawPublished: PublishedRecord[] =
      backupData.published || (backupData as any).publishedRecords || [];
    const rawClasses = Array.isArray((backupData as any).classes) ? (backupData as any).classes : [];
    const rawAttendance = Array.isArray((backupData as any).attendance) ? (backupData as any).attendance : [];
    const rawSettings = Array.isArray((backupData as any).settings) ? [...(backupData as any).settings] : [];
    if ((backupData as any).websiteConfig && typeof (backupData as any).websiteConfig === 'object') {
      rawSettings.push({ id: 'website_config', data: (backupData as any).websiteConfig });
    }

    // Restore classes, attendance, and every settings document before primary records.
    for (const item of rawClasses) {
      const id = String(item.id || item.name || '').trim();
      if (!id) continue;
      await setDoc(doc(db, 'classes', id), cleanFirestorePayload({ ...item, id }), { merge: true });
      stats.classes++;
    }
    for (const item of rawAttendance) {
      const id = String(item.id || `${item.className || 'class'}_${item.date || Date.now()}`).trim();
      if (!id) continue;
      await setDoc(doc(db, 'attendance', id), cleanFirestorePayload({ ...item, id }), { merge: true });
      stats.attendance++;
    }
    for (const item of rawSettings) {
      const id = String(item.id || '').trim();
      if (!id) continue;
      const data = item.data && typeof item.data === 'object' ? item.data : item;
      await setDoc(doc(db, 'settings', id), cleanFirestorePayload(data), { merge: true });
      stats.settings++;
    }

    // Restore Teachers
    if (rawTeachers && rawTeachers.length > 0) {
      const batch = writeBatch(db);
      for (const t of rawTeachers) {
        if (!t.Username) continue;
        const docRef = doc(db, 'teachers', getTeacherDocId(t.Username));
        batch.set(docRef, cleanFirestorePayload(t), { merge: true });
        stats.teachers++;
      }
      await batch.commit();
    }

    // Restore Students
    if (rawStudents && rawStudents.length > 0) {
      await bulkUploadStudents(rawStudents);
      stats.students = rawStudents.length;
    }

    // Restore Subjects
    if (rawSubjects && rawSubjects.length > 0) {
      const batch = writeBatch(db);
      for (const sub of rawSubjects) {
        if (!sub.SubjectName || !sub.Level) continue;
        const docId = sub.id || `${sub.Level}_${sub.Class ? sub.Class + '_' : ''}${sub.SubjectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const docRef = doc(db, 'subjects', docId);
        const subData: Record<string, any> = {
          id: docId,
          SubjectName: sub.SubjectName.trim(),
          Level: sub.Level.trim()
        };
        if (sub.Class && sub.Class.trim()) {
          subData.Class = sub.Class.trim();
        }
        batch.set(docRef, cleanFirestorePayload(subData), { merge: true });
        stats.subjects++;
      }
      await batch.commit();
    }

    // Restore Scores
    if (rawScores && rawScores.length > 0) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < rawScores.length; i += CHUNK_SIZE) {
        const chunk = rawScores.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const sc of chunk) {
          if (!sc.StudentID || !sc.Subject || !sc.Term || !sc.Session) continue;
          const docId = getScoreDocId(sc.StudentID, sc.Session, sc.Term, sc.Subject);
          const docRef = doc(db, 'scores', docId);
          batch.set(docRef, cleanFirestorePayload(sc), { merge: true });
          stats.scores++;
        }
        await batch.commit();
      }
    }

    // Restore Summaries
    if (rawSummaries && rawSummaries.length > 0) {
      const batch = writeBatch(db);
      for (const sum of rawSummaries) {
        if (!sum.StudentID || !sum.Term || !sum.Session) continue;
        const docId = getSummaryDocId(sum.StudentID, sum.Session, sum.Term);
        const docRef = doc(db, 'summaries', docId);
        batch.set(docRef, cleanFirestorePayload(sum), { merge: true });
        stats.summaries++;
      }
      await batch.commit();
    }

    // Restore Published Records
    if (rawPublished && rawPublished.length > 0) {
      const batch = writeBatch(db);
      for (const pub of rawPublished) {
        if (!pub.className || !pub.term || !pub.session) continue;
        const docId = getPublishDocId(pub.className, pub.session, pub.term);
        const docRef = doc(db, 'published', docId);
        batch.set(docRef, cleanFirestorePayload(pub), { merge: true });
        stats.published++;
      }
      await batch.commit();
    }

    // Immediately sync local safeStorage cache with restored dataset
    if (rawStudents.length > 0) {
      safeStorage.setItem('school_coll_students', JSON.stringify(rawStudents.map((s) => ({
        collection: 'students',
        doc_id: getStudentDocId(s.StudentID),
        data: s
      }))));
    }
    if (rawScores.length > 0) {
      safeStorage.setItem('school_coll_scores', JSON.stringify(rawScores.map((sc) => ({
        collection: 'scores',
        doc_id: getScoreDocId(sc.StudentID, sc.Session, sc.Term, sc.Subject),
        data: sc
      }))));
    }
    if (rawSummaries.length > 0) {
      safeStorage.setItem('school_coll_summaries', JSON.stringify(rawSummaries.map((sm) => ({
        collection: 'summaries',
        doc_id: getSummaryDocId(sm.StudentID, sm.Session, sm.Term),
        data: sm
      }))));
    }

    return {
      success: true,
      message: `Database successfully restored and synchronized! Restored: ${stats.students} students, ${stats.scores} scores, ${stats.summaries} summaries, ${stats.teachers} staff.`,
      stats
    };
  } catch (err: any) {
    console.error('Restore error:', err);
    return {
      success: false,
      message: `Database restore failed: ${err.message || 'Firebase write error'}`,
      stats: {}
    };
  }
}

/**
 * Delete a student from Firebase Firestore
 */
export async function deleteStudent(studentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const studentDocId = getStudentDocId(studentId);
    await deleteDoc(doc(db, 'students', studentDocId));

    // Also delete any associated scores and summaries
    const scoresQuery = query(collection(db, 'scores'), where('StudentID', '==', studentId));
    const scoresSnap = await getDocs(scoresQuery);

    const batch = writeBatch(db);
    scoresSnap.forEach((d) => batch.delete(d.ref));

    const summariesQuery = query(collection(db, 'summaries'), where('StudentID', '==', studentId));
    const summariesSnap = await getDocs(summariesQuery);
    summariesSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();

    return {
      success: true,
      message: `Student ${studentId} and all associated records deleted from Firebase.`
    };
  } catch (err: any) {
    console.error('Failed to delete student from Firebase:', err);
    return {
      success: false,
      message: `Failed to delete student: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Publish / Unpublish a class result in Real-Time to Firebase Firestore
 */
export async function setClassPublishStatus(
  className: string,
  term: TermType,
  session: string,
  isPublished: boolean,
  publishedBy: string = 'Staff',
  options?: {
    status?: 'draft' | 'pending_approval' | 'approved';
    teacherSubmitted?: boolean;
    teacherSubmittedBy?: string;
    adminApproved?: boolean;
    adminApprovedBy?: string;
  }
): Promise<{ success: boolean; isPublished: boolean; message: string; record?: PublishedRecord }> {
  const publishDocId = getPublishDocId(className, session, term);
  const docRef = doc(db, 'published', publishDocId);

  const status = options?.status || (isPublished ? 'approved' : 'draft');
  const now = new Date().toISOString();

  // Firestore-safe clean payload (strip all undefined fields so Firestore setDoc never rejects)
  const firestoreRecord: Record<string, any> = {
    classKey: `${className}_${term}_${session}`,
    className,
    term,
    session,
    isPublished: Boolean(isPublished),
    publishedBy,
    status,
    teacherSubmitted: options?.teacherSubmitted !== undefined ? Boolean(options.teacherSubmitted) : Boolean(isPublished),
    adminApproved: options?.adminApproved !== undefined ? Boolean(options.adminApproved) : Boolean(isPublished),
    updatedAt: now
  };

  if (isPublished) {
    firestoreRecord.publishedAt = now;
    firestoreRecord.teacherSubmittedAt = now;
    firestoreRecord.teacherSubmittedBy = options?.teacherSubmittedBy || publishedBy;
    firestoreRecord.adminApprovedAt = now;
    firestoreRecord.adminApprovedBy = options?.adminApprovedBy || publishedBy;
  } else {
    firestoreRecord.unpublishedAt = now;
    firestoreRecord.unpublishedBy = publishedBy;
  }

  if (options?.teacherSubmittedBy) {
    firestoreRecord.teacherSubmittedBy = options.teacherSubmittedBy;
  }
  if (options?.adminApprovedBy) {
    firestoreRecord.adminApprovedBy = options.adminApprovedBy;
  }

  const record: PublishedRecord = {
    classKey: `${className}_${term}_${session}`,
    className,
    term,
    session,
    isPublished: Boolean(isPublished),
    publishedAt: isPublished ? now : undefined,
    publishedBy,
    status,
    teacherSubmitted: options?.teacherSubmitted !== undefined ? options.teacherSubmitted : isPublished,
    teacherSubmittedAt: options?.teacherSubmitted ? now : (isPublished ? now : undefined),
    teacherSubmittedBy: options?.teacherSubmittedBy || publishedBy,
    adminApproved: options?.adminApproved !== undefined ? options.adminApproved : isPublished,
    adminApprovedAt: isPublished || options?.adminApproved ? now : undefined,
    adminApprovedBy: options?.adminApprovedBy || (isPublished ? publishedBy : undefined)
  };

  // Update in-memory state immediately
  const cleanTargetClass = normalizeClassIdentifier(className);
  const cleanTargetTerm = (term || '').trim().toLowerCase();
  const cleanTargetSession = (session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

  const filtered = inMemoryPublished.filter((r) => {
    const rClass = normalizeClassIdentifier(r.className);
    const rTerm = (r.term || '').trim().toLowerCase();
    const rSession = (r.session || '').trim().toLowerCase().replace(/academic\s*session/g, '').replace(/session/g, '').trim();

    const classMatches = rClass === cleanTargetClass || isMatchingClass(r.className, className);
    const termMatches = !rTerm || !cleanTargetTerm || rTerm === cleanTargetTerm;
    const sessionMatches = !rSession || !cleanTargetSession || rSession === cleanTargetSession;

    return !(classMatches && termMatches && sessionMatches);
  });
  filtered.push(record);
  inMemoryPublished = filtered;

  // Persist to local cache immediately so client state is synchronous
  try {
    const currentCache = getCachedSchoolData();
    if (currentCache) {
      setCachedSchoolData({
        ...currentCache,
        published: inMemoryPublished
      });
    }
  } catch (e) {
    console.warn('Failed to update cache in setClassPublishStatus:', e);
  }

  try {
    await setDoc(docRef, firestoreRecord, { merge: false });

    let message = '';
    if (isPublished) {
      message = `Results for ${className} (${term}, ${session}) are PUBLISHED & LIVE for students!`;
    } else {
      message = `Results for ${className} (${term}, ${session}) are UNPUBLISHED (Draft). You can now make score corrections.`;
    }

    return {
      success: true,
      isPublished,
      message,
      record
    };
  } catch (err: any) {
    console.error('Firebase publish error:', err);
    return {
      success: false,
      isPublished: !isPublished,
      message: `Failed to save status to Firebase: ${err.message || 'Firestore error'}`,
      record
    };
  }
}

/**
 * Helper: Update local school cache optimistically for batch subject scores
 */
function updateLocalCacheForBatchScores(
  session: string,
  term: TermType,
  scores: Array<{
    studentId: string;
    subject: string;
    ca1: number | null;
    ca2: number | null;
    exam: number | null;
    total: number | null;
  }>
) {
  try {
    const currentCache = getCachedSchoolData();
    if (!currentCache) return;

    const existingScores = currentCache.scores || [];
    const scoreMap = new Map<string, SubjectScore>();
    existingScores.forEach((s) => {
      const k = `${s.StudentID}_${s.Session}_${s.Term}_${s.Subject}`.toLowerCase();
      scoreMap.set(k, s);
    });

    for (const item of scores) {
      const subj = String(item.subject || '').trim();
      const studentId = String(item.studentId || '').trim();
      if (!subj || !studentId) continue;

      const k = `${studentId}_${session}_${term}_${subj}`.toLowerCase();
      const prev = scoreMap.get(k);

      const ca1 = item.ca1 !== undefined && item.ca1 !== null ? Number(item.ca1) : null;
      const ca2 = item.ca2 !== undefined && item.ca2 !== null ? Number(item.ca2) : null;
      const exam = item.exam !== undefined && item.exam !== null ? Number(item.exam) : null;

      if (ca1 === null && ca2 === null && exam === null && !prev) {
        continue;
      }

      let total = item.total !== undefined && item.total !== null ? Number(item.total) : null;
      if (total === null && (ca1 !== null || ca2 !== null || exam !== null)) {
        total = (ca1 || 0) + (ca2 || 0) + (exam || 0);
      }

      scoreMap.set(k, {
        StudentID: studentId,
        Session: session,
        Term: term,
        Subject: subj,
        CA1: ca1,
        CA2: ca2,
        Exam: exam,
        Total: total
      });
    }

    setCachedSchoolData({
      ...currentCache,
      scores: Array.from(scoreMap.values())
    });
  } catch (cacheErr) {
    console.warn('Failed to sync cache in updateLocalCacheForBatchScores:', cacheErr);
  }
}

/**
 * Save batch subject scores directly to Firebase Firestore
 * Includes field-level merging to prevent concurrent device overwrites
 * and IndexedDB offline queue fallback.
 */
export async function saveBatchSubjectScores(
  payload: {
    session: string;
    term: TermType;
    scores: Array<{
      studentId: string;
      subject: string;
      ca1: number | null;
      ca2: number | null;
      exam: number | null;
      total: number | null;
      explicitlyCleared?: boolean;
      clearCA1?: boolean;
      clearCA2?: boolean;
      clearExam?: boolean;
    }>;
  },
  options?: { fromOfflineQueue?: boolean }
): Promise<{ success: boolean; message: string; queuedOffline?: boolean }> {
  // Capture baseline cached scores BEFORE updating cache so we know which fields were already null
  const priorCache = getCachedSchoolData();
  const priorScoreMap = new Map<string, SubjectScore>();
  (priorCache?.scores || []).forEach((s) => {
    const k = `${s.StudentID}_${s.Session}_${s.Term}_${s.Subject}`.toLowerCase();
    priorScoreMap.set(k, s);
  });

  const annotatedScores = payload.scores.map((item) => {
    const subj = String(item.subject || '').trim();
    const studentId = String(item.studentId || '').trim();
    const lookupKey = `${studentId}_${payload.session}_${payload.term}_${subj}`.toLowerCase();
    const priorLocal = priorScoreMap.get(lookupKey);

    const incomingCA1 = item.ca1 !== undefined && item.ca1 !== null ? Number(item.ca1) : null;
    const incomingCA2 = item.ca2 !== undefined && item.ca2 !== null ? Number(item.ca2) : null;
    const incomingExam = item.exam !== undefined && item.exam !== null ? Number(item.exam) : null;

    return {
      ...item,
      ca1: incomingCA1,
      ca2: incomingCA2,
      exam: incomingExam,
      clearCA1: Boolean(
        item.clearCA1 ||
          item.explicitlyCleared ||
          (!options?.fromOfflineQueue &&
            incomingCA1 === null &&
            priorLocal?.CA1 !== null &&
            priorLocal?.CA1 !== undefined)
      ),
      clearCA2: Boolean(
        item.clearCA2 ||
          item.explicitlyCleared ||
          (!options?.fromOfflineQueue &&
            incomingCA2 === null &&
            priorLocal?.CA2 !== null &&
            priorLocal?.CA2 !== undefined)
      ),
      clearExam: Boolean(
        item.clearExam ||
          item.explicitlyCleared ||
          (!options?.fromOfflineQueue &&
            incomingExam === null &&
            priorLocal?.Exam !== null &&
            priorLocal?.Exam !== undefined)
      )
    };
  });

  const enrichedPayload = {
    ...payload,
    scores: annotatedScores
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    updateLocalCacheForBatchScores(payload.session, payload.term, annotatedScores);
    if (!options?.fromOfflineQueue) {
      const subjectsSummary = Array.from(new Set(annotatedScores.map((s) => s.subject))).join(', ');
      const dedupeKey = `SAVE_BATCH_SCORES__${payload.session}__${payload.term}__${subjectsSummary.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await enqueueOfflineOperation(
        'SAVE_BATCH_SCORES',
        enrichedPayload,
        `Batch scores (${subjectsSummary}) for ${payload.term}, ${payload.session}`,
        dedupeKey
      );
    }
    return {
      success: true,
      queuedOffline: true,
      message: 'Offline mode: Batch scores saved to local device queue and will auto-sync when internet returns!'
    };
  }

  try {
    // Pre-read existing score docs for the target term & session with timeout guard
    const serverScoreMap = new Map<string, SubjectScore>();
    try {
      const uniqueSubjects = Array.from(
        new Set(annotatedScores.map((s) => String(s.subject || '').trim()).filter(Boolean))
      );
      const baseQuery =
        uniqueSubjects.length === 1
          ? query(
              collection(db, 'scores'),
              where('Session', '==', payload.session),
              where('Term', '==', payload.term),
              where('Subject', '==', uniqueSubjects[0])
            )
          : query(
              collection(db, 'scores'),
              where('Session', '==', payload.session),
              where('Term', '==', payload.term)
            );

      const qSnap = await Promise.race([
        getDocs(baseQuery),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Batch pre-read timeout')), 6000)
        )
      ]);
      qSnap.forEach((d) => {
        const data = d.data() as SubjectScore;
        const k = `${data.StudentID}_${data.Session}_${data.Term}_${data.Subject}`.toLowerCase();
        serverScoreMap.set(k, data);
      });
    } catch {
      // Proceed if pre-read times out
    }

    const batch = writeBatch(db);
    const mergedScoresForCache: Array<{
      studentId: string;
      subject: string;
      ca1: number | null;
      ca2: number | null;
      exam: number | null;
      total: number | null;
    }> = [];

    for (const item of annotatedScores) {
      const subj = String(item.subject || '').trim();
      const studentId = String(item.studentId || '').trim();
      if (!subj || !studentId) continue;

      const lookupKey = `${studentId}_${payload.session}_${payload.term}_${subj}`.toLowerCase();
      const serverExisting = serverScoreMap.get(lookupKey);

      const incomingCA1 = item.ca1;
      const incomingCA2 = item.ca2;
      const incomingExam = item.exam;

      const mergedCA1 =
        incomingCA1 !== null
          ? incomingCA1
          : item.clearCA1
          ? null
          : (serverExisting?.CA1 ?? null);
      const mergedCA2 =
        incomingCA2 !== null
          ? incomingCA2
          : item.clearCA2
          ? null
          : (serverExisting?.CA2 ?? null);
      const mergedExam =
        incomingExam !== null
          ? incomingExam
          : item.clearExam
          ? null
          : (serverExisting?.Exam ?? null);

      if (
        mergedCA1 === null &&
        mergedCA2 === null &&
        mergedExam === null &&
        !serverExisting &&
        !item.explicitlyCleared &&
        !item.clearCA1 &&
        !item.clearCA2 &&
        !item.clearExam
      ) {
        continue;
      }

      const mergedTotal =
        mergedCA1 !== null || mergedCA2 !== null || mergedExam !== null
          ? (mergedCA1 || 0) + (mergedCA2 || 0) + (mergedExam || 0)
          : null;

      mergedScoresForCache.push({
        studentId,
        subject: subj,
        ca1: mergedCA1,
        ca2: mergedCA2,
        exam: mergedExam,
        total: mergedTotal
      });

      const scoreDocId = getScoreDocId(studentId, payload.session, payload.term, subj);
      const scoreRef = doc(db, 'scores', scoreDocId);

      batch.set(
        scoreRef,
        {
          StudentID: studentId,
          Session: payload.session,
          Term: payload.term,
          Subject: subj,
          CA1: mergedCA1,
          CA2: mergedCA2,
          Exam: mergedExam,
          Total: mergedTotal,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    await Promise.race([
      batch.commit(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Batch network write timed out')), 12000)
      )
    ]);

    updateLocalCacheForBatchScores(
      payload.session,
      payload.term,
      mergedScoresForCache.length > 0 ? mergedScoresForCache : annotatedScores
    );

    return {
      success: true,
      message: 'Scores merged and updated in Firebase Firestore in real time.'
    };
  } catch (err: any) {
    console.warn('Batch score save interrupted, queueing to IndexedDB offline queue:', err);
    updateLocalCacheForBatchScores(payload.session, payload.term, annotatedScores);

    if (!options?.fromOfflineQueue) {
      const subjectsSummary = Array.from(new Set(annotatedScores.map((s) => s.subject))).join(', ');
      const dedupeKey = `SAVE_BATCH_SCORES__${payload.session}__${payload.term}__${subjectsSummary.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await enqueueOfflineOperation(
        'SAVE_BATCH_SCORES',
        enrichedPayload,
        `Batch scores (${subjectsSummary}) for ${payload.term}, ${payload.session}`,
        dedupeKey
      );
      return {
        success: true,
        queuedOffline: true,
        message: 'Network unstable: Batch scores saved to local Offline Queue and will auto-sync when connection returns!'
      };
    }

    return {
      success: false,
      message: `Failed to save scores: ${err.message || 'Database write error'}`
    };
  }
}

/**
 * Add a new subject to Firebase Firestore
 */
export async function addSubject(subject: {
  SubjectName: string;
  Level: string;
  Class?: string;
}): Promise<{ success: boolean; message: string; subject?: SubjectRule }> {
  try {
    const cleanName = subject.SubjectName.trim();
    const cleanLevel = subject.Level.trim();
    const cleanClass = subject.Class && subject.Class.trim() ? subject.Class.trim() : undefined;

    if (!cleanName) {
      return { success: false, message: 'Subject name is required.' };
    }

    const docId = `${cleanLevel}_${cleanClass ? cleanClass + '_' : ''}${cleanName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const docRef = doc(db, 'subjects', docId);

    // Build payload without undefined properties (Firestore setDoc rejects objects with undefined values)
    const firestoreData: Record<string, any> = {
      id: docId,
      SubjectName: cleanName,
      Level: cleanLevel
    };

    if (cleanClass) {
      firestoreData.Class = cleanClass;
    }

    await setDoc(docRef, firestoreData, { merge: true });

    const newRule: SubjectRule = {
      id: docId,
      SubjectName: cleanName,
      Level: cleanLevel,
      ...(cleanClass ? { Class: cleanClass } : {})
    };

    // Update in-memory cache if available
    try {
      const currentCache = getCachedSchoolData();
      if (currentCache) {
        const updatedSubjects = currentCache.subjects ? [...currentCache.subjects] : [];
        const existingIdx = updatedSubjects.findIndex(s => s.id === docId);
        if (existingIdx >= 0) {
          updatedSubjects[existingIdx] = newRule;
        } else {
          updatedSubjects.push(newRule);
        }
        setCachedSchoolData({
          ...currentCache,
          subjects: updatedSubjects
        });
      }
    } catch (cacheErr) {
      console.warn('Failed to sync cache for added subject:', cacheErr);
    }

    return {
      success: true,
      message: `Subject "${cleanName}" added successfully to Firebase!`,
      subject: newRule
    };
  } catch (err: any) {
    console.error('Failed to add subject to Firebase:', err);
    return {
      success: false,
      message: `Failed to add subject: ${err.message || 'Database error'}`
    };
  }
}

/**
 * Delete a subject from Firebase Firestore
 */
export async function deleteSubject(
  subjectName: string,
  level?: string,
  className?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const batch = writeBatch(db);
    let count = 0;

    subjectsSnap.forEach((d) => {
      const data = d.data() as SubjectRule;
      const nameMatch = data.SubjectName.trim().toLowerCase() === subjectName.trim().toLowerCase();
      const levelMatch = !level || data.Level.trim().toLowerCase() === level.trim().toLowerCase();
      const classMatch = !className || (data.Class && data.Class.trim().toLowerCase() === className.trim().toLowerCase());

      if (nameMatch && (levelMatch || classMatch)) {
        batch.delete(d.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();

      // Sync cache
      try {
        const currentCache = getCachedSchoolData();
        if (currentCache && currentCache.subjects) {
          setCachedSchoolData({
            ...currentCache,
            subjects: currentCache.subjects.filter(s => {
              const nameMatch = s.SubjectName.trim().toLowerCase() === subjectName.trim().toLowerCase();
              const levelMatch = !level || s.Level.trim().toLowerCase() === level.trim().toLowerCase();
              const classMatch = !className || (s.Class && s.Class.trim().toLowerCase() === className.trim().toLowerCase());
              return !(nameMatch && (levelMatch || classMatch));
            })
          });
        }
      } catch (cacheErr) {
        console.warn('Failed to sync cache for deleted subject:', cacheErr);
      }

      return {
        success: true,
        message: `Subject "${subjectName}" removed successfully from Firebase (${count} record deleted).`
      };
    } else {
      // If matching by document id directly
      const cleanLevel = level || 'All';
      const docId = `${cleanLevel}_${className ? className + '_' : ''}${subjectName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await deleteDoc(doc(db, 'subjects', docId));

      try {
        const currentCache = getCachedSchoolData();
        if (currentCache && currentCache.subjects) {
          setCachedSchoolData({
            ...currentCache,
            subjects: currentCache.subjects.filter(s => s.id !== docId)
          });
        }
      } catch (cacheErr) {
        console.warn('Failed to sync cache for deleted subject id:', cacheErr);
      }

      return {
        success: true,
        message: `Subject "${subjectName}" removed from Firebase.`
      };
    }
  } catch (err: any) {
    console.error('Failed to remove subject from Firebase:', err);
    return {
      success: false,
      message: `Failed to remove subject: ${err.message || 'Database error'}`
    };
  }
}

/**
 * Update teacher credentials (username, password, full name, class assigned) in Firebase
 */
export async function updateTeacherCredentials(
  currentUsername: string,
  updates: {
    Username?: string;
    Password?: string;
    FullName?: string;
    ClassAssigned?: string;
    Role?: 'admin' | 'teacher';
    PhotoURL?: string;
    Phone?: string;
  }
): Promise<{ success: boolean; message: string; teacher?: Teacher }> {
  try {
    const cleanCurrentUsername = currentUsername.trim().toLowerCase();
    const oldDocId = getTeacherDocId(cleanCurrentUsername);
    const oldDocRef = doc(db, 'teachers', oldDocId);
    const oldDocSnap = await getDoc(oldDocRef);

    let existingDocId = oldDocId;
    let existingDocRef = oldDocRef;
    let existingData: Teacher | null = null;

    if (oldDocSnap.exists()) {
      existingData = oldDocSnap.data() as Teacher;
    } else {
      // Find document in teachers collection by username or previous usernames or assigned class
      try {
        const allTeachersSnap = await getDocs(collection(db, 'teachers'));
        for (const d of allTeachersSnap.docs) {
          const t = d.data() as Teacher;
          const u = (t.Username || '').trim().toLowerCase();
          const prevU = (t.PreviousUsernames || []).map((x) => x.trim().toLowerCase());
          if (
            u === cleanCurrentUsername ||
            prevU.includes(cleanCurrentUsername) ||
            (updates.ClassAssigned && isMatchingClass(t.ClassAssigned, updates.ClassAssigned) && t.Role !== 'admin')
          ) {
            existingDocId = d.id;
            existingDocRef = d.ref;
            existingData = t;
            break;
          }
        }
      } catch (scanErr) {
        console.warn('Teacher collection scan notice:', scanErr);
      }
    }

    if (!existingData) {
      const cached = getCachedSchoolData();
      existingData =
        cached?.teachers?.find((t) => t.Username.toLowerCase() === cleanCurrentUsername) ||
        INITIAL_DEFAULT_TEACHERS.find((t) => t.Username.toLowerCase() === cleanCurrentUsername) ||
        INITIAL_DEFAULT_TEACHERS.find(
          (t) => updates.ClassAssigned && isMatchingClass(t.ClassAssigned, updates.ClassAssigned) && t.Role !== 'admin'
        ) || {
          Username: cleanCurrentUsername,
          Password: 'password123',
          ClassAssigned: updates.ClassAssigned || 'Primary 1',
          FullName: updates.FullName || 'Staff Teacher',
          Role: updates.Role || 'teacher'
        };
    }

    const cleanUser = (updates.Username?.trim() || existingData.Username || currentUsername).toLowerCase();
    const isMasterAdmin = cleanUser === 'admin' || updates.Role === 'admin' || existingData.Role === 'admin';

    const previousUsernames = Array.from(
      new Set([
        ...(existingData.PreviousUsernames || []),
        (existingData.Username || '').trim().toLowerCase(),
        currentUsername.trim().toLowerCase()
      ])
    ).filter((u) => u && u !== (updates.Username?.trim() || existingData.Username || currentUsername).toLowerCase());

    const cleanStaffUser = (updates.Username?.trim() || existingData.Username || currentUsername).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const fallbackStaffPhoto = safeStorage.getItem(`staff_photo_${cleanStaffUser}`) || '';
    const staffPhoto =
      (updates.PhotoURL && updates.PhotoURL.trim()) ||
      existingData.PhotoURL ||
      (existingData as any)?.photoUrl ||
      fallbackStaffPhoto;

    if (staffPhoto) {
      try {
        safeStorage.setItem(`staff_photo_${cleanStaffUser}`, staffPhoto);
      } catch {}
    }

    const newTeacher: Teacher = {
      ...existingData,
      Username: updates.Username?.trim() || existingData.Username || currentUsername,
      Password: updates.Password !== undefined ? updates.Password.trim() : (existingData.Password || ''),
      FullName: updates.FullName !== undefined ? updates.FullName.trim() : (existingData.FullName || ''),
      ClassAssigned: updates.ClassAssigned?.trim() || existingData.ClassAssigned || (isMasterAdmin ? 'Admin' : ''),
      Role: updates.Role || (isMasterAdmin ? 'admin' : existingData.Role || 'teacher'),
      PhotoURL: staffPhoto,
      Phone: updates.Phone !== undefined ? updates.Phone.trim() : (existingData.Phone || ''),
      PreviousUsernames: previousUsernames
    };

    // Update active teacher session if currently logged in
    try {
      const activeTeacherAuth = safeSessionStorage.getItem('school_portal_teacher_auth');
      if (activeTeacherAuth) {
        const parsed = JSON.parse(activeTeacherAuth);
        if (parsed && (parsed.Username || '').toLowerCase().trim() === cleanCurrentUsername) {
          safeSessionStorage.setItem(
            'school_portal_teacher_auth',
            JSON.stringify({ ...parsed, ...newTeacher })
          );
        }
      }
    } catch {}

    const safeTeacherPayload = cleanFirestorePayload(newTeacher);
    const newDocId = getTeacherDocId(newTeacher.Username);

    if (newDocId !== existingDocId) {
      const batch = writeBatch(db);
      if (oldDocSnap.exists() || existingDocId !== newDocId) {
        batch.delete(existingDocRef);
      }
      batch.set(doc(db, 'teachers', newDocId), safeTeacherPayload, { merge: true });
      // Synchronize class teacher assignment in classes collection
      if (newTeacher.Role !== 'admin' && newTeacher.ClassAssigned && newTeacher.ClassAssigned.toLowerCase() !== 'admin') {
        const clsRef = doc(db, 'classes', getClassDocId(newTeacher.ClassAssigned));
        batch.set(
          clsRef,
          cleanFirestorePayload({
            name: newTeacher.ClassAssigned,
            category: detectClassCategory(newTeacher.ClassAssigned),
            classTeacher: newTeacher.FullName,
            teacherUsername: newTeacher.Username,
            updatedAt: new Date().toISOString()
          }),
          { merge: true }
        );
      }
      await batch.commit();
    } else {
      await setDoc(doc(db, 'teachers', newDocId), safeTeacherPayload, { merge: true });
      if (newTeacher.Role !== 'admin' && newTeacher.ClassAssigned && newTeacher.ClassAssigned.toLowerCase() !== 'admin') {
        const clsRef = doc(db, 'classes', getClassDocId(newTeacher.ClassAssigned));
        await setDoc(
          clsRef,
          cleanFirestorePayload({
            name: newTeacher.ClassAssigned,
            category: detectClassCategory(newTeacher.ClassAssigned),
            classTeacher: newTeacher.FullName,
            teacherUsername: newTeacher.Username,
            updatedAt: new Date().toISOString()
          }),
          { merge: true }
        );
      }
    }

    // Synchronize local cached school data
    const cached = getCachedSchoolData();
    if (cached) {
      const updatedTeachers = (cached.teachers || []).filter(
        (t) =>
          t.Username.toLowerCase() !== currentUsername.toLowerCase() &&
          t.Username.toLowerCase() !== newTeacher.Username.toLowerCase()
      );
      updatedTeachers.push(newTeacher);
      setCachedSchoolData({
        ...cached,
        teachers: updatedTeachers
      });
    }

    return {
      success: true,
      message: `Teacher credentials for ${newTeacher.ClassAssigned} (${newTeacher.Username}) updated successfully!`,
      teacher: newTeacher
    };
  } catch (err: any) {
    console.error('Failed to update teacher credentials in Firebase:', err);
    return {
      success: false,
      message: `Failed to update credentials: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Create a brand new teacher/staff account in Firebase Firestore
 */
export async function createTeacher(
  teacher: Teacher
): Promise<{ success: boolean; message: string; teacher?: Teacher }> {
  try {
    const cleanUsername = teacher.Username.trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, message: 'Username is required.' };
    }

    const docId = getTeacherDocId(cleanUsername);
    const docRef = doc(db, 'teachers', docId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return {
        success: false,
        message: `An account with username "${cleanUsername}" already exists.`
      };
    }

    const isMasterAdmin = cleanUsername === 'admin' || teacher.Role === 'admin';

    const newTeacher: Teacher = {
      Username: teacher.Username.trim(),
      Password: teacher.Password ? teacher.Password.trim() : '',
      FullName: teacher.FullName?.trim() || `Teacher (${teacher.ClassAssigned})`,
      ClassAssigned: teacher.ClassAssigned ? teacher.ClassAssigned.trim() : 'Primary 1',
      Role: isMasterAdmin ? 'admin' : 'teacher',
      PhotoURL: teacher.PhotoURL?.trim() || '',
      Phone: teacher.Phone?.trim() || '',
      PreviousUsernames: []
    };

    await setDoc(docRef, cleanFirestorePayload(newTeacher));
    return {
      success: true,
      message: `Staff account "${newTeacher.FullName}" (${newTeacher.Username}) created successfully!`,
      teacher: newTeacher
    };
  } catch (err: any) {
    console.error('Failed to create teacher in Firebase:', err);
    return {
      success: false,
      message: `Failed to create teacher: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Delete a teacher account from Firebase Firestore
 */
export async function deleteTeacher(
  username: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername === 'admin') {
      return {
        success: false,
        message: 'Cannot delete the primary Administrator account.'
      };
    }
    const docId = getTeacherDocId(cleanUsername);
    await deleteDoc(doc(db, 'teachers', docId));
    return {
      success: true,
      message: `Teacher account "${username}" has been removed.`
    };
  } catch (err: any) {
    console.error('Failed to delete teacher:', err);
    return {
      success: false,
      message: `Failed to delete teacher: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Reset all student passwords for an entire class in Firebase
 */
export async function resetClassStudentPasswords(
  className: string,
  newPassword = 'password'
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const batch = writeBatch(db);
    const stSnap = await getDocs(collection(db, 'students'));
    let matchedCount = 0;

    stSnap.forEach((docSnap) => {
      const data = docSnap.data() as Student;
      if (className === 'all' || isMatchingClass(data.Class, className)) {
        batch.update(docSnap.ref, { Password: newPassword });
        matchedCount++;
      }
    });

    if (matchedCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      message: `Reset passwords for ${matchedCount} pupil(s) in ${className === 'all' ? 'all classes' : className} to "${newPassword}".`,
      count: matchedCount
    };
  } catch (err: any) {
    console.error('Failed to batch reset student passwords:', err);
    return {
      success: false,
      message: `Failed to reset passwords: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Update student password in Firebase Firestore
 */
export async function updateStudentPassword(
  studentId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const studentDocId = getStudentDocId(studentId);
    const studentDocRef = doc(db, 'students', studentDocId);
    const snap = await getDoc(studentDocRef);

    if (!snap.exists()) {
      // Find in default if not yet created
      const defStudent = INITIAL_DEFAULT_STUDENTS.find((s) => s.StudentID.toLowerCase() === studentId.toLowerCase());
      if (defStudent) {
        await setDoc(studentDocRef, { ...defStudent, Password: newPassword.trim() }, { merge: true });
        const cached = getCachedSchoolData();
        if (cached) {
          const updated = (cached.students || []).map((s) =>
            s.StudentID.toLowerCase() === studentId.toLowerCase() ? { ...s, Password: newPassword.trim() } : s
          );
          setCachedSchoolData({ ...cached, students: updated });
        }
        return {
          success: true,
          message: 'Password created and updated successfully in Firebase.'
        };
      }
      return { success: false, message: 'Student record not found.' };
    }

    await setDoc(studentDocRef, { Password: newPassword.trim() }, { merge: true });

    const cached = getCachedSchoolData();
    if (cached) {
      const updated = (cached.students || []).map((s) =>
        s.StudentID.toLowerCase() === studentId.toLowerCase() ? { ...s, Password: newPassword.trim() } : s
      );
      setCachedSchoolData({ ...cached, students: updated });
    }

    return {
      success: true,
      message: 'Your password has been changed successfully in Firebase Firestore.'
    };
  } catch (err: any) {
    console.error('Failed to update student password in Firebase:', err);
    return {
      success: false,
      message: `Failed to change password: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Clear all mock students, score records, and pupil summaries from Firestore database
 * Keeps valid curriculum subjects and authentic staff accounts intact.
 */
export async function clearAllMockData(): Promise<{ success: boolean; message: string; counts: { students: number; scores: number; summaries: number } }> {
  try {
    const [stSnap, scSnap, sumSnap, pubSnap] = await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'scores')),
      getDocs(collection(db, 'summaries')),
      getDocs(collection(db, 'published'))
    ]);

    const counts = {
      students: stSnap.size,
      scores: scSnap.size,
      summaries: sumSnap.size
    };

    // Delete in batches
    const deleteBatches = async (docs: any[]) => {
      const CHUNK = 400;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = writeBatch(db);
        docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    };

    await Promise.all([
      deleteBatches(stSnap.docs),
      deleteBatches(scSnap.docs),
      deleteBatches(sumSnap.docs),
      deleteBatches(pubSnap.docs)
    ]);

    // Clear local storage cache
    inMemoryPublished = [];
    safeStorage.removeItem(LIVE_DATA_CACHE_KEY);

    return {
      success: true,
      message: `Cleaned out mock data: removed ${counts.students} mock student records, ${counts.scores} test scores, and ${counts.summaries} summaries. The system is ready for live student enrollments.`,
      counts
    };
  } catch (err: any) {
    console.error('Failed to clear mock data from Firestore:', err);
    // Even if firestore offline, clear local storage
    safeStorage.removeItem(LIVE_DATA_CACHE_KEY);
    return {
      success: true,
      message: 'Local mock storage purged. App is ready for live student data.',
      counts: { students: 0, scores: 0, summaries: 0 }
    };
  }
}

/**
 * Get quick count of documents across Firestore collections for Admin Center
 */
export async function getDatabaseStats(): Promise<{
  teachersCount: number;
  studentsCount: number;
  subjectsCount: number;
  scoresCount: number;
  summariesCount: number;
  publishedCount: number;
}> {
  try {
    const [t, st, sub, sc, sum, pub] = await Promise.all([
      getDocs(collection(db, 'teachers')),
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'subjects')),
      getDocs(collection(db, 'scores')),
      getDocs(collection(db, 'summaries')),
      getDocs(collection(db, 'published'))
    ]);

    return {
      teachersCount: t.size,
      studentsCount: st.size,
      subjectsCount: sub.size,
      scoresCount: sc.size,
      summariesCount: sum.size,
      publishedCount: pub.size
    };
  } catch {
    const cached = getCachedSchoolData();
    return {
      teachersCount: cached?.teachers.length || INITIAL_DEFAULT_TEACHERS.length,
      studentsCount: cached?.students.length || INITIAL_DEFAULT_STUDENTS.length,
      subjectsCount: cached?.subjects.length || INITIAL_DEFAULT_SUBJECTS.length,
      scoresCount: cached?.scores.length || INITIAL_DEFAULT_SCORES.length,
      summariesCount: cached?.summaries.length || INITIAL_DEFAULT_SUMMARIES.length,
      publishedCount: cached?.published.length || INITIAL_DEFAULT_PUBLISHED.length
    };
  }
}

/**
 * Fetch all classes from Firestore
 */
export async function fetchClasses(): Promise<ClassRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'classes'));
    const classes: ClassRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as ClassRecord;
      classes.push({
        ...data,
        id: d.id,
        category: data.category || detectClassCategory(data.name)
      });
    });

    const sorted = sortSchoolClasses(classes.length > 0 ? classes : INITIAL_DEFAULT_CLASSES);
    return sorted;
  } catch (err) {
    console.error('Failed to fetch classes from Firestore:', err);
    const cached = getCachedSchoolData();
    return cached?.classes || INITIAL_DEFAULT_CLASSES;
  }
}

/**
 * Add / Save a Class to Firestore
 */
export async function saveClass(classData: {
  name: string;
  category?: ClassCategory;
  classTeacher?: string;
  order?: number;
  description?: string;
}): Promise<{ success: boolean; message: string; classRecord?: ClassRecord }> {
  try {
    const trimmedName = classData.name.trim();
    if (!trimmedName) {
      return { success: false, message: 'Class name cannot be empty.' };
    }
    if (trimmedName.toLowerCase() === 'admin') {
      return { success: false, message: '"Admin" is a reserved administrative role, not a class name.' };
    }

    const category = classData.category || detectClassCategory(trimmedName);
    const docId = getClassDocId(trimmedName);
    const classDocRef = doc(db, 'classes', docId);

    const record: ClassRecord = {
      id: docId,
      name: trimmedName,
      category,
      order: classData.order || 99,
      classTeacher: classData.classTeacher || '',
      description: classData.description || '',
      updatedAt: new Date().toISOString()
    };

    const existingDoc = await getDoc(classDocRef);
    if (!existingDoc.exists()) {
      record.createdAt = new Date().toISOString();
    }

    await setDoc(classDocRef, record, { merge: true });

    // If a class teacher username was chosen, assign the teacher to this class
    if (classData.classTeacher) {
      const tSnap = await getDocs(collection(db, 'teachers'));
      tSnap.forEach(async (d) => {
        const t = d.data() as Teacher;
        if (t.Username.toLowerCase() === classData.classTeacher?.toLowerCase() && t.Role !== 'admin') {
          await setDoc(doc(db, 'teachers', d.id), { ClassAssigned: trimmedName }, { merge: true });
        }
      });
    }

    // Refresh dynamic in-memory list and cache
    if (!ALL_SCHOOL_CLASSES.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
      ALL_SCHOOL_CLASSES.push(trimmedName);
      ALL_SCHOOL_CLASSES = sortClassNames(ALL_SCHOOL_CLASSES);
    }

    const cached = getCachedSchoolData();
    if (cached) {
      const existing = (cached.classes || []).filter(c => c.name.toLowerCase() !== trimmedName.toLowerCase());
      existing.push(record);
      const sorted = sortSchoolClasses(existing);
      setCachedSchoolData({
        ...cached,
        classes: sorted,
        classNames: sorted.map(c => c.name)
      });
    }

    return {
      success: true,
      message: `Class "${trimmedName}" (${category}) has been created successfully.`,
      classRecord: record
    };
  } catch (err: any) {
    console.error('Failed to save class to Firestore:', err);
    return {
      success: false,
      message: `Error creating class: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Delete a Class from Firestore with student reassignment or purge options
 */
export async function deleteClass(
  className: string,
  options?: {
    reassignStudentsTo?: string;
    deleteStudents?: boolean;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const trimmedName = className.trim();
    if (!trimmedName) {
      return { success: false, message: 'Class name is required.' };
    }
    if (trimmedName.toLowerCase() === 'admin') {
      return { success: false, message: 'Cannot delete the "Admin" system role.' };
    }

    // Check enrolled students
    const studentsSnap = await getDocs(
      query(collection(db, 'students'), where('Class', '==', trimmedName))
    );

    // If students are enrolled and no action specified
    if (!studentsSnap.empty && !options?.reassignStudentsTo && !options?.deleteStudents) {
      return {
        success: false,
        message: `Class "${trimmedName}" currently has ${studentsSnap.size} enrolled student(s). Please choose a class to reassign them to or confirm pupil deletion.`
      };
    }

    const batch = writeBatch(db);

    // 1. Reassign or delete students
    if (options?.reassignStudentsTo && options.reassignStudentsTo.trim()) {
      const targetClass = options.reassignStudentsTo.trim();
      studentsSnap.forEach((d) => {
        batch.update(d.ref, {
          Class: targetClass,
          UpdatedAt: new Date().toISOString()
        });
      });
    } else if (options?.deleteStudents) {
      // Delete students and their scores/summaries
      studentsSnap.forEach((d) => {
        batch.delete(d.ref);
      });
      for (const d of studentsSnap.docs) {
        const st = d.data() as Student;
        const [scSnap, sumSnap] = await Promise.all([
          getDocs(query(collection(db, 'scores'), where('StudentID', '==', st.StudentID))),
          getDocs(query(collection(db, 'summaries'), where('StudentID', '==', st.StudentID)))
        ]);
        scSnap.forEach(s => batch.delete(s.ref));
        sumSnap.forEach(s => batch.delete(s.ref));
      }
    }

    // 2. Unassign any teachers currently assigned to this class
    const teachersSnap = await getDocs(collection(db, 'teachers'));
    teachersSnap.forEach((d) => {
      const t = d.data() as Teacher;
      if (isMatchingClass(t.ClassAssigned, trimmedName) && t.Role !== 'admin') {
        batch.update(d.ref, { ClassAssigned: 'Unassigned' });
      }
    });

    // 3. Delete published records for this class
    const pubSnap = await getDocs(collection(db, 'published'));
    pubSnap.forEach((d) => {
      const p = d.data() as PublishedRecord;
      if (isMatchingClass(p.className, trimmedName)) {
        batch.delete(d.ref);
      }
    });

    // 4. Delete the class document from `classes`
    const docId = getClassDocId(trimmedName);
    const classDocRef = doc(db, 'classes', docId);
    batch.delete(classDocRef);

    await batch.commit();

    // Update in-memory ALL_SCHOOL_CLASSES
    const remainingNames = ALL_SCHOOL_CLASSES.filter(c => c.toLowerCase() !== trimmedName.toLowerCase());
    ALL_SCHOOL_CLASSES.length = 0;
    ALL_SCHOOL_CLASSES.push(...remainingNames);

    // Update local cache
    const cached = getCachedSchoolData();
    if (cached) {
      const updatedClasses = (cached.classes || []).filter(c => c.name.toLowerCase() !== trimmedName.toLowerCase());
      setCachedSchoolData({
        ...cached,
        classes: updatedClasses,
        classNames: updatedClasses.map(c => c.name)
      });
    }

    return {
      success: true,
      message: `Class "${trimmedName}" has been successfully deleted from the school registry.`
    };
  } catch (err: any) {
    console.error('Failed to delete class from Firestore:', err);
    return {
      success: false,
      message: `Error deleting class: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Update / Rename a Class in Firestore and migrate all references
 */
export async function updateClass(
  originalName: string,
  updatedData: {
    name: string;
    category?: ClassCategory;
    classTeacher?: string;
    description?: string;
  }
): Promise<{ success: boolean; message: string; classRecord?: ClassRecord }> {
  try {
    const oldName = originalName.trim();
    const newName = updatedData.name.trim();

    if (!newName) {
      return { success: false, message: 'Class name cannot be empty.' };
    }
    if (newName.toLowerCase() === 'admin') {
      return { success: false, message: '"Admin" is a reserved administrative role, not a class name.' };
    }

    const category = updatedData.category || detectClassCategory(newName);
    const newDocId = getClassDocId(newName);
    const oldDocId = getClassDocId(oldName);

    const record: ClassRecord = {
      id: newDocId,
      name: newName,
      category,
      classTeacher: updatedData.classTeacher || '',
      description: updatedData.description || '',
      updatedAt: new Date().toISOString()
    };

    const batch = writeBatch(db);

    // If name changed, migrate all references
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
      // 1. Delete old class doc
      batch.delete(doc(db, 'classes', oldDocId));

      // 2. Migrate students
      const studentsSnap = await getDocs(
        query(collection(db, 'students'), where('Class', '==', oldName))
      );
      studentsSnap.forEach((d) => {
        batch.update(d.ref, { Class: newName, UpdatedAt: new Date().toISOString() });
      });

      // 3. Migrate teachers
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      teachersSnap.forEach((d) => {
        const t = d.data() as Teacher;
        if (isMatchingClass(t.ClassAssigned, oldName) && t.Role !== 'admin') {
          batch.update(d.ref, { ClassAssigned: newName });
        }
      });

      // 4. Migrate published records
      const pubSnap = await getDocs(collection(db, 'published'));
      pubSnap.forEach((d) => {
        const p = d.data() as PublishedRecord;
        if (isMatchingClass(p.className, oldName)) {
          batch.update(d.ref, { className: newName, classKey: `${newName}_${p.term}_${p.session}` });
        }
      });
    }

    // Set new class doc
    batch.set(doc(db, 'classes', newDocId), record, { merge: true });

    // If a classTeacher is assigned, update that teacher
    if (updatedData.classTeacher) {
      const teachersSnap = await getDocs(collection(db, 'teachers'));
      teachersSnap.forEach((d) => {
        const t = d.data() as Teacher;
        if (t.Username.toLowerCase() === updatedData.classTeacher?.toLowerCase() && t.Role !== 'admin') {
          batch.update(d.ref, { ClassAssigned: newName });
        }
      });
    }

    await batch.commit();

    // Update in-memory ALL_SCHOOL_CLASSES
    const filtered = ALL_SCHOOL_CLASSES.filter(c => c.toLowerCase() !== oldName.toLowerCase());
    filtered.push(newName);
    ALL_SCHOOL_CLASSES.length = 0;
    ALL_SCHOOL_CLASSES.push(...sortClassNames(filtered));

    // Update local cache
    const cached = getCachedSchoolData();
    if (cached) {
      const existing = (cached.classes || []).filter(c => c.name.toLowerCase() !== oldName.toLowerCase());
      existing.push(record);
      const sorted = sortSchoolClasses(existing);
      setCachedSchoolData({
        ...cached,
        classes: sorted,
        classNames: sorted.map(c => c.name)
      });
    }

    return {
      success: true,
      message: `Class updated successfully from "${oldName}" to "${newName}".`,
      classRecord: record
    };
  } catch (err: any) {
    console.error('Failed to update class in Firestore:', err);
    return {
      success: false,
      message: `Error updating class: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Fetch Custom Academic Grading Scales from Firestore Settings
 */
export async function fetchGradingScales(): Promise<GradingScaleItem[]> {
  try {
    const docRef = doc(db, 'settings', 'academic_grading');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.scales) {
      const scales = snap.data()?.scales as GradingScaleItem[];
      setActiveGradingScales(scales);
      return scales;
    }
    return DEFAULT_GENERAL_GRADING_SCALE;
  } catch (err) {
    console.warn('Failed to fetch grading scales from Firebase:', err);
    return getActiveGradingScales();
  }
}

/**
 * Save / Update Custom Academic Grading Scales to Firestore Settings
 * Accessible by Teachers and School Administrators
 */
export async function saveGradingScales(
  scales: GradingScaleItem[],
  updatedBy?: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!scales || scales.length === 0) {
      return { success: false, message: 'Grading scale cannot be empty.' };
    }

    // Validate score ranges
    for (const item of scales) {
      if (item.minScore < 0 || item.maxScore > 100 || item.minScore > item.maxScore) {
        return {
          success: false,
          message: `Invalid score range for grade ${item.grade}: ${item.minScore} - ${item.maxScore}.`
        };
      }
      if (!item.grade.trim()) {
        return { success: false, message: 'Grade label is required for all scale tiers.' };
      }
    }

    const docRef = doc(db, 'settings', 'academic_grading');
    await setDoc(
      docRef,
      {
        scales,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedBy || 'Staff / Admin'
      },
      { merge: true }
    );

    setActiveGradingScales(scales);

    // Update cache
    const cached = getCachedSchoolData();
    if (cached) {
      setCachedSchoolData({
        ...cached,
        gradingScales: scales
      });
    }

    return {
      success: true,
      message: `Academic grading scales (${scales.length} tiers) successfully saved to Firebase Firestore!`
    };
  } catch (err: any) {
    console.error('Failed to save grading scales in Firebase:', err);
    return {
      success: false,
      message: `Failed to save grading scales: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Fetch Custom Scoring Limits for a specific session and term from Firestore Settings
 */
export async function fetchScoringConfig(
  session?: string,
  term?: string | TermType
): Promise<ScoringConfig> {
  const { session: normSession, term: normTerm } = normalizeSessionAndTerm(session, term);
  const key = `${normSession}_${normTerm}`;
  const safeKey = key.replace(/[\/\s]/g, '_');

  try {
    // 1. Check specific term document first
    const specificDocRef = doc(db, 'settings', `scoring_${safeKey}`);
    const specificSnap = await getDoc(specificDocRef);
    if (specificSnap.exists()) {
      const data = specificSnap.data();
      if (data && typeof data.maxCA1 === 'number' && typeof data.maxExam === 'number') {
        const config: ScoringConfig = {
          maxCA1: Number(data.maxCA1),
          maxCA2: Number(data.maxCA2 ?? 20),
          maxExam: Number(data.maxExam),
          maxTotal: 100
        };
        setCachedScoringConfig(normSession, normTerm, config);
        return config;
      }
    }

    // 2. Check unified scoring_configs registry document
    const registryDocRef = doc(db, 'settings', 'scoring_configs');
    const registrySnap = await getDoc(registryDocRef);
    if (registrySnap.exists()) {
      const data = registrySnap.data();
      const configs = (data?.configs || data) as Record<string, any>;
      const match = configs?.[key] || configs?.[safeKey];
      if (match && typeof match.maxCA1 === 'number' && typeof match.maxExam === 'number') {
        const config: ScoringConfig = {
          maxCA1: Number(match.maxCA1),
          maxCA2: Number(match.maxCA2 ?? 20),
          maxExam: Number(match.maxExam),
          maxTotal: 100
        };
        setCachedScoringConfig(normSession, normTerm, config);
        return config;
      }
    }

    return getScoringConfig(normSession, normTerm);
  } catch (err) {
    console.warn(`Failed to fetch scoring config for ${normSession} ${normTerm}:`, err);
    return getScoringConfig(normSession, normTerm);
  }
}

/**
 * Fetch all Custom Scoring Limits from Firestore Settings
 */
export async function fetchAllScoringConfigs(): Promise<Record<string, ScoringConfig>> {
  try {
    const registryDocRef = doc(db, 'settings', 'scoring_configs');
    const registrySnap = await getDoc(registryDocRef);
    if (registrySnap.exists()) {
      const data = registrySnap.data();
      const configs = (data?.configs || data) as Record<string, ScoringConfig>;
      if (configs && typeof configs === 'object') {
        setAllCachedScoringConfigs(configs);
        return configs;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch all scoring configs from Firebase:', err);
  }
  return {};
}

/**
 * Save / Update Score Limits for a specific session and term in Firestore Settings
 */
export async function saveScoringConfig(
  config: ScoringConfig,
  session: string,
  term: string | TermType,
  updatedBy?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const ca1 = Number(config.maxCA1);
    const ca2 = Number(config.maxCA2);
    const exam = Number(config.maxExam);

    if (!Number.isInteger(ca1) || ca1 < 0 || ca1 > 100) {
      return { success: false, message: 'CA1 limit must be a whole number between 0 and 100.' };
    }
    if (!Number.isInteger(ca2) || ca2 < 0 || ca2 > 100) {
      return { success: false, message: 'CA2 limit must be a whole number between 0 and 100.' };
    }
    if (!Number.isInteger(exam) || exam <= 0 || exam > 100) {
      return { success: false, message: 'Exam limit must be a whole number greater than 0 (up to 100).' };
    }
    if (ca1 + ca2 + exam !== 100) {
      return {
        success: false,
        message: `Total score limits must add up to exactly 100 (current total: ${ca1 + ca2 + exam}).`
      };
    }

    const { session: normSession, term: normTerm } = normalizeSessionAndTerm(session, term);
    const key = `${normSession}_${normTerm}`;
    const safeKey = key.replace(/[\/\s]/g, '_');

    const cleanRecord: Record<string, any> = {
      session: normSession,
      term: normTerm,
      maxCA1: ca1,
      maxCA2: ca2,
      maxExam: exam,
      maxTotal: 100,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'Staff / Admin'
    };

    // Strip any accidental undefined fields before setDoc
    Object.keys(cleanRecord).forEach((k) => {
      if (cleanRecord[k] === undefined) delete cleanRecord[k];
    });

    // 1. Save to specific term settings doc
    await setDoc(doc(db, 'settings', `scoring_${safeKey}`), cleanRecord, { merge: true });

    // 2. Also register in the master scoring_configs document
    await setDoc(
      doc(db, 'settings', 'scoring_configs'),
      {
        [key]: cleanRecord,
        [safeKey]: cleanRecord
      },
      { merge: true }
    );

    // 3. Update in-memory & safeStorage cache
    setCachedScoringConfig(normSession, normTerm, {
      maxCA1: ca1,
      maxCA2: ca2,
      maxExam: exam,
      maxTotal: 100
    });

    // 4. Update school data cache
    const cached = getCachedSchoolData();
    if (cached) {
      setCachedSchoolData({
        ...cached,
        scoringConfigs: {
          ...(cached.scoringConfigs || {}),
          [key]: { maxCA1: ca1, maxCA2: ca2, maxExam: exam, maxTotal: 100 }
        }
      });
    }

    return {
      success: true,
      message: `Score limits for ${normTerm} (${normSession}) successfully saved to Firebase Firestore!`
    };
  } catch (err: any) {
    console.error('Failed to save scoring config to Firebase:', err);
    return {
      success: false,
      message: `Failed to save score limits: ${err?.message || 'Firebase error'}`
    };
  }
}

/**
 * Format Attendance Doc ID helper
 */
export function getAttendanceDocId(className: string, session: string, term: TermType, date: string): string {
  const cleanClass = className.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanSession = session.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanDate = date.replace(/[^a-zA-Z0-9]/g, '_');
  return `${cleanClass}__${cleanSession}__${cleanTerm}__${cleanDate}`;
}

const LOCAL_ATTENDANCE_CACHE_KEY = 'school_portal_attendance_cache';

function getCachedAttendanceRecords(): DailyAttendanceRecord[] {
  try {
    const raw = safeStorage.getItem(LOCAL_ATTENDANCE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedAttendanceRecord(record: DailyAttendanceRecord) {
  try {
    const existing = getCachedAttendanceRecords().filter((r) => r.id !== record.id);
    existing.push(record);
    safeStorage.setItem(LOCAL_ATTENDANCE_CACHE_KEY, JSON.stringify(existing));
  } catch {}
}

/**
 * Save Daily Attendance Record in Firebase Firestore
 * Includes entry-level merging and IndexedDB offline queue fallback
 */
export async function saveDailyAttendance(
  record: DailyAttendanceRecord,
  options?: { fromOfflineQueue?: boolean }
): Promise<{ success: boolean; message: string; record?: DailyAttendanceRecord; queuedOffline?: boolean }> {
  const docId = getAttendanceDocId(record.className, record.session, record.term, record.date);
  const dataToSave: DailyAttendanceRecord = {
    ...record,
    id: docId,
    updatedAt: new Date().toISOString()
  };

  // Always cache locally immediately
  saveCachedAttendanceRecord(dataToSave);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (!options?.fromOfflineQueue) {
      await enqueueOfflineOperation(
        'SAVE_DAILY_ATTENDANCE',
        dataToSave,
        `Attendance for ${record.className} on ${record.date}`,
        `SAVE_DAILY_ATTENDANCE__${docId}`
      );
    }
    return {
      success: true,
      queuedOffline: true,
      message: `Offline mode: Attendance for ${record.className} on ${record.date} saved to local queue and will auto-sync when online!`,
      record: dataToSave
    };
  }

  try {
    const docRef = doc(db, 'attendance', docId);

    // Entry-level merge with any existing record for the same day
    try {
      const existingSnap = await Promise.race([
        getDoc(docRef),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Read timeout')), 5000))
      ]);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as DailyAttendanceRecord;
        const entryMap = new Map<string, AttendanceEntry>();
        (existingData.entries || []).forEach((e) => {
          entryMap.set(e.studentId.toUpperCase().trim(), e);
        });
        (record.entries || []).forEach((e) => {
          entryMap.set(e.studentId.toUpperCase().trim(), e);
        });
        const mergedEntries = Array.from(entryMap.values());
        dataToSave.entries = mergedEntries;
        dataToSave.totalPresent = mergedEntries.filter((e) => e.status === 'Present').length;
        dataToSave.totalAbsent = mergedEntries.filter((e) => e.status === 'Absent').length;
        dataToSave.totalLate = mergedEntries.filter((e) => e.status === 'Late').length;
        dataToSave.totalExcused = mergedEntries.filter((e) => e.status === 'Excused').length;
      }
    } catch {}

    await Promise.race([
      setDoc(docRef, dataToSave, { merge: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Attendance network write timed out')), 10000)
      )
    ]);

    saveCachedAttendanceRecord(dataToSave);

    return {
      success: true,
      message: `Daily attendance for ${record.className} on ${record.date} saved successfully to Firestore!`,
      record: dataToSave
    };
  } catch (err: any) {
    console.warn('Attendance save interrupted, queueing to IndexedDB offline queue:', err);
    if (!options?.fromOfflineQueue) {
      await enqueueOfflineOperation(
        'SAVE_DAILY_ATTENDANCE',
        dataToSave,
        `Attendance for ${record.className} on ${record.date}`,
        `SAVE_DAILY_ATTENDANCE__${docId}`
      );
      return {
        success: true,
        queuedOffline: true,
        message: `Network unstable: Attendance for ${record.className} on ${record.date} saved to Offline Queue and will auto-sync!`,
        record: dataToSave
      };
    }
    return {
      success: false,
      message: `Failed to save attendance: ${err.message || 'Firebase error'}`
    };
  }
}

/**
 * Fetch Daily Attendance Records for a class, session, and term
 * Merges live Firestore records with any locally cached/queued offline attendance records
 */
export async function fetchAttendanceRecords(
  className: string,
  session: string,
  term: TermType
): Promise<DailyAttendanceRecord[]> {
  const localRecords = getCachedAttendanceRecords().filter(
    (data) =>
      isMatchingClass(data.className, className) &&
      (data.session === session || !data.session) &&
      data.term === term
  );

  try {
    const snap = await Promise.race([
      getDocs(collection(db, 'attendance')),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Attendance fetch timeout')), 10000)
      )
    ]);
    const recordMap = new Map<string, DailyAttendanceRecord>();

    localRecords.forEach((r) => {
      const id = r.id || getAttendanceDocId(r.className, r.session, r.term, r.date);
      recordMap.set(id, { ...r, id });
    });

    snap.forEach((d) => {
      const data = d.data() as DailyAttendanceRecord;
      if (
        isMatchingClass(data.className, className) &&
        (data.session === session || !data.session) &&
        data.term === term
      ) {
        const existingLocal = recordMap.get(d.id);
        if (
          !existingLocal ||
          (data.updatedAt || '') >= (existingLocal.updatedAt || '')
        ) {
          recordMap.set(d.id, {
            ...data,
            id: d.id
          });
        }
      }
    });

    const merged = Array.from(recordMap.values());
    return merged.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } catch (err) {
    console.warn('Failed to fetch attendance records from Firestore, using local cache:', err);
    return localRecords.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
}

/**
 * Delete saved daily attendance records for a class, session and term.
 * Pass a `range` (inclusive YYYY-MM-DD dates) to clear only a day, week or month;
 * omit it to clear the whole term.
 */
export async function deleteAttendanceRecords(
  className: string,
  session: string,
  term: TermType,
  range?: { from: string; to: string }
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const records = await fetchAttendanceRecords(className, session, term);
    const toDelete = records.filter((r) => {
      if (!range) return true;
      const d = r.date || '';
      return d >= range.from && d <= range.to;
    });

    if (toDelete.length === 0) {
      return { success: true, message: 'No saved attendance found for that period.', count: 0 };
    }

    // Firestore batches are limited to 500 operations; chunk to stay well under.
    const CHUNK = 400;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + CHUNK).forEach((r) => {
        if (r.id) batch.delete(doc(db, 'attendance', r.id));
      });
      await batch.commit();
    }

    return {
      success: true,
      message: `Cleared ${toDelete.length} saved attendance record${toDelete.length === 1 ? '' : 's'}.`,
      count: toDelete.length
    };
  } catch (err: any) {
    console.error('Failed to delete attendance records:', err);
    return {
      success: false,
      message: `Failed to clear attendance: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Blank out Days Present / Days Opened on every pupil's report card for a class, session and term.
 */
export async function resetReportCardAttendance(
  className: string,
  session: string,
  term: TermType
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const stSnap = await getDocs(collection(db, 'students'));
    const classStudents: Student[] = [];
    stSnap.forEach((d) => {
      const st = d.data() as Student;
      if (isMatchingClass(st.Class, className)) classStudents.push(st);
    });

    if (classStudents.length === 0) {
      return { success: true, message: 'No pupils found in this class.', count: 0 };
    }

    const CHUNK = 400;
    for (let i = 0; i < classStudents.length; i += CHUNK) {
      const batch = writeBatch(db);
      classStudents.slice(i, i + CHUNK).forEach((student) => {
        batch.set(
          doc(db, 'summaries', getSummaryDocId(student.StudentID, session, term)),
          {
            StudentID: student.StudentID,
            Session: session,
            Term: term,
            DaysPresent: null,
            DaysOpened: null,
            UpdatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      });
      await batch.commit();
    }

    return {
      success: true,
      message: `Days Present / Days Opened cleared from ${classStudents.length} report cards.`,
      count: classStudents.length
    };
  } catch (err: any) {
    console.error('Failed to reset report card attendance:', err);
    return {
      success: false,
      message: `Failed to reset report card attendance: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

/**
 * Sync / Tally Attendance directly onto student report cards (StudentSummary)
 * Computes Days Present & Days Opened and saves them to student summaries in Firestore
 */
export async function syncAttendanceToReportCards(
  className: string,
  session: string,
  term: TermType,
  options?: {
    defaultDaysOpened?: number;
    manualTallies?: Record<string, { daysPresent: number; daysOpened: number }>;
    fromOfflineQueue?: boolean;
  }
): Promise<{ success: boolean; message: string; count: number; queuedOffline?: boolean }> {
  try {
    // 1. Fetch students for this class (fallback to cached students if offline)
    let classStudents: Student[] = [];
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = getCachedSchoolData();
      classStudents = (cached?.students || []).filter((st) => isMatchingClass(st.Class, className));
    } else {
      try {
        const stSnap = await Promise.race([
          getDocs(collection(db, 'students')),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);
        stSnap.forEach((d) => {
          const st = d.data() as Student;
          if (isMatchingClass(st.Class, className)) {
            classStudents.push(st);
          }
        });
      } catch {
        const cached = getCachedSchoolData();
        classStudents = (cached?.students || []).filter((st) => isMatchingClass(st.Class, className));
      }
    }

    if (classStudents.length === 0) {
      return { success: false, message: `No students found in ${className}.`, count: 0 };
    }

    // 2. Fetch daily attendance records if no manual override provided
    const dailyRecords = await fetchAttendanceRecords(className, session, term);
    const totalDaysRecorded = dailyRecords.length;
    const defaultDaysOpened = options?.defaultDaysOpened || (totalDaysRecorded > 0 ? totalDaysRecorded : 60);

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const student of classStudents) {
      let daysPresent = 0;
      let daysOpened = defaultDaysOpened;

      if (options?.manualTallies && options.manualTallies[student.StudentID]) {
        daysPresent = options.manualTallies[student.StudentID].daysPresent;
        daysOpened = options.manualTallies[student.StudentID].daysOpened || defaultDaysOpened;
      } else if (dailyRecords.length > 0) {
        // Tally from daily records
        daysPresent = dailyRecords.filter((rec) => {
          const entry = rec.entries?.find(
            (e) => (e.studentId || '').toLowerCase() === student.StudentID.toLowerCase()
          );
          return entry && (entry.status === 'Present' || entry.status === 'Late');
        }).length;
        daysOpened = Math.max(dailyRecords.length, defaultDaysOpened);
      } else {
        daysPresent = 0;
      }

      const summaryDocId = getSummaryDocId(student.StudentID, session, term);
      const summaryDocRef = doc(db, 'summaries', summaryDocId);

      batch.set(
        summaryDocRef,
        {
          StudentID: student.StudentID,
          Session: session,
          Term: term,
          DaysPresent: daysPresent,
          DaysOpened: daysOpened,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      updatedCount++;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Offline mode');
    }

    if (updatedCount > 0) {
      await Promise.race([
        batch.commit(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sync write timeout')), 10000))
      ]);
    }

    return {
      success: true,
      message: `Successfully tallied attendance (Days Present & Days Opened) for ${updatedCount} pupils in ${className} directly onto their report cards!`,
      count: updatedCount
    };
  } catch (err: any) {
    console.warn('Attendance tally sync interrupted, queueing to IndexedDB offline queue:', err);
    if (!options?.fromOfflineQueue) {
      const dedupeKey = `SYNC_ATTENDANCE__${getClassDocId(className)}__${session}__${term}`;
      await enqueueOfflineOperation(
        'SYNC_ATTENDANCE_TO_REPORT_CARDS',
        {
          className,
          session,
          term,
          options: {
            defaultDaysOpened: options?.defaultDaysOpened,
            manualTallies: options?.manualTallies
          }
        },
        `Tally attendance onto report cards for ${className} (${term}, ${session})`,
        dedupeKey
      );
      return {
        success: true,
        queuedOffline: true,
        message: `Offline mode: Attendance tally for ${className} queued locally and will auto-sync to report cards when internet returns!`,
        count: 0
      };
    }
    return {
      success: false,
      message: `Failed to tally attendance: ${err.message || 'Firebase error'}`,
      count: 0
    };
  }
}

let activeOfflineSyncPromise: Promise<{
  syncedCount: number;
  remainingCount: number;
}> | null = null;

/**
 * Replay all pending score & attendance operations from the IndexedDB Offline Queue
 * Uses a singleton mutex lock so concurrent triggers never race or duplicate writes
 */
export async function processOfflineSyncQueue(): Promise<{
  syncedCount: number;
  remainingCount: number;
}> {
  if (activeOfflineSyncPromise) {
    return activeOfflineSyncPromise;
  }

  activeOfflineSyncPromise = (async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const pending = await getOfflineQueueItems();
      return { syncedCount: 0, remainingCount: pending.length };
    }

    const items = await getOfflineQueueItems();
    if (items.length === 0) {
      return { syncedCount: 0, remainingCount: 0 };
    }

    setOfflineSyncingState(true);
    let syncedCount = 0;

    try {
      for (const item of items) {
        let success = false;
        try {
          if (item.type === 'SAVE_REPORT_CARD') {
            const res = await saveStudentReportCard(item.payload, { fromOfflineQueue: true });
            success = res.success && !res.queuedOffline;
          } else if (item.type === 'SAVE_BATCH_SCORES') {
            const res = await saveBatchSubjectScores(item.payload, { fromOfflineQueue: true });
            success = res.success && !res.queuedOffline;
          } else if (item.type === 'SAVE_DAILY_ATTENDANCE') {
            const res = await saveDailyAttendance(item.payload, { fromOfflineQueue: true });
            success = res.success && !res.queuedOffline;
          } else if (item.type === 'SYNC_ATTENDANCE_TO_REPORT_CARDS') {
            const { className, session, term, options } = item.payload;
            const res = await syncAttendanceToReportCards(className, session, term, {
              ...options,
              fromOfflineQueue: true
            });
            success = res.success && !res.queuedOffline;
          }
        } catch (err: any) {
          await updateOfflineQueueItem({
            ...item,
            retryCount: (item.retryCount || 0) + 1,
            lastError: err?.message || 'Sync error'
          });
        }

        if (success) {
          await removeOfflineQueueItem(item.id);
          syncedCount++;
        } else {
          await updateOfflineQueueItem({
            ...item,
            retryCount: (item.retryCount || 0) + 1
          });
        }
      }
    } finally {
      setOfflineSyncingState(false);
    }

    const remaining = await getOfflineQueueItems();
    return { syncedCount, remainingCount: remaining.length };
  })();

  try {
    return await activeOfflineSyncPromise;
  } finally {
    activeOfflineSyncPromise = null;
  }
}

/**
 * Execute Session Rollover & Promotion Engine
 * Promotes students (e.g. Basic 1 → Basic 2, JSS 3 → SSS 1), archives graduating classes (SSS 3 → Graduated Alumni),
 * updates student classes in Firestore, updates student summary promotion decisions, and logs the execution.
 */
export async function executeSessionRollover(options: {
  currentSession: string;
  nextSession: string;
  studentDecisions: RolloverStudentDecision[];
  executedBy?: string;
  notes?: string;
}): Promise<{
  success: boolean;
  message: string;
  summary: {
    total: number;
    promoted: number;
    repeated: number;
    graduated: number;
  };
}> {
  try {
    const { currentSession, nextSession, studentDecisions, executedBy, notes } = options;
    if (!studentDecisions || studentDecisions.length === 0) {
      return {
        success: false,
        message: 'No student promotion decisions provided for rollover.',
        summary: { total: 0, promoted: 0, repeated: 0, graduated: 0 }
      };
    }

    const stSnap = await getDocs(collection(db, 'students'));
    const studentDocMap = new Map<string, any>();
    stSnap.forEach((d) => {
      const data = d.data() as Student;
      studentDocMap.set(data.StudentID.toUpperCase().trim(), d.ref);
    });

    const batch = writeBatch(db);
    let promoted = 0;
    let repeated = 0;
    let graduated = 0;

    for (const dec of studentDecisions) {
      const cleanId = dec.studentId.toUpperCase().trim();
      const stRef = studentDocMap.get(cleanId);
      if (!stRef) continue;

      let newClass = dec.currentClass;
      let finalDecisionText = dec.promotionDecisionText || 'Promoted';

      if (dec.action === 'Promote' || dec.action === 'PromoteOnTrial' || dec.action === 'Custom') {
        newClass = dec.targetClass;
        finalDecisionText = `Promoted to ${dec.targetClass}`;
        promoted++;
      } else if (dec.action === 'Repeat') {
        newClass = dec.currentClass;
        finalDecisionText = `Advised to Repeat ${dec.currentClass}`;
        repeated++;
      } else if (dec.action === 'Graduate') {
        newClass = 'Graduated (Alumni)';
        finalDecisionText = 'Graduated';
        graduated++;
      }

      // Update Student's enrolled class in students collection
      batch.update(stRef, {
        Class: newClass,
        UpdatedAt: new Date().toISOString()
      });

      // Save promotion decision in currentSession's Third Term StudentSummary
      const summaryDocId = getSummaryDocId(dec.studentId, currentSession, 'Third Term');
      const summaryDocRef = doc(db, 'summaries', summaryDocId);
      batch.set(
        summaryDocRef,
        {
          StudentID: dec.studentId,
          Session: currentSession,
          Term: 'Third Term' as TermType,
          PromotionDecision: finalDecisionText,
          UpdatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }

    // Save Rollover History Log in settings/rollover_history
    const historyDocId = `rollover_${currentSession.replace(/[^a-zA-Z0-9]/g, '_')}_to_${nextSession.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const historyRef = doc(db, 'settings', 'rollover_history');
    const historySnap = await getDoc(historyRef);
    const existingLogs: RolloverHistoryRecord[] = historySnap.exists() ? (historySnap.data()?.logs || []) : [];

    const newLog: RolloverHistoryRecord = {
      id: historyDocId,
      timestamp: new Date().toISOString(),
      fromSession: currentSession,
      toSession: nextSession,
      promotedCount: promoted,
      repeatedCount: repeated,
      graduatedCount: graduated,
      executedBy: executedBy || 'Administrator',
      notes: notes || `Annual Rollover from ${currentSession} to ${nextSession}`
    };

    batch.set(historyRef, {
      logs: [newLog, ...existingLogs],
      lastRollover: newLog,
      currentActiveSession: nextSession,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();

    return {
      success: true,
      message: `Academic Session Rollover Completed! Successfully transitioned ${promoted} pupils to next grade level, held ${repeated} repeaters, and archived ${graduated} graduating pupils into Alumni.`,
      summary: {
        total: studentDecisions.length,
        promoted,
        repeated,
        graduated
      }
    };
  } catch (err: any) {
    console.error('Failed to execute session rollover:', err);
    return {
      success: false,
      message: `Failed to execute session rollover: ${err.message || 'Firebase error'}`,
      summary: { total: 0, promoted: 0, repeated: 0, graduated: 0 }
    };
  }
}

/**
 * Fetch Session Rollover Logs & History
 */
export async function fetchRolloverHistory(): Promise<RolloverHistoryRecord[]> {
  try {
    const historyRef = doc(db, 'settings', 'rollover_history');
    const snap = await getDoc(historyRef);
    if (snap.exists() && snap.data()?.logs) {
      return snap.data()?.logs as RolloverHistoryRecord[];
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch rollover history from Firebase:', err);
    return [];
  }
}

/**
 * Get Cached Website Configuration immediately from localStorage
 */
export function getCachedWebsiteConfig(): WebsiteConfig | null {
  try {
    const cached =
      safeStorage.getItem(WEBSITE_CACHE_KEY) ||
      safeStorage.getItem('school_branding_config') ||
      safeStorage.getItem('school_website_config_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed) {
        if (
          parsed.schoolName &&
          (parsed.schoolName.includes('Supreme') ||
           parsed.schoolName.includes('Eminent') ||
           parsed.schoolName.includes('ERCA'))
        ) {
          safeStorage.removeItem(WEBSITE_CACHE_KEY);
          safeStorage.removeItem('school_branding_config');
          safeStorage.removeItem('school_website_config_cache');
          return DEFAULT_WEBSITE_CONFIG;
        }
        if (parsed.enableFacilities === undefined) {
          parsed.enableFacilities = false;
        }
        if (parsed.enableGallery === undefined) {
          parsed.enableGallery = false;
        }
        if (!parsed.gallery || parsed.gallery.length === 0) {
          parsed.gallery = DEFAULT_WEBSITE_CONFIG.gallery;
        }
        return {
          ...DEFAULT_WEBSITE_CONFIG,
          ...parsed
        };
      }
    }
  } catch {}
  return DEFAULT_WEBSITE_CONFIG;
}

/**
 * Recursively strips any undefined values from an object before passing to Firestore setDoc/updateDoc.
 * Firestore strictly rejects undefined field values.
 */
export function cleanFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return (obj === undefined ? '' : null) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestorePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestorePayload(value);
      } else {
        cleaned[key] = ''; // Convert undefined fields to empty string instead of undefined
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Fetch Public Website Configuration from Firestore
 */
export async function fetchWebsiteConfig(): Promise<WebsiteConfig> {
  try {
    const websiteDocRef = doc(db, 'settings', 'website_config');
    const snap = await getDoc(websiteDocRef);
    if (snap.exists()) {
      const data = snap.data() as WebsiteConfig;
      // Merge with defaults to ensure all required fields and facilities exist
      const merged: WebsiteConfig = {
        ...DEFAULT_WEBSITE_CONFIG,
        ...data,
        stampLogoUrl: data.stampLogoUrl || DEFAULT_WEBSITE_CONFIG.stampLogoUrl || '',
        enableFacilities: data.enableFacilities === true,
        enableGallery: data.enableGallery === true,
        facilities: data.facilities && data.facilities.length > 0 ? data.facilities : DEFAULT_WEBSITE_CONFIG.facilities,
        gallery: data.gallery && data.gallery.length > 0 ? data.gallery : DEFAULT_WEBSITE_CONFIG.gallery,
        programmes: data.programmes && data.programmes.length > 0 ? data.programmes : DEFAULT_WEBSITE_CONFIG.programmes,
        values: data.values && data.values.length > 0 ? data.values : DEFAULT_WEBSITE_CONFIG.values,
        announcements: data.announcements && data.announcements.length > 0 ? data.announcements : DEFAULT_WEBSITE_CONFIG.announcements
      };

      safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(merged));
      saveSchoolBrandingLocally(merged);
      return merged;
    }

    // If not yet saved in Firestore, store defaults
    await setDoc(websiteDocRef, cleanFirestorePayload(DEFAULT_WEBSITE_CONFIG), { merge: true });
    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(DEFAULT_WEBSITE_CONFIG));
    saveSchoolBrandingLocally(DEFAULT_WEBSITE_CONFIG);
    return DEFAULT_WEBSITE_CONFIG;
  } catch (err) {
    console.warn('Failed to fetch website config from Firestore, loading local cache:', err);
    try {
      const cached = safeStorage.getItem(WEBSITE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          saveSchoolBrandingLocally(parsed);
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_WEBSITE_CONFIG;
  }
}

/**
 * Save & Publish Website Configuration to Firestore Live Website
 */
export async function saveWebsiteConfig(
  config: Partial<WebsiteConfig> | WebsiteConfig,
  publishedBy = 'Administrator'
): Promise<{ success: boolean; message: string; config: WebsiteConfig }> {
  try {
    const base = getCachedWebsiteConfig() || DEFAULT_WEBSITE_CONFIG;
    const updatedConfig: WebsiteConfig = {
      ...base,
      ...config,
      stampLogoUrl: config.stampLogoUrl !== undefined ? config.stampLogoUrl : (base.stampLogoUrl || ''),
      lastPublishedAt: new Date().toISOString(),
      lastPublishedBy: publishedBy
    };

    const cleanPayload = cleanFirestorePayload(updatedConfig);
    const websiteDocRef = doc(db, 'settings', 'website_config');
    await setDoc(websiteDocRef, cleanPayload, { merge: true });

    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(updatedConfig));
    saveSchoolBrandingLocally(updatedConfig);

    return {
      success: true,
      message: 'Website changes and branding updates successfully published to the live school website!',
      config: updatedConfig
    };
  } catch (err: any) {
    console.error('Failed to publish website config to Firestore:', err);
    const base = getCachedWebsiteConfig() || DEFAULT_WEBSITE_CONFIG;
    const merged: WebsiteConfig = {
      ...base,
      ...config,
      stampLogoUrl: config.stampLogoUrl !== undefined ? config.stampLogoUrl : (base.stampLogoUrl || '')
    };
    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(merged));
    saveSchoolBrandingLocally(merged);
    return {
      success: true,
      message: 'Website configuration saved to local cache (Firebase offline).',
      config: merged
    };
  }
}

/**
 * Reset Website Configuration back to default template preset
 */
export async function resetWebsiteConfig(): Promise<{ success: boolean; message: string; config: WebsiteConfig }> {
  try {
    const websiteDocRef = doc(db, 'settings', 'website_config');
    await setDoc(websiteDocRef, cleanFirestorePayload(DEFAULT_WEBSITE_CONFIG), { merge: false });

    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(DEFAULT_WEBSITE_CONFIG));

    return {
      success: true,
      message: 'Website content and facilities successfully reset to default template.',
      config: DEFAULT_WEBSITE_CONFIG
    };
  } catch (err: any) {
    console.error('Failed to reset website config in Firestore:', err);
    safeStorage.setItem(WEBSITE_CACHE_KEY, JSON.stringify(DEFAULT_WEBSITE_CONFIG));
    return {
      success: true,
      message: 'Website content reset locally.',
      config: DEFAULT_WEBSITE_CONFIG
    };
  }
}

/**
 * Alias object export for seamless compatibility
 */
export const SupabaseService = {
  isConfigured: () => true,
  exportSchoolBackup,
  restoreSchoolBackup,
  loadAllData,
  fetchClasses,
  saveClass,
  deleteClass,
  updateClass,
  fetchFreshStudentData,
  saveStudentReportCard,
  saveBatchSubjectScores,
  deleteStudentReportCard,
  saveStudent,
  updateStudentProfileAndIdentifier,
  promoteClassStudents,
  resetAllStaffPasswords,
  addStudent,
  createStudentWithNextId,
  getNextStudentIdPreview,
  isSecondaryClass,
  STUDENT_ID_PREFIX,
  SECONDARY_STUDENT_ID_PREFIX,
  deleteStudent,
  bulkUploadStudents,
  addSubject,
  deleteSubject,
  updateTeacherCredentials,
  createTeacher,
  deleteTeacher,
  resetClassStudentPasswords,
  updateStudentPassword,
  getPublishedRecords,
  isClassResultPublished,
  subscribeToPublishedRecords,
  setClassPublishStatus,
  fetchGradingScales,
  saveGradingScales,
  fetchScoringConfig,
  fetchAllScoringConfigs,
  saveScoringConfig,
  saveDailyAttendance,
  fetchAttendanceRecords,
  deleteAttendanceRecords,
  resetReportCardAttendance,
  syncAttendanceToReportCards,
  processOfflineSyncQueue,
  getOfflineQueueItems,
  subscribeToOfflineQueue,
  executeSessionRollover,
  fetchRolloverHistory,
  getCachedWebsiteConfig,
  fetchWebsiteConfig,
  saveWebsiteConfig,
  resetWebsiteConfig,
  clearAllMockData,
  seedInitialDatabase,
  getDatabaseStats
};

// Also export as SheetService alias so any residual imports resolve cleanly
export const FirebaseService = SupabaseService;
export const SheetService = SupabaseService;
export const INITIAL_MOCK_SUBJECTS = INITIAL_DEFAULT_SUBJECTS;
