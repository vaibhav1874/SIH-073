import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ReadingHistoryItem } from '../../types';
import { Activity } from 'lucide-react';

interface TelemetryChartsProps {
  history: ReadingHistoryItem[];
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ history }) => {
  const [selectedSensor, setSelectedSensor] = useState<'all' | 'temp' | 'hum' | 'pres'>('all');
  
  const chartData = history.map((item) => {
    const d = new Date(item.timestamp);
    const timeStr = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const fullTimeStr = `${dateStr} ${timeStr}`;

    return {
      ...item,
      timeStr,
      fullTimeStr,
      temp: item.temperature,
      tempCorr: item.corrected_temperature ?? item.temperature,
      hum: item.humidity,
      humCorr: item.corrected_humidity ?? item.humidity,
      pres: item.pressure,
      presCorr: item.corrected_pressure ?? item.pressure,
      anomalyScore: item.ensemble_score,
    };
  });

  return (
    <div className="bg-[#1c1f2b] border border-[#282c3c] rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#262a38] gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
              Observational Telemetry Stream
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#161822] border border-[#282c3c] text-slate-300">
                Rolling 40 Buffer
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Direct sensor signals vs Kalman expected state-space baseline
            </p>
          </div>
        </div>

        <div className="flex items-center bg-[#161822] p-1 rounded-xl border border-[#282c3c] text-xs">
          <button
            onClick={() => setSelectedSensor('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedSensor === 'all'
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Channels
          </button>
          <button
            onClick={() => setSelectedSensor('temp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedSensor === 'temp'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Temp (°C)
          </button>
          <button
            onClick={() => setSelectedSensor('hum')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedSensor === 'hum'
                ? 'bg-blue-500/10 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RH (%)
          </button>
          <button
            onClick={() => setSelectedSensor('pres')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedSensor === 'pres'
                ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pressure (hPa)
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-6">
        {(selectedSensor === 'all' || selectedSensor === 'temp') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Temperature Sensor (Raw vs Kalman Corrected)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Unit: °C</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTempCorr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222634" />
                  <XAxis dataKey="timeStr" stroke="#475569" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                  <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    labelFormatter={(_val, p) => p?.[0]?.payload?.fullTimeStr || _val}
                    contentStyle={{ backgroundColor: '#161822', borderColor: '#2d3245', borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Area
                    type="monotone"
                    dataKey="temp"
                    name="Observed Raw"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTemp)"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.is_anomaly && (payload.affected_sensors?.includes('temperature') || payload.root_cause?.includes('temperature'))) {
                        return (
                          <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} key={props.key} />
                        );
                      }
                      return <circle cx={cx} cy={cy} r={2} fill="#06b6d4" key={props.key} />;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tempCorr"
                    name="Kalman Expected"
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorTempCorr)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {(selectedSensor === 'all' || selectedSensor === 'hum') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Relative Humidity (Raw vs Kalman Corrected)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Unit: %</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222634" />
                  <XAxis dataKey="timeStr" stroke="#475569" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                  <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    labelFormatter={(_val, p) => p?.[0]?.payload?.fullTimeStr || _val}
                    contentStyle={{ backgroundColor: '#161822', borderColor: '#2d3245', borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Area
                    type="monotone"
                    dataKey="hum"
                    name="Observed Raw"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorHum)"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.is_anomaly && (payload.affected_sensors?.includes('humidity') || payload.root_cause?.includes('humidity'))) {
                        return (
                          <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} key={props.key} />
                        );
                      }
                      return <circle cx={cx} cy={cy} r={2} fill="#3b82f6" key={props.key} />;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="humCorr"
                    name="Kalman Expected"
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    fillOpacity={0}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {(selectedSensor === 'all' || selectedSensor === 'pres') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Surface Pressure (Raw vs Kalman Corrected)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Unit: hPa</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorPres" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222634" />
                  <XAxis dataKey="timeStr" stroke="#475569" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                  <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    labelFormatter={(_val, p) => p?.[0]?.payload?.fullTimeStr || _val}
                    contentStyle={{ backgroundColor: '#161822', borderColor: '#2d3245', borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Area
                    type="monotone"
                    dataKey="pres"
                    name="Observed Raw"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPres)"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.is_anomaly && (payload.affected_sensors?.includes('pressure') || payload.root_cause?.includes('pressure'))) {
                        return (
                          <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} key={props.key} />
                        );
                      }
                      return <circle cx={cx} cy={cy} r={2} fill="#818cf8" key={props.key} />;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="presCorr"
                    name="Kalman Expected"
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    fillOpacity={0}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
