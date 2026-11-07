import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface AdminSecretCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSecretCode?: string;
}

export const AdminSecretCodeModal: React.FC<AdminSecretCodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentSecretCode = 'ecra'
}) => {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = passcode.trim();
    const target = (currentSecretCode || 'ecra').trim();

    if (!entered) {
      setError('Please enter the administrative access code.');
      return;
    }

    // Case-insensitive check
    if (entered.toLowerCase() === target.toLowerCase()) {
      setError(null);
      setPasscode('');
      onSuccess();
    } else {
      setAttempts((prev) => prev + 1);
      setError('Incorrect administrative passkey. Access denied.');
      setPasscode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-slate-950 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Crest */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 flex items-center justify-center">
            <SchoolLogo size="lg" className="w-18 h-18 object-contain" />
          </div>

          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-mono bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-400/30">
            Administrative Access
          </span>

          <h3 className="text-lg sm:text-xl font-black text-white mt-2 font-serif">
            Website Content Manager
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
            Enter the administrative passkey to unlock and edit live school website text, photos, and announcements.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Secret Passcode
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter admin code (e.g. ecra)"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 focus:border-amber-400 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-hidden font-mono transition-colors"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                title={showPassword ? 'Hide code' : 'Show code'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
              <span>Primary default passkey: <strong className="text-amber-400 font-mono">ecra</strong></span>
              {attempts > 1 && <span className="text-amber-300/80">Attempts: {attempts}</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 border border-amber-400/50 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Authorize &amp; Edit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-400">
            Passkey can be updated anytime inside the CMS editor under <strong className="text-slate-300">Security Settings</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
