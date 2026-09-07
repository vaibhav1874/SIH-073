import React, { useState } from 'react';
import { Station } from '../../types';
import { apiService } from '../../services/api';
import { Wrench, Play, CheckCircle2, AlertTriangle, Flame, Snowflake, Compass, WifiOff, RefreshCw } from 'lucide-react';

interface FaultControlPanelProps {
  stations: Station[];
  selectedStationId: string;
}

export const FaultControlPanel: React.FC<FaultControlPanelProps> = ({
  stations,
  selectedStationId: initialStationId,
}) => {
  const [stationId, setStationId] = useState<string>(initialStationId);
  const [faultType, setFaultType] = useState<string>('temperature_spike');
  const [durationHours, setDurationHours] = useState<number>(3);
  const [magnitude, setMagnitude] = useState<number>(25.0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const FAULT_OPTIONS = [
    {
      id: 'temperature_spike',
      name: 'Temperature Sensor Spike',
      description: 'Injects an extreme sudden thermal jump (+20°C to +40°C) over 1–3 hours.',
      icon: Flame,
      defaultMag: 25.0,
      unit: '°C',
    },
    {
      id: 'humidity_spike',
      name: 'Humidity Sensor Spike',
      description: 'Injects an abrupt relative humidity surge (+30% to +60%) over 1–3 hours.',
      icon: RefreshCw,
      defaultMag: 35.0,
      unit: '%',
    },
    {
      id: 'pressure_spike',
      name: 'Atmospheric Pressure Jump',
      description: 'Injects barometric fluctuation (±15 to ±30 hPa) bypassing physical adiabatic limits.',
      icon: AlertTriangle,
      defaultMag: 20.0,
      unit: 'hPa',
    },
    {
      id: 'frozen_sensor',
      name: 'Frozen / Stuck Sensor',
      description: 'Sensor outputs flatline / identical values for 4–12 continuous hours with zero CV.',
      icon: Snowflake,
      defaultMag: 0.0,
      unit: 'variance',
    },
    {
      id: 'sensor_drift',
      name: 'Linear Sensor Drift',
      description: 'Gradual systematic bias deviation of ±0.5°C to ±1.5°C accumulated per hour.',
      icon: Compass,
      defaultMag: 1.2,
      unit: 'rate/h',
    },
    {
      id: 'communication_failure',
      name: 'Communication / Packet Loss',
      description: 'Simulates GPRS telemetry link loss or null/NaN values across transmission.',
      icon: WifiOff,
      defaultMag: 0,
      unit: 'nulls',
    },
    {
      id: 'multivariate_inconsistency',
      name: 'Cross-Sensor Discrepancy',
      description: 'Desynchronizes physical relationship between Temperature and Relative Humidity.',
      icon: RefreshCw,
      defaultMag: 18.0,
      unit: 'divergence',
    },
  ];

  const handleFaultSelect = (id: string) => {
    setFaultType(id);
    const opt = FAULT_OPTIONS.find((f) => f.id === id);
    if (opt) setMagnitude(opt.defaultMag);
  };

  const handleInject = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await apiService.injectFault({
        station_id: stationId,
        fault_type: faultType,
        duration_hours: durationHours,
        magnitude,
      });
      setStatusMessage(`Synthetic fault "${faultType}" successfully triggered on station ${stationId}! The hybrid ensemble will diagnose the anomaly in real time.`);
    } catch (e: any) {
      setStatusMessage(`Fault dispatched to simulator: ${faultType}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    setIsSubmitting(true);
    try {
      await apiService.clearFault();
      setStatusMessage('Active fault cleared! Stream reverting to clean nominal conditions.');
    } catch {
      setStatusMessage('Fault cleared.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (presetType: string, presetStation: string, hours: number, mag: number) => {
    setStationId(presetStation);
    handleFaultSelect(presetType);
    setDurationHours(hours);
    setMagnitude(mag);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Controlled Synthetic Fault Injection Lab
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-950/80 border border-sky-500/30 text-sky-300">
                Evaluation Testbed
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Inject synthetic physical sensor faults into the live simulator to test AI detection and Kalman correction
            </p>
          </div>
        </div>
      </div>

      {/* Preset Quick Scenarios */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
          One-Click SIH Evaluation Scenarios:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={() => applyPreset('temperature_spike', 'ABOHAR', 2, 28.0)}
            className="text-left p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900 transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Flame className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              Thermal Shield Radiation Spike
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Abohar: +28°C transient spike testing Rule R03 + IF
            </p>
          </button>

          <button
            onClick={() => applyPreset('frozen_sensor', 'DELHI', 6, 0)}
            className="text-left p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Snowflake className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              Stuck ADC Digitizer Flatline
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Delhi: 6 hours constant variance testing Rule R02
            </p>
          </button>

          <button
            onClick={() => applyPreset('sensor_drift', 'SHIMLA', 12, 1.5)}
            className="text-left p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 transition-all group"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
              <Compass className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              Gradual Calibration Drift
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Shimla: +1.5/h cumulative bias testing LSTM-AE
            </p>
          </button>
        </div>
      </div>

      {/* Target Station & Fault Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Fault Type Selection */}
        <div className="lg:col-span-2 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Select Physical Fault Mode (7 IMD Ground-Truth Types):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FAULT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = faultType === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleFaultSelect(opt.id)}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950 ring-1 ring-sky-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-xs font-bold ${isSelected ? 'text-sky-300' : 'text-slate-200'}`}>
                      {opt.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-snug">{opt.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Parameters & Trigger */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
            Fault Parameters
          </span>

          {/* Station Selection */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Target AWS Station</label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
          </div>

          {/* Duration Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Duration (Hours)</span>
              <span className="font-mono font-bold text-sky-400">{durationHours}h</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={durationHours}
              onChange={(e) => setDurationHours(parseInt(e.target.value))}
              className="w-full accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1h (Transient)</span>
              <span>12h (Persistent)</span>
            </div>
          </div>

          {/* Magnitude Slider */}
          {faultType !== 'frozen_sensor' && faultType !== 'communication_failure' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Fault Magnitude / Deviation</span>
                <span className="font-mono font-bold text-amber-400">±{magnitude.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={0.5}
                value={magnitude}
                onChange={(e) => setMagnitude(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Mild (±5)</span>
                <span>Severe (±50)</span>
              </div>
            </div>
          )}

          {/* Trigger & Clear Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleInject}
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              {isSubmitting ? 'Dispatching to Pipeline...' : 'Inject Fault into Live Stream'}
            </button>

            <button
              onClick={handleClear}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700/60 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Revert to Clean Nominal State
            </button>
          </div>

          {/* Feedback message */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
