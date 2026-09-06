import React from 'react';
import { Thermometer, Droplets, Gauge, ShieldCheck, AlertTriangle } from 'lucide-react';
import { LiveTelemetryPayload } from '../../types';

interface TelemetryCardsProps {
  telemetry: LiveTelemetryPayload['data'] | null;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({ telemetry }) => {
  if (!telemetry) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-900/60 border border-slate-800" />
        ))}
      </div>
    );
  }

  const isTempAnomalous = telemetry.affected_sensors?.includes('temperature') || (telemetry.is_anomaly && telemetry.root_cause.includes('temperature'));
  const isHumAnomalous = telemetry.affected_sensors?.includes('humidity') || (telemetry.is_anomaly && telemetry.root_cause.includes('humidity'));
  const isPresAnomalous = telemetry.affected_sensors?.includes('pressure') || (telemetry.is_anomaly && telemetry.root_cause.includes('pressure'));

  const tempCorr = telemetry.corrected?.temperature ?? telemetry.temperature;
  const humCorr = telemetry.corrected?.humidity ?? telemetry.humidity;
  const presCorr = telemetry.corrected?.pressure ?? telemetry.pressure;

  const tempDelta = Math.abs(telemetry.temperature - tempCorr);
  const humDelta = Math.abs(telemetry.humidity - humCorr);
  const presDelta = Math.abs(telemetry.pressure - presCorr);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Temperature Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
          isTempAnomalous
            ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl ${isTempAnomalous ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ambient Temperature</span>
              <p className="text-[11px] text-slate-500">PT100 RTD Sensor (2m)</p>
            </div>
          </div>
          {isTempAnomalous ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-extrabold tracking-tight font-mono ${isTempAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
              {telemetry.temperature.toFixed(2)}
            </span>
            <span className="text-sm font-semibold text-slate-400">°C</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Kalman Estimate</span>
            <span className="text-xs font-mono font-medium text-sky-400">
              {tempCorr.toFixed(2)} °C
            </span>
          </div>
        </div>

        {/* Kalman Divergence Footnote */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Residual |Δ|:</span>
          <span className={`font-mono font-medium ${tempDelta > 2 ? 'text-rose-400' : 'text-slate-300'}`}>
            {tempDelta.toFixed(2)} °C
          </span>
        </div>
      </div>

      {/* Relative Humidity Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
          isHumAnomalous
            ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl ${isHumAnomalous ? 'bg-rose-500/20 text-rose-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Relative Humidity</span>
              <p className="text-[11px] text-slate-500">Capacitive Thin-Film (2m)</p>
            </div>
          </div>
          {isHumAnomalous ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-extrabold tracking-tight font-mono ${isHumAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
              {telemetry.humidity.toFixed(2)}
            </span>
            <span className="text-sm font-semibold text-slate-400">%</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Kalman Estimate</span>
            <span className="text-xs font-mono font-medium text-sky-400">
              {humCorr.toFixed(2)} %
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Residual |Δ|:</span>
          <span className={`font-mono font-medium ${humDelta > 5 ? 'text-rose-400' : 'text-slate-300'}`}>
            {humDelta.toFixed(2)} %
          </span>
        </div>
      </div>

      {/* Atmospheric Pressure Card */}
      <div
        className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
          isPresAnomalous
            ? 'bg-rose-950/30 border-rose-500/50 shadow-lg shadow-rose-950/50 ring-1 ring-rose-500/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl ${isPresAnomalous ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">MSL Pressure</span>
              <p className="text-[11px] text-slate-500">Piezoresistive Barometer</p>
            </div>
          </div>
          {isPresAnomalous ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-extrabold tracking-tight font-mono ${isPresAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
              {telemetry.pressure.toFixed(2)}
            </span>
            <span className="text-sm font-semibold text-slate-400">hPa</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Kalman Estimate</span>
            <span className="text-xs font-mono font-medium text-sky-400">
              {presCorr.toFixed(2)} hPa
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Residual |Δ|:</span>
          <span className={`font-mono font-medium ${presDelta > 2 ? 'text-rose-400' : 'text-slate-300'}`}>
            {presDelta.toFixed(2)} hPa
          </span>
        </div>
      </div>
    </div>
  );
};
