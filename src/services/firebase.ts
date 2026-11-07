import { db, handleSupabaseError } from './supabaseFirestore';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : ({} as Record<string, string>);

export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '',
  publishableKey: env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
};

export const firebaseConfig = {
  projectId: supabaseConfig.url ? 'supabase' : 'offline_school_portal',
  apiKey: supabaseConfig.publishableKey || 'offline_key',
  authDomain: supabaseConfig.url || 'localhost'
};

export const HARDCODED_DATABASE_ID = 'school_portal_records';
export const app = db;
export const auth = null;
export const handleFirestoreError = handleSupabaseError;
export { handleSupabaseError, db };
export default db;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
