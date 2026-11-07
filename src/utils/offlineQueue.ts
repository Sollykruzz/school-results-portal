/**
 * IndexedDB-Backed Offline Sync Queue for Scores & Attendance
 * Ensures zero data loss during intermittent campus internet connections.
 */

export type OfflineOperationType =
  | 'SAVE_REPORT_CARD'
  | 'SAVE_BATCH_SCORES'
  | 'SAVE_DAILY_ATTENDANCE'
  | 'SYNC_ATTENDANCE_TO_REPORT_CARDS';

export interface OfflineQueueItem {
  id: string;
  type: OfflineOperationType;
  payload: any;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError?: string;
  description: string;
}

const DB_NAME = 'school_portal_offline_queue_db';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';
const FALLBACK_STORAGE_KEY = 'school_portal_offline_queue_fallback';

type QueueListener = (items: OfflineQueueItem[], isSyncing: boolean) => void;
const listeners = new Set<QueueListener>();
let currentlySyncing = false;

function notifyListeners(items: OfflineQueueItem[]) {
  listeners.forEach((listener) => {
    try {
      listener(items, currentlySyncing);
    } catch (e) {
      console.warn('Offline queue listener error:', e);
    }
  });
}

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function getFallbackQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setFallbackQueue(items: OfflineQueueItem[]) {
  try {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export async function getOfflineQueueItems(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openQueueDB();
    return await new Promise<OfflineQueueItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as OfflineQueueItem[];
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return getFallbackQueue().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }
}

/**
 * Intelligently merge two offline payloads of the same type & key so earlier offline edits are never lost
 */
function mergeOfflinePayloads(
  type: OfflineOperationType,
  existingPayload: any,
  incomingPayload: any
): any {
  if (!existingPayload) return incomingPayload;

  if (type === 'SAVE_BATCH_SCORES') {
    const scoreMap = new Map<string, any>();
    (existingPayload.scores || []).forEach((s: any) => {
      const key = `${String(s.studentId || '').toLowerCase()}__${String(s.subject || '').toLowerCase()}`;
      scoreMap.set(key, s);
    });
    (incomingPayload.scores || []).forEach((s: any) => {
      const key = `${String(s.studentId || '').toLowerCase()}__${String(s.subject || '').toLowerCase()}`;
      const prev = scoreMap.get(key);
      if (!prev) {
        scoreMap.set(key, s);
      } else {
        const ca1 = s.ca1 !== null && s.ca1 !== undefined ? s.ca1 : s.clearCA1 ? null : prev.ca1;
        const ca2 = s.ca2 !== null && s.ca2 !== undefined ? s.ca2 : s.clearCA2 ? null : prev.ca2;
        const exam = s.exam !== null && s.exam !== undefined ? s.exam : s.clearExam ? null : prev.exam;
        const total =
          ca1 !== null || ca2 !== null || exam !== null
            ? (ca1 || 0) + (ca2 || 0) + (exam || 0)
            : null;
        scoreMap.set(key, {
          ...prev,
          ...s,
          ca1,
          ca2,
          exam,
          total,
          clearCA1: Boolean(s.clearCA1 || (prev.clearCA1 && ca1 === null)),
          clearCA2: Boolean(s.clearCA2 || (prev.clearCA2 && ca2 === null)),
          clearExam: Boolean(s.clearExam || (prev.clearExam && exam === null))
        });
      }
    });
    return {
      ...existingPayload,
      ...incomingPayload,
      scores: Array.from(scoreMap.values())
    };
  }

  if (type === 'SAVE_REPORT_CARD') {
    const scoreMap = new Map<string, any>();
    (existingPayload.scores || []).forEach((s: any) => {
      const key = String(s.Subject || '').trim().toLowerCase();
      if (key) scoreMap.set(key, s);
    });
    (incomingPayload.scores || []).forEach((s: any) => {
      const key = String(s.Subject || '').trim().toLowerCase();
      if (!key) return;
      const prev = scoreMap.get(key);
      if (!prev) {
        scoreMap.set(key, s);
      } else {
        const CA1 = s.CA1 !== null && s.CA1 !== undefined ? s.CA1 : s.clearCA1 ? null : prev.CA1;
        const CA2 = s.CA2 !== null && s.CA2 !== undefined ? s.CA2 : s.clearCA2 ? null : prev.CA2;
        const Exam = s.Exam !== null && s.Exam !== undefined ? s.Exam : s.clearExam ? null : prev.Exam;
        const Total =
          CA1 !== null || CA2 !== null || Exam !== null
            ? (CA1 || 0) + (CA2 || 0) + (Exam || 0)
            : null;
        scoreMap.set(key, {
          ...prev,
          ...s,
          CA1,
          CA2,
          Exam,
          Total,
          clearCA1: Boolean(s.clearCA1 || (prev.clearCA1 && CA1 === null)),
          clearCA2: Boolean(s.clearCA2 || (prev.clearCA2 && CA2 === null)),
          clearExam: Boolean(s.clearExam || (prev.clearExam && Exam === null))
        });
      }
    });

    const prevSum = existingPayload.summary || {};
    const nextSum = incomingPayload.summary || {};

    return {
      ...existingPayload,
      ...incomingPayload,
      scores: Array.from(scoreMap.values()),
      summary: {
        ...prevSum,
        ...nextSum,
        DaysPresent: nextSum.DaysPresent ?? prevSum.DaysPresent ?? null,
        DaysOpened: nextSum.DaysOpened ?? prevSum.DaysOpened ?? null,
        TeacherComment: nextSum.TeacherComment || prevSum.TeacherComment || '',
        PrincipalComment: nextSum.PrincipalComment || prevSum.PrincipalComment || '',
        AffectiveRatings: { ...(prevSum.AffectiveRatings || {}), ...(nextSum.AffectiveRatings || {}) },
        PsychomotorRatings: { ...(prevSum.PsychomotorRatings || {}), ...(nextSum.PsychomotorRatings || {}) },
        PromotionDecision: nextSum.PromotionDecision || prevSum.PromotionDecision || ''
      }
    };
  }

  return incomingPayload;
}

export async function enqueueOfflineOperation(
  type: OfflineOperationType,
  payload: any,
  description: string,
  dedupeKey?: string
): Promise<OfflineQueueItem> {
  const id = dedupeKey || `${type}__${Date.now()}__${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const existingItems = await getOfflineQueueItems();
  const existingItem = existingItems.find((i) => i.id === id);

  const mergedPayload = existingItem
    ? mergeOfflinePayloads(type, existingItem.payload, payload)
    : payload;

  const item: OfflineQueueItem = {
    id,
    type,
    payload: mergedPayload,
    createdAt: existingItem?.createdAt || now,
    updatedAt: now,
    retryCount: 0,
    description
  };

  try {
    const db = await openQueueDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const current = getFallbackQueue().filter((i) => i.id !== id);
    current.push(item);
    setFallbackQueue(current);
  }

  const allItems = await getOfflineQueueItems();
  notifyListeners(allItems);
  return item;
}

export async function removeOfflineQueueItem(id: string): Promise<void> {
  try {
    const db = await openQueueDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const current = getFallbackQueue().filter((i) => i.id !== id);
    setFallbackQueue(current);
  }

  const allItems = await getOfflineQueueItems();
  notifyListeners(allItems);
}

export async function updateOfflineQueueItem(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openQueueDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const current = getFallbackQueue().map((i) => (i.id === item.id ? item : i));
    setFallbackQueue(current);
  }

  const allItems = await getOfflineQueueItems();
  notifyListeners(allItems);
}

export function subscribeToOfflineQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  getOfflineQueueItems().then((items) => {
    listener(items, currentlySyncing);
  });
  return () => {
    listeners.delete(listener);
  };
}

export function setOfflineSyncingState(syncing: boolean) {
  currentlySyncing = syncing;
  getOfflineQueueItems().then((items) => {
    notifyListeners(items);
  });
}
