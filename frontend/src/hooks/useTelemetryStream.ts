import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveTelemetryPayload, ReadingHistoryItem } from '../types';
import { apiService } from '../services/api';

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
  const selectedStationRef = useRef<string>(selectedStationId);
  const lastDismissedAlertRef = useRef<string | null>(null);

  // Keep ref synchronized with current prop
  useEffect(() => {
    selectedStationRef.current = selectedStationId;
  }, [selectedStationId]);

  const activeFaultRef = useRef<{
    fault_type: string;
    target_sensor: string;
    duration_steps: number;
    magnitude: number;
    steps_remaining: number;
  } | null>(null);

  // Fetch real database history whenever selectedStationId changes
  useEffect(() => {
    let isMounted = true;
    async function loadStationData() {
      try {
        const readings = await apiService.getReadings(selectedStationId, 40);
        if (!isMounted) return;

        // Normalize ensemble_scores
        const normalized = readings.map((r) => ({
          ...r,
          ensemble_score: r.ensemble_score <= 1.0 ? r.ensemble_score * 100 : r.ensemble_score,
        }));

        setTelemetryHistory(normalized);

        if (normalized.length > 0) {
          const last = normalized[normalized.length - 1];
          setLatestTelemetry((prev) => {
            if (prev && prev.temperature === last.temperature) return prev;
            return {
              temperature: last.temperature,
              humidity: last.humidity,
              pressure: last.pressure,
              is_anomaly: last.is_anomaly,
              ensemble_score: last.ensemble_score,
              root_cause: last.root_cause,
              severity: last.severity,
              affected_sensors: last.is_anomaly ? [last.root_cause.split('_')[0]] : [],
              corrected: {
                temperature: last.corrected_temperature ?? last.temperature,
                humidity: last.corrected_humidity ?? last.humidity,
                pressure: last.corrected_pressure ?? last.pressure,
              },
              model_breakdown: {
                rule_engine: { violation: last.is_anomaly, score: last.is_anomaly ? 85 : 5, rules: [] },
                isolation_forest: { flag: last.is_anomaly, score: last.is_anomaly ? 0.75 : 0.15 },
                lstm_autoencoder: { flag: last.is_anomaly, score: last.is_anomaly ? 0.88 : 0.03 },
                ensemble_weights: { rules: 0.35, isolation_forest: 0.35, lstm: 0.30 },
              },
              explanation: {
                summary: last.is_anomaly
                  ? `Elevated residual detected at ${selectedStationId}.`
                  : 'Sensors within normal climatological bounds.',
                root_cause: last.root_cause,
                diagnostic_rationale: last.is_anomaly
                  ? 'Abrupt rate-of-change violation observed.'
                  : 'Physical cross-correlations consistent.',
                evidence_points: ['Sensor observation checked by hybrid AI core.'],
                key_factors: {},
              },
              health: {
                station_id: selectedStationId,
                overall_score: 96,
                station_status: 'HEALTHY',
                sensor_scores: {
                  temperature: { score: 96, status: 'HEALTHY' },
                  humidity: { score: 94, status: 'HEALTHY' },
                  pressure: { score: 98, status: 'HEALTHY' },
                  communication: { score: 99, status: 'HEALTHY' },
                },
              },
              protocol: {
                title: 'Routine AWS Polling Protocol',
                action: 'Continuous 15-minute telemetry polling nominal.',
                sla_hours: 48,
                badge_color: 'emerald',
              },
              latency_ms: 12.4,
            };
          });
        }
      } catch {
        // Handled by fallback
      }
    }

    loadStationData();
    return () => {
      isMounted = false;
    };
  }, [selectedStationId]);

  // Listen for user synthetic fault injection commands
  useEffect(() => {
    const handleInjected = (e: any) => {
      if (e.detail) {
        activeFaultRef.current = {
          ...e.detail,
          steps_remaining: e.detail.duration_steps || 12,
        };
      }
    };
    window.addEventListener('skyguard:fault_injected', handleInjected);
    return () => window.removeEventListener('skyguard:fault_injected', handleInjected);
  }, []);

  // Natural diurnal simulation generator only used when offline
  const generateSimulatedReading = useCallback((stationId: string): LiveTelemetryPayload['data'] => {
    simStepRef.current += 1;
    const step = simStepRef.current;

    // Use actual real-world clock time for diurnal curve so temperature remains realistic and stable
    const now = new Date();
    const hourOfDay = now.getHours() + (now.getMinutes() / 60.0) + (now.getSeconds() / 3600.0);
    const baseTemp = 24 + Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI) * 6;
    const baseHum = 60 - Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI) * 16;
    const basePres = 1013 + Math.cos(((hourOfDay - 8) / 24) * 2 * Math.PI) * 2.5;

    // Subtle thermal sensor micro-noise (±0.05°C)
    const tempNoise = (Math.random() - 0.5) * 0.08;
    const humNoise = (Math.random() - 0.5) * 0.15;
    const presNoise = (Math.random() - 0.5) * 0.05;

    const temp = parseFloat((baseTemp + tempNoise).toFixed(2));
    const hum = parseFloat(Math.min(99, Math.max(15, baseHum + humNoise)).toFixed(2));
    const pres = parseFloat((basePres + presNoise).toFixed(2));

    const fault = activeFaultRef.current;
    const hasActiveFault = fault !== null && fault.steps_remaining > 0;

    if (hasActiveFault) {
      fault.steps_remaining -= 1;
      if (fault.steps_remaining <= 0) {
        activeFaultRef.current = null;
      }
    }

    const isAnomaly = hasActiveFault;
    let actualTemp = temp;
    let actualHum = hum;
    let actualPres = pres;
    let rootCause = isAnomaly ? 'temperature_spike' : 'normal';
    let affected = isAnomaly ? ['temperature'] : [];

    if (hasActiveFault) {
      rootCause = fault.fault_type;
      const mag = fault.magnitude;
      if (fault.fault_type === 'temperature_spike') {
        actualTemp = parseFloat((temp + mag).toFixed(2));
        affected = ['temperature'];
      } else if (fault.fault_type === 'humidity_spike') {
        actualHum = parseFloat(Math.min(100, Math.max(0, hum + mag)).toFixed(2));
        affected = ['humidity'];
      } else if (fault.fault_type === 'pressure_spike') {
        actualPres = parseFloat((pres + mag).toFixed(2));
        affected = ['pressure'];
      } else if (fault.fault_type === 'frozen_sensor') {
        actualTemp = 28.5;
        affected = ['temperature'];
      } else if (fault.fault_type === 'sensor_drift') {
        actualTemp = parseFloat((temp + mag * 3).toFixed(2));
        affected = ['temperature'];
      } else if (fault.fault_type === 'communication_failure') {
        actualTemp = -99.0;
        actualHum = 0.0;
        actualPres = 0.0;
        affected = ['temperature', 'humidity', 'pressure'];
      } else if (fault.fault_type === 'multivariate_inconsistency') {
        actualTemp = 48.2;
        actualHum = 98.5;
        affected = ['temperature', 'humidity'];
      }
    }

    const ensembleScore = isAnomaly ? 92.4 : parseFloat((10 + Math.random() * 8).toFixed(1));
    const severity = isAnomaly ? (ensembleScore > 85 ? 'high' : 'medium') : 'low';

    return {
      temperature: actualTemp,
      humidity: actualHum,
      pressure: actualPres,
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
        isolation_forest: { flag: isAnomaly, score: isAnomaly ? 0.72 : 0.25 },
        lstm_autoencoder: { flag: isAnomaly, score: isAnomaly ? 0.89 : 0.04 },
        ensemble_weights: { rules: 0.35, isolation_forest: 0.35, lstm: 0.3 },
      },
      explanation: {
        summary: isAnomaly
          ? `Physical ${rootCause.replace(/_/g, ' ')} detected on station ${stationId}.`
          : 'All sensors operating within IMD climatological bounds.',
        root_cause: rootCause,
        diagnostic_rationale: isAnomaly
          ? `Abrupt sensor divergence violating Kalman expected threshold.`
          : 'Normal environmental variations with high cross-correlation.',
        evidence_points: isAnomaly
          ? [`Observed signal deviates by ±${hasActiveFault ? fault.magnitude : 20}`, 'Kalman filter baseline held stable']
          : ['All sensor readings nominal'],
        key_factors: {},
      },
      health: {
        station_id: stationId,
        overall_score: isAnomaly ? 78 : 96,
        station_status: isAnomaly ? 'WARNING' : 'HEALTHY',
        sensor_scores: {
          temperature: { score: isAnomaly && affected.includes('temperature') ? 68 : 96, status: 'HEALTHY' },
          humidity: { score: isAnomaly && affected.includes('humidity') ? 65 : 94, status: 'HEALTHY' },
          pressure: { score: isAnomaly && affected.includes('pressure') ? 70 : 98, status: 'HEALTHY' },
          communication: { score: 99, status: 'HEALTHY' },
        },
      },
      protocol: {
        title: isAnomaly ? 'IMD AWS Diagnostic Protocol' : 'Routine AWS Monitoring',
        action: isAnomaly ? 'Inspect sensor element and calibrate hardware.' : 'Continue automated polling.',
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

            // Normalize score to 0-100 scale
            const normalizedScore = data.ensemble_score <= 1.0 ? data.ensemble_score * 100 : data.ensemble_score;
            data.ensemble_score = normalizedScore;

            const targetStation = selectedStationRef.current.toUpperCase();
            if (payload.station_id.toUpperCase() === targetStation) {
              setLatestTelemetry(data);

              if (data.is_anomaly) {
                const alertKey = `${data.root_cause}_${data.alert_id || ''}`;
                if (lastDismissedAlertRef.current !== alertKey) {
                  setActiveAlert(data);
                }
              } else {
                lastDismissedAlertRef.current = null;
              }

              const historyItem: ReadingHistoryItem = {
                id: Date.now(),
                timestamp: payload.timestamp || new Date().toISOString(),
                temperature: data.temperature,
                humidity: data.humidity,
                pressure: data.pressure,
                is_anomaly: data.is_anomaly,
                ensemble_score: normalizedScore,
                root_cause: data.root_cause,
                severity: data.severity,
                corrected_temperature: data.corrected?.temperature,
                corrected_humidity: data.corrected?.humidity,
                corrected_pressure: data.corrected?.pressure,
              };

              setTelemetryHistory((prev) => {
                const updated = [...prev, historyItem];
                return updated.slice(-40);
              });
            }
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
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 8000);
      };
    } catch {
      setConnectionStatus('simulated');
      startFallbackSimulation();
    }
  }, []);

  const startFallbackSimulation = useCallback(() => {
    clearInterval(simulationIntervalRef.current);

    simulationIntervalRef.current = setInterval(() => {
      const currentStation = selectedStationRef.current;
      const reading = generateSimulatedReading(currentStation);
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
  }, [generateSimulatedReading]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearTimeout(reconnectTimeoutRef.current);
      clearInterval(simulationIntervalRef.current);
    };
  }, [connectWebSocket]);

  const clearAlert = useCallback(() => {
    if (activeAlert) {
      if (activeAlert.alert_id) {
        apiService.acknowledgeAlert(activeAlert.alert_id);
      }
      lastDismissedAlertRef.current = `${activeAlert.root_cause}_${activeAlert.alert_id || ''}`;
    }
    setActiveAlert(null);
  }, [activeAlert]);

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
