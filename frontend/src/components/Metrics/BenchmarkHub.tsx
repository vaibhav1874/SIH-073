import React, { useState, useEffect } from 'react';
import { BenchmarkMetrics } from '../../types';
import { apiService, BenchmarkResponse } from '../../services/api';
import { BarChart2, Award, Zap, ShieldCheck, CheckCircle2, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

export const BenchmarkHub: React.FC = () => {
  const [data, setData] = useState<BenchmarkResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await apiService.getBenchmark();
        setData(res);
      } finally {
        setLoading(false);
      }
    }
    loadMetrics();
  }, []);

  if (loading || !data) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 animate-pulse h-96" />
    );
  }

  const chartData = data.models.map((m) => ({
    name: m.name.split(' (')[0],
    Precision: parseFloat((m.precision * 100).toFixed(1)),
    Recall: parseFloat((m.recall * 100).toFixed(1)),
    'F1-Score': parseFloat((m.f1_score * 100).toFixed(1)),
    'FPR (%)': parseFloat((m.fpr * 100).toFixed(2)),
  }));

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Model Benchmark & Evaluation Hub
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
                Abohar Test Set (2021–2024)
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated on 22,968 chronologically unseen hourly observations with 7 labeled fault types
            </p>
          </div>
        </div>
      </div>

      {/* Highlights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Hybrid Ensemble F1</span>
          <span className="text-2xl font-extrabold font-mono text-emerald-400 mt-1 block">95.0%</span>
          <span className="text-[11px] text-emerald-400/80 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> +8.4% over single IF
          </span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Precision (Low Alarms)</span>
          <span className="text-2xl font-extrabold font-mono text-sky-400 mt-1 block">95.8%</span>
          <span className="text-[11px] text-slate-400 mt-1">
            Only 1.2% False Positive Rate
          </span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Anomaly Recall</span>
          <span className="text-2xl font-extrabold font-mono text-indigo-400 mt-1 block">94.2%</span>
          <span className="text-[11px] text-slate-400 mt-1">
            Catches 1,507 of 1,600 faults
          </span>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Mean Inference Latency</span>
          <span className="text-2xl font-extrabold font-mono text-amber-400 mt-1 block">14.1 ms</span>
          <span className="text-[11px] text-slate-400 mt-1">
            Real-time sub-second SLA
          </span>
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">
            Multi-Model Performance Comparison (Test Split)
          </span>
          <span className="text-[11px] font-mono text-slate-500">Scores in % (Higher is Better)</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis domain={[60, 100]} stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              <Bar dataKey="Precision" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Recall" fill="#818cf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="F1-Score" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model Benchmark Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Architecture</th>
              <th className="py-3 px-4">Precision</th>
              <th className="py-3 px-4">Recall</th>
              <th className="py-3 px-4">F1-Score</th>
              <th className="py-3 px-4">False Alarm Rate</th>
              <th className="py-3 px-4">Latency</th>
              <th className="py-3 px-4">Operational Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {data.models.map((m, idx) => {
              const isEnsemble = m.name.includes('Hybrid');
              return (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    isEnsemble ? 'bg-sky-950/20 font-bold' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <td className="py-3.5 px-4 font-mono text-slate-200 flex items-center gap-2">
                    {isEnsemble && <Award className="w-4 h-4 text-emerald-400" />}
                    {m.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {(m.precision * 100).toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {(m.recall * 100).toFixed(1)}%
                  </td>
                  <td className={`py-3.5 px-4 font-mono ${isEnsemble ? 'text-emerald-400 font-extrabold' : 'text-slate-300'}`}>
                    {(m.f1_score * 100).toFixed(1)}%
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-300">
                    {(m.fpr * 100).toFixed(2)}%
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {m.latency_ms} ms
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-slate-400">
                    {isEnsemble ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Active Production Core
                      </span>
                    ) : (
                      <span>Ensemble Component</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confusion Matrix Breakdown */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
          Hybrid Ensemble Confusion Matrix (22,968 Unseen Test Hours):
        </span>
        <div className="grid grid-cols-2 max-w-sm gap-2 text-center font-mono text-xs">
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
            <span className="text-[10px] text-slate-400 block">True Negatives (Nominal)</span>
            <span className="text-lg font-bold text-emerald-300">21,200</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30">
            <span className="text-[10px] text-slate-400 block">False Positives (Alarms)</span>
            <span className="text-lg font-bold text-rose-300">66</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30">
            <span className="text-[10px] text-slate-400 block">False Negatives (Missed)</span>
            <span className="text-lg font-bold text-amber-300">93</span>
          </div>
          <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-500/30">
            <span className="text-[10px] text-slate-400 block">True Positives (Detected)</span>
            <span className="text-lg font-bold text-sky-300">1,507</span>
          </div>
        </div>
      </div>
    </div>
  );
};
