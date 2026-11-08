import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Teacher,
  Student,
  SubjectRule,
  SubjectScore,
  StudentSummary,
  PublishedRecord,
  TermType,
  ClassRecord,
  ClassCategory,
  FacilityItem,
  GalleryItem,
  WebsiteConfig
} from '../types';
import {
  FirebaseService,
  ALL_SCHOOL_CLASSES,
  detectClassCategory,
  sortSchoolClasses,
  sortClassNames
} from '../services/firebaseService';
import { DEFAULT_CURRENT_SESSION } from '../utils/grading';
import { processImageFile, processPassportPhoto } from '../utils/imageUpload';
import { DEFAULT_WEBSITE_CONFIG, DEFAULT_GALLERY_PRESETS } from '../data/websiteDefaults';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Eye,
  EyeOff,
  Edit3,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  KeyRound,
  Users,
  BookOpen,
  Send,
  Layers,
  Download,
  Upload,
  Database,
  Lock,
  GraduationCap,
  FileSpreadsheet,
  Check,
  X,
  Copy,
  ChevronRight,
  UserCheck,
  ExternalLink,
  ArrowRight,
  Filter,
  FolderPlus,
  School,
  Sparkles,
  Building2,
  Image as ImageIcon,
  Loader2,
  Settings,
  Camera
} from 'lucide-react';
import {
  SESSIONS_LIST,
  TERMS_LIST,
  getSchoolIdPrefix,
  getAuthoritativeSubjectsForClass,
  isMatchingClass,
  getGradeAndRemark
} from '../utils/grading';
import {
  exportStudentsToXLSX,
  downloadStudentTemplateXLSX
} from '../utils/spreadsheet';
import { StudentSpreadsheetUpload } from './StudentSpreadsheetUpload';
import { SchoolLogo } from './SchoolLogo';
import { GradingSettingsModal } from './GradingSettingsModal';
import { CumulativeBroadsheet } from './CumulativeBroadsheet';
import { AttendanceRegister } from './AttendanceRegister';
import { SessionRolloverEngine } from './SessionRolloverEngine';
import { BrandingSettingsModal } from './BrandingSettingsModal';
import { Calendar } from 'lucide-react';

interface AdminDashboardProps {
  currentTeacher: Teacher;
  teachersList: Teacher[];
  studentsList: Student[];
  subjectsList: SubjectRule[];
  allScores: SubjectScore[];
  allSummaries: StudentSummary[];
  publishedRecords: PublishedRecord[];
  classesList?: string[];
  classRecords?: ClassRecord[];
  session: string;
  term: TermType;
  websiteConfig?: WebsiteConfig;
  onSaveWebsiteConfig?: (config: WebsiteConfig) => Promise<any> | void;
  onSessionChange: (session: string) => void;
  onTermChange: (term: TermType) => void;
  onInspectClass: (className: string) => void;
  onOpenSubjectManager?: () => void;
  onRefreshData: () => Promise<void>;
  onUpdateCurrentTeacher?: (teacher: Teacher) => void;
  isLive: boolean;
  isLoading?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentTeacher,
  teachersList,
  studentsList,
  subjectsList,
  allScores,
  allSummaries,
  publishedRecords,
  classesList,
  classRecords,
  session,
  term,
  websiteConfig,
  onSaveWebsiteConfig,
  onSessionChange,
  onTermChange,
  onInspectClass,
  onOpenSubjectManager,
  onRefreshData,
  onUpdateCurrentTeacher,
  isLive,
  isLoading = false
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'teachers' | 'students' | 'approvals' | 'broadsheet' | 'attendance' | 'rollover' | 'bulk_upload' | 'backup' | 'facilities' | 'gallery'
  >('overview');
  const [selectedAttendanceClass, setSelectedAttendanceClass] = useState<string>('Primary 1');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGradingSettingsOpen, setIsGradingSettingsOpen] = useState(false);
  const [isBrandingModalOpen, setIsBrandingModalOpen] = useState(false);

  // Local website config state for live website syncing
  const [localWebsiteConfig, setLocalWebsiteConfig] = useState<WebsiteConfig>(() => {
    return websiteConfig || FirebaseService.getCachedWebsiteConfig() || DEFAULT_WEBSITE_CONFIG;
  });

  useEffect(() => {
    if (websiteConfig) {
      setLocalWebsiteConfig(websiteConfig);
    }
  }, [websiteConfig]);

  // Facilities tab state
  const [isAddingFacility, setIsAddingFacility] = useState(false);
  const [facilityForm, setFacilityForm] = useState<{
    title: string;
    category: FacilityItem['category'];
    description: string;
    imageUrl: string;
    features: string[];
    featureInput: string;
  }>({
    title: '',
    category: 'Academics',
    description: '',
    imageUrl: '',
    features: ['Modern standard equipment', 'Supervised learning environment'],
    featureInput: ''
  });

  // Gallery tab state
  const [isAddingGalleryPhoto, setIsAddingGalleryPhoto] = useState(false);
  const [galleryForm, setGalleryForm] = useState<{
    title: string;
    category: string;
    caption: string;
    imageUrl: string;
    date: string;
  }>({
    title: '',
    category: 'Campus Life',
    caption: '',
    imageUrl: '',
    date: `${DEFAULT_CURRENT_SESSION} Session`
  });

  // Editing state for Facilities
  const [editingFacility, setEditingFacility] = useState<FacilityItem | null>(null);
  const [editFacilityForm, setEditFacilityForm] = useState<{
    title: string;
    category: FacilityItem['category'];
    description: string;
    imageUrl: string;
    features: string[];
    featureInput: string;
  }>({
    title: '',
    category: 'Academics',
    description: '',
    imageUrl: '',
    features: [],
    featureInput: ''
  });

  // Editing state for Gallery
  const [editingGalleryItem, setEditingGalleryItem] = useState<GalleryItem | null>(null);
  const [editGalleryForm, setEditGalleryForm] = useState<{
    title: string;
    category: string;
    caption: string;
    imageUrl: string;
    date: string;
  }>({
    title: '',
    category: 'Campus Life',
    caption: '',
    imageUrl: '',
    date: `${DEFAULT_CURRENT_SESSION} Session`
  });

  // Toggle Visibility for Facilities or Gallery
  const handleToggleSectionVisibility = async (section: 'facilities' | 'gallery', enable: boolean) => {
    try {
      setIsProcessing(true);
      const updatedConfig: WebsiteConfig = {
        ...localWebsiteConfig,
        [section === 'facilities' ? 'enableFacilities' : 'enableGallery']: enable
      };
      setLocalWebsiteConfig(updatedConfig);
      if (onSaveWebsiteConfig) {
        await onSaveWebsiteConfig(updatedConfig);
      } else {
        await FirebaseService.saveWebsiteConfig(updatedConfig);
      }
      setFeedback({
        type: 'success',
        message: `${section === 'facilities' ? 'School Facilities' : 'School Gallery'} is now ${
          enable ? 'ENABLED and visible on public website' : 'DISABLED and hidden from website visitors'
        }!`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to update visibility.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for saving Facilities
  const handleSaveFacilitiesToDb = async (updatedFacilities: FacilityItem[]) => {
    try {
      setIsProcessing(true);
      const updatedConfig: WebsiteConfig = {
        ...localWebsiteConfig,
        facilities: updatedFacilities
      };
      setLocalWebsiteConfig(updatedConfig);
      if (onSaveWebsiteConfig) {
        await onSaveWebsiteConfig(updatedConfig);
      } else {
        await FirebaseService.saveWebsiteConfig(updatedConfig);
      }
      setFeedback({ type: 'success', message: 'School facilities updated and published to live website!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to save facilities.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler for saving Gallery
  const handleSaveGalleryToDb = async (updatedGallery: GalleryItem[]) => {
    try {
      setIsProcessing(true);
      const updatedConfig: WebsiteConfig = {
        ...localWebsiteConfig,
        gallery: updatedGallery
      };
      setLocalWebsiteConfig(updatedConfig);
      if (onSaveWebsiteConfig) {
        await onSaveWebsiteConfig(updatedConfig);
      } else {
        await FirebaseService.saveWebsiteConfig(updatedConfig);
      }
      setFeedback({ type: 'success', message: 'School photo gallery updated and published to live website!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to save gallery.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenEditFacility = (fac: FacilityItem) => {
    setEditingFacility(fac);
    setEditFacilityForm({
      title: fac.title,
      category: fac.category,
      description: fac.description || '',
      imageUrl: fac.imageUrl,
      features: fac.features || [],
      featureInput: ''
    });
  };

  const handleSaveEditedFacility = async () => {
    if (!editingFacility) return;
    if (!editFacilityForm.title.trim()) {
      alert('Facility title is required');
      return;
    }
    if (!editFacilityForm.imageUrl.trim()) {
      alert('Facility image is required');
      return;
    }
    const updated = (localWebsiteConfig.facilities || []).map((f) =>
      f.id === editingFacility.id
        ? {
            ...f,
            title: editFacilityForm.title.trim(),
            category: editFacilityForm.category,
            description: editFacilityForm.description.trim(),
            imageUrl: editFacilityForm.imageUrl,
            features: editFacilityForm.features
          }
        : f
    );
    await handleSaveFacilitiesToDb(updated);
    setEditingFacility(null);
  };

  const handleOpenEditGallery = (item: GalleryItem) => {
    setEditingGalleryItem(item);
    setEditGalleryForm({
      title: item.title,
      category: item.category || 'Campus Life',
      caption: item.caption || '',
      imageUrl: item.imageUrl,
      date: item.date || `${DEFAULT_CURRENT_SESSION} Session`
    });
  };

  const handleSaveEditedGalleryItem = async () => {
    if (!editingGalleryItem) return;
    if (!editGalleryForm.title.trim()) {
      alert('Photo title is required');
      return;
    }
    if (!editGalleryForm.imageUrl.trim()) {
      alert('Photo image is required');
      return;
    }
    const currentList = localWebsiteConfig.gallery?.length ? localWebsiteConfig.gallery : DEFAULT_GALLERY_PRESETS;
    const updated = currentList.map((g) =>
      g.id === editingGalleryItem.id
        ? {
            ...g,
            title: editGalleryForm.title.trim(),
            category: editGalleryForm.category.trim(),
            caption: editGalleryForm.caption.trim(),
            imageUrl: editGalleryForm.imageUrl,
            date: editGalleryForm.date.trim()
          }
        : g
    );
    await handleSaveGalleryToDb(updated);
    setEditingGalleryItem(null);
  };

  const handleMultipleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      setIsProcessing(true);
      const currentList = localWebsiteConfig.gallery?.length ? localWebsiteConfig.gallery : DEFAULT_GALLERY_PRESETS;
      const newPhotos: GalleryItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await processImageFile(file, 1200, 0.82);
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        newPhotos.push({
          id: `gal_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) || `School Photo ${currentList.length + i + 1}`,
          category: 'Campus Life',
          caption: '',
          imageUrl: dataUrl,
          date: `${DEFAULT_CURRENT_SESSION} Session`,
          order: currentList.length + i + 1
        });
      }
      const updated = [...newPhotos, ...currentList];
      await handleSaveGalleryToDb(updated);
      setFeedback({
        type: 'success',
        message: `Successfully uploaded and added ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} to the school gallery!`
      });
    } catch (err: any) {
      alert(err?.message || 'Failed to process images');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  // File upload for Facility (Device / Camera)
  const handleFacilityImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetFacilityId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessing(true);
      const dataUrl = await processImageFile(file, 1200, 0.82);
      if (targetFacilityId) {
        const updated = (localWebsiteConfig.facilities || []).map((f) =>
          f.id === targetFacilityId ? { ...f, imageUrl: dataUrl } : f
        );
        await handleSaveFacilitiesToDb(updated);
      } else {
        setFacilityForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  // File upload for Gallery (Device / Camera)
  const handleGalleryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetPhotoId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessing(true);
      const dataUrl = await processImageFile(file, 1200, 0.82);
      if (targetPhotoId) {
        const currentList = localWebsiteConfig.gallery?.length ? localWebsiteConfig.gallery : DEFAULT_GALLERY_PRESETS;
        const updated = currentList.map((g) =>
          g.id === targetPhotoId ? { ...g, imageUrl: dataUrl } : g
        );
        await handleSaveGalleryToDb(updated);
      } else {
        setGalleryForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddNewFacility = async () => {
    if (!facilityForm.title.trim()) {
      alert('Please enter a facility title.');
      return;
    }
    if (!facilityForm.imageUrl.trim()) {
      alert('Please upload an image for the facility.');
      return;
    }
    const newFac: FacilityItem = {
      id: `fac_${Date.now()}`,
      title: facilityForm.title.trim(),
      category: facilityForm.category,
      description: facilityForm.description.trim() || 'Modern facility equipped for student development and excellence.',
      imageUrl: facilityForm.imageUrl,
      features: facilityForm.features,
      order: (localWebsiteConfig.facilities?.length || 0) + 1
    };
    const updated = [newFac, ...(localWebsiteConfig.facilities || [])];
    await handleSaveFacilitiesToDb(updated);
    setIsAddingFacility(false);
    setFacilityForm({
      title: '',
      category: 'Academics',
      description: '',
      imageUrl: '',
      features: ['Modern standard equipment', 'Supervised learning environment'],
      featureInput: ''
    });
  };

  const handleAddNewGalleryPhoto = async () => {
    if (!galleryForm.title.trim()) {
      alert('Please enter a photo title.');
      return;
    }
    if (!galleryForm.imageUrl.trim()) {
      alert('Please upload a photo for the gallery.');
      return;
    }
    const currentList = localWebsiteConfig.gallery?.length ? localWebsiteConfig.gallery : DEFAULT_GALLERY_PRESETS;
    const newPhoto: GalleryItem = {
      id: `gal_${Date.now()}`,
      title: galleryForm.title.trim(),
      category: galleryForm.category.trim() || 'Campus Life',
      caption: galleryForm.caption.trim() || `Moments of learning and student life at ${localWebsiteConfig.schoolName || 'our school'}.`,
      imageUrl: galleryForm.imageUrl,
      date: galleryForm.date.trim() || `${DEFAULT_CURRENT_SESSION} Session`,
      order: currentList.length + 1
    };
    const updated = [newPhoto, ...currentList];
    await handleSaveGalleryToDb(updated);
    setIsAddingGalleryPhoto(false);
    setGalleryForm({
      title: '',
      category: 'Campus Life',
      caption: '',
      imageUrl: '',
      date: `${DEFAULT_CURRENT_SESSION} Session`
    });
  };

  const handleDeleteFacilityFromAdmin = async (facId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the facility "${title}"?`)) return;
    const updated = (localWebsiteConfig.facilities || []).filter((f) => f.id !== facId);
    await handleSaveFacilitiesToDb(updated);
  };

  const handleDeleteGalleryFromAdmin = async (galId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the photo "${title}" from the gallery?`)) return;
    const currentList = localWebsiteConfig.gallery?.length ? localWebsiteConfig.gallery : DEFAULT_GALLERY_PRESETS;
    const updated = currentList.filter((g) => g.id !== galId);
    await handleSaveGalleryToDb(updated);
  };

  // Active Classes List
  const effectiveClassesList = useMemo(() => {
    return classesList && classesList.length > 0 ? classesList : ALL_SCHOOL_CLASSES;
  }, [classesList]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Class Management States
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClassForm, setNewClassForm] = useState<{
    name: string;
    category: ClassCategory;
    classTeacher: string;
    description: string;
  }>({
    name: '',
    category: 'Primary',
    classTeacher: '',
    description: ''
  });

  const [editingClass, setEditingClass] = useState<{
    originalName: string;
    name: string;
    category: ClassCategory;
    classTeacher: string;
    description: string;
  } | null>(null);

  const [deletingClass, setDeletingClass] = useState<{
    className: string;
    pupilsCount: number;
  } | null>(null);
  const [deleteReassignTo, setDeleteReassignTo] = useState<string>('');
  const [deletePupilsAction, setDeletePupilsAction] = useState<'reassign' | 'delete'>('reassign');

  const [classCategoryFilter, setClassCategoryFilter] = useState<string>('all');
  const [classSearchQuery, setClassSearchQuery] = useState<string>('');

  // Password Visibility State
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAllStaffPasswords, setShowAllStaffPasswords] = useState(false);
  const [showAllPupilPasswords, setShowAllPupilPasswords] = useState(false);

  // Teacher Reassignment / Edit Modal State
  const [editingTeacher, setEditingTeacher] = useState<{
    originalUsername: string;
    username: string;
    password: string;
    fullName: string;
    classAssigned: string;
    role?: 'admin' | 'teacher';
    photoURL?: string;
  } | null>(null);

  const [isUploadingAdminPhoto, setIsUploadingAdminPhoto] = useState(false);

  // Quick Reset Password Modal State
  const [quickResetTeacher, setQuickResetTeacher] = useState<Teacher | null>(null);
  const [quickResetPassword, setQuickResetPassword] = useState('');
  const [showQuickResetPass, setShowQuickResetPass] = useState(false);

  // Reassign Class Teacher Modal State (dedicated simple modal)
  const [reassigningClass, setReassigningClass] = useState<{
    className: string;
    currentTeacherName: string;
    currentUsername: string;
  } | null>(null);
  const [reassignForm, setReassignForm] = useState<{
    teacherName: string;
    username: string;
    password: string;
  }>({
    teacherName: '',
    username: '',
    password: 'password123'
  });

  // Create New Teacher Account State
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [newTeacherForm, setNewTeacherForm] = useState<{
    username: string;
    password: string;
    fullName: string;
    classAssigned: string;
    role: 'admin' | 'teacher';
  }>({
    username: '',
    password: 'password123',
    fullName: '',
    classAssigned: 'Primary 1',
    role: 'teacher'
  });

  // Student Full Edit State
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<{
    studentId: string;
    fullName: string;
    className: string;
    gender: 'Male' | 'Female';
    dob: string;
    parentName: string;
    parentPhone: string;
    address: string;
    password: string;
  }>({
    studentId: '',
    fullName: '',
    className: 'Primary 1',
    gender: 'Male',
    dob: '',
    parentName: '',
    parentPhone: '',
    address: '',
    password: 'password'
  });

  // New Student Registration State
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState<{
    studentId: string;
    fullName: string;
    className: string;
    gender: 'Male' | 'Female';
    dob: string;
    parentName: string;
    parentPhone: string;
    address: string;
    password: string;
  }>({
    studentId: '',
    fullName: '',
    className: 'Primary 1',
    gender: 'Male',
    dob: '',
    parentName: '',
    parentPhone: '',
    address: '',
    password: 'password'
  });

  // Bulk Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [bulkRawText, setBulkRawText] = useState('');
  const [parsedBulkStudents, setParsedBulkStudents] = useState<Student[]>([]);
  const [bulkValidationErrors, setBulkValidationErrors] = useState<string[]>([]);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Restore Backup State
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [restoreDataPreview, setRestoreDataPreview] = useState<{
    studentsCount: number;
    scoresCount: number;
    summariesCount: number;
    teachersCount: number;
    subjectsCount: number;
    data: any;
  } | null>(null);

  // Calculate Class Statistics
  const classStats = useMemo(() => {
    const list = sortClassNames(effectiveClassesList);
    return list.map((cls) => {
      const record = classRecords?.find((r) => isMatchingClass(r.name, cls));
      const category: ClassCategory = record?.category || detectClassCategory(cls);
      const teacher = teachersList.find(
        (t) => isMatchingClass(t.ClassAssigned, cls) && t.Role !== 'admin'
      );
      const classPupils = studentsList.filter((s) => isMatchingClass(s.Class, cls));
      const authSubjects = getAuthoritativeSubjectsForClass(cls, subjectsList);
      const expectedScores = classPupils.length * authSubjects.length;

      let enteredScores = 0;
      classPupils.forEach((p) => {
        const pScores = allScores.filter(
          (sc) =>
            String(sc.StudentID ?? '').toLowerCase() === String(p.StudentID ?? '').toLowerCase() &&
            sc.Term === term &&
            (sc.Session === session || !sc.Session) &&
            authSubjects.some((as) => String(as ?? '').toLowerCase() === String(sc.Subject ?? '').toLowerCase()) &&
            (sc.CA1 !== null || sc.CA2 !== null || sc.Exam !== null || sc.Total !== null)
        );
        enteredScores += pScores.length;
      });

      const completionPercent =
        expectedScores > 0 ? Math.min(100, Math.round((enteredScores / expectedScores) * 100)) : 0;

      const pubRecord = publishedRecords.find(
        (r) =>
          isMatchingClass(r.className, cls) &&
          r.term === term &&
          (r.session === session || !r.session)
      );
      const status = pubRecord?.status || (pubRecord?.isPublished ? 'approved' : 'draft');
      const isApproved = Boolean(pubRecord?.isPublished && pubRecord?.adminApproved !== false && status === 'approved');
      const isPendingApproval = status === 'pending_approval' || Boolean(pubRecord?.teacherSubmitted && !isApproved);

      return {
        className: cls,
        category,
        description: record?.description || '',
        teacher: teacher || {
          Username: `teacher_${cls.toLowerCase().replace(/[\s._-]/g, '')}`,
          FullName: record?.classTeacher || 'Unassigned Staff',
          ClassAssigned: cls,
          Password: 'password123',
          Role: 'teacher' as const
        },
        pupilsCount: classPupils.length,
        subjectsCount: authSubjects.length,
        enteredScores,
        expectedScores,
        completionPercent,
        status,
        isApproved,
        isPendingApproval,
        teacherSubmitted: pubRecord?.teacherSubmitted,
        teacherSubmittedBy: pubRecord?.teacherSubmittedBy,
        publishedAt: pubRecord?.publishedAt,
        publishedBy: pubRecord?.publishedBy
      };
    });
  }, [effectiveClassesList, classRecords, teachersList, studentsList, subjectsList, allScores, publishedRecords, session, term]);

  // Overall School Metrics
  const schoolMetrics = useMemo(() => {
    const totalPupils = studentsList.length;
    const totalTeachers = teachersList.filter((t) => t.Role !== 'admin').length;
    const totalSubjects = subjectsList.length;
    const approvedClasses = classStats.filter((c) => c.isApproved).length;
    const totalExpected = classStats.reduce((acc, c) => acc + c.expectedScores, 0);
    const totalEntered = classStats.reduce((acc, c) => acc + c.enteredScores, 0);
    const overallProgress =
      totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0;

    return {
      totalPupils,
      totalTeachers,
      totalSubjects,
      approvedClasses,
      totalExpected,
      totalEntered,
      overallProgress
    };
  }, [studentsList, teachersList, subjectsList, classStats]);

  // Copy credentials helper
  const handleCopyCredentials = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2500);
  };

  // Toggle Single Class Result Publish Status & Approval
  const handleToggleApprove = async (className: string, shouldApprove: boolean) => {
    setIsProcessing(true);
    setFeedback(null);
    try {
      await FirebaseService.setClassPublishStatus(
        className,
        term,
        session,
        shouldApprove,
        currentTeacher.FullName || 'Administrator',
        shouldApprove
          ? {
              status: 'approved',
              adminApproved: true,
              adminApprovedBy: currentTeacher.FullName || 'Administrator'
            }
          : {
              status: 'draft',
              adminApproved: false
            }
      );
      setFeedback({
        type: 'success',
        message: shouldApprove
          ? `Results for ${className} (${term}, ${session}) APPROVED & RELEASED! Students can now view their report cards.`
          : `Results for ${className} set to DRAFT / UNPUBLISHED.`
      });
      await onRefreshData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update approval status.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk Approve All Classes
  const handleApproveAll = async () => {
    const readyClasses = classStats.filter((c) => c.pupilsCount > 0 && !c.isApproved);
    if (readyClasses.length === 0) {
      setFeedback({ type: 'success', message: 'All active classes are already approved.' });
      return;
    }

    if (
      !window.confirm(
        `Approve and release results for all ${readyClasses.length} remaining classes in ${term} (${session})? Students will immediately have access to their report cards.`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      for (const cls of readyClasses) {
        await FirebaseService.setClassPublishStatus(
          cls.className,
          term,
          session,
          true,
          currentTeacher.FullName || 'Administrator',
          {
            status: 'approved',
            adminApproved: true,
            adminApprovedBy: currentTeacher.FullName || 'Administrator'
          }
        );
      }
      setFeedback({
        type: 'success',
        message: `Successfully APPROVED and RELEASED results for ${readyClasses.length} classes!`
      });
      await onRefreshData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error approving classes.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reassign Class Teacher Submit
  const handleReassignClassTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigningClass) return;

    if (!reassignForm.teacherName.trim()) {
      setFeedback({ type: 'error', message: 'Teacher name is required.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const username =
        reassignForm.username.trim() ||
        `teacher_${reassigningClass.className.toLowerCase().replace(/[\s._-]/g, '')}`;

      const res = await FirebaseService.updateTeacherCredentials(reassigningClass.currentUsername, {
        Username: username,
        Password: reassignForm.password.trim() || 'password123',
        FullName: reassignForm.teacherName.trim(),
        ClassAssigned: reassigningClass.className,
        Role: 'teacher'
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Class teacher for ${reassigningClass.className} updated to "${reassignForm.teacherName.trim()}".`
        });
        setReassigningClass(null);
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reassign teacher.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Class Management: Create Class Handler
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newClassForm.name.trim();
    if (!name) {
      setFeedback({ type: 'error', message: 'Class name cannot be empty.' });
      return;
    }

    const exists = effectiveClassesList.some(
      (c) => c.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (exists) {
      setFeedback({ type: 'error', message: `Class "${name}" already exists in the system.` });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.saveClass({
        name,
        category: newClassForm.category || detectClassCategory(name),
        classTeacher: newClassForm.classTeacher.trim() || undefined,
        description: newClassForm.description.trim() || undefined
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Class "${name}" successfully created and added to the curriculum roster.`
        });
        setIsAddingClass(false);
        setNewClassForm({
          name: '',
          category: 'Primary',
          classTeacher: '',
          description: ''
        });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create new class.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Class Management: Update Class Handler
  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    const name = editingClass.name.trim();
    if (!name) {
      setFeedback({ type: 'error', message: 'Class name cannot be empty.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.updateClass(editingClass.originalName, {
        name,
        category: editingClass.category || detectClassCategory(name),
        classTeacher: editingClass.classTeacher.trim() || undefined,
        description: editingClass.description.trim() || undefined
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Class "${editingClass.originalName}" successfully updated${
            editingClass.originalName !== name ? ` to "${name}"` : ''
          }.`
        });
        setEditingClass(null);
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update class.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Class Management: Delete Class Confirm Handler
  const handleDeleteClassConfirm = async () => {
    if (!deletingClass) return;

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.deleteClass(deletingClass.className, {
        reassignStudentsTo:
          deletePupilsAction === 'reassign' && deleteReassignTo.trim()
            ? deleteReassignTo.trim()
            : undefined,
        deleteStudents: deletePupilsAction === 'delete'
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
        setDeletingClass(null);
        setDeleteReassignTo('');
        setDeletePupilsAction('reassign');
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete class.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Photo upload handler for Admin Account (strictly <= 100KB with permanent Firebase storage)
  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Selected file is not an image. Please choose a JPG or PNG file.' });
      return;
    }

    if (file.size > 100 * 1024) {
      setFeedback({
        type: 'error',
        message: `Admin photo must be 100KB or lower. Selected file is ${(file.size / 1024).toFixed(1)}KB.`
      });
      return;
    }

    try {
      setIsUploadingAdminPhoto(true);
      const dataUrl = await processPassportPhoto(file, 100 * 1024);
      const res = await FirebaseService.updateTeacherCredentials(masterAdmin.Username, {
        PhotoURL: dataUrl
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Admin profile photograph uploaded and permanently saved in Firebase!'
        });
        if (onUpdateCurrentTeacher) {
          onUpdateCurrentTeacher({
            ...currentTeacher,
            PhotoURL: dataUrl
          });
        }
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to upload admin photo.' });
    } finally {
      setIsUploadingAdminPhoto(false);
    }
  };

  // Save Teacher Credential Update
  const handleSaveTeacherCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.updateTeacherCredentials(editingTeacher.originalUsername, {
        Username: editingTeacher.username.trim(),
        Password: editingTeacher.password.trim(),
        FullName: editingTeacher.fullName.trim(),
        ClassAssigned: editingTeacher.classAssigned,
        Role: editingTeacher.role,
        PhotoURL: editingTeacher.photoURL !== undefined ? editingTeacher.photoURL.trim() : undefined
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        // Update currentTeacher session if user edited their own account or edited admin credentials while logged in as admin
        const isEditingSelfOrAdmin =
          editingTeacher.originalUsername.toLowerCase() === String(currentTeacher.Username ?? '').toLowerCase() ||
          (currentTeacher.Role === 'admin' && editingTeacher.role === 'admin');

        if (isEditingSelfOrAdmin) {
          onUpdateCurrentTeacher?.({
            ...currentTeacher,
            Username: editingTeacher.username.trim(),
            Password: editingTeacher.password.trim(),
            FullName: editingTeacher.fullName.trim(),
            ClassAssigned: editingTeacher.classAssigned,
            Role: editingTeacher.role,
            PhotoURL: editingTeacher.photoURL !== undefined ? editingTeacher.photoURL.trim() : currentTeacher.PhotoURL
          });
        }
        setEditingTeacher(null);
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update credentials' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create Staff Login Submit
  const handleCreateTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherForm.username.trim() || !newTeacherForm.fullName.trim()) {
      setFeedback({ type: 'error', message: 'Username and Full Name are required.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.createTeacher({
        Username: newTeacherForm.username.trim(),
        Password: newTeacherForm.password.trim() || 'password123',
        FullName: newTeacherForm.fullName.trim(),
        ClassAssigned: newTeacherForm.classAssigned,
        Role: newTeacherForm.role
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setIsCreatingTeacher(false);
        setNewTeacherForm({
          username: '',
          password: 'password123',
          fullName: '',
          classAssigned: 'Primary 1',
          role: 'teacher'
        });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create staff account.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Teacher
  const handleDeleteTeacher = async (username: string, fullName: string) => {
    if (username.toLowerCase() === String(currentTeacher.Username ?? '').toLowerCase()) {
      alert('Cannot delete your own active Administrator account.');
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete the staff account for "${fullName}" (${username})?`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.deleteTeacher(username);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete teacher.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Quick Reset Password Modal
  const handleOpenQuickResetPassword = (teacher: Teacher) => {
    setQuickResetTeacher(teacher);
    setQuickResetPassword('');
    setShowQuickResetPass(false);
  };

  // Save Quick Reset Password
  const handleSaveQuickResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickResetTeacher) return;
    if (!quickResetPassword.trim()) {
      setFeedback({ type: 'error', message: 'Password cannot be empty.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.updateTeacherCredentials(quickResetTeacher.Username, {
        Username: quickResetTeacher.Username,
        Password: quickResetPassword.trim(),
        FullName: quickResetTeacher.FullName,
        ClassAssigned: quickResetTeacher.ClassAssigned,
        Role: quickResetTeacher.Role
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Password for ${quickResetTeacher.FullName} (${quickResetTeacher.Username}) updated successfully!`
        });
        if (
          String(quickResetTeacher.Username ?? '').toLowerCase() === String(currentTeacher.Username ?? '').toLowerCase() ||
          (currentTeacher.Role === 'admin' && quickResetTeacher.Role === 'admin')
        ) {
          onUpdateCurrentTeacher?.({
            ...currentTeacher,
            Password: quickResetPassword.trim()
          });
        }
        setQuickResetTeacher(null);
        setQuickResetPassword('');
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Staff Credentials CSV
  const handleExportStaffCredentials = () => {
    const rows = [
      ['Assigned Class', 'Staff Full Name', 'Login Username', 'Password', 'Role'],
      ...teachersList.map((t) => [
        t.ClassAssigned,
        t.FullName || '',
        t.Username,
        t.Password || '',
        t.Role || (String(t.Username ?? '').toLowerCase() === 'admin' ? 'admin' : 'teacher')
      ])
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows
        .map((e) => e.map((x) => `"${(x || '').toString().replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const schoolFilePrefix = (localWebsiteConfig.acronym || localWebsiteConfig.shortName || localWebsiteConfig.schoolName || 'School')
      .replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `${schoolFilePrefix}_Staff_Credentials_${session.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Student CRUD Operations
  const [pupilIdStreamFilter, setPupilIdStreamFilter] = useState<'all' | 'dnps' | 'dss'>('all');

  const handleOpenAddStudent = (preferredClass?: string) => {
    const activeFilterClass =
      preferredClass ||
      (selectedClassFilter !== 'all'
        ? selectedClassFilter
        : pupilIdStreamFilter === 'dss'
        ? effectiveClassesList.find((c) => FirebaseService.isSecondaryClass(c)) || 'JSS 1'
        : effectiveClassesList[0] || 'Primary 1');
    setNewStudentForm({
      studentId: FirebaseService.getNextStudentIdPreview(studentsList, activeFilterClass),
      fullName: '',
      className: activeFilterClass,
      gender: 'Male',
      dob: '',
      parentName: '',
      parentPhone: '',
      address: '',
      password: 'password'
    });
    setIsAddingStudent(true);
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    if (!newStudentForm.fullName.trim()) {
      setFeedback({ type: 'error', message: 'Full Name is required.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.createStudentWithNextId({
        studentId: newStudentForm.studentId.trim(),
        fullName: newStudentForm.fullName.trim(),
        className: newStudentForm.className,
        gender: newStudentForm.gender,
        dob: newStudentForm.dob.trim(),
        parentName: newStudentForm.parentName.trim(),
        parentPhone: newStudentForm.parentPhone.trim(),
        address: newStudentForm.address.trim(),
        password: newStudentForm.password.trim() || 'password'
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Pupil ${newStudentForm.fullName.trim()} (${res.student?.StudentID || ''}) registered successfully!`
        });
        setIsAddingStudent(false);
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to add student.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToEdit) return;

    if (!editStudentForm.studentId.trim() || !editStudentForm.fullName.trim()) {
      setFeedback({ type: 'error', message: 'Student ID and Full Name are required.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.updateStudentProfileAndIdentifier(studentToEdit.StudentID, {
        StudentID: editStudentForm.studentId.trim().toUpperCase(),
        FullName: editStudentForm.fullName.trim(),
        Class: editStudentForm.className,
        Gender: editStudentForm.gender,
        DOB: editStudentForm.dob.trim(),
        ParentName: editStudentForm.parentName.trim(),
        ParentPhone: editStudentForm.parentPhone.trim(),
        Address: editStudentForm.address.trim(),
        Password: editStudentForm.password.trim() || 'password'
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || `Pupil ${editStudentForm.fullName} updated successfully!`
        });
        setStudentToEdit(null);
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save student profile.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete pupil "${studentName}" (${studentId}) and all their assessment scores?`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.deleteStudent(studentId);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete student.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickResetStudentPassword = async (studentId: string, studentName: string) => {
    const newPass = window.prompt(
      `Enter new password for pupil ${studentName} (${studentId}):`,
      'password'
    );
    if (newPass === null) return;
    if (!newPass.trim()) {
      alert('Password cannot be empty.');
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.updateStudentPassword(studentId, newPass.trim());
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Password for ${studentName} (${studentId}) updated to "${newPass.trim()}".`
        });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reset password.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchResetClassPasswords = async () => {
    const targetClass = selectedClassFilter;
    const targetName = targetClass === 'all' ? 'ALL classes' : targetClass;
    if (
      !window.confirm(
        `Reset all student passwords in ${targetName} to default "password"? Pupils will log in using their ID and "password".`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.resetClassStudentPasswords(targetClass, 'password');
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to batch reset passwords.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportStudentCredentials = () => {
    const filteredStudents = studentsList.filter((s) => {
      const matchesClass = selectedClassFilter === 'all' || isMatchingClass(s.Class, selectedClassFilter);
      const isSec = FirebaseService.isSecondaryClass(s.Class) || String(s.StudentID ?? '').trim().toUpperCase().startsWith('DSS');
      const matchesStream =
        pupilIdStreamFilter === 'all' ||
        (pupilIdStreamFilter === 'dss' && isSec) ||
        (pupilIdStreamFilter === 'dnps' && !isSec);
      return matchesClass && matchesStream;
    });

    const rows = [
      ['DNPS ID (Nursery / Primary)', 'DSS ID (Secondary)', 'Full Name', 'Class', 'Gender', 'Login Password', 'Parent Name', 'Parent Phone'],
      ...filteredStudents.map((s) => {
        const isSec = FirebaseService.isSecondaryClass(s.Class) || String(s.StudentID ?? '').trim().toUpperCase().startsWith('DSS');
        return [
          !isSec ? s.StudentID : '',
          isSec ? s.StudentID : '',
          s.FullName,
          s.Class,
          s.Gender || 'Male',
          s.Password || 'password',
          s.ParentName || '',
          s.ParentPhone || ''
        ];
      })
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows
        .map((e) => e.map((x) => `"${(x || '').toString().replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const schoolFilePrefix = (localWebsiteConfig.shortName || localWebsiteConfig.schoolName || 'Student')
      .replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute(
      'download',
      `${schoolFilePrefix}_Student_Logins_${selectedClassFilter === 'all' ? 'All_Classes' : selectedClassFilter.replace(/\s+/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportStudentCredentialsXLSX = () => {
    const filteredStudents = studentsList.filter((s) => {
      const matchesClass = selectedClassFilter === 'all' || isMatchingClass(s.Class, selectedClassFilter);
      const isSec = FirebaseService.isSecondaryClass(s.Class) || String(s.StudentID ?? '').trim().toUpperCase().startsWith('DSS');
      const matchesStream =
        pupilIdStreamFilter === 'all' ||
        (pupilIdStreamFilter === 'dss' && isSec) ||
        (pupilIdStreamFilter === 'dnps' && !isSec);
      return matchesClass && matchesStream;
    });
    const schoolFilePrefix = (localWebsiteConfig.acronym || localWebsiteConfig.shortName || localWebsiteConfig.schoolName || 'School')
      .replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${schoolFilePrefix}_Student_Roster_${selectedClassFilter === 'all' ? 'All_Classes' : selectedClassFilter.replace(/\s+/g, '_')}`;
    exportStudentsToXLSX(filteredStudents, fileName);
  };

  // Bulk Upload Parsing
  const parseBulkCSV = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      setParsedBulkStudents([]);
      setBulkValidationErrors([]);
      return;
    }

    const errors: string[] = [];
    const results: Student[] = [];

    let startIndex = 0;
    const firstLineLower = lines[0].toLowerCase();
    const hasHeader =
      firstLineLower.includes('id') ||
      firstLineLower.includes('name') ||
      firstLineLower.includes('class');

    if (hasHeader) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/[\t,;]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length < 2) {
        errors.push(`Row ${i + 1}: Incomplete row. Minimum columns: ID, Full Name.`);
        continue;
      }

      const id = parts[0];
      const name = parts[1];
      const className = parts[2] || 'Primary 1';
      const gender = (parts[3] === 'Female' || parts[3] === 'F' ? 'Female' : 'Male') as
        | 'Male'
        | 'Female';
      const parentName = parts[4] || '';
      const parentPhone = parts[5] || '';
      const address = parts[6] || '';
      const password = parts[7] || 'password';

      if (!id || !name) {
        errors.push(`Row ${i + 1}: Student ID or Name is missing.`);
        continue;
      }

      results.push({
        StudentID: id.toUpperCase(),
        FullName: name,
        Class: className,
        Gender: gender,
        ParentName: parentName,
        ParentPhone: parentPhone,
        Address: address,
        Password: password
      });
    }

    setParsedBulkStudents(results);
    setBulkValidationErrors(errors);
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setBulkRawText(content);
      parseBulkCSV(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteBulkUpload = async () => {
    if (parsedBulkStudents.length === 0) {
      setFeedback({ type: 'error', message: 'No valid student records to upload.' });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.bulkUploadStudents(parsedBulkStudents);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Successfully uploaded ${res.count} pupils into school database!`
        });
        setBulkRawText('');
        setParsedBulkStudents([]);
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Bulk upload failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Full Database Backup Export
  const handleExportFullBackup = async () => {
    try {
      const schoolName = localWebsiteConfig?.schoolName || 'School Management Portal';
      const schoolSlug = (localWebsiteConfig?.acronym || localWebsiteConfig?.shortName || 'school').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const backupObj = {
        school: schoolName,
        ...(await FirebaseService.exportSchoolBackup()),
        websiteConfig: localWebsiteConfig
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${schoolSlug}_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Could not create the full backup.' });
    }
  };

  // Backup File Read
  const handleRestoreFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON format.');
        }

        const studentsArr = Array.isArray(parsed.students)
          ? parsed.students
          : Array.isArray(parsed.studentsList)
          ? parsed.studentsList
          : Array.isArray(parsed.pupils)
          ? parsed.pupils
          : [];
        const scoresArr = Array.isArray(parsed.scores)
          ? parsed.scores
          : Array.isArray(parsed.allScores)
          ? parsed.allScores
          : Array.isArray(parsed.scoresList)
          ? parsed.scoresList
          : [];
        const summariesArr = Array.isArray(parsed.summaries)
          ? parsed.summaries
          : Array.isArray(parsed.allSummaries)
          ? parsed.allSummaries
          : Array.isArray(parsed.summariesList)
          ? parsed.summariesList
          : [];
        const teachersArr = Array.isArray(parsed.teachers)
          ? parsed.teachers
          : Array.isArray(parsed.teachersList)
          ? parsed.teachersList
          : [];
        const subjectsArr = Array.isArray(parsed.subjects)
          ? parsed.subjects
          : Array.isArray(parsed.subjectsList)
          ? parsed.subjectsList
          : [];

        setRestoreDataPreview({
          studentsCount: studentsArr.length,
          scoresCount: scoresArr.length,
          summariesCount: summariesArr.length,
          teachersCount: teachersArr.length,
          subjectsCount: subjectsArr.length,
          data: {
            ...parsed,
            students: studentsArr,
            scores: scoresArr,
            summaries: summariesArr,
            teachers: teachersArr,
            subjects: subjectsArr
          }
        });
        setFeedback(null);
      } catch (err: any) {
        setFeedback({ type: 'error', message: 'Failed to parse backup file: ' + err.message });
      }
    };
    reader.readAsText(file);
    // Reset file input value so re-selecting the same file fires onChange reliably
    e.target.value = '';
  };

  // Execute Restore (direct, iframe-safe without blocked window.confirm)
  const handleExecuteRestore = async () => {
    if (!restoreDataPreview?.data) return;

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.restoreSchoolBackup(restoreDataPreview.data);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        setRestoreDataPreview(null);
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Restore failed.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear Mock Data
  const handleClearMockData = async () => {
    if (
      !window.confirm(
        'Are you sure you want to CLEAR all mock student records and test scores from Firestore?\n\nThis will purge test/demo records from Firestore so your portal is completely clean and ready for real student registrations.'
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await FirebaseService.clearAllMockData();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message
        });
        await onRefreshData();
      } else {
        setFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to clear mock data.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered Students for the directory
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return studentsList.filter((s) => {
      const matchesClass =
        selectedClassFilter === 'all' || isMatchingClass(s.Class, selectedClassFilter);
      const isSec =
        FirebaseService.isSecondaryClass(s.Class) ||
        String(s.StudentID ?? '').trim().toUpperCase().startsWith('DSS');
      const matchesStream =
        pupilIdStreamFilter === 'all' ||
        (pupilIdStreamFilter === 'dss' && isSec) ||
        (pupilIdStreamFilter === 'dnps' && !isSec);
      const matchesSearch =
        !q ||
        String(s.FullName ?? '').toLowerCase().includes(q) ||
        String(s.StudentID ?? '').toLowerCase().includes(q) ||
        String(s.Class ?? '').toLowerCase().includes(q) ||
        (s.ParentName && s.ParentName.toLowerCase().includes(q));
      return matchesClass && matchesStream && matchesSearch;
    });
  }, [studentsList, selectedClassFilter, pupilIdStreamFilter, searchQuery]);

  // Master Admin teacher object
  const masterAdmin = useMemo(() => {
    // 1. If currently active user is an admin, match their exact username or use currentTeacher
    if (currentTeacher?.Role === 'admin' || currentTeacher?.Username?.toLowerCase() === 'admin') {
      const match = teachersList.find(
        (t) => String(t.Username ?? '').toLowerCase() === String(currentTeacher.Username ?? '').toLowerCase()
      );
      if (match) return match;
      return currentTeacher;
    }

    // 2. Otherwise locate the admin account from the loaded staff list
    const adminDoc =
      teachersList.find((t) => String(t.Username ?? '').toLowerCase() === 'admin' && t.Role === 'admin') ||
      teachersList.find((t) => String(t.Username ?? '').toLowerCase() === 'admin') ||
      teachersList.find((t) => t.Role === 'admin');

    if (adminDoc) return adminDoc;

    return {
      Username: currentTeacher?.Username || 'admin',
      Password: currentTeacher?.Password || 'admin',
      ClassAssigned: 'Admin',
      FullName: currentTeacher?.FullName || 'Portal Administrator',
      Role: 'admin' as const
    };
  }, [teachersList, currentTeacher]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Command Center Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Brand Info */}
          <div className="flex items-center gap-4">
            <SchoolLogo size="lg" className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 object-contain" />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase font-serif tracking-tight">
                  Admin Control Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono font-black text-xs uppercase tracking-wider">
                  Full Authority
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-200 mt-1">
                {(localWebsiteConfig?.schoolName || 'School Management Portal')} &bull; School-Wide Management, Teacher Assignments &amp; Result Publishing Gate
              </p>
            </div>
          </div>

          {/* Academic Term Switcher & Controls */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-800/90 p-2 rounded-xl border border-slate-700">
            <button
              id="admin-settings-header-btn"
              onClick={() => setIsBrandingModalOpen(true)}
              className="p-1.5 px-3 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow transition-all flex items-center gap-1.5 cursor-pointer"
              title="Customize school settings, name, logo, motto, address, contacts, stamp, and homepage text"
            >
              <Settings className="w-3.5 h-3.5 text-slate-950" />
              <span>School Settings</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Term:
              </span>
              <select
                value={term}
                onChange={(e) => onTermChange(e.target.value as TermType)}
                className="bg-slate-900 text-amber-400 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {TERMS_LIST.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Session:
              </span>
              <select
                value={session}
                onChange={(e) => onSessionChange(e.target.value)}
                className="bg-slate-900 text-white border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {SESSIONS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onRefreshData}
              disabled={isLoading}
              className="p-1.5 px-3 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Sync with Firebase Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isLoading ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* High Level Key Metrics Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-800">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
              Enrolled Pupils
            </span>
            <span className="text-xl font-black font-mono text-white mt-1 block">
              {schoolMetrics.totalPupils}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
              Classes
            </span>
            <span className="text-xl font-black font-mono text-white mt-1 block">
              {ALL_SCHOOL_CLASSES.length}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
              Staff Accounts
            </span>
            <span className="text-xl font-black font-mono text-white mt-1 block">
              {schoolMetrics.totalTeachers}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
              Subjects
            </span>
            <span className="text-xl font-black font-mono text-white mt-1 block">
              {schoolMetrics.totalSubjects}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
              Published Classes
            </span>
            <span className="text-xl font-black font-mono text-emerald-400 mt-1 block">
              {schoolMetrics.approvedClasses} / {ALL_SCHOOL_CLASSES.length}
            </span>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
              Scores Progress
            </span>
            <span className="text-xl font-black font-mono text-amber-400 mt-1 block">
              {schoolMetrics.overallProgress}%
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('overview');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Classes &amp; Score Control ({ALL_SCHOOL_CLASSES.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('teachers');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'teachers'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <KeyRound className="w-4 h-4 text-amber-400" />
          <span>Staff Logins &amp; Teachers</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('students');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'students'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          <span>Pupils Directory ({studentsList.length})</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('approvals');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'approvals'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4 text-amber-400" />
          <span>Result Publishing Controls</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('broadsheet');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'broadsheet'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>Annual Broadsheet</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('attendance');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'attendance'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-400" />
          <span>Attendance Register</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('rollover');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'rollover'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <span>Session Rollover &amp; Promotion</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('bulk_upload');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'bulk_upload'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          <span>Bulk Upload</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('backup');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'backup'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4 text-amber-400" />
          <span>Data Backup</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('facilities');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'facilities'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-400" />
          <span>School Facilities</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            localWebsiteConfig.enableFacilities
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {localWebsiteConfig.enableFacilities ? 'Live' : 'Hidden'}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('gallery');
            setFeedback(null);
          }}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'gallery'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-amber-400" />
          <span>School Gallery</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
            localWebsiteConfig.enableGallery
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {localWebsiteConfig.enableGallery ? 'Live' : 'Hidden'}
          </span>
        </button>

        <button
          id="admin-settings-tab-btn"
          onClick={() => setIsBrandingModalOpen(true)}
          className="py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-xs ml-auto"
          title="Customize school settings: name, logo, address, contact, stamp, and homepage text"
        >
          <Settings className="w-4 h-4 text-slate-950" />
          <span>School Settings</span>
        </button>

        <button
          onClick={() => setIsGradingSettingsOpen(true)}
          className="py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
          title="Customize school academic grading scale & remarks in settings"
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Grading Settings</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & MASTER CLASSES CONTROL */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Header Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <School className="w-4 h-4 text-amber-500" />
                  <span>Curriculum Classes &amp; Academic Rosters</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage classes, assign teachers, record pupil marks, and approve final report cards.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingClass(true)}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Class</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSubjectManager}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  <span>Subject Manager</span>
                </button>

                <button
                  type="button"
                  onClick={handleApproveAll}
                  disabled={isProcessing}
                  className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve All</span>
                </button>
              </div>
            </div>

            {/* Category Filter Chips and Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 shrink-0">
                  Filter Tier:
                </span>
                {[
                  { key: 'all', label: `All (${classStats.length})` },
                  { key: 'KG', label: 'KG' },
                  { key: 'Nursery', label: 'Nursery' },
                  { key: 'Primary', label: 'Primary' },
                  { key: 'Junior Secondary', label: 'JSS' },
                  { key: 'Senior Secondary', label: 'SSS' }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setClassCategoryFilter(item.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      classCategoryFilter === item.key
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Find class..."
                  value={classSearchQuery}
                  onChange={(e) => setClassSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Classes Cards Grid */}
          {(() => {
            const filtered = classStats.filter((stat) => {
              const matchesCategory =
                classCategoryFilter === 'all' ||
                (stat.category && stat.category.toLowerCase() === classCategoryFilter.toLowerCase()) ||
                (classCategoryFilter === 'KG' && stat.className.toUpperCase().includes('KG')) ||
                (classCategoryFilter === 'Nursery' && stat.className.toLowerCase().includes('nursery')) ||
                (classCategoryFilter === 'Primary' && stat.className.toLowerCase().includes('primary')) ||
                (classCategoryFilter === 'Junior Secondary' && (stat.className.toUpperCase().includes('JSS') || stat.className.toLowerCase().includes('junior'))) ||
                (classCategoryFilter === 'Senior Secondary' && (stat.className.toUpperCase().includes('SS') || stat.className.toLowerCase().includes('senior')));

              const matchesSearch =
                !classSearchQuery.trim() ||
                stat.className.toLowerCase().includes(classSearchQuery.toLowerCase().trim()) ||
                String(stat.teacher.FullName ?? '').toLowerCase().includes(classSearchQuery.toLowerCase().trim());

              return matchesCategory && matchesSearch;
            });

            if (filtered.length === 0) {
              return (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
                  <p className="font-semibold text-slate-700">No classes found matching the criteria.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setClassCategoryFilter('all');
                      setClassSearchQuery('');
                    }}
                    className="mt-2 text-amber-600 font-bold hover:underline cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((stat) => (
                  <div
                    key={stat.className}
                    className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                      stat.isApproved
                        ? 'border-emerald-300 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-base text-slate-900">
                              {stat.className}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {stat.category}
                            </span>
                          </div>
                          {stat.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{stat.description}</p>
                          )}
                        </div>

                        {/* Status Badge */}
                        {stat.isApproved ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3" />
                            <span>Live</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            <span>Draft</span>
                          </span>
                        )}
                      </div>

                      {/* Card Details */}
                      <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Assigned Teacher:</span>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-900">{stat.teacher.FullName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setReassigningClass({
                                  className: stat.className,
                                  currentTeacherName: stat.teacher.FullName || '',
                                  currentUsername: stat.teacher.Username
                                });
                                setReassignForm({
                                  teacherName: stat.teacher.FullName || '',
                                  username: stat.teacher.Username,
                                  password: stat.teacher.Password || 'password123'
                                });
                              }}
                              className="text-amber-600 hover:text-amber-800 text-[11px] font-bold underline ml-1 cursor-pointer"
                              title="Reassign or change teacher for this class"
                            >
                              Change
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-500">Enrolled Pupils:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {stat.pupilsCount} pupils
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-500">Curriculum Subjects:</span>
                          <span className="font-mono text-slate-800">
                            {stat.subjectsCount} subjects
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-500">Scores Entered:</span>
                          <span className="font-mono text-slate-800">
                            {stat.enteredScores} / {stat.expectedScores} ({stat.completionPercent}%)
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden border border-slate-200">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            stat.isApproved
                              ? 'bg-emerald-600'
                              : stat.completionPercent === 100
                              ? 'bg-amber-500'
                              : 'bg-slate-700'
                          }`}
                          style={{ width: `${stat.completionPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="space-y-2 pt-2.5 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectClass(stat.className)}
                          className="py-2 px-3 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                          <span>Enter Scores</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleApprove(stat.className, !stat.isApproved)}
                          disabled={isProcessing}
                          className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                            stat.isApproved
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          {stat.isApproved ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Unpublish</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Edit & Delete Class row */}
                      <div className="flex items-center justify-end gap-1.5 pt-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClass({
                              originalName: stat.className,
                              name: stat.className,
                              category: stat.category,
                              classTeacher: stat.teacher.FullName || '',
                              description: stat.description || ''
                            });
                          }}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                          title="Edit class name, category, or notes"
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" />
                          <span>Edit Class</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setDeletingClass({
                              className: stat.className,
                              pupilsCount: stat.pupilsCount
                            });
                            const otherClasses = effectiveClassesList.filter(
                              (c) => c !== stat.className
                            );
                            setDeleteReassignTo(otherClasses[0] || '');
                            setDeletePupilsAction('reassign');
                          }}
                          className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] cursor-pointer inline-flex items-center gap-1"
                          title="Delete class from curriculum"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STAFF & TEACHER CREDENTIALS */}
      {/* ========================================================================= */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          {/* Master Admin Card */}
          <div className="bg-white border border-amber-300 rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative group shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0 overflow-hidden">
                    {masterAdmin.PhotoURL ? (
                      <img
                        src={masterAdmin.PhotoURL}
                        alt="Administrator"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ShieldCheck className="w-6 h-6" />
                    )}
                  </div>
                  <label
                    htmlFor="admin-card-photo-input"
                    className="absolute -bottom-1 -right-1 bg-slate-900 hover:bg-amber-500 text-amber-300 hover:text-slate-950 p-1 rounded-full shadow cursor-pointer transition-colors"
                    title="Upload Admin Photo (Max 100KB)"
                  >
                    <Camera className="w-3 h-3" />
                    <input
                      id="admin-card-photo-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAdminPhotoUpload}
                      disabled={isUploadingAdminPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Master Administrator Account
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                      Admin
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Logged in as <strong>{masterAdmin.FullName}</strong>. Decoupled from any individual class with full administrative authority.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs flex items-center gap-3 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">
                      Username
                    </span>
                    <span className="font-bold text-slate-900">{masterAdmin.Username}</span>
                  </div>
                  <div className="h-5 w-px bg-slate-200" />
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans font-bold">
                      Password
                    </span>
                    <span className="text-slate-700 font-bold">
                      {visiblePasswords['admin_master'] ? masterAdmin.Password : '••••••••'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setVisiblePasswords((prev) => ({
                        ...prev,
                        admin_master: !prev['admin_master']
                      }))
                    }
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Toggle password visibility"
                  >
                    {visiblePasswords['admin_master'] ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <label
                  htmlFor="admin-card-photo-button"
                  className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Upload Admin Photo (Max 100KB, saved permanently to Firebase)"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isUploadingAdminPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                  <span className="text-[10px] text-amber-700 font-normal hidden sm:inline">(≤100KB)</span>
                  <input
                    id="admin-card-photo-button"
                    type="file"
                    accept="image/*"
                    onChange={handleAdminPhotoUpload}
                    disabled={isUploadingAdminPhoto}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setEditingTeacher({
                      originalUsername: masterAdmin.Username,
                      username: masterAdmin.Username,
                      password: masterAdmin.Password || '',
                      fullName: masterAdmin.FullName || 'Portal Administrator',
                      classAssigned: 'Admin',
                      role: 'admin',
                      photoURL: masterAdmin.PhotoURL || ''
                    });
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modify Admin Login</span>
                </button>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by class, full name, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllStaffPasswords(!showAllStaffPasswords)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                {showAllStaffPasswords ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>{showAllStaffPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportStaffCredentials}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Staff CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreatingTeacher(true)}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Staff Account</span>
              </button>
            </div>
          </div>

          {/* Staff Accounts Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3">Assigned Class</th>
                    <th className="p-3">Staff Full Name</th>
                    <th className="p-3">Login Username</th>
                    <th className="p-3">Password</th>
                    <th className="p-3">Role</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {effectiveClassesList.filter((cls) => {
                    const teacher = teachersList.find(
                      (t) => isMatchingClass(t.ClassAssigned, cls) && t.Role !== 'admin'
                    );
                    const q = searchQuery.toLowerCase();
                    return (
                      cls.toLowerCase().includes(q) ||
                      teacher?.FullName?.toLowerCase().includes(q) ||
                      teacher?.Username?.toLowerCase().includes(q)
                    );
                  }).map((cls) => {
                    const teacher = teachersList.find(
                      (t) => isMatchingClass(t.ClassAssigned, cls) && t.Role !== 'admin'
                    ) || {
                      Username: `teacher_${cls.toLowerCase().replace(/[\s._-]/g, '')}`,
                      FullName: `Class Teacher (${cls})`,
                      ClassAssigned: cls,
                      Password: 'password123',
                      Role: 'teacher' as const
                    };
                    const isVisible =
                      showAllStaffPasswords || visiblePasswords[teacher.Username];

                    return (
                      <tr key={cls} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{cls}</td>
                        <td className="p-3 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            {teacher.PhotoURL ? (
                              <img
                                src={teacher.PhotoURL}
                                alt={teacher.FullName}
                                className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0"
                              />
                            ) : null}
                            <span>{teacher.FullName}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {teacher.Username}
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          <span className="font-semibold">
                            {isVisible ? teacher.Password || 'password123' : '••••••••'}
                          </span>
                          <button
                            onClick={() =>
                              setVisiblePasswords((prev) => ({
                                ...prev,
                                [teacher.Username]: !prev[teacher.Username]
                              }))
                            }
                            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            title="Toggle password"
                          >
                            {isVisible ? (
                              <EyeOff className="w-3.5 h-3.5 inline" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 inline" />
                            )}
                          </button>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                            {teacher.Role || 'teacher'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() =>
                              handleCopyCredentials(
                                `${(localWebsiteConfig?.schoolName || 'SCHOOL PORTAL').toUpperCase()} LOGIN:\nClass: ${cls}\nStaff: ${teacher.FullName}\nUsername: ${teacher.Username}\nPassword: ${teacher.Password || 'password123'}`,
                                teacher.Username
                              )
                            }
                            className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                            title="Copy Login Details"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copyStatus === teacher.Username ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => handleOpenQuickResetPassword(teacher)}
                            className="px-2 py-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                            title="Quick Reset Password"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                          <button
                            onClick={() =>
                              setEditingTeacher({
                                originalUsername: teacher.Username,
                                username: teacher.Username,
                                password: teacher.Password || '',
                                fullName: teacher.FullName || '',
                                classAssigned: cls,
                                role: teacher.Role || 'teacher',
                                photoURL: teacher.PhotoURL || ''
                              })
                            }
                            className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Modify Staff Account & Class Assignment"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PUPILS DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap flex-1 items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search pupils by ID (DNPS / DSS), full name, or parent..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPupilIdStreamFilter('all')}
                  className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                    pupilIdStreamFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({studentsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPupilIdStreamFilter('dnps')}
                  className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                    pupilIdStreamFilter === 'dnps'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DNPS ({studentsList.filter((s) => !(FirebaseService.isSecondaryClass(s.Class) || String(s.StudentID ?? '').trim().toUpperCase().startsWith('DSS'))).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPupilIdStreamFilter('dss')}
                  className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-colors ${
                    pupilIdStreamFilter === 'dss'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  DSS ({studentsList.filter((s) => FirebaseService.isSecondaryClass(s.Class) || String(s.StudentID ?? '').trim().toUpperCase().startsWith('DSS')).length})
                </button>
              </div>

              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="all">All Classes ({studentsList.length})</option>
                {effectiveClassesList.map((cls) => {
                  const count = studentsList.filter((s) => isMatchingClass(s.Class, cls)).length;
                  return (
                    <option key={cls} value={cls}>
                      {cls} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                title="Upload student data from an Excel (.xlsx, .xls) or CSV spreadsheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                <span>Upload Excel / CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAllPupilPasswords(!showAllPupilPasswords)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                {showAllPupilPasswords ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>{showAllPupilPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
              </button>

              <button
                type="button"
                onClick={handleBatchResetClassPasswords}
                className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                title="Reset all student passwords in the selected class to default 'password'"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                <span>Batch Reset Passwords</span>
              </button>

              <button
                type="button"
                onClick={handleExportStudentCredentialsXLSX}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                title="Export student roster to Microsoft Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export XLSX</span>
              </button>

              <button
                type="button"
                onClick={handleExportStudentCredentials}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                title="Export student roster to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddStudent()}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Register Pupil</span>
              </button>
            </div>
          </div>

          {/* Pupils Table with Dedicated DNPS and DSS Columns */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3 border-r border-slate-800 bg-amber-950/40 text-amber-300">
                      DNPS ID <span className="block text-[10px] font-normal text-amber-200/80">Nursery &amp; Primary</span>
                    </th>
                    <th className="p-3 border-r border-slate-800 bg-indigo-950/50 text-indigo-300">
                      DSS ID <span className="block text-[10px] font-normal text-indigo-200/80">Secondary (JSS / SSS)</span>
                    </th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3">Login Password</th>
                    <th className="p-3">Parent Contact</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No pupils found matching the current search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      const isVisible =
                        showAllPupilPasswords || visiblePasswords[student.StudentID];
                      const isSecondaryPupil =
                        FirebaseService.isSecondaryClass(student.Class) ||
                        student.StudentID.trim().toUpperCase().startsWith('DSS');

                      return (
                        <tr key={student.StudentID} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold border-r border-slate-100 bg-amber-50/20">
                            {!isSecondaryPupil ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-950 border border-amber-200">
                                {student.StudentID}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold border-r border-slate-100 bg-indigo-50/20">
                            {isSecondaryPupil ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-950 border border-indigo-200">
                                {student.StudentID}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          <td className="p-3 font-semibold text-slate-900">{student.FullName}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-700">{student.Class}</span>
                          </td>
                          <td className="p-3 text-slate-600">{student.Gender || 'Male'}</td>
                          <td className="p-3 font-mono text-slate-700">
                            <span className="font-semibold">
                              {isVisible ? student.Password || 'password' : '••••••••'}
                            </span>
                            <button
                              onClick={() =>
                                setVisiblePasswords((prev) => ({
                                  ...prev,
                                  [student.StudentID]: !prev[student.StudentID]
                                }))
                              }
                              className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="Toggle password visibility"
                            >
                              {isVisible ? (
                                <EyeOff className="w-3.5 h-3.5 inline" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 inline" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 text-slate-600">
                            {student.ParentPhone ? (
                              <span className="font-mono text-slate-800">
                                {student.ParentPhone}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() =>
                                handleQuickResetStudentPassword(
                                  student.StudentID,
                                  student.FullName
                                )
                              }
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                              title="Reset Password"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                            <button
                              onClick={() => {
                                setStudentToEdit(student);
                                setEditStudentForm({
                                  studentId: student.StudentID,
                                  fullName: student.FullName,
                                  className: student.Class,
                                  gender: student.Gender === 'Female' ? 'Female' : 'Male',
                                  dob: student.DOB || '',
                                  parentName: student.ParentName || '',
                                  parentPhone: student.ParentPhone || '',
                                  address: student.Address || '',
                                  password: student.Password || 'password'
                                });
                              }}
                              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                              title="Edit Pupil Profile"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteStudent(student.StudentID, student.FullName)
                              }
                              className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                              title="Delete Pupil"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RESULT APPROVALS GATE */}
      {/* ========================================================================= */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Class Result Publishing Status
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Teachers can publish directly for students to see, and unpublish anytime to make corrections. Administrators can also publish or unpublish classes in bulk.
              </p>
            </div>
            <button
              onClick={handleApproveAll}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish All Ready Classes</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="p-3">Class</th>
                    <th className="p-3">Teacher</th>
                    <th className="p-3">Pupils</th>
                    <th className="p-3">Entered / Total Scores</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Gate Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classStats.map((stat) => (
                    <tr key={stat.className} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{stat.className}</td>
                      <td className="p-3 font-semibold text-slate-800">{stat.teacher.FullName}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{stat.pupilsCount}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700">
                            {stat.enteredScores} / {stat.expectedScores} ({stat.completionPercent}%)
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                            <div
                              className={`h-1.5 rounded-full ${
                                stat.isApproved
                                  ? 'bg-emerald-600'
                                  : stat.completionPercent === 100
                                  ? 'bg-amber-500'
                                  : 'bg-slate-700'
                              }`}
                              style={{ width: `${stat.completionPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {stat.isApproved ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Approved &amp; Live</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Draft (Hidden from Pupils)</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onInspectClass(stat.className)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                        <button
                          onClick={() => handleToggleApprove(stat.className, !stat.isApproved)}
                          disabled={isProcessing}
                          className={`px-3 py-1 rounded-md font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs ${
                            stat.isApproved
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          {stat.isApproved ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Unpublish</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Release to Students</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ANNUAL CUMULATIVE BROADSHEET */}
      {/* ========================================================================= */}
      {activeTab === 'broadsheet' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Class to View Broadsheet:
              </label>
              <select
                value={selectedClassFilter === 'all' ? (effectiveClassesList[0] || 'Primary 1') : selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-slate-900"
              >
                {effectiveClassesList.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-500">
              Aggregates 1st, 2nd &amp; 3rd Term scores into Annual Weighted Averages &amp; Promotion Decisions.
            </span>
          </div>

          <CumulativeBroadsheet
            className={selectedClassFilter === 'all' ? (effectiveClassesList[0] || 'Primary 1') : selectedClassFilter}
            session={session}
            students={studentsList}
            allScores={allScores}
            allSummaries={allSummaries}
            subjectsList={subjectsList}
            currentTeacher={currentTeacher}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CLASS ATTENDANCE REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <AttendanceRegister
          currentClass={selectedAttendanceClass}
          classesList={effectiveClassesList}
          session={session}
          term={term}
          studentsList={studentsList}
          currentTeacher={masterAdmin}
          onRefreshData={onRefreshData}
          onClassChange={(newClass) => setSelectedAttendanceClass(newClass)}
          onSessionChange={onSessionChange}
          onTermChange={onTermChange}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB: SESSION ROLLOVER & CLASS PROMOTION ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'rollover' && (
        <SessionRolloverEngine
          students={studentsList}
          allScores={allScores}
          allSummaries={allSummaries}
          currentSession={session}
          classesList={effectiveClassesList}
          currentUser={masterAdmin}
          onRefreshData={onRefreshData}
          onSessionRolledOver={(newSession) => onSessionChange(newSession)}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 5: BULK UPLOAD & SPREADSHEET IMPORT */}
      {/* ========================================================================= */}
      {activeTab === 'bulk_upload' && (
        <StudentSpreadsheetUpload
          effectiveClassesList={effectiveClassesList}
          existingStudents={studentsList}
          onUploadSuccess={async () => {
            await onRefreshData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 6: DATA BACKUP & MAINTENANCE */}
      {/* ========================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Backup Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    Export Full School Database
                  </h3>
                  <p className="text-xs text-slate-500">
                    Download complete snapshot of all students, staff, subjects, scores &amp; summaries in JSON format.
                  </p>
                </div>
              </div>

              <button
                onClick={handleExportFullBackup}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors shadow-xs"
              >
                Download Full JSON Backup
              </button>
            </div>

            {/* Restore Backup Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    Restore From Backup
                  </h3>
                  <p className="text-xs text-slate-500">
                    Restore all collections from a previously exported JSON backup file.
                  </p>
                </div>
              </div>

              <input
                type="file"
                ref={restoreFileRef}
                onChange={handleRestoreFileRead}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => restoreFileRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors border border-slate-200"
              >
                Select Backup File (.json)
              </button>

              {restoreDataPreview && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                  <p className="font-bold text-amber-950">Backup Preview:</p>
                  <p className="text-slate-700">
                    {restoreDataPreview.studentsCount} students &bull; {restoreDataPreview.scoresCount} scores &bull; {restoreDataPreview.teachersCount} staff accounts
                  </p>
                  <button
                    onClick={handleExecuteRestore}
                    disabled={isProcessing}
                    className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer"
                  >
                    {isProcessing ? 'Restoring...' : 'Confirm Restore into Firestore'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Purge Demo Records Card */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-rose-950 uppercase">
                Clean Demo / Test Records
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">
                Purge mock test scores and demo students to start with a fresh, clean real-world database.
              </p>
            </div>
            <button
              onClick={handleClearMockData}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs shrink-0"
            >
              Clear Test Data
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: SCHOOL FACILITIES (ADMIN IMAGE UPLOAD & MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === 'facilities' && (
        <div className="space-y-6">
          {/* Section Visibility Control Card */}
          <div className={`border-2 rounded-2xl p-5 shadow-xs transition-colors ${
            localWebsiteConfig.enableFacilities
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-amber-50/60 border-amber-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  localWebsiteConfig.enableFacilities ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                }`}>
                  {localWebsiteConfig.enableFacilities ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900 uppercase">
                      Website Section Visibility:
                    </h4>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      localWebsiteConfig.enableFacilities
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-amber-200 text-amber-900'
                    }`}>
                      {localWebsiteConfig.enableFacilities ? 'Active & Live on Website' : 'Currently Disabled (Hidden from Visitors)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    {localWebsiteConfig.enableFacilities
                      ? 'The School Facilities section is currently visible to visitors on the school website homepage.'
                      : 'The School Facilities section is currently hidden from the public website homepage. You can freely edit pictures and text here, and enable it whenever you are ready.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggleSectionVisibility('facilities', !localWebsiteConfig.enableFacilities)}
                disabled={isProcessing}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shrink-0 cursor-pointer shadow-xs transition-all ${
                  localWebsiteConfig.enableFacilities
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {localWebsiteConfig.enableFacilities ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Disable &amp; Hide from Website</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Enable &amp; Show on Website</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Header Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 uppercase">
                  School Facilities &amp; Campus Infrastructure
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Upload photos, edit text and specifications, and manage campus facilities displayed on the live school website.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAddingFacility(!isAddingFacility)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isAddingFacility ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 text-amber-400" />}
                <span>{isAddingFacility ? 'Cancel' : 'Upload New Facility'}</span>
              </button>
            </div>
          </div>

          {/* Add Facility Form Card */}
          {isAddingFacility && (
            <div className="bg-amber-50/50 border-2 border-amber-300 rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                <h4 className="font-black text-sm text-slate-900 uppercase flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>Upload &amp; Configure New Campus Facility</span>
                </h4>
                <button
                  onClick={() => setIsAddingFacility(false)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left: Image Uploader */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Facility Photo from Device / Camera *
                  </label>
                  <div className="border-2 border-dashed border-amber-300 bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    {facilityForm.imageUrl ? (
                      <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-2">
                        <img
                          src={facilityForm.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setFacilityForm((p) => ({ ...p, imageUrl: '' }))}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="py-4 flex flex-col items-center">
                        <ImageIcon className="w-10 h-10 text-amber-500/70 mb-2" />
                        <p className="text-xs font-bold text-slate-800">Select Image File</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Direct device upload (JPEG, PNG, WebP)</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFacilityImageUpload(e)}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#0a1e3f] file:text-white hover:file:bg-[#132c57] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Right: Facility Details */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Facility Title *
                    </label>
                    <input
                      type="text"
                      value={facilityForm.title}
                      onChange={(e) => setFacilityForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Modern Chemistry Laboratory"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Category
                      </label>
                      <select
                        value={facilityForm.category}
                        onChange={(e) => setFacilityForm((p) => ({ ...p, category: e.target.value as any }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      >
                        <option value="Academics">Academics</option>
                        <option value="STEM & Tech">STEM &amp; Tech</option>
                        <option value="Sports">Sports</option>
                        <option value="Safety & Transit">Safety &amp; Transit</option>
                        <option value="Early Years">Early Years</option>
                        <option value="Campus">Campus</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Add Bullet Feature
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={facilityForm.featureInput}
                          onChange={(e) => setFacilityForm((p) => ({ ...p, featureInput: e.target.value }))}
                          placeholder="e.g. Air-conditioned"
                          className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!facilityForm.featureInput.trim()) return;
                            setFacilityForm((p) => ({
                              ...p,
                              features: [...p.features, p.featureInput.trim()],
                              featureInput: ''
                            }));
                          }}
                          className="px-2.5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={facilityForm.description}
                      onChange={(e) => setFacilityForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Brief overview of the facility and equipment..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium resize-none focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-amber-200">
                <button
                  onClick={() => setIsAddingFacility(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewFacility}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Check className="w-4 h-4 text-amber-400" />}
                  <span>Save &amp; Publish to Website</span>
                </button>
              </div>
            </div>
          )}

          {/* Current Facilities List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(localWebsiteConfig.facilities || []).map((fac) => (
              <div
                key={fac.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden group">
                    <img
                      src={fac.imageUrl}
                      alt={fac.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900/90 text-white uppercase tracking-wider">
                        {fac.category}
                      </span>
                    </div>

                    {/* Replace Image overlay input */}
                    <label className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-xl bg-black/70 hover:bg-black text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Change Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFacilityImageUpload(e, fac.id)}
                      />
                    </label>
                  </div>

                  <div className="p-4 space-y-2">
                    <h4 className="font-black text-sm text-slate-900">{fac.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {fac.description}
                    </p>
                    {fac.features && fac.features.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                        {fac.features.slice(0, 3).map((feat, fIdx) => (
                          <span
                            key={fIdx}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                          >
                            &bull; {feat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenEditFacility(fac)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Edit Text &amp; Specs</span>
                  </button>

                  <button
                    onClick={() => handleDeleteFacilityFromAdmin(fac.id, fac.title)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                    title="Delete Facility"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* EDIT FACILITY MODAL */}
          {editingFacility && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-amber-600" />
                    <h3 className="text-base font-black text-slate-900">
                      Edit Facility: {editingFacility.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setEditingFacility(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo Section */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Facility Image
                    </label>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden aspect-[16/10] relative bg-slate-100 mb-2">
                      <img
                        src={editFacilityForm.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <label className="block w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-center rounded-xl text-xs font-bold cursor-pointer transition-colors">
                      <span>Upload New Image from Device</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await processImageFile(file, 1200, 0.82);
                            setEditFacilityForm((p) => ({ ...p, imageUrl: dataUrl }));
                          } catch (err: any) {
                            alert(err?.message || 'Error loading image');
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Text Details Section */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Facility Title *
                      </label>
                      <input
                        type="text"
                        value={editFacilityForm.title}
                        onChange={(e) => setEditFacilityForm((p) => ({ ...p, title: e.target.value }))}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Category
                      </label>
                      <select
                        value={editFacilityForm.category}
                        onChange={(e) => setEditFacilityForm((p) => ({ ...p, category: e.target.value as any }))}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                      >
                        <option value="Academics">Academics</option>
                        <option value="STEM & Tech">STEM &amp; Tech</option>
                        <option value="Sports">Sports</option>
                        <option value="Safety & Transit">Safety &amp; Transit</option>
                        <option value="Early Years">Early Years</option>
                        <option value="Campus">Campus</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Description / Specifications
                      </label>
                      <textarea
                        rows={3}
                        value={editFacilityForm.description}
                        onChange={(e) => setEditFacilityForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Add Bullet Feature
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={editFacilityForm.featureInput}
                          onChange={(e) => setEditFacilityForm((p) => ({ ...p, featureInput: e.target.value }))}
                          placeholder="e.g. Fiber optic internet"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!editFacilityForm.featureInput.trim()) return;
                            setEditFacilityForm((p) => ({
                              ...p,
                              features: [...p.features, p.featureInput.trim()],
                              featureInput: ''
                            }));
                          }}
                          className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {editFacilityForm.features.map((feat, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded flex items-center gap-1"
                          >
                            <span>{feat}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setEditFacilityForm((p) => ({
                                  ...p,
                                  features: p.features.filter((_, i) => i !== idx)
                                }))
                              }
                              className="text-slate-400 hover:text-rose-600 font-bold"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => setEditingFacility(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditedFacility}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Check className="w-4 h-4 text-amber-400" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: SCHOOL GALLERY (ADMIN IMAGE UPLOAD & MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === 'gallery' && (
        <div className="space-y-6">
          {/* Section Visibility Control Card */}
          <div className={`border-2 rounded-2xl p-5 shadow-xs transition-colors ${
            localWebsiteConfig.enableGallery
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-amber-50/60 border-amber-300'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  localWebsiteConfig.enableGallery ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                }`}>
                  {localWebsiteConfig.enableGallery ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900 uppercase">
                      Website Gallery Visibility:
                    </h4>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      localWebsiteConfig.enableGallery
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-amber-200 text-amber-900'
                    }`}>
                      {localWebsiteConfig.enableGallery ? 'Active & Live on Website' : 'Currently Disabled (Hidden from Visitors)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    {localWebsiteConfig.enableGallery
                      ? 'The School Gallery is currently visible to visitors on the school website homepage.'
                      : 'The School Gallery is currently hidden from the public website homepage. You can upload multiple photos and edit captions here, and turn it on whenever you want it visible to the public.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleToggleSectionVisibility('gallery', !localWebsiteConfig.enableGallery)}
                disabled={isProcessing}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shrink-0 cursor-pointer shadow-xs transition-all ${
                  localWebsiteConfig.enableGallery
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {localWebsiteConfig.enableGallery ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>Disable &amp; Hide from Website</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Enable &amp; Show on Website</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Header Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 uppercase">
                  School Photo Gallery ({localWebsiteConfig.gallery?.length || DEFAULT_GALLERY_PRESETS.length} Pictures)
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Showcase multiple campus pictures: sports, science labs, classroom sessions, graduation, and cultural days.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Upload Multiple Pictures at Once */}
              <label className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-xs cursor-pointer transition-all">
                <Upload className="w-4 h-4" />
                <span>Upload Multiple Pictures</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleMultipleGalleryUpload}
                  className="hidden"
                />
              </label>

              {/* Upload Single with form */}
              <button
                onClick={() => setIsAddingGalleryPhoto(!isAddingGalleryPhoto)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {isAddingGalleryPhoto ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4 text-amber-400" />}
                <span>{isAddingGalleryPhoto ? 'Cancel' : 'Add Single Photo with Details'}</span>
              </button>
            </div>
          </div>

          {/* Add Gallery Form Card */}
          {isAddingGalleryPhoto && (
            <div className="bg-amber-50/50 border-2 border-amber-300 rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                <h4 className="font-black text-sm text-slate-900 uppercase flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-600" />
                  <span>Upload Single Photo with Details</span>
                </h4>
                <button
                  onClick={() => setIsAddingGalleryPhoto(false)}
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left: Photo Upload or URL */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Photo Image Web URL
                    </label>
                    <input
                      type="url"
                      value={galleryForm.imageUrl}
                      onChange={(e) => setGalleryForm((p) => ({ ...p, imageUrl: e.target.value }))}
                      placeholder="https://example.com/photos/sports-day.jpg"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Paste any direct image link, or select a file from your device below.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Or Select Photo from Device / Camera
                    </label>
                    <div className="border-2 border-dashed border-amber-300 bg-white rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                      {galleryForm.imageUrl ? (
                        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-2">
                          <img
                            src={galleryForm.imageUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                          <button
                            onClick={() => setGalleryForm((p) => ({ ...p, imageUrl: '' }))}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="py-4 flex flex-col items-center">
                          <ImageIcon className="w-8 h-8 text-amber-500/70 mb-1" />
                          <p className="text-xs font-bold text-slate-800">Select Image File</p>
                          <p className="text-[11px] text-slate-500">JPEG, PNG, WebP from mobile or computer</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleGalleryPhotoUpload(e)}
                        className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#0a1e3f] file:text-white hover:file:bg-[#132c57] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Details */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Photo Title *
                    </label>
                    <input
                      type="text"
                      value={galleryForm.title}
                      onChange={(e) => setGalleryForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Science Fair Presentation"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Category
                      </label>
                      <select
                        value={galleryForm.category}
                        onChange={(e) => setGalleryForm((p) => ({ ...p, category: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      >
                        <option value="STEM & ICT">STEM &amp; ICT</option>
                        <option value="Academics">Academics</option>
                        <option value="Sports">Sports</option>
                        <option value="Early Years">Early Years</option>
                        <option value="Campus Life">Campus Life</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Academic Session / Date
                      </label>
                      <input
                        type="text"
                        value={galleryForm.date}
                        onChange={(e) => setGalleryForm((p) => ({ ...p, date: e.target.value }))}
                        placeholder={`e.g. ${DEFAULT_CURRENT_SESSION} Session`}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Caption / Activity Notes
                    </label>
                    <textarea
                      rows={3}
                      value={galleryForm.caption}
                      onChange={(e) => setGalleryForm((p) => ({ ...p, caption: e.target.value }))}
                      placeholder="Explain what the students are learning or doing in this photo..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium resize-none focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-amber-200">
                <button
                  onClick={() => setIsAddingGalleryPhoto(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNewGalleryPhoto}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Check className="w-4 h-4 text-amber-400" />}
                  <span>Publish Photo to Gallery</span>
                </button>
              </div>
            </div>
          )}

          {/* Current Multi-Picture Gallery Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {(localWebsiteConfig.gallery?.length ? localWebsiteConfig.gallery : DEFAULT_GALLERY_PRESETS).map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between group hover:shadow-md transition-all"
              >
                <div>
                  <div className="relative aspect-square bg-slate-100 overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-900/90 text-white uppercase tracking-wider">
                        {item.category}
                      </span>
                    </div>

                    {/* Replace Photo Overlay */}
                    <label className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow">
                      <Upload className="w-3 h-3 text-amber-400" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleGalleryPhotoUpload(e, item.id)}
                      />
                    </label>
                  </div>

                  <div className="p-3 space-y-1">
                    <p className="text-[10px] text-slate-400 font-semibold truncate">
                      {item.date || localWebsiteConfig.schoolName || 'Official Update'}
                    </p>
                    <h4 className="font-black text-xs text-slate-900 truncate" title={item.title}>
                      {item.title}
                    </h4>
                    {item.caption && (
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenEditGallery(item)}
                    className="px-2 py-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3 h-3 text-amber-600" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDeleteGalleryFromAdmin(item.id, item.title)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                    title="Delete Photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* EDIT GALLERY ITEM MODAL */}
          {editingGalleryItem && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-5 h-5 text-amber-600" />
                    <h3 className="text-base font-black text-slate-900">
                      Edit Picture Details
                    </h3>
                  </div>
                  <button
                    onClick={() => setEditingGalleryItem(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo Preview & Change */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Picture Preview
                    </label>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden aspect-square relative bg-slate-100">
                      <img
                        src={editGalleryForm.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                        Image Web URL
                      </label>
                      <input
                        type="url"
                        value={editGalleryForm.imageUrl}
                        onChange={(e) => setEditGalleryForm((p) => ({ ...p, imageUrl: e.target.value }))}
                        placeholder="https://example.com/photo.jpg"
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 mb-2"
                      />
                    </div>
                    <label className="block w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-center rounded-xl text-xs font-bold cursor-pointer transition-colors">
                      <span>Or Change Picture File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await processImageFile(file, 1200, 0.82);
                            setEditGalleryForm((p) => ({ ...p, imageUrl: dataUrl }));
                          } catch (err: any) {
                            alert(err?.message || 'Error loading image');
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* Fields */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={editGalleryForm.title}
                        onChange={(e) => setEditGalleryForm((p) => ({ ...p, title: e.target.value }))}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Category
                      </label>
                      <select
                        value={editGalleryForm.category}
                        onChange={(e) => setEditGalleryForm((p) => ({ ...p, category: e.target.value }))}
                        className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                      >
                        <option value="STEM & ICT">STEM &amp; ICT</option>
                        <option value="Academics">Academics</option>
                        <option value="Sports">Sports</option>
                        <option value="Early Years">Early Years</option>
                        <option value="Campus Life">Campus Life</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Date / Session
                      </label>
                      <input
                        type="text"
                        value={editGalleryForm.date}
                        onChange={(e) => setEditGalleryForm((p) => ({ ...p, date: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Caption / Notes
                      </label>
                      <textarea
                        rows={3}
                        value={editGalleryForm.caption}
                        onChange={(e) => setEditGalleryForm((p) => ({ ...p, caption: e.target.value }))}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    onClick={() => setEditingGalleryItem(null)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditedGalleryItem}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Check className="w-4 h-4 text-amber-400" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REASSIGN CLASS TEACHER */}
      {/* ========================================================================= */}
      {reassigningClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <form
            onSubmit={handleReassignClassTeacher}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  Assign Teacher to {reassigningClass.className}
                </h3>
                <p className="text-xs text-slate-500">
                  Update the teacher's name and login credentials for this class.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassigningClass(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Teacher Full Name
              </label>
              <input
                type="text"
                required
                value={reassignForm.teacherName}
                onChange={(e) =>
                  setReassignForm({ ...reassignForm, teacherName: e.target.value })
                }
                placeholder="e.g. Mr. Emmanuel Solomon"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Login Username
              </label>
              <input
                type="text"
                required
                value={reassignForm.username}
                onChange={(e) =>
                  setReassignForm({ ...reassignForm, username: e.target.value })
                }
                placeholder="e.g. teacher_p4"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Password
              </label>
              <input
                type="text"
                required
                value={reassignForm.password}
                onChange={(e) =>
                  setReassignForm({ ...reassignForm, password: e.target.value })
                }
                placeholder="password123"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReassigningClass(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Saving...' : 'Save Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TEACHER / STAFF ACCOUNT */}
      {/* ========================================================================= */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <form
            onSubmit={handleSaveTeacherCredentials}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                Modify Staff Credentials ({editingTeacher.username})
              </h3>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={editingTeacher.fullName}
                onChange={(e) =>
                  setEditingTeacher({ ...editingTeacher, fullName: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={editingTeacher.username}
                onChange={(e) =>
                  setEditingTeacher({ ...editingTeacher, username: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Password
              </label>
              <input
                type="text"
                required
                value={editingTeacher.password}
                onChange={(e) =>
                  setEditingTeacher({ ...editingTeacher, password: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Assigned Class
              </label>
              <select
                value={editingTeacher.classAssigned}
                onChange={(e) =>
                  setEditingTeacher({ ...editingTeacher, classAssigned: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="Admin">Admin (Full Control)</option>
                {effectiveClassesList.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            {/* Staff / Admin Profile Photo Upload with strict <=100KB limit */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Profile Photo (Max 100KB &bull; Stored Permanently)
              </label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {editingTeacher.photoURL ? (
                    <img
                      src={editingTeacher.photoURL}
                      alt="Staff Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="modal-staff-photo-input"
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-600" />
                    <span>Upload Photo (≤100KB)</span>
                    <input
                      id="modal-staff-photo-input"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('image/')) {
                          alert('Please select an image file (JPG or PNG).');
                          return;
                        }
                        if (file.size > 100 * 1024) {
                          alert(`Photo must be 100KB or lower. Selected file is ${(file.size / 1024).toFixed(1)}KB.`);
                          return;
                        }
                        try {
                          const dataUrl = await processPassportPhoto(file, 100 * 1024);
                          setEditingTeacher((prev) => (prev ? { ...prev, photoURL: dataUrl } : null));
                        } catch (err: any) {
                          alert(err.message || 'Failed to process photo.');
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  {editingTeacher.photoURL && (
                    <button
                      type="button"
                      onClick={() => setEditingTeacher((prev) => (prev ? { ...prev, photoURL: '' } : null))}
                      className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUICK RESET STAFF PASSWORD */}
      {/* ========================================================================= */}
      {quickResetTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <form
            onSubmit={handleSaveQuickResetPassword}
            className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  Reset Staff Password
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {quickResetTeacher.FullName} ({quickResetTeacher.Username})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickResetTeacher(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showQuickResetPass ? 'text' : 'password'}
                  required
                  placeholder="Enter new password"
                  value={quickResetPassword}
                  onChange={(e) => setQuickResetPassword(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowQuickResetPass(!showQuickResetPass)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showQuickResetPass ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickResetTeacher(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Updating...' : 'Set Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE NEW STAFF ACCOUNT */}
      {/* ========================================================================= */}
      {isCreatingTeacher && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <form
            onSubmit={handleCreateTeacherSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                Create New Staff Account
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingTeacher(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={newTeacherForm.fullName}
                onChange={(e) =>
                  setNewTeacherForm({ ...newTeacherForm, fullName: e.target.value })
                }
                placeholder="e.g. Mrs. Mary Oche"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={newTeacherForm.username}
                onChange={(e) =>
                  setNewTeacherForm({ ...newTeacherForm, username: e.target.value })
                }
                placeholder="e.g. teacher_p2"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Password
              </label>
              <input
                type="text"
                required
                value={newTeacherForm.password}
                onChange={(e) =>
                  setNewTeacherForm({ ...newTeacherForm, password: e.target.value })
                }
                placeholder="password123"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Assigned Class
              </label>
              <select
                value={newTeacherForm.classAssigned}
                onChange={(e) =>
                  setNewTeacherForm({ ...newTeacherForm, classAssigned: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {effectiveClassesList.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreatingTeacher(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTER / EDIT PUPIL */}
      {/* ========================================================================= */}
      {(isAddingStudent || studentToEdit) && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <form
            onSubmit={isAddingStudent ? handleAddStudentSubmit : handleSaveStudentEdit}
            className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase">
                {isAddingStudent ? 'Register New Pupil' : `Edit Pupil: ${studentToEdit?.FullName}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddingStudent(false);
                  setStudentToEdit(null);
                }}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Class
                </label>
                <select
                  value={isAddingStudent ? newStudentForm.className : editStudentForm.className}
                  onChange={(e) => {
                    const newClass = e.target.value;
                    if (isAddingStudent) {
                      setNewStudentForm({
                        ...newStudentForm,
                        className: newClass,
                        studentId: FirebaseService.getNextStudentIdPreview(studentsList, newClass)
                      });
                    } else {
                      const wasSec = FirebaseService.isSecondaryClass(editStudentForm.className);
                      const nowSec = FirebaseService.isSecondaryClass(newClass);
                      const updatedId =
                        wasSec !== nowSec
                          ? FirebaseService.getNextStudentIdPreview(studentsList, newClass)
                          : editStudentForm.studentId;
                      setEditStudentForm({
                        ...editStudentForm,
                        className: newClass,
                        studentId: updatedId
                      });
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  {effectiveClassesList.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls} ({FirebaseService.isSecondaryClass(cls) ? 'DSS/' : 'DNPS/'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {FirebaseService.isSecondaryClass(
                    isAddingStudent ? newStudentForm.className : editStudentForm.className
                  )
                    ? 'Secondary Class — Uses DSS/ sequence column'
                    : 'Nursery / Primary Class — Uses DNPS/ sequence column'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center justify-between">
                  <span>
                    {FirebaseService.isSecondaryClass(
                      isAddingStudent ? newStudentForm.className : editStudentForm.className
                    )
                      ? 'DSS ID (Secondary)'
                      : 'DNPS ID (Primary/Nursery)'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                      FirebaseService.isSecondaryClass(
                        isAddingStudent ? newStudentForm.className : editStudentForm.className
                      )
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {FirebaseService.isSecondaryClass(
                      isAddingStudent ? newStudentForm.className : editStudentForm.className
                    )
                      ? 'DSS/ Stream'
                      : 'DNPS/ Stream'}
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={isAddingStudent ? newStudentForm.studentId : editStudentForm.studentId}
                  onChange={(e) =>
                    isAddingStudent
                      ? setNewStudentForm({ ...newStudentForm, studentId: e.target.value })
                      : setEditStudentForm({ ...editStudentForm, studentId: e.target.value })
                  }
                  placeholder={
                    FirebaseService.isSecondaryClass(
                      isAddingStudent ? newStudentForm.className : editStudentForm.className
                    )
                      ? 'DSS/001'
                      : 'DNPS/0001'
                  }
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-white text-slate-800"
                />
                {isAddingStudent && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Auto-recommended in sequence. Editable if needed.
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={isAddingStudent ? newStudentForm.fullName : editStudentForm.fullName}
                  onChange={(e) =>
                    isAddingStudent
                      ? setNewStudentForm({ ...newStudentForm, fullName: e.target.value })
                      : setEditStudentForm({ ...editStudentForm, fullName: e.target.value })
                  }
                  placeholder="e.g. Chinedu Eze"
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  value={isAddingStudent ? newStudentForm.gender : editStudentForm.gender}
                  onChange={(e) =>
                    isAddingStudent
                      ? setNewStudentForm({
                          ...newStudentForm,
                          gender: e.target.value as 'Male' | 'Female'
                        })
                      : setEditStudentForm({
                          ...editStudentForm,
                          gender: e.target.value as 'Male' | 'Female'
                        })
                  }
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Login Password
                </label>
                <input
                  type="text"
                  required
                  value={isAddingStudent ? newStudentForm.password : editStudentForm.password}
                  onChange={(e) =>
                    isAddingStudent
                      ? setNewStudentForm({ ...newStudentForm, password: e.target.value })
                      : setEditStudentForm({ ...editStudentForm, password: e.target.value })
                  }
                  placeholder="password"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Parent Phone
                </label>
                <input
                  type="text"
                  value={isAddingStudent ? newStudentForm.parentPhone : editStudentForm.parentPhone}
                  onChange={(e) =>
                    isAddingStudent
                      ? setNewStudentForm({ ...newStudentForm, parentPhone: e.target.value })
                      : setEditStudentForm({ ...editStudentForm, parentPhone: e.target.value })
                  }
                  placeholder="08012345678"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsAddingStudent(false);
                  setStudentToEdit(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Saving...' : 'Save Pupil Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW CLASS */}
      {/* ========================================================================= */}
      {isAddingClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <form
            onSubmit={handleCreateClass}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <School className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  Add New Class to Curriculum
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingClass(false)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Class Name *
              </label>
              <input
                type="text"
                required
                value={newClassForm.name}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoCategory: ClassCategory = val.toUpperCase().includes('KG')
                    ? 'KG'
                    : val.toLowerCase().includes('nursery')
                    ? 'Nursery'
                    : val.toUpperCase().includes('JSS') || val.toLowerCase().includes('junior')
                    ? 'Junior Secondary'
                    : val.toUpperCase().includes('SS') || val.toLowerCase().includes('senior')
                    ? 'Senior Secondary'
                    : 'Primary';
                  setNewClassForm({
                    ...newClassForm,
                    name: val,
                    category: autoCategory
                  });
                }}
                placeholder="e.g. Primary 7, Nursery 3, JSS 1"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Educational Category *
              </label>
              <select
                value={newClassForm.category}
                onChange={(e) =>
                  setNewClassForm({ ...newClassForm, category: e.target.value as ClassCategory })
                }
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="KG">Kindergarten (KG)</option>
                <option value="Nursery">Nursery</option>
                <option value="Primary">Primary</option>
                <option value="Junior Secondary">Junior Secondary (JSS)</option>
                <option value="Senior Secondary">Senior Secondary (SSS)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Assigned Class Teacher (Optional)
              </label>
              <input
                type="text"
                value={newClassForm.classTeacher}
                onChange={(e) =>
                  setNewClassForm({ ...newClassForm, classTeacher: e.target.value })
                }
                placeholder="e.g. Mr. Emmanuel Solomon"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Description / Notes (Optional)
              </label>
              <input
                type="text"
                value={newClassForm.description}
                onChange={(e) =>
                  setNewClassForm({ ...newClassForm, description: e.target.value })
                }
                placeholder="e.g. Special arm, morning batch, etc."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddingClass(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT CLASS */}
      {/* ========================================================================= */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <form
            onSubmit={handleUpdateClass}
            className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  Edit Class: {editingClass.originalName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Class Name *
              </label>
              <input
                type="text"
                required
                value={editingClass.name}
                onChange={(e) =>
                  setEditingClass({ ...editingClass, name: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
              />
              {editingClass.name !== editingClass.originalName && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Note: Renaming this class will automatically update all enrolled pupils and assigned subjects.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Educational Category *
              </label>
              <select
                value={editingClass.category}
                onChange={(e) =>
                  setEditingClass({ ...editingClass, category: e.target.value as ClassCategory })
                }
                className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="KG">Kindergarten (KG)</option>
                <option value="Nursery">Nursery</option>
                <option value="Primary">Primary</option>
                <option value="Junior Secondary">Junior Secondary (JSS)</option>
                <option value="Senior Secondary">Senior Secondary (SSS)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Assigned Class Teacher (Optional)
              </label>
              <input
                type="text"
                value={editingClass.classTeacher}
                onChange={(e) =>
                  setEditingClass({ ...editingClass, classTeacher: e.target.value })
                }
                placeholder="e.g. Mr. Emmanuel Solomon"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                Description / Notes (Optional)
              </label>
              <input
                type="text"
                value={editingClass.description}
                onChange={(e) =>
                  setEditingClass({ ...editingClass, description: e.target.value })
                }
                placeholder="e.g. Special arm, morning batch, etc."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Saving...' : 'Save Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CLASS CONFIRMATION */}
      {/* ========================================================================= */}
      {deletingClass && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-rose-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="text-sm font-black text-rose-900 uppercase">
                  Delete Class: {deletingClass.className}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-700">
              Are you sure you want to permanently remove <strong>{deletingClass.className}</strong> from the school curriculum?
            </p>

            {deletingClass.pupilsCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-amber-900">
                  This class currently has {deletingClass.pupilsCount} enrolled pupil{deletingClass.pupilsCount === 1 ? '' : 's'}. What should happen to them?
                </p>

                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deletePupilAction"
                      value="reassign"
                      checked={deletePupilsAction === 'reassign'}
                      onChange={() => setDeletePupilsAction('reassign')}
                      className="mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 block">Reassign pupils to another class</span>
                      {deletePupilsAction === 'reassign' && (
                        <select
                          value={deleteReassignTo}
                          onChange={(e) => setDeleteReassignTo(e.target.value)}
                          className="mt-1 w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                        >
                          {effectiveClassesList
                            .filter((c) => c !== deletingClass.className)
                            .map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deletePupilAction"
                      value="delete"
                      checked={deletePupilsAction === 'delete'}
                      onChange={() => setDeletePupilsAction('delete')}
                      className="mt-0.5"
                    />
                    <div className="text-xs font-semibold text-rose-800">
                      Delete all {deletingClass.pupilsCount} pupils and their scores together with the class
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingClass(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClassConfirm}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                {isProcessing ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ACADEMIC GRADING SCALE & SETTINGS */}
      {/* ========================================================================= */}
      <GradingSettingsModal
        isOpen={isGradingSettingsOpen}
        onClose={() => setIsGradingSettingsOpen(false)}
        currentUser={currentTeacher}
        session={session}
        term={term}
        allScores={allScores}
        onScalesUpdated={onRefreshData}
      />

      {/* ========================================================================= */}
      {/* MODAL: SCHOOL BRANDING & IDENTITY SETTINGS */}
      {/* ========================================================================= */}
      <BrandingSettingsModal
        isOpen={isBrandingModalOpen}
        onClose={() => setIsBrandingModalOpen(false)}
        websiteConfig={localWebsiteConfig}
        onUpdateWebsiteConfig={async (newConfig) => {
          setLocalWebsiteConfig(newConfig);
          if (onSaveWebsiteConfig) {
            await onSaveWebsiteConfig(newConfig);
          }
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
