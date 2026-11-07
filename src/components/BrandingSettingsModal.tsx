import React, { useState, useRef } from 'react';
import {
  SchoolTemplateConfig,
  getActiveSchoolConfig,
  saveSchoolBrandingLocally
} from '../config/schoolConfig';
import { FirebaseService } from '../services/firebaseService';
import { WebsiteConfig } from '../types';
import {
  Building2,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  MapPin,
  Stamp,
  Sparkles,
  RefreshCw,
  Eye,
  Trash2,
  FileText
} from 'lucide-react';

interface BrandingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  websiteConfig?: WebsiteConfig;
  onUpdateWebsiteConfig?: (config: WebsiteConfig) => void;
}

export const BrandingSettingsModal: React.FC<BrandingSettingsModalProps> = ({
  isOpen,
  onClose,
  websiteConfig,
  onUpdateWebsiteConfig
}) => {
  const activeConfig = getActiveSchoolConfig();

  const [formData, setFormData] = useState<SchoolTemplateConfig>(() => {
    return {
      schoolName: websiteConfig?.schoolName || activeConfig.schoolName || '',
      shortName: websiteConfig?.shortName || activeConfig.shortName || '',
      acronym: websiteConfig?.acronym || activeConfig.acronym || '',
      motto: websiteConfig?.motto || activeConfig.motto || '',
      subMotto: websiteConfig?.subMotto || activeConfig.subMotto || '',
      logoUrl: websiteConfig?.logoUrl || activeConfig.logoUrl || '/school-logo.png',
      stampTopText: websiteConfig?.stampTopText || activeConfig.stampTopText || '',
      stampBottomText: websiteConfig?.stampBottomText || activeConfig.stampBottomText || '',
      campusAddress: websiteConfig?.campusAddress || activeConfig.campusAddress || '',
      cityState: websiteConfig?.cityState || activeConfig.cityState || '',
      country: websiteConfig?.country || activeConfig.country || 'Nigeria',
      phonePrimary: websiteConfig?.phonePrimary || activeConfig.phonePrimary || '',
      phoneSecondary: websiteConfig?.phoneSecondary || activeConfig.phoneSecondary || '',
      emailContact: websiteConfig?.emailContact || activeConfig.emailContact || '',
      whatsAppNumber: websiteConfig?.whatsAppNumber || activeConfig.whatsAppNumber || '',
      visitingHours: websiteConfig?.visitingHours || activeConfig.visitingHours || '',
      admissionStatus: websiteConfig?.admissionStatus || activeConfig.admissionStatus || '',
      principalName: websiteConfig?.principalName || activeConfig.principalName || '',
      principalTitle: websiteConfig?.principalTitle || activeConfig.principalTitle || 'Principal / Head Teacher',
      portalTitle: websiteConfig?.portalTitle || activeConfig.portalTitle || 'Academic Management & Student Result Portal',
      welcomeHeadline: websiteConfig?.welcomeHeadline || activeConfig.welcomeHeadline || '',
      welcomeSubheadline: websiteConfig?.welcomeSubheadline || activeConfig.welcomeSubheadline || '',
      aboutText: websiteConfig?.aboutText || activeConfig.aboutText || ''
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'identity' | 'logo' | 'contact' | 'stamp' | 'portal'>('identity');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFieldChange = (field: keyof SchoolTemplateConfig, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Keep stampTopText synced if empty or previously identical
      if (field === 'schoolName' && (!prev.stampTopText || prev.stampTopText === prev.schoolName.toUpperCase())) {
        updated.stampTopText = value.toUpperCase();
      }
      return updated;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, SVG, or WEBP).');
      return;
    }

    // Limit to 2MB to keep Firestore document size lean
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Image file is too large. Please select an image under 2MB.');
      return;
    }

    // Handle image file upload with client-side scaling to ensure lean Firestore document size & transparency preservation
    const reader = new FileReader();
    reader.onload = () => {
      const rawResult = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (file.type === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
          }
          ctx.drawImage(img, 0, 0, w, h);
          const mime = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
          const optimized = canvas.toDataURL(mime, 0.9);
          setFormData((prev) => ({ ...prev, logoUrl: optimized }));
        } else {
          setFormData((prev) => ({ ...prev, logoUrl: rawResult }));
        }
        setErrorMessage(null);
      };
      img.onerror = () => {
        setFormData((prev) => ({ ...prev, logoUrl: rawResult }));
        setErrorMessage(null);
      };
      img.src = rawResult;
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read image file. Please try again or use a direct URL.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.schoolName.trim()) {
      setErrorMessage('School Name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. Save locally and broadcast update to all active React components
      const savedConfig = saveSchoolBrandingLocally(formData);

      // 2. Persist to Firestore database
      const result = await FirebaseService.saveWebsiteConfig({
        schoolName: formData.schoolName.trim(),
        shortName: (formData.shortName || formData.schoolName).trim(),
        acronym: (formData.acronym || '').trim().toUpperCase(),
        motto: (formData.motto || '').trim(),
        subMotto: (formData.subMotto || '').trim(),
        logoUrl: formData.logoUrl.trim(),
        stampLogoUrl: (formData.stampLogoUrl || '').trim(),
        stampTopText: (formData.stampTopText || formData.schoolName).trim().toUpperCase(),
        stampBottomText: (formData.stampBottomText || formData.motto || 'OFFICIAL SEAL').trim().toUpperCase(),
        campusAddress: (formData.campusAddress || '').trim(),
        cityState: (formData.cityState || '').trim(),
        country: (formData.country || 'Nigeria').trim(),
        phonePrimary: (formData.phonePrimary || '').trim(),
        phoneSecondary: (formData.phoneSecondary || '').trim(),
        emailContact: (formData.emailContact || '').trim(),
        whatsAppNumber: (formData.whatsAppNumber || formData.phonePrimary || '').trim(),
        visitingHours: (formData.visitingHours || '').trim(),
        admissionStatus: (formData.admissionStatus || '').trim(),
        principalName: (formData.principalName || '').trim(),
        principalTitle: (formData.principalTitle || '').trim(),
        portalTitle: (formData.portalTitle || '').trim(),
        welcomeHeadline: (formData.welcomeHeadline || '').trim(),
        welcomeSubheadline: (formData.welcomeSubheadline || '').trim(),
        aboutText: (formData.aboutText || '').trim()
      });

      if (onUpdateWebsiteConfig) {
        onUpdateWebsiteConfig(result.config || (savedConfig as any));
      }

      setSuccessMessage('School settings saved successfully! All screens, report cards, and templates are updated.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving branding settings:', err);
      setErrorMessage(err.message || 'Failed to save settings. Changes are applied locally.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="branding-settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white font-serif tracking-tight">
                School &amp; Portal Settings
              </h2>
              <p className="text-xs text-slate-400">
                Institutional configuration — updates homepage, login portal, report cards, stamps, and exports
              </p>
            </div>
          </div>
          <button
            id="close-branding-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-2 sm:gap-4 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'identity'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>School Name &amp; Motto</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logo')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'logo'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>School Logo / Crest</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'contact'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Address &amp; Contacts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stamp')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'stamp'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Stamp className="w-4 h-4" />
            <span>Official Rubber Stamp</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('portal')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'portal'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Landing Page &amp; Portal</span>
          </button>
        </div>

        {/* Notifications */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: School Identity */}
          {activeTab === 'identity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Full School Name <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="branding-school-name-input"
                    type="text"
                    required
                    value={formData.schoolName}
                    onChange={(e) => handleFieldChange('schoolName', e.target.value)}
                    placeholder="e.g. St. Benedict International Academy"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Appears on result sheets, broadsheets, student report cards, and page titles.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Acronym / Initials
                  </label>
                  <input
                    id="branding-acronym-input"
                    type="text"
                    value={formData.acronym}
                    onChange={(e) => handleFieldChange('acronym', e.target.value)}
                    placeholder="e.g. SBIA"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-amber-300 font-bold uppercase focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Used for student IDs, badges, and avatars.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Short / Everyday Name
                  </label>
                  <input
                    id="branding-short-name-input"
                    type="text"
                    value={formData.shortName}
                    onChange={(e) => handleFieldChange('shortName', e.target.value)}
                    placeholder="e.g. St. Benedict Academy"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Primary School Motto
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">e.g. Excellence, Discipline &amp; Integrity</span>
                  </div>
                  <input
                    id="branding-motto-input"
                    type="text"
                    value={formData.motto}
                    onChange={(e) => handleFieldChange('motto', e.target.value)}
                    placeholder="e.g. Excellence, Discipline & Integrity"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white italic focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Sub-Motto / Tagline
                    </label>
                    <span className="text-[10px] text-blue-400 font-mono">e.g. Building Tomorrow's Leaders</span>
                  </div>
                  <input
                    id="branding-sub-motto-input"
                    type="text"
                    value={formData.subMotto}
                    onChange={(e) => handleFieldChange('subMotto', e.target.value)}
                    placeholder="e.g. Building Tomorrow's Leaders"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Head of School / Signatory
                  </label>
                  <input
                    type="text"
                    value={formData.principalName}
                    onChange={(e) => handleFieldChange('principalName', e.target.value)}
                    placeholder="e.g. Dr. A. O. Eze"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: School Logo / Crest */}
          {activeTab === 'logo' && (
            <div className="space-y-5">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-6">
                {/* Logo Preview */}
                <div className="relative w-32 h-32 rounded-2xl bg-slate-900 border-2 border-dashed border-amber-500/40 p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="School Logo Preview"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        // Mark as failed visually without clearing user input
                        (e.currentTarget as HTMLElement).style.opacity = '0.5';
                      }}
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-600" />
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1 space-y-3 text-center sm:text-left w-full">
                  <div>
                    <h4 className="text-sm font-bold text-white">Upload New School Logo</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Upload an emblem, crest, or school logo (PNG, JPG, SVG, or WEBP under 2MB).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      id="upload-logo-file-btn"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Choose File from Device</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFieldChange('logoUrl', '/school-logo.png')}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset to Standard Crest</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Image URL fallback */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Or Paste Direct Image Link (URL)
                </label>
                <input
                  type="text"
                  value={formData.logoUrl}
                  onChange={(e) => handleFieldChange('logoUrl', e.target.value)}
                  placeholder="e.g. https://example.com/logo.png or /school-logo.png"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Address & Contacts */}
          {activeTab === 'contact' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Campus Physical Address
                </label>
                <input
                  id="branding-address-input"
                  type="text"
                  value={formData.campusAddress}
                  onChange={(e) => handleFieldChange('campusAddress', e.target.value)}
                  placeholder="e.g. Plot 14 Academic Boulevard, Victoria Island"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    City, State &amp; Country
                  </label>
                  <input
                    type="text"
                    value={formData.cityState}
                    onChange={(e) => handleFieldChange('cityState', e.target.value)}
                    placeholder="e.g. Lagos State, Nigeria"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Official Enquiries Email
                  </label>
                  <input
                    type="email"
                    value={formData.emailContact}
                    onChange={(e) => handleFieldChange('emailContact', e.target.value)}
                    placeholder="e.g. enquiries@schoolname.edu.ng"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Primary Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phonePrimary}
                    onChange={(e) => handleFieldChange('phonePrimary', e.target.value)}
                    placeholder="e.g. +2348012345678"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    WhatsApp Hotline (For Parent Enquiries)
                  </label>
                  <input
                    type="text"
                    value={formData.whatsAppNumber}
                    onChange={(e) => handleFieldChange('whatsAppNumber', e.target.value)}
                    placeholder="e.g. +2348012345678"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Official Rubber Stamp */}
          {activeTab === 'stamp' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Stamp Outer Rim Top Text
                    </label>
                    <input
                      type="text"
                      value={formData.stampTopText}
                      onChange={(e) => handleFieldChange('stampTopText', e.target.value.toUpperCase())}
                      placeholder="e.g. ST. BENEDICT INTERNATIONAL ACADEMY"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-amber-300 font-bold uppercase focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Usually the uppercase school name running along the top curve of the seal.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Stamp Outer Rim Bottom Text
                    </label>
                    <input
                      type="text"
                      value={formData.stampBottomText}
                      onChange={(e) => handleFieldChange('stampBottomText', e.target.value.toUpperCase())}
                      placeholder="e.g. DISCIPLINE & EXCELLENCE • SEAL"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-amber-300 font-bold uppercase focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Usually the school motto, location, or "OFFICIAL SEAL".
                    </span>
                  </div>
                </div>

                {/* Stamp Live Visual Preview */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-950/60 rounded-2xl border border-slate-800 text-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Live Stamp Seal Preview
                  </span>
                  <div className="w-36 h-36 rounded-full border-4 border-dashed border-blue-600/80 p-1 flex items-center justify-center bg-blue-950/20 text-blue-400 shadow-lg relative select-none">
                    <div className="w-full h-full rounded-full border-2 border-blue-500/60 flex flex-col items-center justify-center p-2 text-center">
                      <span className="text-[8px] font-black tracking-tighter uppercase leading-tight text-blue-300">
                        {formData.stampTopText || formData.schoolName || 'OFFICIAL SCHOOL SEAL'}
                      </span>
                      <div className="w-8 h-8 my-1 rounded-full border border-blue-400/50 flex items-center justify-center">
                        <Stamp className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-[7px] font-bold tracking-tight uppercase leading-tight text-amber-400">
                        {formData.stampBottomText || formData.motto || 'APPROVED • SEAL'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-3">
                    Appears directly on printed terminal result sheets &amp; slips.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Landing Page & Portal Content */}
          {activeTab === 'portal' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Homepage Welcome Headline
                </label>
                <input
                  id="branding-welcome-headline-input"
                  type="text"
                  value={formData.welcomeHeadline}
                  onChange={(e) => handleFieldChange('welcomeHeadline', e.target.value)}
                  placeholder="e.g. Welcome to Academic Distinction &amp; Character Building"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Welcome Subheadline / Tagline
                </label>
                <input
                  id="branding-welcome-subheadline-input"
                  type="text"
                  value={formData.welcomeSubheadline}
                  onChange={(e) => handleFieldChange('welcomeSubheadline', e.target.value)}
                  placeholder="e.g. Nurturing Future Global Leaders Through Standard Instruction &amp; Care"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Portal Header Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.portalTitle}
                    onChange={(e) => handleFieldChange('portalTitle', e.target.value)}
                    placeholder="e.g. Academic Assessment &amp; Student Result Management System"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Admission Status Notice
                  </label>
                  <input
                    type="text"
                    value={formData.admissionStatus}
                    onChange={(e) => handleFieldChange('admissionStatus', e.target.value)}
                    placeholder="e.g. Admissions Ongoing for 2025/2026 Academic Session"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Campus Visiting &amp; Enquiry Hours
                </label>
                <input
                  type="text"
                  value={formData.visitingHours}
                  onChange={(e) => handleFieldChange('visitingHours', e.target.value)}
                  placeholder="e.g. Mon – Fri: 8:00 AM – 4:00 PM"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  About School Overview
                </label>
                <textarea
                  rows={3}
                  value={formData.aboutText}
                  onChange={(e) => handleFieldChange('aboutText', e.target.value)}
                  placeholder="A concise summary of the institution's heritage, values, and academic excellence."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="save-branding-submit-btn"
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save School Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
