import React from 'react';
import { Thermometer, Droplets, Gauge, ShieldCheck, AlertTriangle, Sparkles, Activity } from 'lucide-react';
import { LiveTelemetryPayload } from '../../types';

interface TelemetryCardsProps {
  telemetry: LiveTelemetryPayload['data'] | null;
}

interface RadialProgressProps {
  percentage: number;
  color: string;
  isAnomalous?: boolean;
  label?: string;
}

const RadialProgress: React.FC<RadialProgressProps> = ({ percentage, color, isAnomalous, label }) => {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 52 52">
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="4"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="transparent"
          stroke={isAnomalous ? '#f43f5e' : color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={`text-[10px] font-mono font-bold leading-none ${isAnomalous ? 'text-rose-400' : 'text-slate-200'}`}>
          {Math.round(percentage)}%
        </span>
        {label && <span className="text-[7px] font-mono text-slate-500 uppercase mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry }) => {
  const currentTelemetry = telemetry || {
    temperature: 28.5,
    humidity: 62.0,
    pressure: 1008.4,
    is_anomaly: false,
    ensemble_score: 10,
    root_cause: 'normal',
    severity: 'low' as const,
    affected_sensors: [],
    corrected: {
      temperature: 28.5,
      humidity: 62.0,
      pressure: 1008.4,
    },
  };

  const isTempAnomalous = currentTelemetry.affected_sensors?.includes('temperature') || (currentTelemetry.is_anomaly && currentTelemetry.root_cause.includes('temperature'));
  const isHumAnomalous = currentTelemetry.affected_sensors?.includes('humidity') || (currentTelemetry.is_anomaly && currentTelemetry.root_cause.includes('humidity'));
  const isPresAnomalous = currentTelemetry.affected_sensors?.includes('pressure') || (currentTelemetry.is_anomaly && currentTelemetry.root_cause.includes('pressure'));

  const tempCorr = currentTelemetry.corrected?.temperature ?? currentTelemetry.temperature;
  const humCorr = currentTelemetry.corrected?.humidity ?? currentTelemetry.humidity;
  const presCorr = currentTelemetry.corrected?.pressure ?? currentTelemetry.pressure;

  const tempDelta = Math.abs(currentTelemetry.temperature - tempCorr);
  const humDelta = Math.abs(currentTelemetry.humidity - humCorr);
  const presDelta = Math.abs(currentTelemetry.pressure - presCorr);

  const tempPercent = Math.min(100, Math.max(0, (currentTelemetry.temperature / 50) * 100));
  const humPercent = Math.min(100, Math.max(0, currentTelemetry.humidity));
  const presPercent = Math.min(100, Math.max(0, ((currentTelemetry.pressure - 920) / (1040 - 920)) * 100));
  const kalmanQuality = currentTelemetry.is_anomaly ? 94.2 : 99.7;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Temperature Card */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isTempAnomalous
            ? 'bg-rose-950/25 border-rose-600/50 shadow-sm'
            : 'bg-[#1c1f2b] border-[#282c3c] hover:border-[#383d52] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${isTempAnomalous ? 'bg-rose-950/60 text-rose-400 border-rose-700/50' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Temperature</span>
              <span className="text-[10px] text-slate-500 font-mono">PT100 (2m AGL)</span>
            </div>
          </div>
          {isTempAnomalous ? (
            <span className="text-[10px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-700/60 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-700/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tracking-tight ${isTempAnomalous ? 'text-rose-400' : 'text-white'}`}>
                {currentTelemetry.temperature.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-slate-400">°C</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Kalman: <span className="text-cyan-400 font-medium">{tempCorr.toFixed(2)}°C</span>
            </div>
          </div>
          <RadialProgress percentage={tempPercent} color="#06b6d4" isAnomalous={isTempAnomalous} label="Limit" />
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#262a38] flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500">Innovation |Δ|:</span>
          <span className={tempDelta > 2 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
            {tempDelta.toFixed(2)} °C
          </span>
        </div>
      </div>

      {/* 2. Relative Humidity Card */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isHumAnomalous
            ? 'bg-rose-950/25 border-rose-600/50 shadow-sm'
            : 'bg-[#1c1f2b] border-[#282c3c] hover:border-[#383d52] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${isHumAnomalous ? 'bg-rose-950/60 text-rose-400 border-rose-700/50' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Humidity</span>
              <span className="text-[10px] text-slate-500 font-mono">Capacitive (2m)</span>
            </div>
          </div>
          {isHumAnomalous ? (
            <span className="text-[10px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-700/60 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-700/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tracking-tight ${isHumAnomalous ? 'text-rose-400' : 'text-white'}`}>
                {currentTelemetry.humidity.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-slate-400">%</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Kalman: <span className="text-blue-400 font-medium">{humCorr.toFixed(2)}%</span>
            </div>
          </div>
          <RadialProgress percentage={humPercent} color="#3b82f6" isAnomalous={isHumAnomalous} label="RH" />
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#262a38] flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500">Innovation |Δ|:</span>
          <span className={humDelta > 5 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
            {humDelta.toFixed(2)} %
          </span>
        </div>
      </div>

      {/* 3. Surface Pressure Card */}
      <div
        className={`p-4 rounded-2xl border transition-all ${
          isPresAnomalous
            ? 'bg-rose-950/25 border-rose-600/50 shadow-sm'
            : 'bg-[#1c1f2b] border-[#282c3c] hover:border-[#383d52] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${isPresAnomalous ? 'bg-rose-950/60 text-rose-400 border-rose-700/50' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Pressure</span>
              <span className="text-[10px] text-slate-500 font-mono">Barometer (QFE)</span>
            </div>
          </div>
          {isPresAnomalous ? (
            <span className="text-[10px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-700/60 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-700/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tracking-tight ${isPresAnomalous ? 'text-rose-400' : 'text-white'}`}>
                {currentTelemetry.pressure.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-400">hPa</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Kalman: <span className="text-indigo-400 font-medium">{presCorr.toFixed(1)} hPa</span>
            </div>
          </div>
          <RadialProgress percentage={presPercent} color="#818cf8" isAnomalous={isPresAnomalous} label="QFE" />
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#262a38] flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500">Innovation |Δ|:</span>
          <span className={presDelta > 2 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
            {presDelta.toFixed(2)} hPa
          </span>
        </div>
      </div>

      {/* 4. Kalman Self-Healing Innovation Card */}
      <div className="p-4 rounded-2xl bg-[#1c1f2b] border border-[#282c3c] hover:border-[#383d52] shadow-sm transition-all">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Kalman Filter</span>
              <span className="text-[10px] text-slate-500 font-mono">Innovation Gating</span>
            </div>
          </div>
          <span className="text-[10px] font-medium text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-700/40 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> ACTIVE
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono tracking-tight text-white">
                {kalmanQuality.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-amber-400">%</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              State: <span className="text-amber-400 font-medium">Auto-Imputing</span>
            </div>
          </div>
          <RadialProgress percentage={kalmanQuality} color="#f59e0b" label="Health" />
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#262a38] flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500">Inference Delay:</span>
          <span className="text-emerald-400 font-semibold">&lt; 12 ms</span>
        </div>
      </div>
    </div>
  );
};
