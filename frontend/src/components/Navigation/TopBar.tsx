import React, { useState, useEffect } from 'react';
import { Station, StaffUser } from '../../types';
import { ConnectionStatus } from '../../hooks/useTelemetryStream';
import {
  Search,
  Bell,
  Radio,
  History,
  Wifi,
  ChevronDown,
  Volume2,
  VolumeX,
  MapPin,
  Check,
} from 'lucide-react';
import { apiService } from '../../services/api';

interface TopBarProps {
  stations: Station[];
  selectedStationId: string;
  onSelectStation: (id: string) => void;
  connectionStatus: ConnectionStatus;
  currentUser?: StaffUser | null;
  onOpenAuth?: () => void;
  activeAlertCount: number;
  onSelectTab?: (tab: 'monitor' | 'alerts' | 'faults' | 'benchmark') => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
  connectionStatus,
  currentUser,
  onOpenAuth,
  activeAlertCount,
  onSelectTab,
}) => {
  const currentStation = stations.find((s) => s.id === selectedStationId) || stations[0];
  const [simMode, setSimMode] = useState<'replay' | 'live'>('live');
  const [liveCity, setLiveCity] = useState<string>('abohar');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(() => {
    return localStorage.getItem('skyguard_sound_muted') === 'true';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

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
    window.dispatchEvent(new CustomEvent('skyguard:reset-telemetry'));
    await apiService.setSimulatorMode(mode, liveCity);
    setIsSwitching(false);
  };

  const handleCitySelect = async (cityKey: string) => {
    setIsSwitching(true);
    setLiveCity(cityKey);
    onSelectStation(cityKey.toUpperCase());
    window.dispatchEvent(new CustomEvent('skyguard:reset-telemetry'));
    await apiService.setSimulatorMode(simMode, cityKey);
    setIsSwitching(false);
  };

  const toggleSound = () => {
    const next = !isSoundMuted;
    setIsSoundMuted(next);
    localStorage.setItem('skyguard_sound_muted', String(next));
    window.dispatchEvent(new CustomEvent('skyguard-sound-mute-toggle', { detail: { muted: next } }));
  };

  const renderConnectionPill = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/40 text-emerald-400 text-xs font-mono font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-0.5 animate-pulse" />
            LIVE WS
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-700/40 text-amber-400 text-xs font-mono font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block mr-0.5" />
            CONNECTING
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-700/40 text-rose-400 text-xs font-mono font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block mr-0.5" />
            OFFLINE
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-20 w-full border-b border-[#262a38] bg-[#161822]/95 backdrop-blur-md px-6 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Station Identity & GPS Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight truncate">
                {currentStation ? currentStation.name : 'Abohar Observatory'}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1c1f2b] border border-[#282c3c] text-amber-400 font-semibold shrink-0">
                {currentStation ? currentStation.state : 'Punjab'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              GPS: {currentStation ? `${currentStation.latitude.toFixed(2)}°N, ${currentStation.longitude.toFixed(2)}°E` : '30.15°N, 74.20°E'} • Real-Time 1.0 Hz
            </p>
          </div>
        </div>

        {/* Center: Search Bar (as seen on Behance dashboard) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search station, telemetry channel, or sensor..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#1c1f2b] border border-[#282c3c] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
            />
          </div>
        </div>

        {/* Right: Controls & Profiles */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#1c1f2b] border border-[#282c3c] rounded-xl p-0.5 shrink-0">
            <button
              onClick={() => handleToggleMode('replay')}
              disabled={isSwitching}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                simMode === 'replay'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3 h-3" />
              <span>Historic</span>
            </button>
            <button
              onClick={() => handleToggleMode('live')}
              disabled={isSwitching}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                simMode === 'live'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Live</span>
            </button>
          </div>

          {/* Station Dropdown */}
          <div className="relative shrink-0">
            <select
              value={selectedStationId.toLowerCase()}
              onChange={(e) => handleCitySelect(e.target.value)}
              disabled={isSwitching}
              className="appearance-none pl-3 pr-7 py-1.5 rounded-xl bg-[#1c1f2b] border border-[#282c3c] text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              {stations.map((st) => (
                <option key={st.id} value={st.id.toLowerCase()} className="bg-[#1c1f2b] text-slate-200">
                  {st.name} ({st.state})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* WebSocket Status */}
          {renderConnectionPill()}

          {/* Audio Alert Toggle */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-all ${
              isSoundMuted
                ? 'bg-[#1c1f2b] border-[#282c3c] text-slate-500'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
            title={isSoundMuted ? "Sound muted" : "Sound enabled"}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Alert Bell Button */}
          <button
            onClick={() => onSelectTab && onSelectTab('alerts')}
            className="p-2 rounded-xl bg-[#1c1f2b] border border-[#282c3c] text-slate-400 hover:text-white relative transition-all"
            title="View Alerts"
          >
            <Bell className="w-4 h-4" />
            {activeAlertCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
