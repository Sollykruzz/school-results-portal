import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { safeStorage } from '../utils/safeStorage';

export type FirestoreLike = { client: SupabaseClient };
export type CollectionReference = { kind: 'collection'; collection: string };
export type DocumentReference = { kind: 'document'; collection: string; id: string };
export type QueryConstraint = { field: string; operator: '=='; value: unknown };
export type QueryReference = { kind: 'query'; collection: string; constraints: QueryConstraint[] };

type Row = { collection: string; doc_id: string; data: any; updated_at?: string };

const rawUrl =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_SUPABASE_URL ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
      import.meta.env.SUPABASE_URL)) ||
  '';
const rawKey =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.SUPABASE_ANON_KEY)) ||
  '';

const supabaseUrl = String(rawUrl).trim();
const supabaseKey = String(rawKey).trim();

// Keep one authoritative configuration check for every service and UI status.
export const isConfigured = Boolean(
  /^https:\/\/[^\s]+$/i.test(supabaseUrl) &&
    supabaseKey.length > 20 &&
    !/placeholder|offline/i.test(supabaseUrl)
);

// Fallback dummy credentials prevent @supabase/supabase-js from throwing on initialization
export const db: FirestoreLike = {
  client: createClient(
    isConfigured ? rawUrl : 'https://placeholder-offline-db.supabase.co',
    isConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'
  )
};

export const collection = (_db: FirestoreLike, name: string): CollectionReference => ({
  kind: 'collection',
  collection: name
});

export const doc = (_db: FirestoreLike, name: string, id: string): DocumentReference => ({
  kind: 'document',
  collection: name,
  id
});

export const query = (
  source: CollectionReference,
  ...constraints: QueryConstraint[]
): QueryReference => ({
  kind: 'query',
  collection: source.collection,
  constraints
});

export const where = (field: string, operator: '==', value: unknown): QueryConstraint => ({
  field,
  operator,
  value
});

const sourceFor = (source: CollectionReference | QueryReference) => source;

// Safe localStorage persistence helpers for offline or unconfigured mode
function getLocalRows(collectionName: string): Row[] {
  try {
    const raw = safeStorage.getItem(`school_coll_${collectionName}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalRows(collectionName: string, rows: Row[]): void {
  try {
    safeStorage.setItem(`school_coll_${collectionName}`, JSON.stringify(rows));
  } catch {}
}

const rowsFor = async (
  source: CollectionReference | QueryReference,
  client: SupabaseClient
): Promise<Row[]> => {
  const collName = sourceFor(source).collection;

  if (!isConfigured) {
    let rows = getLocalRows(collName);
    if (source.kind === 'query') {
      rows = rows.filter((r) =>
        source.constraints.every((c) => String(r.data?.[c.field]) === String(c.value))
      );
    }
    return rows;
  }

  try {
    let request = client
      .from('school_portal_records')
      .select('collection, doc_id, data, updated_at')
      .eq('collection', collName);
    if (source.kind === 'query') {
      for (const constraint of source.constraints) {
        request = request.eq(`data->>${constraint.field}`, String(constraint.value));
      }
    }
    const { data, error } = await request;
    if (error) throw error;
    return (data || []) as Row[];
  } catch (error) {
    // Never turn a live Supabase outage into an empty login/data result.
    // Local fallback is only valid when the app is intentionally offline.
    console.warn('Supabase read failed:', error);
    throw error;
  }
};

const snapshot = (rows: Row[]) => {
  const docs = rows.map((row) => ({
    id: row.doc_id,
    ref: { kind: 'document' as const, collection: row.collection, id: row.doc_id },
    data: () => row.data,
    exists: () => true
  }));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (callback: (value: (typeof docs)[number]) => void) => docs.forEach(callback)
  };
};

export async function getDocs(source: CollectionReference | QueryReference) {
  return snapshot(await rowsFor(source, db.client));
}
export const getDocsFromServer = getDocs;

export async function getDoc(reference: DocumentReference): Promise<any> {
  const collName = reference.collection;
  const docId = reference.id;

  if (!isConfigured) {
    const rows = getLocalRows(collName);
    const found = rows.find((r) => r.doc_id === docId);
    return {
      id: docId,
      ref: reference,
      exists: () => Boolean(found),
      data: () => found?.data || undefined
    };
  }

  try {
    const { data, error } = await db.client
      .from('school_portal_records')
      .select('collection, doc_id, data')
      .eq('collection', collName)
      .eq('doc_id', docId)
      .maybeSingle();
    if (error) throw error;
    return {
      id: docId,
      ref: reference,
      exists: () => Boolean(data),
      data: () => data?.data || undefined
    };
  } catch (error) {
    console.warn('Supabase document read failed:', error);
    throw error;
  }
}

export async function setDoc(
  reference: DocumentReference,
  value: any,
  options?: { merge?: boolean; mustExist?: boolean }
) {
  const collName = reference.collection;
  const docId = reference.id;
  let payload = value;

  const rows = getLocalRows(collName);
  const existingIdx = rows.findIndex((r) => r.doc_id === docId);

  if (options?.merge || options?.mustExist) {
    // A merge must be applied to the REAL stored row. Merging only with this browser's
    // local copy used to overwrite the whole remote row with just the patch
    // (e.g. { Password } or { Class }), wiping StudentID/FullName and making the
    // record vanish from lists and login while its ID stayed "assigned".
    let base: any = existingIdx >= 0 ? rows[existingIdx].data : undefined;
    if (isConfigured) {
      const { data: remote, error } = await db.client
        .from('school_portal_records')
        .select('data')
        .eq('collection', collName)
        .eq('doc_id', docId)
        .maybeSingle();
      if (error) throw error; // never write a partial patch over a row we could not read
      base = remote?.data || undefined;
    }
    if (options?.mustExist && !base) return; // update() on a missing doc must not create a ghost row
    payload = { ...(base || {}), ...value };
  }

  const updatedRow: Row = {
    collection: collName,
    doc_id: docId,
    data: payload,
    updated_at: new Date().toISOString()
  };
  if (existingIdx >= 0) {
    rows[existingIdx] = updatedRow;
  } else {
    rows.push(updatedRow);
  }
  if (!isConfigured) {
    saveLocalRows(collName, rows);
    return;
  }

  const { error } = await db.client.from('school_portal_records').upsert(
    {
      collection: collName,
      doc_id: docId,
      data: payload,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'collection,doc_id' }
  );
  if (error) throw error;

  // Keep a best-effort local mirror only after the authoritative remote write succeeds.
  saveLocalRows(collName, rows);
}

export async function deleteDoc(reference: DocumentReference) {
  const collName = reference.collection;
  const docId = reference.id;

  const rows = getLocalRows(collName).filter((r) => r.doc_id !== docId);

  if (!isConfigured) {
    saveLocalRows(collName, rows);
    return;
  }

  const { error } = await db.client
    .from('school_portal_records')
    .delete()
    .eq('collection', collName)
    .eq('doc_id', docId);
  if (error) throw error;

  saveLocalRows(collName, rows);
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export const Timestamp = {
  now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() })
};

export function writeBatch(_db: FirestoreLike) {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (reference: DocumentReference, value: any, options?: { merge?: boolean }) =>
      operations.push(() => setDoc(reference, value, options)),
    update: (reference: DocumentReference, value: any) =>
      operations.push(() => setDoc(reference, value, { merge: true, mustExist: true })),
    delete: (reference: DocumentReference) =>
      operations.push(() => deleteDoc(reference)),
    commit: () =>
      Promise.all(operations.map((operation) => operation())).then(() => undefined)
  };
}

export async function runTransaction(
  _db: FirestoreLike,
  callback: (transaction: { get: typeof getDoc; set: typeof setDoc }) => Promise<any>
): Promise<any> {
  const transaction = { get: getDoc, set: setDoc };
  return callback(transaction);
}

export function onSnapshot(
  source: CollectionReference | QueryReference,
  next: (value: ReturnType<typeof snapshot>) => void,
  error?: (reason: unknown) => void
) {
  let active = true;
  const poll = async () => {
    try {
      if (active) next(await getDocs(source));
    } catch (reason) {
      error?.(reason);
    }
  };
  void poll();
  if (typeof window !== 'undefined') {
    const timer = window.setInterval(poll, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }
  return () => {
    active = false;
  };
}

export function handleSupabaseError(
  error: unknown,
  operationType: string,
  path: string | null
) {
  console.warn('Database operation notice:', {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  });
}

export default db;
