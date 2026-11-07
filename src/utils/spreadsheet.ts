import * as XLSX from 'xlsx';
import { Student } from '../types';
import { getActiveSchoolConfig } from '../config/schoolConfig';

export interface SpreadsheetParseResult {
  students: Student[];
  errors: string[];
  warnings: string[];
  sheetNames: string[];
  selectedSheet: string;
  stats: {
    totalRows: number;
    validCount: number;
    errorCount: number;
    classesDetected: string[];
  };
}

/**
 * Normalizes a header string for fuzzy matching
 */
function normalizeHeader(header: any): string {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file/buffer into structured Student records.
 */
export async function parseStudentSpreadsheet(
  fileOrData: File | ArrayBuffer | string,
  options: {
    defaultClass?: string;
    defaultPassword?: string;
    overrideClass?: string;
    sheetIndex?: number;
  } = {}
): Promise<SpreadsheetParseResult> {
  const {
    defaultClass = 'Primary 1',
    defaultPassword = 'password',
    overrideClass = '',
    sheetIndex = 0
  } = options;

  let workbook: XLSX.WorkBook;

  try {
    if (fileOrData instanceof File) {
      const buffer = await fileOrData.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array' });
    } else if (fileOrData instanceof ArrayBuffer) {
      workbook = XLSX.read(fileOrData, { type: 'array' });
    } else if (typeof fileOrData === 'string') {
      workbook = XLSX.read(fileOrData, { type: 'string' });
    } else {
      throw new Error('Unsupported file format provided.');
    }
  } catch (err: any) {
    return {
      students: [],
      errors: [`Failed to read file: ${err.message || 'Invalid spreadsheet format'}`],
      warnings: [],
      sheetNames: [],
      selectedSheet: '',
      stats: { totalRows: 0, validCount: 0, errorCount: 1, classesDetected: [] }
    };
  }

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    return {
      students: [],
      errors: ['The workbook does not contain any sheets.'],
      warnings: [],
      sheetNames: [],
      selectedSheet: '',
      stats: { totalRows: 0, validCount: 0, errorCount: 1, classesDetected: [] }
    };
  }

  const targetSheetName = sheetNames[Math.min(sheetIndex, sheetNames.length - 1)];
  const sheet = workbook.Sheets[targetSheetName];

  if (!sheet) {
    return {
      students: [],
      errors: [`Sheet "${targetSheetName}" is empty or unreadable.`],
      warnings: [],
      sheetNames,
      selectedSheet: targetSheetName,
      stats: { totalRows: 0, validCount: 0, errorCount: 1, classesDetected: [] }
    };
  }

  // Convert sheet to 2D array of strings
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false
  });

  if (rawRows.length === 0) {
    return {
      students: [],
      errors: ['No data rows found in the selected spreadsheet.'],
      warnings: [],
      sheetNames,
      selectedSheet: targetSheetName,
      stats: { totalRows: 0, validCount: 0, errorCount: 1, classesDetected: [] }
    };
  }

  // Identify Header Row and Column Index Mapping
  let headerRowIndex = -1;
  let colMap = {
    id: -1,
    dnpsId: -1,
    dssId: -1,
    name: -1,
    class: -1,
    gender: -1,
    dob: -1,
    parentName: -1,
    parentPhone: -1,
    address: -1,
    password: -1,
    email: -1
  };

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    const normalizedRow = row.map(normalizeHeader);

    const tempMap = {
      dnpsId: normalizedRow.findIndex((h) => h.includes('dnps')),
      dssId: normalizedRow.findIndex((h) => h.includes('dss')),
      id: normalizedRow.findIndex((h) =>
        (/^(studentid|id|admno|admissionno|admissionnumber|registrationno|regno|matricno|rollno|pupilid)$/i.test(h) ||
          h.includes('studentid') ||
          h.includes('admission') ||
          h.includes('regno')) &&
        !h.includes('dnps') &&
        !h.includes('dss')
      ),
      name: normalizedRow.findIndex((h) =>
        /^(fullname|name|studentname|pupilname|nameofstudent|studentfullname)$/i.test(h) ||
        h.includes('fullname') ||
        h.includes('studentname') ||
        h.includes('pupilname')
      ),
      class: normalizedRow.findIndex((h) =>
        /^(class|classname|grade|level|arm|currentclass)$/i.test(h) ||
        h.includes('class') ||
        h.includes('grade')
      ),
      gender: normalizedRow.findIndex((h) =>
        /^(gender|sex)$/i.test(h) || h.includes('gender') || h.includes('sex')
      ),
      dob: normalizedRow.findIndex((h) =>
        /^(dob|dateofbirth|birthdate|birth)$/i.test(h) || h.includes('dob') || h.includes('birth')
      ),
      parentName: normalizedRow.findIndex((h) =>
        /^(parentname|parent|guardian|fathername|mothername|nextofkin|guardianname)$/i.test(h) ||
        h.includes('parent') ||
        h.includes('guardian')
      ),
      parentPhone: normalizedRow.findIndex((h) =>
        /^(parentphone|phone|phonenumber|contact|mobile|parentcontact|gsm|telephone|guardianphone)$/i.test(h) ||
        h.includes('phone') ||
        h.includes('contact') ||
        h.includes('mobile')
      ),
      address: normalizedRow.findIndex((h) =>
        /^(address|homeaddress|residence|location|residentialaddress)$/i.test(h) ||
        h.includes('address')
      ),
      password: normalizedRow.findIndex((h) =>
        /^(password|loginpassword|portalpassword|passcode|pin)$/i.test(h) ||
        h.includes('password')
      ),
      email: normalizedRow.findIndex((h) =>
        /^(email|parentemail|guardianemail)$/i.test(h) || h.includes('email')
      )
    };

    // If both name and (id or dnpsId or dssId or class) are identified, we found the header row
    if (tempMap.name !== -1 || ((tempMap.id !== -1 || tempMap.dnpsId !== -1 || tempMap.dssId !== -1) && tempMap.class !== -1)) {
      headerRowIndex = r;
      colMap = tempMap;
      break;
    }
  }

  // Fallback positional indexing if no header row was detected
  let dataStartIndex = 0;
  if (headerRowIndex !== -1) {
    dataStartIndex = headerRowIndex + 1;
  } else {
    // Treat first row as data or positional
    colMap = {
      id: 0,
      dnpsId: -1,
      dssId: -1,
      name: 1,
      class: 2,
      gender: 3,
      parentName: 4,
      parentPhone: 5,
      address: 6,
      password: 7,
      dob: -1,
      email: -1
    };
  }

  const students: Student[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const detectedClasses = new Set<string>();

  for (let i = dataStartIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    // Skip totally empty rows
    const hasAnyContent = row.some((cell) => String(cell || '').trim().length > 0);
    if (!hasAnyContent) continue;

    const rawDnpsId = colMap.dnpsId !== -1 ? String(row[colMap.dnpsId] || '').trim() : '';
    const rawDssId = colMap.dssId !== -1 ? String(row[colMap.dssId] || '').trim() : '';
    const rawSingleId = colMap.id !== -1 ? String(row[colMap.id] || '').trim() : '';
    const rawId = rawDssId || rawDnpsId || rawSingleId;
    const rawName = colMap.name !== -1 ? String(row[colMap.name] || '').trim() : '';
    let rawClass = colMap.class !== -1 ? String(row[colMap.class] || '').trim() : '';
    const rawGender = colMap.gender !== -1 ? String(row[colMap.gender] || '').trim() : '';
    const rawDob = colMap.dob !== -1 ? String(row[colMap.dob] || '').trim() : '';
    const rawParentName = colMap.parentName !== -1 ? String(row[colMap.parentName] || '').trim() : '';
    const rawParentPhone = colMap.parentPhone !== -1 ? String(row[colMap.parentPhone] || '').trim() : '';
    const rawAddress = colMap.address !== -1 ? String(row[colMap.address] || '').trim() : '';
    const rawPassword = colMap.password !== -1 ? String(row[colMap.password] || '').trim() : '';
    const rawEmail = colMap.email !== -1 ? String(row[colMap.email] || '').trim() : '';

    const rowNum = i + 1;

    // Validation: Missing Full Name or Student ID
    if (!rawName) {
      errors.push(`Row ${rowNum}: Missing student full name.`);
      continue;
    }

    // Apply class override or fallback early so we know whether it's secondary or primary
    if (overrideClass && overrideClass.trim().length > 0) {
      rawClass = overrideClass.trim();
    } else if (!rawClass) {
      rawClass = rawDssId ? 'JSS 1' : defaultClass;
      warnings.push(`Row ${rowNum}: Class missing for "${rawName}". Defaulted to "${rawClass}".`);
    }

    const upperCls = rawClass.toUpperCase();
    const isSecClass =
      upperCls.startsWith('JSS') ||
      upperCls.startsWith('J.S.S') ||
      upperCls.includes('JUNIOR') ||
      upperCls.startsWith('SS') ||
      upperCls.startsWith('S.S') ||
      upperCls.startsWith('SSS') ||
      upperCls.includes('SENIOR');

    let studentId = rawId;
    if (!studentId) {
      // Auto-generate temporary student ID if missing using DSS or DNPS prefix
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      studentId = isSecClass ? `DSS/${randomSuffix}` : `DNPS/0${randomSuffix}`;
      warnings.push(`Row ${rowNum}: Student ID was missing for "${rawName}". Auto-assigned ID "${studentId}".`);
    } else {
      studentId = studentId.toUpperCase();
    }

    detectedClasses.add(rawClass);

    // Normalize Gender
    let gender: 'Male' | 'Female' = 'Male';
    const gLower = rawGender.toLowerCase();
    if (gLower.startsWith('f') || gLower === 'female' || gLower === 'girl') {
      gender = 'Female';
    } else if (gLower.startsWith('m') || gLower === 'male' || gLower === 'boy') {
      gender = 'Male';
    }

    // Password fallback
    const password = rawPassword.trim().length > 0 ? rawPassword.trim() : defaultPassword;

    const student: Student = {
      StudentID: studentId,
      FullName: rawName,
      Class: rawClass,
      Gender: gender,
      DOB: rawDob || undefined,
      ParentName: rawParentName || undefined,
      ParentPhone: rawParentPhone || undefined,
      Address: rawAddress || undefined,
      GuardianEmail: rawEmail || undefined,
      Password: password,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString()
    };

    students.push(student);
  }

  return {
    students,
    errors,
    warnings,
    sheetNames,
    selectedSheet: targetSheetName,
    stats: {
      totalRows: rawRows.length - dataStartIndex,
      validCount: students.length,
      errorCount: errors.length,
      classesDetected: Array.from(detectedClasses)
    }
  };
}

/**
 * Generates and downloads a standardized Microsoft Excel (.xlsx) student upload template.
 */
export function downloadStudentTemplateXLSX(availableClasses: string[] = []): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template data
  const templateHeaders = [
    'DNPS ID (Primary/Nursery)',
    'DSS ID (Secondary)',
    'Full Name *',
    'Class *',
    'Gender (Male/Female)',
    'Parent/Guardian Name',
    'Parent Phone Number',
    'Home Address',
    'Login Password'
  ];

  const activeSchool = getActiveSchoolConfig();
  const schoolSlug = (activeSchool.acronym || activeSchool.shortName || 'school').toLowerCase().replace(/[^a-z0-9]/g, '_');

  const sampleRows = [
    [
      'DNPS/0001',
      '',
      'Emmanuel Solomon Sunday',
      availableClasses[0] || 'Primary 4',
      'Male',
      'Mr. Sunday',
      '08031234567',
      '12 Campus Road, Central Area',
      'password'
    ],
    [
      'DNPS/0002',
      '',
      'Grace Amina Bello',
      availableClasses[1] || 'Primary 5',
      'Female',
      'Mrs. Bello',
      '08129876543',
      'Plot 5 Greenfield Estate',
      'password'
    ],
    [
      '',
      'DSS/001',
      'Chinedu David Eze',
      'JSS 1',
      'Male',
      'Chief Eze',
      '08055551234',
      'Block 8 Sunrise Avenue',
      'password'
    ]
  ];

  const wsData = [templateHeaders, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 22 }, // DNPS ID
    { wch: 20 }, // DSS ID
    { wch: 28 }, // Full Name
    { wch: 16 }, // Class
    { wch: 20 }, // Gender
    { wch: 24 }, // Parent Name
    { wch: 20 }, // Parent Phone
    { wch: 32 }, // Home Address
    { wch: 18 }  // Password
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Student Roster Template');

  // Sheet 2: Available Classes Reference
  const classesHeaders = ['Approved School Classes', 'Educational Category / Level'];
  const classesData = [
    classesHeaders,
    ...availableClasses.map((cls) => [
      cls,
      cls.toLowerCase().includes('kg')
        ? 'Kindergarten'
        : cls.toLowerCase().includes('nursery')
        ? 'Nursery'
        : cls.toLowerCase().includes('jss')
        ? 'Junior Secondary'
        : cls.toLowerCase().includes('sss')
        ? 'Senior Secondary'
        : 'Primary'
    ])
  ];

  const wsClasses = XLSX.utils.aoa_to_sheet(classesData);
  wsClasses['!cols'] = [{ wch: 24 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsClasses, 'Class Reference Guide');

  // Generate file and trigger browser download
  XLSX.writeFile(wb, `${schoolSlug}_student_upload_template.xlsx`);
}

/**
 * Exports students list to a clean .xlsx spreadsheet
 */
export function exportStudentsToXLSX(
  students: Student[],
  fileName?: string
): void {
  const activeSchool = getActiveSchoolConfig();
  const schoolSlug = (activeSchool.acronym || activeSchool.shortName || 'school').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const targetFileName = fileName || `${schoolSlug}_students_roster`;
  const wb = XLSX.utils.book_new();

  const headers = [
    'DNPS ID (Nursery / Primary)',
    'DSS ID (Secondary)',
    'Full Name',
    'Class',
    'Gender',
    'Login Password',
    'Parent/Guardian Name',
    'Parent Phone',
    'Residential Address',
    'Date Registered'
  ];

  const rows = students.map((s) => {
    const c = (s.Class || '').trim().toUpperCase();
    const isSec =
      c.startsWith('JSS') ||
      c.startsWith('J.S.S') ||
      c.includes('JUNIOR') ||
      c.startsWith('SS') ||
      c.startsWith('S.S') ||
      c.startsWith('SSS') ||
      c.includes('SENIOR') ||
      s.StudentID.trim().toUpperCase().startsWith('DSS');

    return [
      !isSec ? s.StudentID : '',
      isSec ? s.StudentID : '',
      s.FullName,
      s.Class,
      s.Gender || 'Male',
      s.Password || 'password',
      s.ParentName || '',
      s.ParentPhone || '',
      s.Address || '',
      s.CreatedAt ? new Date(s.CreatedAt).toLocaleDateString() : ''
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 24 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Pupils Directory');
  XLSX.writeFile(wb, `${targetFileName}.xlsx`);
}
