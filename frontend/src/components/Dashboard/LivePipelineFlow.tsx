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
    <div className="rounded-2xl bg-[#1c1f2b] border border-[#282c3c] p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#262a38]">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-md border ${isAnomaly ? 'bg-rose-950/50 text-rose-400 border-rose-700/50' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Live Data Ingestion & Self-Healing Pipeline
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 border ${
                isAnomaly
                  ? 'bg-rose-950/70 text-rose-300 border-rose-700/60'
                  : 'bg-emerald-950/50 text-emerald-400 border-emerald-700/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAnomaly ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                {telemetry
                  ? (isAnomaly ? 'ANOMALY ISOLATION ACTIVE' : 'PIPELINE NOMINAL')
                  : 'SYNCHRONIZING...'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              End-to-end observational telemetry path: Sensor ingestion → Hybrid AI analysis → Kalman innovation gating → IMD NWP grid
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-[#161822] px-3 py-1.5 rounded-xl border border-[#282c3c]">
          <span className="text-slate-400">Latency:</span>
          <span className="text-slate-200 font-semibold">&lt; 14.8 ms</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-slate-300">1.0 Hz Stream</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch relative">
        <div className="flex flex-col justify-between p-3.5 rounded-xl bg-[#161822] border border-[#282c3c] group hover:border-[#383d52] transition-all">
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500 mb-1.5">
              <span>Stage 01</span>
              <span className="text-cyan-400 font-semibold">Raw Edge</span>
            </div>
            <div className="text-xs font-bold text-slate-200">AWS Telemetry Ingestion</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              Sampling 3 primary channels (RTD, Capacitive RH, Barometer).
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#282c3c] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Observed:</span>
            <span className={`font-bold ${isTempAffected && isAnomaly ? 'text-rose-400' : 'text-slate-200'}`}>
              {rawTemp.toFixed(1)}°C
            </span>
          </div>
        </div>

        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly && affectedSensors.length > 0
            ? 'bg-amber-500/10 border-amber-500/40 text-slate-200'
            : 'bg-[#161822] border-[#282c3c] text-slate-200'
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

          <div className="mt-3 pt-2.5 border-t border-[#282c3c] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Safety Status:</span>
            <span className={`font-bold ${isAnomaly ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isAnomaly ? 'BREACH FLAGGED' : 'WMO PASSED'}
            </span>
          </div>
        </div>

        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly
            ? 'bg-purple-500/10 border-purple-500/40 text-slate-200'
            : 'bg-[#161822] border-[#282c3c] text-slate-200'
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

          <div className="mt-3 pt-2.5 border-t border-[#282c3c] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Confidence:</span>
            <span className={`font-bold ${score >= 55 ? 'text-purple-400' : 'text-slate-300'}`}>
              {score} / 100
            </span>
          </div>
        </div>

        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly
            ? 'bg-rose-500/15 border-rose-500/50 shadow-md shadow-rose-950/30'
            : 'bg-[#161822] border-[#282c3c]'
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

          <div className="mt-3 pt-2.5 border-t border-[#282c3c] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Diagnosis:</span>
            <span className={`font-bold uppercase text-[10px] ${isAnomaly ? 'text-rose-400' : 'text-emerald-400'}`}>
              {rootCause.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
          isAnomaly && tempDiff > 1
            ? 'bg-amber-500/15 border-amber-400/60 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/40'
            : 'bg-[#161822] border-[#282c3c]'
        }`}>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-mono text-slate-500 mb-1.5">
              <span>Stage 05</span>
              <span className="text-amber-400 font-semibold">Self-Healing</span>
            </div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>Kalman Innovation Filter</span>
              {isAnomaly && tempDiff > 1 && (
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
              {isAnomaly && tempDiff > 1
                ? 'Outlier rejected via innovation gating. Imputing clean baseline.'
                : 'Adaptive state tracking active with zero phase lag.'}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#282c3c] flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Delivered State:</span>
            <span className="font-bold text-amber-400">
              {corrTemp.toFixed(1)}°C
            </span>
          </div>
        </div>
      </div>

      {isAnomaly && tempDiff > 1 && (
        <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-3 animate-fade-in text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-300">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>SELF-HEALING ACTIVE:</strong> Faulty reading ({rawTemp.toFixed(2)}°C) intercepted and replaced with physical state estimate ({corrTemp.toFixed(2)}°C)
            </span>
          </div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
            NWP MODEL PROTECTED
          </span>
        </div>
      )}
    </div>
  );
};
