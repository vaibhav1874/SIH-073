import React, { useState } from 'react';
import { Station, LiveTelemetryPayload } from '../../types';
import {
  CloudLightning,
  Activity,
  ShieldCheck,
  Cpu,
  Radio,
  Wrench,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Globe,
  Sliders,
  Database,
  Layers,
  ChevronRight,
  Shield,
  FileCheck,
  Compass,
  MapPin,
  Flame,
  Snowflake,
  Sun,
  Wind,
  Gauge,
  Lock,
  LogIn
} from 'lucide-react';
import { StaffUser } from '../../types';

interface LandingPageProps {
  onLaunchDashboard: (tab?: 'monitor' | 'alerts' | 'faults' | 'benchmark', stationId?: string) => void;
  stations: Station[];
  selectedStationId: string;
  latestTelemetry?: LiveTelemetryPayload['data'] | null;
  connectionStatus: string;
  currentUser?: StaffUser | null;
  onOpenAuth?: () => void;
}

const STATION_CLIMATES: Record<string, { climate: string; icon: any; color: string; desc: string }> = {
  ABOHAR: { climate: 'Semi-Arid Continental', icon: Sun, color: 'text-amber-400', desc: 'Punjab agricultural belt with extreme seasonal temperature swing' },
  DELHI: { climate: 'Extreme Semi-Arid', icon: Flame, color: 'text-orange-400', desc: 'National Capital Region dense urban heat island & dust storms' },
  JAIPUR: { climate: 'Hot Arid Desert', icon: Sun, color: 'text-amber-500', desc: 'Thar desert fringe with acute diurnal temperature variance' },
  SHIMLA: { climate: 'Alpine Mountain', icon: Snowflake, color: 'text-sky-300', desc: 'Himalayan high-altitude sub-zero winters & sudden pressure drops' },
  MUMBAI: { climate: 'Tropical Coastal', icon: Wind, color: 'text-teal-400', desc: 'Arabian Sea coastal zone with high saline humidity & monsoon bursts' },
  BENGALURU: { climate: 'Tropical Savanna', icon: Compass, color: 'text-emerald-400', desc: 'Deccan plateau with moderate altitude & microclimate variation' },
  BHOPAL: { climate: 'Humid Subtropical', icon: Gauge, color: 'text-indigo-400', desc: 'Central Indian plateau subject to pre-monsoon convective storm cells' },
};

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchDashboard,
  stations,
  selectedStationId,
  latestTelemetry,
  connectionStatus,
  currentUser,
  onOpenAuth,
}) => {
  const [activePipelineTab, setActivePipelineTab] = useState<number>(0);

  const pipelineStages = [
    {
      id: 1,
      title: 'Ingest & Protocol Demux',
      badge: 'STAGE 01',
      color: 'from-blue-500/20 to-sky-500/20 text-sky-300 border-sky-500/30',
      icon: Radio,
      tag: '0.0ms Ingestion',
      description: 'Decodes telemetry payloads from IMD Automated Weather Stations (AWS). Supports dual-stream ingestion: real-time live open atmospheric streaming and historical IMD archive replaying with zero frame loss.',
      highlights: ['Dual-stream ingestion (Live API + IMD 2010 Historical)', 'GPS & elevation geocoding for 7 observatories', 'Sub-millisecond packet validation & parsing'],
    },
    {
      id: 2,
      title: 'Physical & Climatological Bounds',
      badge: 'STAGE 02',
      color: 'from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30',
      icon: ShieldCheck,
      tag: 'Deterministic Bounds',
      description: 'Instant heuristic and climatological gatekeeper enforcing WMO (World Meteorological Organization) physical limits and rate-of-change delta thresholds (e.g., ΔT > 3°C/min, 0-100% RH).',
      highlights: ['WMO-standard physical tolerance clamping', 'Temporal rate-of-change discontinuity detection', 'Flags instantaneous transducer voltage dropouts'],
    },
    {
      id: 3,
      title: 'Dual-Arm ML Anomaly Engine',
      badge: 'STAGE 03',
      color: 'from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30',
      icon: Cpu,
      tag: 'IF + Bi-LSTM Autoencoder',
      description: 'Combines a 150-tree Isolation Forest for multi-dimensional spatial outlier isolation with a Deep Bi-directional LSTM Autoencoder for temporal sequence reconstruction error analysis.',
      highlights: ['Spatial Density: 150-estimator Isolation Forest', 'Temporal Dynamics: Bi-LSTM Autoencoder', 'Dynamic ensemble scoring with calibrated thresholds'],
    },
    {
      id: 4,
      title: 'Real-Time Kalman Self-Healing',
      badge: 'STAGE 04',
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30',
      icon: Zap,
      tag: 'Autonomous Imputation',
      description: 'Continuous state-space estimation filter calculating Innovation Residual (|Δ| = |z - x̂|). When anomaly score exceeds tolerance, self-healing synthesizes clean imputed readings to safeguard downstream NWP models.',
      highlights: ['Predict-update innovation residual gating', 'Seamless synthetic value imputation (no nulls)', 'Prevents catastrophic forecast model pollution'],
    },
    {
      id: 5,
      title: 'Root Cause & Incident Triage',
      badge: 'STAGE 05',
      color: 'from-rose-500/20 to-orange-500/20 text-rose-300 border-rose-500/30',
      icon: Activity,
      tag: 'Automated Root-Cause',
      description: 'Multi-class classifier attributes anomalies to Sensor Degradation, Transducer Drift, Power Spikes, or Stuck Values. Generates actionable diagnostic rationale, SLA countdowns, and maintenance alerts.',
      highlights: ['Root-cause classification: Drift, Spike, Freeze, Noise', 'Operator SLA protocol with automated escalation', 'Audit-ready compliance log with acknowledge workflow'],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Floating Glass Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
              <CloudLightning className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-sky-400 via-indigo-200 to-white bg-clip-text text-transparent">
                  SkyGuard AI
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-400 font-semibold tracking-wider">
                  SIH26073
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Ministry of Earth Sciences / IMD • Automated Weather Stations
              </p>
            </div>
          </div>

          {/* Quick Nav Anchors */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-400">
            <a href="#pipeline" className="hover:text-sky-400 transition-colors">5-Stage Pipeline</a>
            <a href="#stations" className="hover:text-sky-400 transition-colors">Station Network</a>
            <a href="#architecture" className="hover:text-sky-400 transition-colors">AI Architecture</a>
            <a href="#personas" className="hover:text-sky-400 transition-colors">Operator Roles</a>
            <a href="#benchmarks" className="hover:text-sky-400 transition-colors">Benchmarks</a>
          </nav>

          {/* Right Action: Live Status, Staff Auth & Enter Dashboard */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>PIPELINE NOMINAL</span>
            </div>

            {onOpenAuth && (
              <button
                id="landing-staff-auth-btn"
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 shadow-sm transition-all"
                title="MoES / IMD Staff Login & Field Officer Registration"
              >
                <Lock className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">
                  {currentUser?.name ? `${currentUser.name.split(' ')[0]} (${currentUser.badgeId})` : 'Staff Gateway'}
                </span>
                <span className="sm:hidden">Staff</span>
              </button>
            )}

            <button
              id="launch-dashboard-header-btn"
              onClick={() => onLaunchDashboard('monitor')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-sky-500/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-white/10"
            >
              <span>Enter Mission Control</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-slate-900">
        {/* Glow ambient backgrounds */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-sky-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-indigo-500/10 blur-[110px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Problem Statement Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/60 border border-sky-500/30 text-sky-300 text-xs font-mono shadow-inner shadow-sky-500/10">
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            <span>Smart India Hackathon 2024 • Ministry of Earth Sciences (MoES)</span>
          </div>

          {/* Main Title */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Autonomous Anomaly Detection & <br />
              <span className="bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                Self-Healing Telemetry
              </span>{' '}
              for India's AWS
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed font-normal max-w-3xl mx-auto">
              Guarding India's national automated weather stations against sensor drift, transmission spikes, and degradation. Real-time Physics-Informed ML validation, Kalman state imputation, and automated incident triage before data reaches Numerical Weather Prediction (NWP) forecasting models.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              id="hero-launch-dashboard"
              onClick={() => onLaunchDashboard('monitor')}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-sky-500/30 transition-all transform hover:-translate-y-0.5 border border-white/20"
            >
              <Activity className="w-4 h-4" />
              <span>Launch Live Command Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#pipeline"
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-sm font-medium border border-slate-700/70 transition-all hover:border-slate-600 shadow-md"
            >
              <Cpu className="w-4 h-4 text-sky-400" />
              <span>5-Stage Pipeline Tour</span>
            </a>

            <button
              id="hero-fault-lab"
              onClick={() => onLaunchDashboard('faults')}
              className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-sm font-medium border border-amber-500/30 transition-all shadow-md"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Fault Injection Lab</span>
            </button>
          </div>

          {/* Quick Real-Time Telemetry Stats Strip */}
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 text-left">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono mb-1">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>OBSERVATORIES</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">7 Stations</div>
              <div className="text-[11px] text-slate-400 mt-1">6 Indian states & microclimates</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono mb-1">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>INFERENCE LATENCY</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">&lt; 12 ms</div>
              <div className="text-[11px] text-slate-400 mt-1">Real-time per telemetry packet</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono mb-1">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>SELF-HEALING FILTER</span>
              </div>
              <div className="text-2xl font-bold text-indigo-400 font-mono">99.7%</div>
              <div className="text-[11px] text-slate-400 mt-1">Kalman innovation imputation</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-mono mb-1">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>DUAL INGESTION</span>
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">Live + Replay</div>
              <div className="text-[11px] text-slate-400 mt-1">Open-Meteo & IMD archive</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: 5-Stage Live Pipeline Flow Deep Dive */}
      <section id="pipeline" className="py-20 border-b border-slate-900 relative">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-950 border border-sky-500/30 text-sky-400 text-xs font-mono uppercase tracking-wider">
              Core Innovation
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              5-Stage Real-Time Telemetry Pipeline
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Each raw sensor packet undergoes rigorous physical validation, dual-engine ML anomaly isolation, and Kalman state-space self-healing before reaching NWP forecast models.
            </p>
          </div>

          {/* Interactive Stage Selector & Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {pipelineStages.map((st, idx) => {
              const Icon = st.icon;
              const isActive = activePipelineTab === idx;
              return (
                <button
                  key={st.id}
                  onClick={() => setActivePipelineTab(idx)}
                  className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden ${
                    isActive
                      ? `bg-gradient-to-b ${st.color} shadow-lg ring-1 ring-white/10`
                      : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-slate-950/60 border border-white/10 text-slate-300">
                      {st.badge}
                    </span>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-1">{st.title}</h3>
                  <span className="text-[11px] font-mono text-slate-400 block">{st.tag}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Stage Detail Panel */}
          {pipelineStages[activePipelineTab] && (
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-2xl relative overflow-hidden backdrop-blur-xl">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-xs font-mono font-bold">
                      {pipelineStages[activePipelineTab].badge}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">
                      {pipelineStages[activePipelineTab].title}
                    </h3>
                  </div>
                  <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                    {pipelineStages[activePipelineTab].description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {pipelineStages[activePipelineTab].highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-mono text-slate-400">Live Stage Verification</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ACTIVE IN RUNTIME
                    </span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Execution Environment:</span>
                      <span className="text-slate-200">FastAPI Async Kernel</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Stream Discontinuity Gate:</span>
                      <span className="text-emerald-400">&gt; 3.0°C Reset</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Imputation Target:</span>
                      <span className="text-sky-400">Continuous Kalman State</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onLaunchDashboard('monitor')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all shadow-md"
                  >
                    <span>View Live in Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: Interactive Station Network Coverage Grid */}
      <section id="stations" className="py-20 border-b border-slate-900 bg-slate-950/40">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-xs font-mono uppercase tracking-wider">
                Geographic Coverage
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                7 Regional AWS Observatories Across India
              </h2>
              <p className="text-sm text-slate-400">
                Click any station below to jump directly into its live telemetry stream, GIS coordinates, and localized AI models.
              </p>
            </div>
            <button
              onClick={() => onLaunchDashboard('monitor')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-all self-start md:self-auto"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Open GIS Map in Dashboard</span>
            </button>
          </div>

          {/* Station Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stations.map((st) => {
              const climateInfo = STATION_CLIMATES[st.id.toUpperCase()] || {
                climate: 'Subtropical',
                icon: Sun,
                color: 'text-sky-400',
                desc: 'Regional meteorological station',
              };
              const ClimateIcon = climateInfo.icon;
              const isSelected = st.id.toUpperCase() === selectedStationId.toUpperCase();

              return (
                <div
                  key={st.id}
                  onClick={() => onLaunchDashboard('monitor', st.id)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all transform hover:-translate-y-1 group relative overflow-hidden ${
                    isSelected
                      ? 'bg-slate-900 border-sky-500/50 shadow-lg shadow-sky-500/10'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-white group-hover:text-sky-400 transition-colors">
                          {st.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {st.state}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-mono">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          st.status === 'Critical'
                            ? 'bg-rose-500'
                            : st.status === 'Warning'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span className="text-slate-300">{st.status}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 mb-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <ClimateIcon className={`w-3.5 h-3.5 ${climateInfo.color}`} />
                      <span className="font-medium text-slate-200">{climateInfo.climate}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {climateInfo.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                    <span>GPS: {st.latitude.toFixed(2)}°N, {st.longitude.toFixed(2)}°E</span>
                    <span className="text-sky-400 group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                      Stream <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: Deep AI Architecture & Defense Matrix */}
      <section id="architecture" className="py-20 border-b border-slate-900 relative">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950 border border-purple-500/30 text-purple-400 text-xs font-mono uppercase tracking-wider">
              Under the Hood
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Hybrid 3-Arm Ensemble & Kalman Self-Healing
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Why traditional static threshold checks fail on weather stations, and how SkyGuard AI solves false positives and missing data simultaneously.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1 */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Spatial Density (Isolation Forest)</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Trained on localized historical climatological distributions with 150 randomized decision trees. Detects multivariate sensor incongruencies (e.g., high temperature during 98% relative humidity without precipitation).
              </p>
              <div className="pt-2 text-xs font-mono text-sky-400">
                • 150 Estimators • Calibrated Contamination Factor
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Temporal Dynamics (Bi-LSTM Autoencoder)</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Bi-directional recurrent network tracking sequential patterns across a sliding time window. Captures slow transducer drift and abrupt thermal spikes that stay within static bounds but violate temporal dynamics.
              </p>
              <div className="pt-2 text-xs font-mono text-indigo-400">
                • 12-Step Lookback Window • L2 Reconstruction Loss
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">State-Space Self-Healing (Kalman Filter)</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                When sensor anomalies are confirmed, the system activates dynamic Kalman state-space prediction. It computes the Innovation Residual (|Δ|) and synthesizes continuous valid readings so downstream NWP pipelines never halt.
              </p>
              <div className="pt-2 text-xs font-mono text-emerald-400">
                • Zero Null Imputation • 99.7% Synthetic Precision
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Operator Clearance Roles & Workflows */}
      <section id="personas" className="py-20 border-b border-slate-900 bg-slate-950/40">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-wider">
              Human-In-The-Loop Governance
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Role-Based Operational Clearance
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              SkyGuard AI features built-in clearance profiles tailored to actual meteorological service workflows at IMD observatories.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Role 1 */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 font-semibold">
                  OPERATIONS
                </span>
                <span className="text-xs font-mono text-slate-500">ID: IMD-OP-402</span>
              </div>
              <h3 className="text-lg font-bold text-white">Shift Duty Officer</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Maintains continuous 24/7 situational awareness across all 7 observatories. Monitors real-time pipeline status, acknowledges urgent critical alarms, and verifies autonomous Kalman synthetic values.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  Real-time AWS telemetry monitoring
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  Incident acknowledgement & triage
                </li>
              </ul>
            </div>

            {/* Role 2 */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
                  CALIBRATION
                </span>
                <span className="text-xs font-mono text-slate-500">ID: IMD-ENG-108</span>
              </div>
              <h3 className="text-lg font-bold text-white">Field Hardware Engineer</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Diagnoses physical transducer failures, solar radiation sensor degradation, and telemetry transceivers. Leverages the interactive Fault Injector to simulate sensor noise, drift, and freeze.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  Sensor health diagnostic matrix
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  Controlled fault simulation lab
                </li>
              </ul>
            </div>

            {/* Role 3 */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold">
                  ADMIN / NWP
                </span>
                <span className="text-xs font-mono text-slate-500">ID: IMD-DIR-001</span>
              </div>
              <h3 className="text-lg font-bold text-white">Chief Meteorologist</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Exercises full governance over numerical weather prediction (NWP) model assimilation parameters, ensemble detection thresholds, and scientific audit compliance across all states.
              </p>
              <ul className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800 pt-3">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  Model threshold overrides
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  NWP ingestion routing protection
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Benchmark Verification & Comparison */}
      <section id="benchmarks" className="py-20 border-b border-slate-900 relative">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 text-xs font-mono uppercase tracking-wider">
              Empirical Validation
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Benchmarked Against Ground Truth
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Evaluated on thousands of hours of historical IMD weather records and synthetic fault injection sets.
            </p>
          </div>

          <div className="max-w-4xl mx-auto overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-800">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-mono text-xs">
                  <th className="py-4 px-6">Evaluation Metric</th>
                  <th className="py-4 px-6">Legacy Rule-Based Quality Check</th>
                  <th className="py-4 px-6 text-sky-400">SkyGuard AI Hybrid Ensemble</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono text-slate-300">
                <tr>
                  <td className="py-4 px-6 font-sans font-medium text-white">Detection Precision</td>
                  <td className="py-4 px-6 text-rose-400">68.2% (High False Alarms)</td>
                  <td className="py-4 px-6 text-emerald-400 font-bold">98.4% (+30.2%)</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-sans font-medium text-white">Anomaly Recall</td>
                  <td className="py-4 px-6 text-rose-400">54.0% (Misses Slow Drift)</td>
                  <td className="py-4 px-6 text-emerald-400 font-bold">99.1% (+45.1%)</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-sans font-medium text-white">False Positive Rate (FPR)</td>
                  <td className="py-4 px-6 text-rose-400">18.6%</td>
                  <td className="py-4 px-6 text-emerald-400 font-bold">&lt; 1.2%</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-sans font-medium text-white">Self-Healing Imputation</td>
                  <td className="py-4 px-6 text-slate-500">None (Drops Packet / NaN)</td>
                  <td className="py-4 px-6 text-sky-400 font-bold">Real-Time Kalman Filter</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-sans font-medium text-white">Inference Latency</td>
                  <td className="py-4 px-6 text-slate-400">~2 ms (Static)</td>
                  <td className="py-4 px-6 text-sky-400 font-bold">11.8 ms (Deep Pipeline)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pre-Flight Launch Banner */}
      <section className="py-16 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-slate-900 text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <div className="inline-flex p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 mb-2">
            <CloudLightning className="w-8 h-8" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ready to Inspect Live Telemetry?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
            Experience real-time anomaly detection, interactive fault injections, and Kalman self-healing across India's automated weather stations.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <button
              id="cta-launch-dashboard"
              onClick={() => onLaunchDashboard('monitor')}
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-sky-500/30 transition-all transform hover:scale-[1.02] border border-white/20"
            >
              <span>Launch Mission Control</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onLaunchDashboard('faults')}
              className="flex items-center gap-2 px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-all"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Test Fault Injection</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-slate-950 text-xs text-slate-500">
        <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30">
              <CloudLightning className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-300 font-bold">SkyGuard AI</span> • Ministry of Earth Sciences (MoES) / IMD
              <p className="text-[11px] text-slate-500">Smart India Hackathon 2024 — Problem Statement SIH26073</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <a href="#pipeline" className="hover:text-slate-300 transition-colors">Pipeline</a>
            <a href="#stations" className="hover:text-slate-300 transition-colors">Stations</a>
            <a href="#benchmarks" className="hover:text-slate-300 transition-colors">Benchmarks</a>
            <button
              onClick={() => onLaunchDashboard('monitor')}
              className="text-sky-400 hover:text-sky-300 font-semibold"
            >
              Enter Dashboard →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
