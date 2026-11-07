import React, { useState, useRef } from 'react';
import { Student } from '../types';
import {
  FileSpreadsheet,
  Upload,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  FileText,
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck
} from 'lucide-react';
import {
  parseStudentSpreadsheet,
  downloadStudentTemplateXLSX,
  SpreadsheetParseResult
} from '../utils/spreadsheet';
import { FirebaseService } from '../services/firebaseService';
import { isMatchingClass } from '../utils/grading';

interface StudentSpreadsheetUploadProps {
  effectiveClassesList: string[];
  existingStudents: Student[];
  onUploadSuccess: (importedCount: number) => Promise<void>;
  onCloseModal?: () => void;
  isModal?: boolean;
}

export const StudentSpreadsheetUpload: React.FC<StudentSpreadsheetUploadProps> = ({
  effectiveClassesList,
  existingStudents,
  onUploadSuccess,
  onCloseModal,
  isModal = false
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<SpreadsheetParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Configuration options
  const [overrideClass, setOverrideClass] = useState<string>('');
  const [defaultPassword, setDefaultPassword] = useState<string>('password');
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [rawPastedText, setRawPastedText] = useState<string>('');

  // Preview filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse file whenever selected or options change
  const handleProcessFile = async (file: File, sheetIdx = 0, clsOverride = overrideClass, pwd = defaultPassword) => {
    setIsParsing(true);
    setFeedback(null);
    try {
      const result = await parseStudentSpreadsheet(file, {
        defaultPassword: pwd,
        overrideClass: clsOverride,
        sheetIndex: sheetIdx
      });
      setParseResult(result);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to parse spreadsheet: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setSelectedSheetIndex(0);
    handleProcessFile(file, 0);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['xlsx', 'xls', 'csv', 'tsv', 'txt'].includes(ext || '')) {
        setSelectedFile(file);
        setSelectedSheetIndex(0);
        handleProcessFile(file, 0);
      } else {
        setFeedback({
          type: 'error',
          message: 'Unsupported file type. Please upload a .xlsx, .xls, or .csv spreadsheet.'
        });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleProcessPastedText = async (text: string) => {
    setRawPastedText(text);
    if (!text.trim()) {
      setParseResult(null);
      return;
    }
    setIsParsing(true);
    try {
      const result = await parseStudentSpreadsheet(text, {
        defaultPassword,
        overrideClass
      });
      setParseResult(result);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to parse pasted data: ${err.message || 'Error'}`
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteUpload = async () => {
    if (!parseResult || parseResult.students.length === 0) {
      setFeedback({ type: 'error', message: 'No valid student records found to upload.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);

    try {
      const res = await FirebaseService.bulkUploadStudents(parseResult.students);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Successfully uploaded ${res.count} pupils into school database!`
        });
        await onUploadSuccess(res.count);
        if (isModal && onCloseModal) {
          setTimeout(() => {
            onCloseModal();
          }, 1500);
        }
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Bulk upload failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    setRawPastedText('');
    setFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtered parsed students for preview table
  const filteredStudents = (parseResult?.students || []).filter((st) => {
    const matchesSearch =
      st.StudentID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.ParentName && st.ParentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (st.ParentPhone && st.ParentPhone.includes(searchQuery));
    const matchesClass = classFilter === 'all' || isMatchingClass(st.Class, classFilter);
    return matchesSearch && matchesClass;
  });

  return (
    <div className={`space-y-4 ${isModal ? '' : ''}`}>
      {/* Top Banner with Instructions and Template Download */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-inner">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-amber-400">
              Student Data Spreadsheet Upload (XLSX / CSV)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
              Import pupil rosters directly into Firestore from Microsoft Excel (<code className="text-amber-300">.xlsx</code>, <code className="text-amber-300">.xls</code>) or CSV files. Automatically validates Student IDs, names, classes, and login passwords.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => downloadStudentTemplateXLSX(effectiveClassesList)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer shrink-0 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Download Excel Template (.xlsx)</span>
        </button>
      </div>

      {/* Upload Methods Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
            activeTab === 'upload'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Excel / CSV File</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('paste')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
            activeTab === 'paste'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Paste Data Directly</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Upload / Input Area */}
      {activeTab === 'upload' ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
            isDragging
              ? 'border-amber-500 bg-amber-50/50 scale-[1.01]'
              : selectedFile
              ? 'border-emerald-300 bg-emerald-50/20'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            className="hidden"
          />

          <div className="max-w-md mx-auto flex flex-col items-center justify-center">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-inner ${
                selectedFile ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {selectedFile ? (
                <FileSpreadsheet className="w-7 h-7" />
              ) : (
                <Upload className="w-7 h-7" />
              )}
            </div>

            {selectedFile ? (
              <div className="space-y-1 mb-4">
                <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB &bull;{' '}
                  {selectedFile.name.endsWith('.xlsx')
                    ? 'Microsoft Excel Workbook (.xlsx)'
                    : selectedFile.name.endsWith('.xls')
                    ? 'Excel 97-2004 Workbook (.xls)'
                    : 'CSV Spreadsheet'}
                </p>
              </div>
            ) : (
              <div className="space-y-1 mb-4">
                <p className="text-sm font-bold text-slate-900">
                  Drag &amp; drop your student spreadsheet here
                </p>
                <p className="text-xs text-slate-500">
                  Supports Excel spreadsheets (<strong className="text-slate-800">.xlsx</strong>, <strong className="text-slate-800">.xls</strong>) and <strong className="text-slate-800">.csv</strong> files.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {selectedFile ? 'Choose Different File' : 'Select Spreadsheet File'}
              </button>

              {selectedFile && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Paste Tabular Data from Excel or CSV
            </label>
            <span className="text-[11px] text-slate-400">Columns: ID, Name, Class, Gender, Parent Name, Phone, Password</span>
          </div>
          <textarea
            rows={5}
            value={rawPastedText}
            onChange={(e) => handleProcessPastedText(e.target.value)}
            placeholder="StudentID&#9;FullName&#9;Class&#9;Gender&#9;ParentName&#9;ParentPhone&#10;DNPS/2026/001&#9;Emmanuel Sunday&#9;Primary 4&#9;Male&#9;Mr. Sunday&#9;08031234567"
            className="w-full p-3 text-xs font-mono rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>
      )}

      {/* Parsing indicator */}
      {isParsing && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold text-slate-600 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
          <span>Reading and validating spreadsheet structure...</span>
        </div>
      )}

      {/* Options & Configuration when spreadsheet is loaded */}
      {parseResult && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <span>Spreadsheet Content Summary</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {parseResult.students.length} Valid Records
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Review parsed records, adjust class overrides, and verify student details before committing to Firestore.
              </p>
            </div>

            {parseResult.sheetNames.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">Active Sheet:</label>
                <select
                  value={selectedSheetIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedSheetIndex(idx);
                    if (selectedFile) {
                      handleProcessFile(selectedFile, idx);
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-slate-50"
                >
                  {parseResult.sheetNames.map((name, i) => (
                    <option key={name} value={i}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Import Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Class Assignment Option
              </label>
              <select
                value={overrideClass}
                onChange={(e) => {
                  const val = e.target.value;
                  setOverrideClass(val);
                  if (selectedFile) {
                    handleProcessFile(selectedFile, selectedSheetIndex, val, defaultPassword);
                  } else if (rawPastedText) {
                    handleProcessPastedText(rawPastedText);
                  }
                }}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white"
              >
                <option value="">Keep Class from File (Default)</option>
                {effectiveClassesList.map((cls) => (
                  <option key={cls} value={cls}>
                    Assign ALL to {cls}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Default Password for New Accounts
              </label>
              <input
                type="text"
                value={defaultPassword}
                onChange={(e) => {
                  const val = e.target.value;
                  setDefaultPassword(val);
                  if (selectedFile) {
                    handleProcessFile(selectedFile, selectedSheetIndex, overrideClass, val);
                  }
                }}
                placeholder="password"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-300 bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Classes Found in File ({parseResult.stats.classesDetected.length})
              </label>
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                {parseResult.stats.classesDetected.map((cls) => (
                  <span
                    key={cls}
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-slate-200 text-slate-700"
                  >
                    {cls}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Warnings / Errors if any */}
          {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
            <div className="space-y-2">
              {parseResult.errors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-rose-950">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{parseResult.errors.length} Row(s) Skipped Due to Errors:</span>
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                    {parseResult.errors.slice(0, 10).map((err, i) => (
                      <p key={i}>&bull; {err}</p>
                    ))}
                    {parseResult.errors.length > 10 && (
                      <p className="italic text-slate-500">...and {parseResult.errors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}

              {parseResult.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>{parseResult.warnings.length} Validation Notice(s):</span>
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-0.5 text-[11px]">
                    {parseResult.warnings.slice(0, 8).map((w, i) => (
                      <p key={i}>&bull; {w}</p>
                    ))}
                    {parseResult.warnings.length > 8 && (
                      <p className="italic text-slate-500">...and {parseResult.warnings.length - 8} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Pre-Upload Review Table */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search in parsed preview..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white"
                  />
                </div>

                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50"
                >
                  <option value="all">All Parsed Classes ({parseResult.students.length})</option>
                  {parseResult.stats.classesDetected.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer inline-flex items-center gap-1 shadow-2xs shrink-0"
                >
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPasswords ? 'Hide' : 'Show'} Pwd</span>
                </button>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-700">
                  Showing {filteredStudents.length} of {parseResult.students.length}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 text-white font-bold z-10">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5 border-r border-slate-800 bg-amber-950/40 text-amber-300">DNPS ID (Primary)</th>
                    <th className="p-2.5 border-r border-slate-800 bg-indigo-950/50 text-indigo-300">DSS ID (Secondary)</th>
                    <th className="p-2.5">Full Name</th>
                    <th className="p-2.5">Class</th>
                    <th className="p-2.5">Gender</th>
                    <th className="p-2.5">Login Password</th>
                    <th className="p-2.5">Parent Contact</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-slate-400">
                        No pupils match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const isExisting = existingStudents.some(
                        (e) => e.StudentID.toLowerCase() === st.StudentID.toLowerCase()
                      );
                      const isSec =
                        FirebaseService.isSecondaryClass(st.Class) ||
                        st.StudentID.trim().toUpperCase().startsWith('DSS');

                      return (
                        <tr key={st.StudentID + idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold border-r border-slate-100 bg-amber-50/20 text-amber-950">
                            {!isSec ? st.StudentID : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="p-2.5 font-mono font-bold border-r border-slate-100 bg-indigo-50/20 text-indigo-950">
                            {isSec ? st.StudentID : <span className="text-slate-300 font-normal">—</span>}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900">{st.FullName}</td>
                          <td className="p-2.5 font-bold text-slate-700">{st.Class}</td>
                          <td className="p-2.5 text-slate-600">{st.Gender}</td>
                          <td className="p-2.5 font-mono text-slate-700">
                            {showPasswords ? st.Password || 'password' : '••••••••'}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {st.ParentPhone || st.ParentName || '—'}
                          </td>
                          <td className="p-2.5">
                            {isExisting ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                Update
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Execution Bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Ready to import <strong>{parseResult.students.length}</strong> pupil records across{' '}
              <strong>{parseResult.stats.classesDetected.length}</strong> class(es).
            </div>

            <div className="flex items-center justify-end gap-2">
              {isModal && onCloseModal && (
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
              )}

              <button
                type="button"
                onClick={handleExecuteUpload}
                disabled={isProcessing || parseResult.students.length === 0}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing with Firestore...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Commit {parseResult.students.length} Pupils to Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
