import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTelemetryPayload, ReadingHistoryItem } from '../types';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'simulated';

export interface UseTelemetryStreamReturn {
  connectionStatus: ConnectionStatus;
  latestTelemetry: LiveTelemetryPayload['data'] | null;
  currentStationId: string;
  telemetryHistory: ReadingHistoryItem[];
  activeAlert: LiveTelemetryPayload['data'] | null;
  clearAlert: () => void;
  reconnect: () => void;
  sendWsMessage: (msg: any) => void;
}

export function useTelemetryStream(selectedStationId = 'ABOHAR'): UseTelemetryStreamReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [latestTelemetry, setLatestTelemetry] = useState<LiveTelemetryPayload['data'] | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<ReadingHistoryItem[]>([]);
  const [activeAlert, setActiveAlert] = useState<LiveTelemetryPayload['data'] | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const simulationIntervalRef = useRef<any>(null);
  const simStepRef = useRef<number>(0);

  // Fallback simulator generator when backend WS is unavailable
  const generateSimulatedReading = useCallback((stationId: string): LiveTelemetryPayload['data'] => {
    simStepRef.current += 1;
    const step = simStepRef.current;
    
    // Natural diuranal wave
    const hourOfDay = (step % 24);
    const baseTemp = 27 + Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) * 7;
    const baseHum = 65 - Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI) * 18;
    const basePres = 1010 + Math.cos((hourOfDay / 24) * 2 * Math.PI) * 3;
    
    // Random noise
    const tempNoise = (Math.random() - 0.5) * 0.4;
    const humNoise = (Math.random() - 0.5) * 0.8;
    const presNoise = (Math.random() - 0.5) * 0.2;
    
    const temp = parseFloat((baseTemp + tempNoise).toFixed(2));
    const hum = parseFloat(Math.min(99, Math.max(15, baseHum + humNoise)).toFixed(2));
    const pres = parseFloat((basePres + presNoise).toFixed(2));

    // Periodic demonstration anomaly every 25 steps
    const isAnomalyTick = step > 0 && step % 25 === 0;

    const ensembleScore = isAnomalyTick ? 89.4 : parseFloat((10 + Math.random() * 8).toFixed(1));
    const isAnomaly = isAnomalyTick;
    const rootCause = isAnomalyTick ? 'temperature_spike' : 'normal';
    const severity = isAnomalyTick ? 'high' : 'low';
    const affected = isAnomalyTick ? ['temperature'] : [];

    const actualTemp = isAnomalyTick ? temp + 16.5 : temp;

    return {
      temperature: actualTemp,
      humidity: hum,
      pressure: pres,
      is_anomaly: isAnomaly,
      ensemble_score: ensembleScore,
      root_cause: rootCause,
      severity,
      affected_sensors: affected,
      corrected: {
        temperature: temp,
        humidity: hum,
        pressure: pres,
      },
      model_breakdown: {
        rule_engine: { violation: isAnomaly, score: isAnomaly ? 85 : 5, rules: [] },
        isolation_forest: { flag: isAnomaly, score: isAnomaly ? -0.68 : 0.25 },
        lstm_autoencoder: { flag: isAnomaly, score: isAnomaly ? 0.92 : 0.04 },
        ensemble_weights: { rules: 0.35, isolation_forest: 0.35, lstm: 0.30 },
      },
      explanation: {
        summary: isAnomaly ? `Thermal spike of +16.5°C over baseline detected at ${stationId}.` : 'All 3 sensors within normal physical limits.',
        root_cause: rootCause,
        diagnostic_rationale: isAnomaly 
          ? 'Abrupt rate-of-change violation (ΔT = +16.5°C) without physical co-variation in relative humidity or atmospheric pressure.' 
          : 'Continuous readings exhibit high multivariate cross-correlation and temporal stability.',
        evidence_points: isAnomaly 
          ? ['ΔT exceeds 4.5σ rolling historical window', 'No precipitation or front-passage pressure drop detected', 'Isolation Forest and LSTM AE consensus > 85%']
          : ['All sensor readings within IMD climatological thresholds', 'Zero stuck values or drift tendencies observed'],
        key_factors: { temp_delta_1h: isAnomaly ? 16.5 : 0.3, z_score: isAnomaly ? 4.8 : 0.2 },
      },
      health: {
        station_id: stationId,
        overall_score: isAnomaly ? 82 : 96,
        station_status: isAnomaly ? 'WARNING' : 'HEALTHY',
        sensor_scores: {
          temperature: { score: isAnomaly ? 74 : 96, status: isAnomaly ? 'WARNING' : 'HEALTHY' },
          humidity: { score: 94, status: 'HEALTHY' },
          pressure: { score: 98, status: 'HEALTHY' },
          communication: { score: 99, status: 'HEALTHY' },
        },
      },
      protocol: {
        title: isAnomaly ? 'SOP-IMD-AWS-T01: Sensor Verification Protocol' : 'Standard Routine Monitoring',
        action: isAnomaly ? 'Verify solar radiation shield fan operation and dispatch AWS field technician.' : 'Continue automated 15-minute telemetry polling.',
        sla_hours: isAnomaly ? 4 : 48,
        badge_color: isAnomaly ? 'red' : 'emerald',
      },
      latency_ms: 12.4,
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    clearInterval(simulationIntervalRef.current);
    clearTimeout(reconnectTimeoutRef.current);

    setConnectionStatus('connecting');

    // Determine WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/telemetry`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus('connected');
        clearInterval(simulationIntervalRef.current);
      };

      socket.onmessage = (event) => {
        try {
          const payload: LiveTelemetryPayload = JSON.parse(event.data);
          if (payload.type === 'TELEMETRY_UPDATE' && payload.data) {
            const data = payload.data;
            setLatestTelemetry(data);

            if (data.is_anomaly) {
              setActiveAlert(data);
            }

            // Append to rolling history
            const historyItem: ReadingHistoryItem = {
              id: Date.now(),
              timestamp: payload.timestamp || new Date().toISOString(),
              temperature: data.temperature,
              humidity: data.humidity,
              pressure: data.pressure,
              is_anomaly: data.is_anomaly,
              ensemble_score: data.ensemble_score,
              root_cause: data.root_cause,
              severity: data.severity,
              corrected_temperature: data.corrected?.temperature,
              corrected_humidity: data.corrected?.humidity,
              corrected_pressure: data.corrected?.pressure,
            };

            setTelemetryHistory((prev) => {
              const updated = [...prev, historyItem];
              return updated.slice(-40); // keep last 40 observations
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        setConnectionStatus('simulated');
        startFallbackSimulation();
        // Try reconnecting in 8 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 8000);
      };
    } catch {
      setConnectionStatus('simulated');
      startFallbackSimulation();
    }
  }, [selectedStationId, generateSimulatedReading]);

  const startFallbackSimulation = useCallback(() => {
    clearInterval(simulationIntervalRef.current);
    
    // Initial batch if empty
    if (telemetryHistory.length === 0) {
      const initialHistory: ReadingHistoryItem[] = [];
      for (let i = 25; i >= 0; i--) {
        const dummy = generateSimulatedReading(selectedStationId);
        initialHistory.push({
          id: Date.now() - i * 3000,
          timestamp: new Date(Date.now() - i * 3000).toISOString(),
          temperature: dummy.temperature,
          humidity: dummy.humidity,
          pressure: dummy.pressure,
          is_anomaly: dummy.is_anomaly,
          ensemble_score: dummy.ensemble_score,
          root_cause: dummy.root_cause,
          severity: dummy.severity,
          corrected_temperature: dummy.corrected?.temperature,
          corrected_humidity: dummy.corrected?.humidity,
          corrected_pressure: dummy.corrected?.pressure,
        });
      }
      setTelemetryHistory(initialHistory);
    }

    simulationIntervalRef.current = setInterval(() => {
      const reading = generateSimulatedReading(selectedStationId);
      setLatestTelemetry(reading);

      if (reading.is_anomaly) {
        setActiveAlert(reading);
      }

      setTelemetryHistory((prev) => {
        const item: ReadingHistoryItem = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          temperature: reading.temperature,
          humidity: reading.humidity,
          pressure: reading.pressure,
          is_anomaly: reading.is_anomaly,
          ensemble_score: reading.ensemble_score,
          root_cause: reading.root_cause,
          severity: reading.severity,
          corrected_temperature: reading.corrected?.temperature,
          corrected_humidity: reading.corrected?.humidity,
          corrected_pressure: reading.corrected?.pressure,
        };
        return [...prev, item].slice(-40);
      });
    }, 2800);
  }, [selectedStationId, generateSimulatedReading, telemetryHistory.length]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimeoutRef.current);
      clearInterval(simulationIntervalRef.current);
    };
  }, [connectWebSocket]);

  const clearAlert = () => setActiveAlert(null);

  const sendWsMessage = (msg: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  };

  return {
    connectionStatus,
    latestTelemetry,
    currentStationId: selectedStationId,
    telemetryHistory,
    activeAlert,
    clearAlert,
    reconnect: connectWebSocket,
    sendWsMessage,
  };
}
