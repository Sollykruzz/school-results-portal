# Assistant Instructions & Project Conventions

## Special Trigger Command: "wakanda" / "Wakanda" / "Wakande"

Whenever the user sends the code word **"wakanda"** (case-insensitive, including variations like "Wakanda" or "Wakande"):

### 1. Recognition & Prompting
Immediately recognize this trigger command and prompt the user for the details required to clone, rebrand, and configure the portal for a new school:
- **Full School Name**: (e.g., *St. Benedict International Academy*)
- **Short Name & Acronym**: (e.g., *St. Benedict* / *SBIA*)
- **School Motto & Sub-Motto**: (e.g., *Discipline, Knowledge & Integrity*)
- **Campus Address, City & State**: (e.g., *Plot 14 Victoria Island, Lagos State*)
- **Contact Numbers**: Primary Phone, Secondary Phone, WhatsApp Hotline
- **Contact Email**: Official email for parent enquiries
- **Principal / Head of School**: Name and title (e.g., *Mrs. Angela Eze, Principal*)
- **Official Stamp Outer Rim Text**: Top text (usually School Name) and Bottom text (Location / Seal)
- **School Logo / Crest**: URL or uploaded image path (or use generated fallback crest)
- **Academic Structure**:
  - Classes offered (e.g., *Creche, Nursery 1-2, Primary 1-6, JSS 1-3, SSS 1-3*)
  - Assessment weightings (e.g., *CA1: 20%, CA2: 20%, Exam: 60%*)
- **Firebase Project Name/ID**: The project identifier on Firebase for the new school.

### 2. Automatic Setup Execution
Once the user provides the new school's details:
1. **Firebase Connection**:
   - Call `set_up_firebase` with `userConfirmedTermsAcceptedInUI: false` and the school's requested project ID/name.
   - Once accepted, deploy rules (`firestore.rules`) to the new database so the school has a clean, isolated database with no lingering data from previous schools.
2. **Branding & Configuration Updates**:
   - Update `src/config/schoolConfig.ts` (`DEFAULT_SCHOOL_CONFIG`).
   - Update `index.html` (`<title>`, `<meta property="og:title">`, description).
   - Update `public/manifest.json` (PWA name and short name).
   - Update `metadata.json` with the new school's name and description.
3. **Clean Slate Initialization**:
   - Reset default administrator credentials in `src/services/firebaseService.ts` for the new school.
   - Clear sample pupil rosters and attendance records so the new school starts completely fresh.
4. **Verification**:
   - Run `lint_applet` and `compile_applet` to ensure a clean build and ready-to-use deployment.
