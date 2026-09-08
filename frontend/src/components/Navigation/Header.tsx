import React, { useState, useEffect } from 'react';
import { Station, StaffUser } from '../../types';
import { ConnectionStatus } from '../../hooks/useTelemetryStream';
import { CloudLightning, Radio, Activity, ShieldAlert, Cpu, Wrench, BarChart2, History, Wifi, UserCheck, Shield, ChevronDown, Check, Volume2, VolumeX, Compass, LogIn, LogOut } from 'lucide-react';
import { apiService } from '../../services/api';

interface HeaderProps {
  stations: Station[];
  selectedStationId: string;
  onSelectStation: (id: string) => void;
  connectionStatus: ConnectionStatus;
  activeTab: 'monitor' | 'alerts' | 'faults' | 'benchmark';
  onSelectTab: (tab: 'monitor' | 'alerts' | 'faults' | 'benchmark') => void;
  activeAlertCount: number;
  onGoToLanding?: () => void;
  currentUser?: StaffUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export type UserRole = 'officer' | 'engineer' | 'scientist';

interface RoleProfile {
  id: UserRole;
  title: string;
  badge: string;
  badgeColor: string;
  officerId: string;
  permissions: string[];
}

const ROLES: Record<UserRole, RoleProfile> = {
  officer: {
    id: 'officer',
    title: 'Shift Duty Officer',
    badge: 'OPERATIONS',
    badgeColor: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    officerId: 'IMD-OP-402',
    permissions: ['Telemetry Monitoring', 'Incident Triage & Ack', 'Kalman Stream Inspection'],
  },
  engineer: {
    id: 'engineer',
    title: 'Field Hardware Engineer',
    badge: 'CALIBRATION',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    officerId: 'IMD-ENG-108',
    permissions: ['Sensor Diagnostics', 'Fault Injection Lab', 'Transducer Calibration'],
  },
  scientist: {
    id: 'scientist',
    title: 'Chief Meteorologist',
    badge: 'ADMIN / NWP',
    badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    officerId: 'IMD-DIR-001',
    permissions: ['Full Governance', 'Model Thresholds Override', 'NWP Ingestion Routing'],
  },
};

export const Header: React.FC<HeaderProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
  connectionStatus,
  activeTab,
  onSelectTab,
  activeAlertCount,
  onGoToLanding,
  currentUser,
  onOpenAuth,
  onLogout,
}) => {
  const currentStation = stations.find((s) => s.id === selectedStationId) || stations[0];
  const [simMode, setSimMode] = useState<'replay' | 'live'>('live');
  const [liveCity, setLiveCity] = useState<string>('abohar');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<UserRole>(currentUser?.role || 'officer');
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState<boolean>(false);
  const role = ROLES[activeRole];

  useEffect(() => {
    if (currentUser?.role) {
      setActiveRole(currentUser.role);
    }
  }, [currentUser]);

  useEffect(() => {
    apiService.getSimulatorMode().then((res) => {
      setSimMode(res.mode);
      if (res.city) {
        setLiveCity(res.city);
        const cityUpper = res.city.toUpperCase();
        if (cityUpper !== selectedStationId.toUpperCase()) {
          onSelectStation(cityUpper);
        }
      }
    });
  }, []);

  const handleToggleMode = async (mode: 'replay' | 'live') => {
    setIsSwitching(true);
    setSimMode(mode);
    // Immediately reset graphs and alerts so no vertical cliff spike appears
    window.dispatchEvent(new CustomEvent('skyguard:reset-telemetry'));
    await apiService.setSimulatorMode(mode, liveCity);
    setIsSwitching(false);
  };

  const handleCityChange = async (city: string) => {
    setLiveCity(city);
    onSelectStation(city.toUpperCase());
    // Immediately reset graphs and alerts so no vertical cliff spike appears
    window.dispatchEvent(new CustomEvent('skyguard:reset-telemetry'));
    // Preserve current mode when switching city (works for both replay and live)
    await apiService.setSimulatorMode(simMode, city);
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-0.5" />
            LIVE WS
          </div>
        );
      case 'simulated':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-medium shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block mr-0.5" />
            SIMULATED
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-medium shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block mr-0.5" />
            CONNECTING
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-medium shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block mr-0.5" />
            OFFLINE
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/98 backdrop-blur-md shadow-lg shadow-black/40">
      <div className="max-w-[1700px] w-full mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-3">
          {/* Logo & Identity - strictly protected against flex squishing */}
          <div
            onClick={onGoToLanding}
            className={`flex items-center gap-2.5 shrink-0 ${onGoToLanding ? 'cursor-pointer group select-none' : ''}`}
            title={onGoToLanding ? "Return to SkyGuard AI Landing Page" : undefined}
          >
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20 ring-1 ring-white/20 shrink-0 group-hover:ring-sky-400 transition-all">
              <CloudLightning className="w-5 h-5" />
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-sky-400 via-indigo-300 to-white bg-clip-text text-transparent whitespace-nowrap group-hover:from-sky-300 transition-all">
                SkyGuard AI
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-500/30 text-sky-400 font-semibold tracking-wider shrink-0">
                SIH26073
              </span>
            </div>
          </div>

          {/* Navigation Tabs - strictly protected with whitespace-nowrap */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0">
            {onGoToLanding && (
              <button
                onClick={onGoToLanding}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-sky-300 hover:bg-slate-800/50 transition-all border-r border-slate-800/80 pr-2.5 mr-0.5 whitespace-nowrap"
                title="Return to SkyGuard AI Portal Overview"
              >
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>Portal</span>
              </button>
            )}

            <button
              onClick={() => onSelectTab('monitor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'monitor'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Monitor</span>
            </button>

            <button
              onClick={() => onSelectTab('alerts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative whitespace-nowrap ${
                activeTab === 'alerts'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Alerts</span>
              {activeAlertCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                  {activeAlertCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('faults')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'faults'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Fault Lab</span>
            </button>

            <button
              onClick={() => onSelectTab('benchmark')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === 'benchmark'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Benchmarks</span>
            </button>
          </nav>

          {/* Right Controls: Telemetry Source Switcher + Single Unified Station/City Selector + Status + Officer */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Dynamic Telemetry Source Switcher (Historical Replay vs Live Real-Time) */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-0.5 shadow-inner shrink-0">
              <button
                onClick={() => handleToggleMode('replay')}
                disabled={isSwitching}
                title="Replay historical IMD AWS dataset (Winter 2010)"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  simMode === 'replay'
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Historic</span>
              </button>

              <button
                onClick={() => handleToggleMode('live')}
                disabled={isSwitching}
                title="Stream real-time live weather from Open-Meteo"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  simMode === 'live'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wifi className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
                <span>Live</span>
              </button>
            </div>

            {/* Single Unified Observatory / City Dropdown with width constraint and truncate */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm max-w-[145px] sm:max-w-[165px] shrink-0">
              <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse shrink-0" />
              <select
                value={selectedStationId.toUpperCase()}
                onChange={(e) => {
                  const newSt = e.target.value;
                  onSelectStation(newSt);
                  setLiveCity(newSt.toLowerCase());
                  window.dispatchEvent(new CustomEvent('skyguard:reset-telemetry'));
                  apiService.setSimulatorMode(simMode, newSt.toLowerCase());
                }}
                className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer truncate w-full pr-1"
              >
                <optgroup label="─── Punjab Region ───" className="bg-slate-900 text-slate-400 font-semibold">
                  <option value="ABOHAR" className="bg-slate-900 text-slate-200">Abohar Agro-Met</option>
                  <option value="AMRITSAR" className="bg-slate-900 text-slate-200">Amritsar Airport</option>
                  <option value="LUDHIANA" className="bg-slate-900 text-slate-200">Ludhiana PAU</option>
                  <option value="BATHINDA" className="bg-slate-900 text-slate-200">Bathinda Regional</option>
                  <option value="PATIALA" className="bg-slate-900 text-slate-200">Patiala Obs.</option>
                </optgroup>
                <optgroup label="─── Multi-State IMD Observatories ───" className="bg-slate-900 text-slate-400 font-semibold">
                  <option value="DELHI" className="bg-slate-900 text-slate-200">Delhi Safdarjung</option>
                  <option value="JAIPUR" className="bg-slate-900 text-slate-200">Jaipur Sanganer</option>
                  <option value="SHIMLA" className="bg-slate-900 text-slate-200">Shimla Ridge</option>
                  <option value="MUMBAI" className="bg-slate-900 text-slate-200">Mumbai Santacruz</option>
                  <option value="BENGALURU" className="bg-slate-900 text-slate-200">Bengaluru IMD</option>
                  <option value="BHOPAL" className="bg-slate-900 text-slate-200">Bhopal Bairagarh</option>
                </optgroup>
              </select>
            </div>

            {/* Live Indicator */}
            {getStatusBadge()}

            {/* Operator Role & Authentication Badge */}
            <div className="relative shrink-0">
              <button
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 text-xs text-slate-200 transition-all shadow-sm cursor-pointer shrink-0"
                title="IMD Operator Profile & Role Clearance"
              >
                <div className="w-5 h-5 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-bold leading-tight whitespace-nowrap">
                    {currentUser?.name ? currentUser.name.split(' ')[0] + ' ' + (currentUser.name.split(' ')[1] || '') : role.title}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 whitespace-nowrap">
                    {currentUser?.badgeId || role.officerId}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
              </button>

              {/* Dropdown Menu */}
              {isRoleMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 border border-slate-800 p-3 shadow-2xl backdrop-blur-xl z-50 animate-fade-in space-y-2">
                  <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Security Clearance</span>
                      <div className="text-xs font-bold text-slate-200">
                        {currentUser?.name || 'IMD Role-Based Access'}
                      </div>
                      {currentUser?.department && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {currentUser.department}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                      {currentUser?.isLoggedIn ? 'AUTHENTICATED' : 'DEMO MODE'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {Object.values(ROLES).map((r) => {
                      const isSelected = r.id === activeRole;
                      return (
                        <div
                          key={r.id}
                          onClick={() => {
                            setActiveRole(r.id);
                            setIsRoleMenuOpen(false);
                          }}
                          className={`cursor-pointer p-2 rounded-xl transition-all flex items-start justify-between ${
                            isSelected
                              ? 'bg-sky-500/10 border border-sky-500/30 text-sky-200'
                              : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold">
                              <span>{r.title}</span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${r.badgeColor}`}>
                                {r.badge}
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              {r.permissions.join(' • ')}
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-1" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Auth Actions: Switch / Login & Logout */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    {onOpenAuth && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRoleMenuOpen(false);
                          onOpenAuth();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/30 text-sky-300 text-xs font-medium transition-all"
                      >
                        <LogIn className="w-3 h-3 text-sky-400" />
                        <span>Switch Staff / Register Officer</span>
                      </button>
                    )}

                    {onLogout && currentUser && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRoleMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-medium transition-all"
                      >
                        <LogOut className="w-3 h-3 text-rose-400" />
                        <span>Lock Session & Sign Out</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Badge: {currentUser?.badgeId || role.officerId}</span>
                    <span className="text-emerald-400 font-semibold">TLS 1.3 Active</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
