import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { ReadingHistoryItem } from '../../types';
import { SlidersHorizontal, Activity } from 'lucide-react';

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
    <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-md bg-slate-800 border border-slate-700 text-sky-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
              Observational Telemetry Stream
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                Rolling 40 Buffer
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Direct sensor signals vs Kalman expected state-space baseline
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-900 p-1 rounded-md border border-slate-800 text-xs">
          <button
            onClick={() => setSelectedSensor('all')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              selectedSensor === 'all' ? 'bg-slate-800 text-white border border-slate-700 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Channels
          </button>
          <button
            onClick={() => setSelectedSensor('temp')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              selectedSensor === 'temp' ? 'bg-slate-800 text-amber-300 border border-slate-700 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Temp (°C)
          </button>
          <button
            onClick={() => setSelectedSensor('hum')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              selectedSensor === 'hum' ? 'bg-slate-800 text-sky-300 border border-slate-700 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RH (%)
          </button>
          <button
            onClick={() => setSelectedSensor('pres')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              selectedSensor === 'pres' ? 'bg-slate-800 text-indigo-300 border border-slate-700 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pressure (hPa)
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {(selectedSensor === 'all' || selectedSensor === 'temp') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Temperature Sensor (Raw vs Kalman Corrected)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Unit: °C</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(_val, p) => p?.[0]?.payload?.fullTimeStr || _val}
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line
                    type="monotone"
                    dataKey="temp"
                    name="Observed Raw"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.is_anomaly && (payload.affected_sensors?.includes('temperature') || payload.root_cause?.includes('temperature'))) {
                        return (
                          <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} key={props.key} />
                        );
                      }
                      return <circle cx={cx} cy={cy} r={2} fill="#f59e0b" key={props.key} />;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="tempCorr"
                    name="Kalman Expected"
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {(selectedSensor === 'all' || selectedSensor === 'hum') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Relative Humidity (Raw vs Kalman Corrected)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Unit: %</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(_val, p) => p?.[0]?.payload?.fullTimeStr || _val}
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line
                    type="monotone"
                    dataKey="hum"
                    name="Observed Raw"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.is_anomaly && (payload.affected_sensors?.includes('humidity') || payload.root_cause?.includes('humidity'))) {
                        return (
                          <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} key={props.key} />
                        );
                      }
                      return <circle cx={cx} cy={cy} r={2} fill="#06b6d4" key={props.key} />;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="humCorr"
                    name="Kalman Expected"
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {(selectedSensor === 'all' || selectedSensor === 'pres') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                Barometric Pressure MSL (Raw vs Kalman Corrected)
              </span>
              <span className="text-[11px] font-mono text-slate-400">Unit: hPa</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timeStr" stroke="#64748b" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={4} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(_val, p) => p?.[0]?.payload?.fullTimeStr || _val}
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line
                    type="monotone"
                    dataKey="pres"
                    name="Observed Raw"
                    stroke="#818cf8"
                    strokeWidth={2}
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
                  <Line
                    type="monotone"
                    dataKey="presCorr"
                    name="Kalman Expected"
                    stroke="#38bdf8"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
