import React from 'react';
import { ShieldAlert, X, AlertTriangle, ArrowUpRight, Clock, CheckCircle2 } from 'lucide-react';
import { LiveTelemetryPayload } from '../../types';

interface AlertToastProps {
  alert: LiveTelemetryPayload['data'] | null;
  onDismiss: () => void;
}

export const AlertToast: React.FC<AlertToastProps> = ({ alert, onDismiss }) => {
  if (!alert || !alert.is_anomaly) return null;

  const formatCause = (rc: string) =>
    rc
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-bounce-short">
      <div className="bg-slate-900 border-2 border-rose-500/80 rounded-2xl shadow-2xl shadow-rose-950/80 overflow-hidden backdrop-blur-2xl">
        {/* Top Crimson Banner */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-2.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <ShieldAlert className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono">
              CRITICAL ANOMALY ALERT
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg hover:bg-rose-800 transition-colors text-rose-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-100">
              {formatCause(alert.root_cause)}
            </span>
            <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/30">
              Score: {alert.ensemble_score.toFixed(1)}/100
            </span>
          </div>

          <p className="text-xs text-slate-300">
            {alert.explanation?.summary || 'Sensor observation diverges significantly from normal physical bounds.'}
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Observed Value</span>
              <span className="text-rose-400 font-bold">
                {alert.root_cause.includes('temp')
                  ? `${alert.temperature.toFixed(2)} °C`
                  : alert.root_cause.includes('hum')
                  ? `${alert.humidity.toFixed(2)} %`
                  : `${alert.pressure.toFixed(2)} hPa`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Kalman Expected</span>
              <span className="text-sky-400 font-bold">
                {alert.root_cause.includes('temp')
                  ? `${alert.corrected?.temperature?.toFixed(2) ?? alert.temperature.toFixed(2)} °C`
                  : alert.root_cause.includes('hum')
                  ? `${alert.corrected?.humidity?.toFixed(2) ?? alert.humidity.toFixed(2)} %`
                  : `${alert.corrected?.pressure?.toFixed(2) ?? alert.pressure.toFixed(2)} hPa`}
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>SLA: {alert.protocol?.sla_hours ?? 4} Hours</span>
            </div>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-rose-600/30"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Acknowledge & Triage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
