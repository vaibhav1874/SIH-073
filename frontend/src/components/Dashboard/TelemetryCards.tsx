import React from 'react';
import { Thermometer, Droplets, Gauge, ShieldCheck, AlertTriangle } from 'lucide-react';
import { LiveTelemetryPayload } from '../../types';

interface TelemetryCardsProps {
  telemetry: LiveTelemetryPayload['data'] | null;
}

interface ArcGaugeProps {
  value: number;
  min: number;
  max: number;
  color: string;
  isAnomalous: boolean;
  unit: string;
}

const ArcGauge: React.FC<ArcGaugeProps> = ({ value, min, max, color, isAnomalous, unit }) => {
  const clamped = Math.min(max, Math.max(min, value));
  const percent = (clamped - min) / (max - min);
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.72; // 260 degree arc
  const strokeDashoffset = arcLength - percent * arcLength;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg className="w-16 h-16 -rotate-135 transform" viewBox="0 0 60 60">
        {/* Background track */}
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="4"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        {/* Active arc */}
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="transparent"
          stroke={isAnomalous ? '#f43f5e' : color}
          strokeWidth="4"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={`text-[11px] font-mono font-bold leading-none ${isAnomalous ? 'text-rose-400' : 'text-slate-200'}`}>
          {Math.round(percent * 100)}%
        </span>
        <span className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Scale</span>
      </div>
    </div>
  );
};

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry }) => {
  const isSyncing = !telemetry;
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Temperature Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
          isTempAnomalous
            ? 'bg-rose-950/30 border-rose-500/50 shadow-xl shadow-rose-950/60 ring-1 ring-rose-500/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${isTempAnomalous ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Ambient Temperature</span>
              <p className="text-[11px] text-slate-500">PT100 RTD Sensor (2m AGL)</p>
            </div>
          </div>
          {isTempAnomalous ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/40 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${isTempAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
                {currentTelemetry.temperature.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-slate-400">°C</span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-500">Kalman Estimate:</span>
              <span className="text-xs font-mono font-bold text-sky-400">
                {tempCorr.toFixed(2)} °C
              </span>
            </div>
          </div>

          <ArcGauge
            value={currentTelemetry.temperature}
            min={0}
            max={50}
            color="#f59e0b"
            isAnomalous={isTempAnomalous}
            unit="°C"
          />
        </div>

        {/* Kalman Divergence Footnote */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Innovation Residual |Δ|:</span>
          <span className={`font-mono font-bold ${tempDelta > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {tempDelta.toFixed(2)} °C
          </span>
        </div>
      </div>

      {/* Relative Humidity Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
          isHumAnomalous
            ? 'bg-rose-950/30 border-rose-500/50 shadow-xl shadow-rose-950/60 ring-1 ring-rose-500/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${isHumAnomalous ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'}`}>
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Relative Humidity</span>
              <p className="text-[11px] text-slate-500">Capacitive Thin-Film (2m)</p>
            </div>
          </div>
          {isHumAnomalous ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/40 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${isHumAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
                {currentTelemetry.humidity.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-slate-400">%</span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-500">Kalman Estimate:</span>
              <span className="text-xs font-mono font-bold text-sky-400">
                {humCorr.toFixed(2)} %
              </span>
            </div>
          </div>

          <ArcGauge
            value={currentTelemetry.humidity}
            min={0}
            max={100}
            color="#06b6d4"
            isAnomalous={isHumAnomalous}
            unit="%"
          />
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Innovation Residual |Δ|:</span>
          <span className={`font-mono font-bold ${humDelta > 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {humDelta.toFixed(2)} %
          </span>
        </div>
      </div>

      {/* Atmospheric Pressure Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
          isPresAnomalous
            ? 'bg-rose-950/30 border-rose-500/50 shadow-xl shadow-rose-950/60 ring-1 ring-rose-500/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/90'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border ${isPresAnomalous ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Station Surface Pressure</span>
              <p className="text-[11px] text-slate-500">Piezoresistive Barometer (QFE)</p>
            </div>
          </div>
          {isPresAnomalous ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/15 px-2.5 py-0.5 rounded-full border border-rose-500/40 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${isPresAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
                {currentTelemetry.pressure.toFixed(2)}
              </span>
              <span className="text-sm font-semibold text-slate-400">hPa</span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-500">Kalman Estimate:</span>
              <span className="text-xs font-mono font-bold text-sky-400">
                {presCorr.toFixed(2)} hPa
              </span>
            </div>
          </div>

          <ArcGauge
            value={currentTelemetry.pressure}
            min={920}
            max={1040}
            color="#818cf8"
            isAnomalous={isPresAnomalous}
            unit="hPa"
          />
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Innovation Residual |Δ|:</span>
          <span className={`font-mono font-bold ${presDelta > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {presDelta.toFixed(2)} hPa
          </span>
        </div>
      </div>
    </div>
  );
};
