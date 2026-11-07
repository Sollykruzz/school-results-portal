/**
 * ============================================================================
 * SCHOOL BRAND & IDENTITY TEMPLATE CONFIGURATION
 * ============================================================================
 * 
 * This file serves as the SINGLE SOURCE OF TRUTH for customizing this school
 * management system, student result portal, and continuous assessment system
 * for any school.
 * 
 * HOW TO USE FOR A NEW SCHOOL DEPLOYMENT:
 * ----------------------------------------------------------------------------
 * 1. Modify the `DEFAULT_SCHOOL_CONFIG` values below with the new school's details:
 *    - School Name, Acronym, Motto, Address, Phone, WhatsApp, Email, Logo
 * 
 * 2. (Optional) Place the new school's logo in `/public/school-logo.png`
 *    OR provide an image URL / base64 image string in `logoUrl`.
 * 
 * 3. (Optional) In production environments (Vercel, Netlify, Cloud Run, etc.),
 *    you can also override these values dynamically using Environment Variables:
 *    - VITE_SCHOOL_NAME="Your School Name"
 *    - VITE_SCHOOL_SHORT_NAME="Your School"
 *    - VITE_SCHOOL_MOTTO="Your School Motto"
 *    - VITE_SCHOOL_PHONE="08012345678"
 *    - VITE_SCHOOL_WHATSAPP="08012345678"
 *    - VITE_SCHOOL_ADDRESS="123 Education Boulevard"
 *    - VITE_SCHOOL_CITY_STATE="Lagos, Nigeria"
 *    - VITE_SCHOOL_EMAIL="admin@yourschool.edu.ng"
 *    - VITE_SCHOOL_LOGO_URL="/school-logo.png"
 * 
 * 4. You can also customize all identifiers directly from the live app
 *    via Admin Dashboard -> School Profile & White-Label Setup.
 */

export interface SchoolTemplateConfig {
  /** Full official legal/institution name for headers, certificates, report cards */
  schoolName: string;
  /** Short or everyday name used in mobile navigation and tight UI spaces */
  shortName: string;
  /** Acronym / initials for badges and icons (e.g. "DGOS", "ERC") */
  acronym: string;
  /** Primary institutional motto */
  motto: string;
  /** Sub-motto or core pillars displayed on stamps and banners */
  subMotto: string;
  /** Path or URL to official school crest/logo (e.g. "/school-logo.png" or web link) */
  logoUrl: string;
  /** Optional secondary crest or icon used inside stamps */
  stampLogoUrl?: string;
  /** Top curved arc text on official rubber stamp (defaults to uppercase school name) */
  stampTopText: string;
  /** Bottom curved arc text on official rubber stamp (e.g. "OFFICIAL SEAL • APPROVED") */
  stampBottomText: string;
  /** Campus physical street address */
  campusAddress: string;
  /** Campus city, state, and province */
  cityState: string;
  /** Country */
  country: string;
  /** Primary administrative phone number */
  phonePrimary: string;
  /** Secondary hotline / customer service phone number */
  phoneSecondary: string;
  /** Official administrative email address */
  emailContact: string;
  /** WhatsApp enquiry number for instant chat links (international format or local) */
  whatsAppNumber: string;
  /** Administrative office enquiry hours */
  visitingHours: string;
  /** Live admissions status announcement badge */
  admissionStatus: string;
  /** Name of Head Teacher, Principal, or Academic Director */
  principalName: string;
  /** Title of Head Teacher or Principal */
  principalTitle: string;
  /** Portal header title */
  portalTitle: string;
  /** Homepage welcome banner headline */
  welcomeHeadline: string;
  /** Homepage welcome banner subheadline */
  welcomeSubheadline: string;
  /** Comprehensive about section narrative */
  aboutText: string;
}

/**
 * DEFAULT TEMPLATE PRESET
 * Edit the values below to pre-brand this repository for another school.
 */
export const DEFAULT_SCHOOL_CONFIG: SchoolTemplateConfig = {
  schoolName: 'Dominion Group Of Schools',
  shortName: 'Dominion Group Of Schools',
  acronym: 'DGS',
  motto: 'Raising the dominion child',
  subMotto: 'Alloma',
  logoUrl: '/school-logo.png',
  stampLogoUrl: '/school-logo.png',
  stampTopText: 'DOMINION GROUP OF SCHOOLS',
  stampBottomText: 'OFFICIAL SEAL • ALLOMA',
  campusAddress: 'Alloma Campus',
  cityState: 'Alloma, Kogi State, Nigeria',
  country: 'Nigeria',
  phonePrimary: '08168986994',
  phoneSecondary: '',
  emailContact: 'info@dominionschools.edu.ng',
  whatsAppNumber: '08168986994',
  visitingHours: 'Monday – Friday: 7:30 AM – 4:30 PM (Administrative Enquiries)',
  admissionStatus: 'Admissions Ongoing for Current Academic Session',
  principalName: 'The Principal',
  principalTitle: 'Principal / Administrator',
  portalTitle: 'Dominion Group Of Schools Academic Portal',
  welcomeHeadline: 'Welcome to Dominion Group Of Schools',
  welcomeSubheadline: 'Raising the dominion child through academic distinction, godly character, and excellence.',
  aboutText: 'Dominion Group Of Schools is dedicated to raising the dominion child with qualitative basic, nursery, primary, and secondary education, moral discipline, and intellectual leadership.'
};

import { safeStorage } from '../utils/safeStorage';

export const BRANDING_STORAGE_KEY = 'school_branding_config';
export const WEBSITE_CONFIG_CACHE_KEY = 'school_portal_website_cache';
export const LEGACY_WEBSITE_CACHE_KEY = 'school_website_config_cache';

/**
 * Resolves the active school configuration by merging:
 * 1. Default base config from this file
 * 2. Optional build-time / runtime environment variables (`VITE_SCHOOL_*`)
 * 3. Saved dynamic CMS configuration from localStorage/Firestore if available
 */
export function getActiveSchoolConfig(overrides?: Partial<SchoolTemplateConfig>): SchoolTemplateConfig {
  // 1. Start with base defaults
  const resolved: SchoolTemplateConfig = { ...DEFAULT_SCHOOL_CONFIG };

  // 2. Apply Vite environment variables if defined at build/runtime
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv) {
      if (metaEnv.VITE_SCHOOL_NAME) resolved.schoolName = String(metaEnv.VITE_SCHOOL_NAME).trim();
      if (metaEnv.VITE_SCHOOL_SHORT_NAME) resolved.shortName = String(metaEnv.VITE_SCHOOL_SHORT_NAME).trim();
      if (metaEnv.VITE_SCHOOL_ACRONYM) resolved.acronym = String(metaEnv.VITE_SCHOOL_ACRONYM).trim();
      if (metaEnv.VITE_SCHOOL_MOTTO) resolved.motto = String(metaEnv.VITE_SCHOOL_MOTTO).trim();
      if (metaEnv.VITE_SCHOOL_SUB_MOTTO) resolved.subMotto = String(metaEnv.VITE_SCHOOL_SUB_MOTTO).trim();
      if (metaEnv.VITE_SCHOOL_LOGO_URL) resolved.logoUrl = String(metaEnv.VITE_SCHOOL_LOGO_URL).trim();
      if (metaEnv.VITE_SCHOOL_PHONE) resolved.phonePrimary = String(metaEnv.VITE_SCHOOL_PHONE).trim();
      if (metaEnv.VITE_SCHOOL_PHONE_SEC) resolved.phoneSecondary = String(metaEnv.VITE_SCHOOL_PHONE_SEC).trim();
      if (metaEnv.VITE_SCHOOL_WHATSAPP) resolved.whatsAppNumber = String(metaEnv.VITE_SCHOOL_WHATSAPP).trim();
      if (metaEnv.VITE_SCHOOL_ADDRESS) resolved.campusAddress = String(metaEnv.VITE_SCHOOL_ADDRESS).trim();
      if (metaEnv.VITE_SCHOOL_CITY_STATE) resolved.cityState = String(metaEnv.VITE_SCHOOL_CITY_STATE).trim();
      if (metaEnv.VITE_SCHOOL_EMAIL) resolved.emailContact = String(metaEnv.VITE_SCHOOL_EMAIL).trim();
    }
  } catch {
    // Ignore in non-Vite execution contexts
  }

  // 3. Apply cached user/admin customizations from browser storage if present
  try {
    const cached =
      safeStorage.getItem(WEBSITE_CONFIG_CACHE_KEY) ||
      safeStorage.getItem(BRANDING_STORAGE_KEY) ||
      safeStorage.getItem(LEGACY_WEBSITE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Automatically purge any stale branding cache from previous school deployments
      if (
        parsed.schoolName &&
        (parsed.schoolName.includes('Supreme') ||
         parsed.schoolName.includes('Eminent') ||
         parsed.schoolName.includes('ERCA'))
      ) {
        safeStorage.removeItem(BRANDING_STORAGE_KEY);
        safeStorage.removeItem(WEBSITE_CONFIG_CACHE_KEY);
        safeStorage.removeItem(LEGACY_WEBSITE_CACHE_KEY);
      } else {
        if (parsed.schoolName !== undefined && parsed.schoolName !== '') resolved.schoolName = parsed.schoolName;
        if (parsed.shortName !== undefined && parsed.shortName !== '') resolved.shortName = parsed.shortName;
        if (parsed.acronym !== undefined && parsed.acronym !== '') resolved.acronym = parsed.acronym;
        if (parsed.motto !== undefined) resolved.motto = parsed.motto;
        if (parsed.subMotto !== undefined) resolved.subMotto = parsed.subMotto;
        if (parsed.logoUrl !== undefined && parsed.logoUrl !== '' && !parsed.logoUrl.includes('supreme') && !parsed.logoUrl.includes('erca')) {
          resolved.logoUrl = parsed.logoUrl;
        }
        if (parsed.stampLogoUrl !== undefined && !parsed.stampLogoUrl.includes('supreme') && !parsed.stampLogoUrl.includes('erca')) {
          resolved.stampLogoUrl = parsed.stampLogoUrl;
        }
        if (parsed.stampTopText !== undefined && parsed.stampTopText !== '' && !parsed.stampTopText.includes('SUPREME')) resolved.stampTopText = parsed.stampTopText;
        if (parsed.stampBottomText !== undefined && parsed.stampBottomText !== '' && !parsed.stampBottomText.includes('UROMI')) resolved.stampBottomText = parsed.stampBottomText;
        if (parsed.campusAddress !== undefined && parsed.campusAddress !== '' && !parsed.campusAddress.includes('Uromi')) resolved.campusAddress = parsed.campusAddress;
        if (parsed.cityState !== undefined && parsed.cityState !== '' && !parsed.cityState.includes('Edo')) resolved.cityState = parsed.cityState;
        if (parsed.country !== undefined && parsed.country !== '') resolved.country = parsed.country;
        if (parsed.phonePrimary !== undefined && parsed.phonePrimary !== '' && !parsed.phonePrimary.includes('8000000000')) resolved.phonePrimary = parsed.phonePrimary;
        if (parsed.phoneSecondary !== undefined) resolved.phoneSecondary = parsed.phoneSecondary;
        if (parsed.emailContact !== undefined && parsed.emailContact !== '' && !parsed.emailContact.includes('supreme')) resolved.emailContact = parsed.emailContact;
        if (parsed.whatsAppNumber !== undefined && parsed.whatsAppNumber !== '' && !parsed.whatsAppNumber.includes('8000000000')) resolved.whatsAppNumber = parsed.whatsAppNumber;
        if (parsed.principalName !== undefined && parsed.principalName !== '') resolved.principalName = parsed.principalName;
        if (parsed.principalTitle !== undefined && parsed.principalTitle !== '') resolved.principalTitle = parsed.principalTitle;
        if (parsed.admissionStatus !== undefined && parsed.admissionStatus !== '') resolved.admissionStatus = parsed.admissionStatus;
        if (parsed.welcomeHeadline !== undefined && parsed.welcomeHeadline !== '' && !parsed.welcomeHeadline.includes('Supreme')) resolved.welcomeHeadline = parsed.welcomeHeadline;
        if (parsed.welcomeSubheadline !== undefined && parsed.welcomeSubheadline !== '') resolved.welcomeSubheadline = parsed.welcomeSubheadline;
        if (parsed.aboutText !== undefined && parsed.aboutText !== '' && !parsed.aboutText.includes('Supreme')) resolved.aboutText = parsed.aboutText;
      }
    }
  } catch {
    // Storage access fallback
  }

  // 4. Apply direct overrides if supplied (e.g. from props or state)
  if (overrides) {
    Object.assign(resolved, overrides);
  }

  return resolved;
}

/**
 * Persists updated branding settings locally and dispatches a live update event
 */
export function saveSchoolBrandingLocally(updates: Partial<SchoolTemplateConfig>): SchoolTemplateConfig {
  const current = getActiveSchoolConfig();
  const updated: SchoolTemplateConfig = { ...current, ...updates };

  try {
    const json = JSON.stringify(updated);
    safeStorage.setItem(BRANDING_STORAGE_KEY, json);
    safeStorage.setItem(WEBSITE_CONFIG_CACHE_KEY, json);
    safeStorage.setItem(LEGACY_WEBSITE_CACHE_KEY, json);
  } catch (e) {
    console.warn('Failed to save branding locally:', e);
  }

  // Update document title dynamically
  if (typeof document !== 'undefined') {
    const titleText = `${updated.schoolName} Portal`;
    document.title = titleText;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', titleText);
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta && updated.welcomeSubheadline) descMeta.setAttribute('content', updated.welcomeSubheadline);
  }

  // Broadcast event for all components listening in the app
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('school_branding_updated', { detail: updated }));
  }

  return updated;
}

/**
 * Standard WhatsApp link generator using active school configuration
 */
export function getSchoolWhatsAppLink(phoneOrWhatsApp?: string, message?: string, schoolName?: string): string {
  const active = getActiveSchoolConfig();
  const targetNumber = (phoneOrWhatsApp || active.whatsAppNumber || '').replace(/[^0-9]/g, '');
  const cleanNumber = targetNumber.startsWith('0') ? `234${targetNumber.slice(1)}` : targetNumber;
  const name = schoolName || active.schoolName;
  const text = message || `Hello ${name}, I would like to make an enquiry regarding admissions and academic programmes.`;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`;
}
