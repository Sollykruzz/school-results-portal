/**
 * Re-export FirebaseService as sheetService for backward compatibility
 * All data storage and retrieval is now powered by Firebase Firestore
 */

export * from './firebaseService';
export { SupabaseService as default } from './firebaseService';
