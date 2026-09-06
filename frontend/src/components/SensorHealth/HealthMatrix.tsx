import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, AlertOctagon, TrendingDown, Radio } from 'lucide-react';
import { HealthSummary } from '../../types';

interface HealthMatrixProps {
  health: HealthSummary | null;
  stationName?: string;
}

export const HealthMatrix: React.FC<HealthMatrixProps> = ({ health, stationName }) => {
  if (!health) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 animate-pulse h-64" />
    );
  }

  const overall = health.overall_score;
  const sensors = health.sensor_scores;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getBarGradient = (score: number) => {
    if (score >= 80) return 'bg-gradient-to-r from-emerald-500 to-teal-400';
    if (score >= 50) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
    return 'bg-gradient-to-r from-rose-600 to-rose-400';
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Sensor Health Matrix
              <span className="text-[10px] font-mono text-slate-400">
                24h Sliding Window
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Station {health.station_id} {stationName ? `(${stationName})` : ''}
            </p>
          </div>
        </div>

        {/* Overall Health Pill */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${getScoreColor(overall)}`}>
            {overall >= 80 ? 'HEALTHY' : overall >= 50 ? 'DEGRADED' : 'CRITICAL'} • {overall}/100
          </span>
        </div>
      </div>

      {/* Sensor Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Temperature Sensor Health */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Temperature RTD</span>
            <span className="font-mono font-bold text-slate-200">{sensors.temperature.score}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarGradient(sensors.temperature.score)}`}
              style={{ width: `${sensors.temperature.score}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Status</span>
            <span className={sensors.temperature.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
              {sensors.temperature.status}
            </span>
          </div>
        </div>

        {/* Humidity Sensor Health */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">RH Capacitive</span>
            <span className="font-mono font-bold text-slate-200">{sensors.humidity.score}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarGradient(sensors.humidity.score)}`}
              style={{ width: `${sensors.humidity.score}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Status</span>
            <span className={sensors.humidity.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
              {sensors.humidity.status}
            </span>
          </div>
        </div>

        {/* Pressure Sensor Health */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Pressure Baro</span>
            <span className="font-mono font-bold text-slate-200">{sensors.pressure.score}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarGradient(sensors.pressure.score)}`}
              style={{ width: `${sensors.pressure.score}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Status</span>
            <span className={sensors.pressure.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
              {sensors.pressure.status}
            </span>
          </div>
        </div>

        {/* Telemetry Modem / Comm Health */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">GPRS Modem / Comm</span>
            <span className="font-mono font-bold text-slate-200">{sensors.communication.score}/100</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarGradient(sensors.communication.score)}`}
              style={{ width: `${sensors.communication.score}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Uptime</span>
            <span className="text-emerald-400">99.8% Nominal</span>
          </div>
        </div>
      </div>
    </div>
  );
};
