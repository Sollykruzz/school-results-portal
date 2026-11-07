import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SubjectRule, EducationLevel } from '../types';
import { FirebaseService, ALL_SCHOOL_CLASSES } from '../services/firebaseService';
import {
  BookOpen,
  Plus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Layers,
  Sparkles,
  School
} from 'lucide-react';
import { determineClassLevel } from '../utils/grading';

interface SubjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectsList: SubjectRule[];
  currentClass?: string;
  initialClass?: string;
  onRefreshData: () => Promise<void> | void;
  isAdmin?: boolean;
  classesList?: string[];
}

const EDUCATION_LEVEL_OPTIONS = [
  { value: 'Kindergarten', label: 'Kindergarten / Early Years (KG 1 - 2)' },
  { value: 'Nursery', label: 'Nursery (Nursery 1 - 3)' },
  { value: 'LowerPrimary', label: 'Lower Primary (Primary 1 - 3)' },
  { value: 'UpperPrimary', label: 'Upper Primary (Primary 4 - 6)' },
  { value: 'JuniorSecondary', label: 'Junior Secondary (JSS 1 - 3)' },
  { value: 'SeniorSecondary', label: 'Senior Secondary (SS 1 - 3)' }
];

export const SubjectManagerModal: React.FC<SubjectManagerModalProps> = ({
  isOpen,
  onClose,
  subjectsList,
  currentClass,
  initialClass,
  onRefreshData,
  isAdmin = false,
  classesList
}) => {
  const availableClasses = classesList && classesList.length > 0 ? classesList : ALL_SCHOOL_CLASSES;
  const effectiveClass = currentClass || initialClass || availableClasses[0] || 'Primary 1';
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>(
    effectiveClass ? determineClassLevel(effectiveClass) : 'all'
  );

  // New Subject Form
  const [newSubjectName, setNewSubjectName] = useState('');
  const [targetLevel, setTargetLevel] = useState<string>(
    effectiveClass ? determineClassLevel(effectiveClass) : 'LowerPrimary'
  );
  const [targetSpecificClass, setTargetSpecificClass] = useState<string>(effectiveClass || '');
  const [isClassSpecific, setIsClassSpecific] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingSubjectName, setDeletingSubjectName] = useState<string | null>(null);

  // Filtered list
  const filteredSubjects = useMemo(() => {
    return subjectsList.filter((s) => {
      const matchSearch =
        s.SubjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.Level && s.Level.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.Class && s.Class.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (selectedLevelFilter === 'all') return true;
      if (selectedLevelFilter === 'class_specific' && s.Class) return true;

      const sLevel = (s.Level || '').toLowerCase();
      const filterLevel = selectedLevelFilter.toLowerCase();
      return sLevel === filterLevel || (s.Class && s.Class.toLowerCase() === filterLevel);
    });
  }, [subjectsList, searchQuery, selectedLevelFilter]);

  if (!isOpen) return null;

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const name = newSubjectName.trim();
    if (!name) {
      setFeedback({ type: 'error', message: 'Please enter a subject name.' });
      return;
    }

    // Check duplicate
    const exists = subjectsList.some(
      (s) =>
        s.SubjectName.trim().toLowerCase() === name.toLowerCase() &&
        (isClassSpecific
          ? s.Class?.toLowerCase() === targetSpecificClass.toLowerCase()
          : s.Level?.toLowerCase() === targetLevel.toLowerCase())
    );

    if (exists) {
      setFeedback({
        type: 'error',
        message: `Subject "${name}" already exists in ${isClassSpecific ? targetSpecificClass : targetLevel}.`
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await FirebaseService.addSubject({
        SubjectName: name,
        Level: isClassSpecific ? determineClassLevel(targetSpecificClass) : targetLevel,
        Class: isClassSpecific ? targetSpecificClass : undefined
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setNewSubjectName('');
        await onRefreshData();
        setTimeout(() => {
          setActiveTab('list');
          setFeedback(null);
        }, 1200);
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to add subject' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubject = async (subject: SubjectRule) => {
    const confirmMsg = `Are you sure you want to remove "${subject.SubjectName}" from ${
      subject.Class ? `class ${subject.Class}` : `${subject.Level} curriculum`
    }?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingSubjectName(subject.SubjectName);
    setFeedback(null);

    try {
      const res = await FirebaseService.deleteSubject(subject.SubjectName, subject.Level, subject.Class);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove subject' });
    } finally {
      setDeletingSubjectName(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] max-h-[750px] min-h-0 my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                Curriculum Subjects Management
                {currentClass && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {currentClass}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-300">
                Add, customize, or remove subjects synced directly to Firebase Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 shrink-0 gap-2">
          <button
            onClick={() => {
              setActiveTab('list');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-amber-500 text-amber-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Active Subjects List ({subjectsList.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('add');
              setFeedback(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'border-amber-500 text-amber-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Subject</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl text-xs flex items-center gap-2 shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
        )}

        {/* Tab 1: Subject List */}
        {activeTab === 'list' && (
          <div className="p-4 sm:p-5 flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
            {/* Filters Bar */}
            <div className="shrink-0 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search subject by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedLevelFilter}
                  onChange={(e) => setSelectedLevelFilter(e.target.value)}
                  className="text-xs px-2.5 py-2 border border-slate-200 rounded-xl bg-white text-slate-700 font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">All Levels & Classes</option>
                  <option value="Kindergarten">Kindergarten (KG 1 - 2)</option>
                  <option value="Nursery">Nursery (1 - 3)</option>
                  <option value="LowerPrimary">Lower Primary (1 - 3)</option>
                  <option value="UpperPrimary">Upper Primary (4 - 6)</option>
                  <option value="JuniorSecondary">Junior Secondary (JSS)</option>
                  <option value="SeniorSecondary">Senior Secondary (SS)</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white overscroll-contain">
              {filteredSubjects.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No subjects found matching the criteria.
                </div>
              ) : (
                filteredSubjects.map((subj, idx) => (
                  <div
                    key={`${subj.SubjectName}_${subj.Level}_${subj.Class || ''}_${idx}`}
                    className="p-3 sm:px-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 font-mono text-[11px] font-bold flex items-center justify-center border border-amber-200">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{subj.SubjectName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                            {subj.Level}
                          </span>
                          {subj.Class && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                              Class: {subj.Class}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteSubject(subj)}
                      disabled={deletingSubjectName === subj.SubjectName}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove subject"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Add New Subject */}
        {activeTab === 'add' && (
          <form onSubmit={handleAddSubject} className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4 overscroll-contain">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                required
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="e.g. Further Mathematics, Hausa Language, Music..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Assignment Scope
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsClassSpecific(false)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    !isClassSpecific
                      ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-bold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="font-bold">Entire Academic Tier</p>
                  <p className="text-[10px] text-slate-500 font-normal">Apply to all classes in that stage</p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsClassSpecific(true)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    isClassSpecific
                      ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-bold shadow-2xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <p className="font-bold">Specific Class Only</p>
                  <p className="text-[10px] text-slate-500 font-normal">Apply strictly to one class</p>
                </button>
              </div>
            </div>

            {!isClassSpecific ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Target Education Level *
                </label>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Select Specific Class *
                </label>
                <select
                  value={targetSpecificClass}
                  onChange={(e) => setTargetSpecificClass(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 bg-white font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-500 shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Saving to Firebase Firestore...' : 'Save Subject to Firebase'}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>Real-time sync to Firebase</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
