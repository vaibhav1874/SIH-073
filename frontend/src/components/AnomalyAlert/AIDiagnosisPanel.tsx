import React from 'react';
import { Cpu, CheckCircle2, AlertOctagon, HelpCircle, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { LiveTelemetryPayload } from '../../types';

interface AIDiagnosisPanelProps {
  telemetry: LiveTelemetryPayload['data'] | null;
}

export const AIDiagnosisPanel: React.FC<AIDiagnosisPanelProps> = ({ telemetry }) => {
  if (!telemetry) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 animate-pulse h-80" />
    );
  }

  const rawScore = telemetry.ensemble_score ?? 0;
  const ensembleScore = rawScore <= 1.0 ? rawScore * 100 : rawScore;
  const isAnomaly = telemetry.is_anomaly;
  const breakdown = telemetry.model_breakdown;
  const explanation = telemetry.explanation;
  const protocol = telemetry.protocol;

  // Format Root Cause label
  const formatRootCause = (rc: string) => {
    return rc
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Hybrid AI Inference Engine
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                Triple-Arm Ensemble
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Rule Engine (35%) • Isolation Forest (35%) • PyTorch LSTM-AE (30%)
            </p>
          </div>
        </div>

        {/* Root Cause Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono font-bold uppercase px-3 py-1 rounded-full border ${getSeverityBadge(
              telemetry.severity
            )}`}
          >
            {formatRootCause(telemetry.root_cause || 'nominal')}
          </span>
        </div>
      </div>

      {/* Ensemble Score Meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Ensemble Anomaly Probability</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-extrabold text-slate-100">
              {ensembleScore.toFixed(1)}
              <span className="text-xs text-slate-400">/100</span>
            </span>
            <span
              className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                isAnomaly ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {isAnomaly ? 'Threshold Breached (≥55)' : 'Nominal Band'}
            </span>
          </div>
        </div>

        {/* Progress bar with threshold indicator */}
        <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isAnomaly
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600'
                : 'bg-gradient-to-r from-sky-500 to-emerald-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, ensembleScore))}%` }}
          />
          {/* Threshold marker at 55% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-400/80 z-10"
            style={{ left: '55%' }}
            title="Anomaly Threshold: 55"
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0 (Pure Normal)</span>
          <span className="text-rose-400">▲ Threshold (55)</span>
          <span>100 (Critical Fault)</span>
        </div>
      </div>

      {/* 3-Arm Consensus Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Arm 1: Rule Engine */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">1. Domain Rules</span>
            <span className="text-[10px] font-mono text-slate-500">Weight: 35%</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-slate-200">
              Score: {breakdown?.rule_engine?.score ?? 0}
            </span>
            {breakdown?.rule_engine?.violation ? (
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                VIOLATED
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                PASSED
              </span>
            )}
          </div>
        </div>

        {/* Arm 2: Isolation Forest */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">2. Isolation Forest</span>
            <span className="text-[10px] font-mono text-slate-500">Weight: 35%</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-slate-200">
              Score: {breakdown?.isolation_forest?.score?.toFixed(2) ?? '0.00'}
            </span>
            {breakdown?.isolation_forest?.flag ? (
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                OUTLIER
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                INLIER
              </span>
            )}
          </div>
        </div>

        {/* Arm 3: LSTM Autoencoder */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400">3. PyTorch LSTM-AE</span>
            <span className="text-[10px] font-mono text-slate-500">Weight: 30%</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-slate-200">
              MSE: {breakdown?.lstm_autoencoder?.score?.toFixed(3) ?? '0.000'}
            </span>
            {breakdown?.lstm_autoencoder?.flag ? (
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                RECON ERR
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                CONVERGED
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SHAP Diagnostic Rationale & Evidence */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            SHAP Diagnostic Rationale
          </span>
          <span className="text-[10px] font-mono text-slate-500">Latency: {telemetry.latency_ms ?? 14}ms</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {explanation?.diagnostic_rationale || explanation?.summary || 'Observational vectors confirm normal environmental variations.'}
        </p>

        {explanation?.evidence_points && explanation.evidence_points.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Inference Evidence Points:
            </span>
            <ul className="space-y-1">
              {explanation.evidence_points.map((pt, idx) => (
                <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                  <span className="text-sky-400 mt-0.5">•</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* IMD Standard Operating Procedure Protocol Action */}
      {protocol && (
        <div className="bg-slate-950/90 border border-sky-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              {protocol.title}
            </span>
            <p className="text-xs text-slate-300">{protocol.action}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Response SLA:</span>
            <span className="text-amber-300 font-bold">{protocol.sla_hours}h</span>
          </div>
        </div>
      )}
    </div>
  );
};
