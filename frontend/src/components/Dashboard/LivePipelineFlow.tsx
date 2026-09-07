import React from 'react';
import { LiveTelemetryPayload } from '../../types';
import { Cpu, ShieldCheck, AlertTriangle, ArrowRight, Zap, RefreshCw, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';

interface LivePipelineFlowProps {
  telemetry: LiveTelemetryPayload['data'] | null;
}

export const LivePipelineFlow: React.FC<LivePipelineFlowProps> = ({ telemetry }) => {
  const isAnomaly = telemetry ? telemetry.is_anomaly : false;
  const score = telemetry ? Math.round((telemetry.ensemble_score || 0) * 100) : 10;
  const affectedSensors = telemetry?.affected_sensors || [];
  const rootCause = telemetry?.root_cause || 'normal';

  const rawTemp = telemetry?.temperature ?? 28.5;
  const corrTemp = telemetry?.corrected?.temperature ?? rawTemp;
  const tempDiff = Math.abs(rawTemp - corrTemp);
  const isTempAffected = affectedSensors.includes('temperature') || rootCause.includes('temp');

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-2xl backdrop-blur-xl">
      {/* Background Ambient Glow */}
      <div
        className={`absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isAnomaly ? 'bg-rose-500/15' : 'bg-sky-500/10'
        }`}
      />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${isAnomaly ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-sky-500/15 text-sky-400 border-sky-500/30'}`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Live Data Ingestion & Self-Healing Pipeline
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border ${
                isAnomaly
                  ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAnomaly ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                {telemetry
                  ? (isAnomaly ? 'ANOMALY ISOLATION & HEALING ACTIVE' : 'PIPELINE NOMINAL • SYNCHRONIZED')
                  : 'SYNCHRONIZING TELEMETRY PIPELINE...'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              End-to-end observational telemetry path: Sensor ingestion → Hybrid AI analysis → Kalman innovation gating → IMD NWP grid
            </p>
          </div>
        </div>

        {/* Latency & Processing Speed Tag */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="text-slate-500">Execution Latency:</span>
          <span className="text-emerald-400 font-bold">&lt; 14.8 ms</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-sky-400">1.0 Hz Stream</span>
        </div>
      </div>

      {/* Flow Nodes Grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch relative">
        {/* Step 1: Ingestion */}
        <div className="flex flex-col justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 group hover:border-slate-700 transition-all">
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500 mb-1.5">
              <span>Stage 01</span>
              <span className="text-sky-400 font-semibold">Raw Edge</span>
            </div>
            <div className="text-xs font-bold text-slate-200">AWS Telemetry Ingestion</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Sampling 3 primary channels (RTD, Capacitive RH, Barometer).
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Observed:</span>
            <span className={`font-bold ${isTempAffected && isAnomaly ? 'text-rose-400' : 'text-slate-200'}`}>
              {rawTemp.toFixed(1)}°C
            </span>
          </div>
        </div>

        {/* Step 2: Rules */}
        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly && affectedSensors.length > 0
            ? 'bg-amber-950/20 border-amber-500/40 text-slate-200'
            : 'bg-slate-950/70 border-slate-800/90 text-slate-200'
        }`}>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500 mb-1.5">
              <span>Stage 02</span>
              <span className="text-amber-400 font-semibold">Deterministic</span>
            </div>
            <div className="text-xs font-bold text-slate-200">WMO / IMD Rule Engine</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Absolute physical bounds &amp; rate-of-change delta limits.
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Safety Status:</span>
            <span className={`font-bold ${isAnomaly ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isAnomaly ? 'BREACH FLAGGED' : 'WMO PASSED'}
            </span>
          </div>
        </div>

        {/* Step 3: ML Models */}
        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly
            ? 'bg-purple-950/20 border-purple-500/40 text-slate-200'
            : 'bg-slate-950/70 border-slate-800/90 text-slate-200'
        }`}>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500 mb-1.5">
              <span>Stage 03</span>
              <span className="text-purple-400 font-semibold">Dual ML Arms</span>
            </div>
            <div className="text-xs font-bold text-slate-200">IF (40F) + LSTM-AE</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Spatial density isolation &amp; 15-step temporal sequence MSE.
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Confidence:</span>
            <span className={`font-bold ${score >= 55 ? 'text-purple-400' : 'text-slate-300'}`}>
              {score} / 100
            </span>
          </div>
        </div>

        {/* Step 4: Decision & Diagnosis */}
        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly
            ? 'bg-rose-950/25 border-rose-500/50 shadow-md shadow-rose-950/30'
            : 'bg-slate-950/70 border-slate-800/90'
        }`}>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500 mb-1.5">
              <span>Stage 04</span>
              <span className="text-indigo-400 font-semibold">Decision Fusion</span>
            </div>
            <div className="text-xs font-bold text-slate-200">XGBoost Diagnostics</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Multi-class root cause classification &amp; triage assignment.
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Diagnosis:</span>
            <span className={`font-bold uppercase text-[10px] ${isAnomaly ? 'text-rose-400' : 'text-emerald-400'}`}>
              {rootCause.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Step 5: Kalman Self-Healing */}
        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly && tempDiff > 1
            ? 'bg-cyan-950/30 border-cyan-400/60 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-400/40'
            : 'bg-slate-950/70 border-slate-800/90'
        }`}>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500 mb-1.5">
              <span>Stage 05</span>
              <span className="text-cyan-400 font-semibold">Self-Healing</span>
            </div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>Kalman Innovation Filter</span>
              {isAnomaly && tempDiff > 1 && (
                <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              {isAnomaly && tempDiff > 1
                ? 'Outlier rejected via innovation gating. Imputing clean baseline.'
                : 'Adaptive state tracking active with zero phase lag.'}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Delivered State:</span>
            <span className="font-bold text-cyan-400">
              {corrTemp.toFixed(1)}°C
            </span>
          </div>
        </div>
      </div>

      {/* Live Self-Healing Banner if Anomaly is active */}
      {isAnomaly && tempDiff > 1 && (
        <div className="mt-3 p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/40 flex items-center justify-between gap-3 animate-fade-in text-xs font-mono">
          <div className="flex items-center gap-2 text-cyan-300">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>SELF-HEALING ACTIVE:</strong> Faulty reading ({rawTemp.toFixed(2)}°C) intercepted and replaced with physical state estimate ({corrTemp.toFixed(2)}°C)
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shrink-0">
            NWP MODEL PROTECTED
          </span>
        </div>
      )}
    </div>
  );
};
