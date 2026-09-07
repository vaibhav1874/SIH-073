import React, { useState, useEffect } from 'react';
import { Station } from '../../types';
import { ConnectionStatus } from '../../hooks/useTelemetryStream';
import { CloudLightning, Radio, Activity, ShieldAlert, Cpu, Wrench, BarChart2, History, Wifi } from 'lucide-react';
import { apiService } from '../../services/api';

interface HeaderProps {
  stations: Station[];
  selectedStationId: string;
  onSelectStation: (id: string) => void;
  connectionStatus: ConnectionStatus;
  activeTab: 'monitor' | 'alerts' | 'faults' | 'benchmark';
  onSelectTab: (tab: 'monitor' | 'alerts' | 'faults' | 'benchmark') => void;
  activeAlertCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  stations,
  selectedStationId,
  onSelectStation,
  connectionStatus,
  activeTab,
  onSelectTab,
  activeAlertCount,
}) => {
  const currentStation = stations.find((s) => s.id === selectedStationId) || stations[0];
  const [simMode, setSimMode] = useState<'replay' | 'live'>('live');
  const [liveCity, setLiveCity] = useState<string>('abohar');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  useEffect(() => {
    apiService.getSimulatorMode().then((res) => {
      setSimMode(res.mode);
      if (res.city) setLiveCity(res.city);
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-0.5" />
            LIVE WS
          </div>
        );
      case 'simulated':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block mr-0.5" />
            SIMULATED
          </div>
        );
      case 'connecting':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block mr-0.5" />
            CONNECTING
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block mr-0.5" />
            OFFLINE
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/98 backdrop-blur-md shadow-lg shadow-black/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
              <CloudLightning className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 via-indigo-300 to-white bg-clip-text text-transparent">
                  SkyGuard AI
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-500/30 text-sky-400 font-semibold tracking-wider">
                  SIH26073
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Ministry of Earth Sciences / IMD • Intelligent AWS Telemetry
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => onSelectTab('monitor')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'monitor'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Live Monitor
            </button>

            <button
              onClick={() => onSelectTab('alerts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                activeTab === 'alerts'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Alerts & Triage
              {activeAlertCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                  {activeAlertCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('faults')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'faults'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Fault Injector
            </button>

            <button
              onClick={() => onSelectTab('benchmark')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'benchmark'
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              ML Benchmarks
            </button>
          </nav>

          {/* Right Controls: Telemetry Source Switcher + Single Unified Station/City Selector + Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Dynamic Telemetry Source Switcher (Historical Replay vs Live Real-Time) */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => handleToggleMode('replay')}
                disabled={isSwitching}
                title="Replay historical IMD AWS dataset (Winter 2010)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  simMode === 'replay'
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">Historical IMD</span>
                <span className="sm:hidden">Historic</span>
              </button>

              <button
                onClick={() => handleToggleMode('live')}
                disabled={isSwitching}
                title="Stream real-time live weather from Open-Meteo"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  simMode === 'live'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wifi className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Real-Time Live</span>
                <span className="sm:hidden">Live</span>
              </button>
            </div>

            {/* Single Unified Observatory / City Dropdown */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-sm">
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
                className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <optgroup label="─── Punjab Region ───" className="bg-slate-900 text-slate-400 font-semibold">
                  <option value="ABOHAR" className="bg-slate-900 text-slate-200">Abohar Agro-Met (Punjab)</option>
                  <option value="AMRITSAR" className="bg-slate-900 text-slate-200">Amritsar Airport (Punjab)</option>
                  <option value="LUDHIANA" className="bg-slate-900 text-slate-200">Ludhiana PAU (Punjab)</option>
                  <option value="BATHINDA" className="bg-slate-900 text-slate-200">Bathinda Regional (Punjab)</option>
                  <option value="PATIALA" className="bg-slate-900 text-slate-200">Patiala Observatory (Punjab)</option>
                </optgroup>
                <optgroup label="─── Multi-State IMD Observatories ───" className="bg-slate-900 text-slate-400 font-semibold">
                  <option value="DELHI" className="bg-slate-900 text-slate-200">Delhi Safdarjung (Delhi NCT)</option>
                  <option value="JAIPUR" className="bg-slate-900 text-slate-200">Jaipur Sanganer (Rajasthan)</option>
                  <option value="SHIMLA" className="bg-slate-900 text-slate-200">Shimla Ridge (Himachal)</option>
                  <option value="MUMBAI" className="bg-slate-900 text-slate-200">Mumbai Santacruz (Maharashtra)</option>
                  <option value="BENGALURU" className="bg-slate-900 text-slate-200">Bengaluru IMD (Karnataka)</option>
                  <option value="BHOPAL" className="bg-slate-900 text-slate-200">Bhopal Bairagarh (Madhya Pradesh)</option>
                </optgroup>
              </select>
            </div>

            {/* Live Indicator */}
            {getStatusBadge()}
          </div>
        </div>
      </div>
    </header>
  );
};
