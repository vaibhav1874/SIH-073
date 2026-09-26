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
  const arcLength = circumference * 0.72;
  const strokeDashoffset = arcLength - percent * arcLength;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg className="w-16 h-16 -rotate-135 transform" viewBox="0 0 60 60">
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
      <div
        className={`relative overflow-hidden rounded-lg p-4 border transition-colors ${
          isTempAnomalous
            ? 'bg-rose-950/25 border-rose-700/60'
            : 'bg-[#111827] border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-md border ${isTempAnomalous ? 'bg-rose-950/50 text-rose-400 border-rose-700/40' : 'bg-slate-800 text-amber-400 border-slate-700'}`}>
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Ambient Temperature</span>
              <p className="text-[11px] text-slate-400">PT100 RTD Sensor (2m AGL)</p>
            </div>
          </div>
          {isTempAnomalous ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-950/70 px-2 py-0.5 rounded border border-rose-700/60">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-700/40">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold tracking-tight font-mono ${isTempAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
                {currentTelemetry.temperature.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-slate-400">°C</span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-400">Kalman Estimate:</span>
              <span className="text-xs font-mono font-semibold text-sky-400">
                {tempCorr.toFixed(2)} °C
              </span>
            </div>
          </div>

          <ArcGauge
            value={currentTelemetry.temperature}
            min={0}
            max={50}
            color="#d97706"
            isAnomalous={isTempAnomalous}
            unit="°C"
          />
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Innovation Residual |Δ|:</span>
          <span className={`font-mono font-medium ${tempDelta > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {tempDelta.toFixed(2)} °C
          </span>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-lg p-4 border transition-colors ${
          isHumAnomalous
            ? 'bg-rose-950/25 border-rose-700/60'
            : 'bg-[#111827] border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-md border ${isHumAnomalous ? 'bg-rose-950/50 text-rose-400 border-rose-700/40' : 'bg-slate-800 text-sky-400 border-slate-700'}`}>
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Relative Humidity</span>
              <p className="text-[11px] text-slate-400">Capacitive Thin-Film (2m)</p>
            </div>
          </div>
          {isHumAnomalous ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-950/70 px-2 py-0.5 rounded border border-rose-700/60">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-700/40">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold tracking-tight font-mono ${isHumAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
                {currentTelemetry.humidity.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-slate-400">%</span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-400">Kalman Estimate:</span>
              <span className="text-xs font-mono font-semibold text-sky-400">
                {humCorr.toFixed(2)} %
              </span>
            </div>
          </div>

          <ArcGauge
            value={currentTelemetry.humidity}
            min={0}
            max={100}
            color="#0284c7"
            isAnomalous={isHumAnomalous}
            unit="%"
          />
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Innovation Residual |Δ|:</span>
          <span className={`font-mono font-medium ${humDelta > 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {humDelta.toFixed(2)} %
          </span>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-lg p-4 border transition-colors ${
          isPresAnomalous
            ? 'bg-rose-950/25 border-rose-700/60'
            : 'bg-[#111827] border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-md border ${isPresAnomalous ? 'bg-rose-950/50 text-rose-400 border-rose-700/40' : 'bg-slate-800 text-indigo-400 border-slate-700'}`}>
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">Station Surface Pressure</span>
              <p className="text-[11px] text-slate-400">Piezoresistive Barometer (QFE)</p>
            </div>
          </div>
          {isPresAnomalous ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-300 bg-rose-950/70 px-2 py-0.5 rounded border border-rose-700/60">
              <AlertTriangle className="w-3 h-3" /> FAULT
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-700/40">
              <ShieldCheck className="w-3 h-3" /> NOMINAL
            </span>
          )}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold tracking-tight font-mono ${isPresAnomalous ? 'text-rose-400' : 'text-slate-100'}`}>
                {currentTelemetry.pressure.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-slate-400">hPa</span>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-400">Kalman Estimate:</span>
              <span className="text-xs font-mono font-semibold text-sky-400">
                {presCorr.toFixed(2)} hPa
              </span>
            </div>
          </div>

          <ArcGauge
            value={currentTelemetry.pressure}
            min={920}
            max={1040}
            color="#6366f1"
            isAnomalous={isPresAnomalous}
            unit="hPa"
          />
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Filter Innovation Residual |Δ|:</span>
          <span className={`font-mono font-medium ${presDelta > 2 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {presDelta.toFixed(2)} hPa
          </span>
        </div>
      </div>
    </div>
  );
};
