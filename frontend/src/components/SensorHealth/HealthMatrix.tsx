import React from 'react';
import { Activity, Thermometer, Droplets, Gauge, Radio, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
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
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getBarGradient = (score: number) => {
    if (score >= 80) return 'bg-gradient-to-r from-emerald-500 to-teal-400';
    if (score >= 50) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
    return 'bg-gradient-to-r from-rose-600 to-rose-400';
  };

  const sensorList = [
    {
      id: 'temp',
      name: 'Temperature RTD',
      sub: 'PT100 Sensor (2m)',
      score: sensors.temperature.score,
      status: sensors.temperature.status,
      icon: Thermometer,
      accent: 'text-amber-400',
      bgAccent: 'bg-amber-500/10',
    },
    {
      id: 'hum',
      name: 'RH Capacitive',
      sub: 'Thin-Film Polymer (2m)',
      score: sensors.humidity.score,
      status: sensors.humidity.status,
      icon: Droplets,
      accent: 'text-cyan-400',
      bgAccent: 'bg-cyan-500/10',
    },
    {
      id: 'pres',
      name: 'Pressure Baro',
      sub: 'Piezoresistive Barometer',
      score: sensors.pressure.score,
      status: sensors.pressure.status,
      icon: Gauge,
      accent: 'text-indigo-400',
      bgAccent: 'bg-indigo-500/10',
    },
    {
      id: 'comm',
      name: 'GPRS Modem / Comm',
      sub: 'AWS Telemetry Link',
      score: sensors.communication.score,
      status: 'Nominal',
      icon: Radio,
      accent: 'text-sky-400',
      bgAccent: 'bg-sky-500/10',
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Sensor Health Matrix
              <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                24h Window
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {health.station_id} {stationName ? `• ${stationName}` : ''}
            </p>
          </div>
        </div>

        {/* Overall Health Pill */}
        <div className="shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${getScoreColor(overall)}`}>
            {overall >= 80 ? 'HEALTHY' : overall >= 50 ? 'DEGRADED' : 'CRITICAL'} • {overall}/100
          </span>
        </div>
      </div>

      {/* Sensor Breakdown List - Vertical Clean Layout (Eliminates horizontal squishing & overlap) */}
      <div className="space-y-2.5">
        {sensorList.map((item) => {
          const Icon = item.icon;
          const isHealthy = item.score >= 80;
          const isWarning = item.score >= 50 && item.score < 80;

          return (
            <div
              key={item.id}
              className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-3 transition-colors space-y-2"
            >
              {/* Top Row: Icon, Name, and Score */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1.5 rounded-lg ${item.bgAccent} ${item.accent} shrink-0`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-200 block truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {item.sub}
                    </span>
                  </div>
                </div>

                {/* Score & Status Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium ${
                      isHealthy
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : isWarning
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    }`}
                  >
                    {item.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-100">
                    {item.score}<span className="text-[10px] text-slate-500 font-normal">/100</span>
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBarGradient(item.score)}`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
