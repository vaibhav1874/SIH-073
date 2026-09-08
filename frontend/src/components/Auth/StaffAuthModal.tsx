import React, { useState } from 'react';
import { StaffUser } from '../../types';
import {
  Shield,
  Lock,
  UserCheck,
  Building2,
  KeyRound,
  X,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Radio,
  FileBadge,
  Eye,
  EyeOff
} from 'lucide-react';

interface StaffAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: StaffUser) => void;
}

export const PRESET_OFFICERS: Record<string, StaffUser> = {
  officer: {
    id: 'usr-op-402',
    name: 'Insp. Ravi Sharma',
    email: 'r.sharma@imd.gov.in',
    badgeId: 'IMD-OP-402',
    role: 'officer',
    department: 'National AWS Monitoring Cell',
    assignedStation: 'DELHI',
    clearanceLevel: 'Tier 1 • Operations Clearance',
    isLoggedIn: true,
  },
  engineer: {
    id: 'usr-eng-108',
    name: 'Er. Pooja Verma',
    email: 'p.verma@imd.gov.in',
    badgeId: 'IMD-ENG-108',
    role: 'engineer',
    department: 'Surface Instruments & Sensor Calibration',
    assignedStation: 'ABOHAR',
    clearanceLevel: 'Tier 2 • Calibration & Fault Lab',
    isLoggedIn: true,
  },
  scientist: {
    id: 'usr-dir-001',
    name: 'Dr. K. S. Rathore',
    email: 'k.rathore@moes.gov.in',
    badgeId: 'IMD-DIR-001',
    role: 'scientist',
    department: 'NWP Assimilation & Climatology Division',
    assignedStation: 'ALL',
    clearanceLevel: 'Tier 3 • Full NWP Governance',
    isLoggedIn: true,
  },
};

export const StaffAuthModal: React.FC<StaffAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Login form state
  const [badgeInput, setBadgeInput] = useState<string>('IMD-OP-402');
  const [passwordInput, setPasswordInput] = useState<string>('••••••••');
  const [selectedStation, setSelectedStation] = useState<string>('DELHI');

  // Signup form state
  const [signupName, setSignupName] = useState<string>('');
  const [signupEmail, setSignupEmail] = useState<string>('');
  const [signupBadge, setSignupBadge] = useState<string>('');
  const [signupDept, setSignupDept] = useState<string>('National AWS Monitoring Cell');
  const [signupRole, setSignupRole] = useState<'officer' | 'engineer' | 'scientist'>('officer');
  const [signupStation, setSignupStation] = useState<string>('DELHI');

  if (!isOpen) return null;

  const handleQuickLogin = (roleKey: 'officer' | 'engineer' | 'scientist') => {
    const user = PRESET_OFFICERS[roleKey];
    localStorage.setItem('skyguard_auth_user', JSON.stringify(user));
    onLoginSuccess(user);
    onClose();
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!badgeInput.trim()) {
      setErrorMessage('Please enter your Official Badge ID or Gov Email.');
      return;
    }

    // Determine matched role from badge prefix or default to officer
    const upperBadge = badgeInput.trim().toUpperCase();
    let matchedRole: 'officer' | 'engineer' | 'scientist' = 'officer';
    if (upperBadge.includes('ENG')) matchedRole = 'engineer';
    else if (upperBadge.includes('DIR') || upperBadge.includes('SCI')) matchedRole = 'scientist';

    const preset = PRESET_OFFICERS[matchedRole];
    const user: StaffUser = {
      id: `usr-${Date.now()}`,
      name: upperBadge.startsWith('IMD') ? preset.name : badgeInput.split('@')[0],
      email: badgeInput.includes('@') ? badgeInput : `${badgeInput.toLowerCase()}@imd.gov.in`,
      badgeId: upperBadge.startsWith('IMD') ? upperBadge : `IMD-STAFF-${Math.floor(100 + Math.random() * 900)}`,
      role: matchedRole,
      department: preset.department,
      assignedStation: selectedStation,
      clearanceLevel: preset.clearanceLevel,
      isLoggedIn: true,
    };

    localStorage.setItem('skyguard_auth_user', JSON.stringify(user));
    onLoginSuccess(user);
    onClose();
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!signupName.trim() || !signupEmail.trim()) {
      setErrorMessage('Please enter your full name and government email.');
      return;
    }

    const clearanceTitles = {
      officer: 'Tier 1 • Operations Clearance',
      engineer: 'Tier 2 • Calibration & Fault Lab',
      scientist: 'Tier 3 • Full NWP Governance',
    };

    const newUser: StaffUser = {
      id: `usr-${Date.now()}`,
      name: signupName.trim(),
      email: signupEmail.trim(),
      badgeId: signupBadge.trim() ? signupBadge.trim().toUpperCase() : `IMD-REG-${Math.floor(100 + Math.random() * 900)}`,
      role: signupRole,
      department: signupDept,
      assignedStation: signupStation,
      clearanceLevel: clearanceTitles[signupRole],
      isLoggedIn: true,
    };

    localStorage.setItem('skyguard_auth_user', JSON.stringify(newUser));
    onLoginSuccess(newUser);
    onClose();
  };

  const handleGuestAccess = () => {
    const guestUser: StaffUser = {
      id: 'usr-guest',
      name: 'Guest Observer',
      email: 'jury.observer@sih2024.in',
      badgeId: 'SIH-OBS-2024',
      role: 'officer',
      department: 'Smart India Hackathon Jury Evaluation Cell',
      assignedStation: 'ALL',
      clearanceLevel: 'Reviewer Mode • Read-Only Observation',
      isLoggedIn: true,
    };
    localStorage.setItem('skyguard_auth_user', JSON.stringify(guestUser));
    onLoginSuccess(guestUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-sky-950/60 overflow-hidden text-slate-100 max-h-[92vh] flex flex-col">
        {/* Top Header Strip with MoES / IMD Seal styling */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-sky-950/40 to-slate-900 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/25 ring-1 ring-white/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-white tracking-tight">
                  MoES / IMD Staff Gateway
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-950 border border-sky-500/40 text-sky-400 font-semibold">
                  SECURE ACCESS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                National Automated Weather Station Telemetry & Anomaly Response
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* ⚡ Quick 1-Click Role Profiles for Jury Demonstration */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-sky-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-sky-400 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                ⚡ 1-Click Fast Pass for Jury / Demonstration
              </span>
              <span className="text-[10px] font-mono text-slate-400">Instant Role Simulation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleQuickLogin('officer')}
                className="p-3 rounded-xl bg-slate-900 hover:bg-sky-950/50 border border-sky-500/30 hover:border-sky-400 text-left transition-all group"
              >
                <div className="text-[10px] font-mono text-sky-400 font-semibold mb-0.5">
                  IMD-OP-402
                </div>
                <div className="text-xs font-bold text-white group-hover:text-sky-300">
                  Duty Officer
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Live monitoring & incident triage
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('engineer')}
                className="p-3 rounded-xl bg-slate-900 hover:bg-amber-950/50 border border-amber-500/30 hover:border-amber-400 text-left transition-all group"
              >
                <div className="text-[10px] font-mono text-amber-400 font-semibold mb-0.5">
                  IMD-ENG-108
                </div>
                <div className="text-xs font-bold text-white group-hover:text-amber-300">
                  Field Engineer
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Sensor diagnostics & fault lab
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('scientist')}
                className="p-3 rounded-xl bg-slate-900 hover:bg-purple-950/50 border border-purple-500/30 hover:border-purple-400 text-left transition-all group"
              >
                <div className="text-[10px] font-mono text-purple-400 font-semibold mb-0.5">
                  IMD-DIR-001
                </div>
                <div className="text-xs font-bold text-white group-hover:text-purple-300">
                  Chief Scientist
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  NWP oversight & model overrides
                </div>
              </button>
            </div>
          </div>

          {/* Form Tabs: Login vs Register */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'login'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Staff Login
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('signup'); setErrorMessage(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'signup'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register Field Officer (Sign Up)
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  OFFICIAL BADGE ID OR GOV EMAIL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={badgeInput}
                    onChange={(e) => setBadgeInput(e.target.value)}
                    placeholder="e.g. IMD-OP-402 or officer.sharma@imd.gov.in"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                  <FileBadge className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  SECURITY KEY / ACCESS PIN
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  ASSIGNED OBSERVATORY STATION / REGIONAL HUB
                </label>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
                >
                  <option value="DELHI">Delhi AWS (National Capital)</option>
                  <option value="ABOHAR">Abohar AWS (Punjab Agricultural Belt)</option>
                  <option value="JAIPUR">Jaipur AWS (Thar Arid Zone)</option>
                  <option value="SHIMLA">Shimla AWS (Alpine Himalayan)</option>
                  <option value="MUMBAI">Mumbai AWS (Arabian Sea Coastal)</option>
                  <option value="BENGALURU">Bengaluru AWS (Deccan Plateau)</option>
                  <option value="BHOPAL">Bhopal AWS (Central Subtropical)</option>
                  <option value="ALL">All-India HQ Meteorological Command</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                <Lock className="w-4 h-4" />
                <span>Authenticate & Access Live Telemetry</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 2: SIGNUP FORM */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    OFFICER FULL NAME
                  </label>
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="e.g. S. Narayanan"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    OFFICIAL GOV EMAIL
                  </label>
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="s.narayanan@imd.gov.in"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    BADGE NUMBER (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={signupBadge}
                    onChange={(e) => setSignupBadge(e.target.value)}
                    placeholder="e.g. IMD-AWS-741"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    BASE OBSERVATORY
                  </label>
                  <select
                    value={signupStation}
                    onChange={(e) => setSignupStation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  >
                    <option value="DELHI">Delhi AWS</option>
                    <option value="ABOHAR">Abohar AWS</option>
                    <option value="JAIPUR">Jaipur AWS</option>
                    <option value="SHIMLA">Shimla AWS</option>
                    <option value="MUMBAI">Mumbai AWS</option>
                    <option value="BENGALURU">Bengaluru AWS</option>
                    <option value="BHOPAL">Bhopal AWS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  DEPARTMENT / DIVISION
                </label>
                <select
                  value={signupDept}
                  onChange={(e) => setSignupDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="National AWS Monitoring Cell">National AWS Monitoring Cell</option>
                  <option value="Surface Instruments & Sensor Calibration">Surface Instruments & Sensor Calibration</option>
                  <option value="NWP Assimilation & Climatology Division">NWP Assimilation & Climatology Division</option>
                  <option value="Regional Meteorological Centre Operations">Regional Meteorological Centre Operations</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  REQUESTED CLEARANCE TIER
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupRole('officer')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signupRole === 'officer'
                        ? 'bg-sky-950/60 border-sky-400 text-sky-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[11px] font-bold">Duty Officer</div>
                    <div className="text-[9px] text-slate-400">Tier 1 Ops</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole('engineer')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signupRole === 'engineer'
                        ? 'bg-amber-950/60 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[11px] font-bold">Engineer</div>
                    <div className="text-[9px] text-slate-400">Tier 2 Calib</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole('scientist')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      signupRole === 'scientist'
                        ? 'bg-purple-950/60 border-purple-400 text-purple-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[11px] font-bold">Scientist</div>
                    <div className="text-[9px] text-slate-400">Tier 3 NWP</div>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                <UserCheck className="w-4 h-4" />
                <span>Submit Field Registration & Authorize</span>
              </button>
            </form>
          )}

          {/* Guest Observer Bypass */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Reviewing for Hackathon?</span>
            <button
              type="button"
              onClick={handleGuestAccess}
              className="text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2"
            >
              Continue as Guest Observer (Read-Only) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
