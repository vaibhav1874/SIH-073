import React, { useState } from 'react';
import { AnomalyAlert } from '../../types';
import { ShieldAlert, CheckCircle2, Download, Filter, Search, Clock, ExternalLink } from 'lucide-react';
import { apiService } from '../../services/api';

interface AlertLogTableProps {
  alerts: AnomalyAlert[];
  onAlertAcknowledged: () => void;
}

export const AlertLogTable: React.FC<AlertLogTableProps> = ({ alerts, onAlertAcknowledged }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const filteredAlerts = alerts.filter((a) => {
    const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
    const matchesSearch =
      a.station_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.root_cause.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.explanation.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const handleAcknowledge = async (alertId: number) => {
    await apiService.acknowledgeAlert(alertId, 'Duty Meteorologist (IMD HQ)');
    onAlertAcknowledged();
  };

  const exportCSV = () => {
    setIsExporting(true);
    const headers = 'ID,Station,Timestamp,Root Cause,Severity,Ensemble Score,Explanation,Recommended Action,Status\n';
    const rows = filteredAlerts
      .map(
        (a) =>
          `"${a.id}","${a.station_id}","${a.timestamp}","${a.root_cause}","${a.severity}","${a.ensemble_score}","${a.explanation.replace(/"/g, '""')}","${a.recommended_action.replace(/"/g, '""')}","${a.is_acknowledged ? 'Acknowledged' : 'Pending'}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `skyguard_anomaly_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExporting(false);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'medium':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-5">
      {/* Title & Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Anomaly Alert & Triage Center
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {filteredAlerts.length} Events
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              IMD operational ticket dispatch and automated fault resolution log
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search station, cause..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Severities</option>
              <option value="critical" className="bg-slate-900">Critical</option>
              <option value="high" className="bg-slate-900">High</option>
              <option value="medium" className="bg-slate-900">Medium</option>
              <option value="low" className="bg-slate-900">Low</option>
            </select>
          </div>

          {/* CSV Export Button */}
          <button
            onClick={exportCSV}
            disabled={isExporting}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shadow-sm shadow-sky-600/30"
          >
            <Download className="w-3.5 h-3.5" />
            Export Log
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Station</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Diagnosis (Root Cause)</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">AI Score</th>
              <th className="py-3 px-4">Recommended Action</th>
              <th className="py-3 px-4 text-center">Status / Triage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                  No anomaly alerts found matching the current filters.
                </td>
              </tr>
            ) : (
              filteredAlerts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-sky-400">
                    {a.station_id}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    {new Date(a.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-200 block">
                      {a.root_cause.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-400 line-clamp-1">
                      {a.explanation}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold border ${getSeverityBadge(a.severity)}`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                    {a.ensemble_score.toFixed(1)}/100
                  </td>
                  <td className="py-3.5 px-4 text-slate-300 max-w-xs">
                    <div className="flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-[11px]">{a.recommended_action}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {a.is_acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Ack by {a.acknowledged_by || 'Officer'}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3 py-1 rounded-lg transition-all"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
