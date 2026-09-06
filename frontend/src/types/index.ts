export interface Station {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  status: 'Healthy' | 'Warning' | 'Critical';
}

export interface SensorData {
  temperature: number;
  humidity: number;
  pressure: number;
}

export interface ReadingHistoryItem {
  id: number;
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  is_anomaly: boolean;
  ensemble_score: number;
  root_cause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  corrected_temperature?: number;
  corrected_humidity?: number;
  corrected_pressure?: number;
}

export interface AnomalyAlert {
  id: number;
  station_id: string;
  timestamp: string;
  root_cause: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_sensors: string;
  ensemble_score: number;
  explanation: string;
  recommended_action: string;
  sla_hours: number;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

export interface HealthSummary {
  station_id: string;
  overall_score: number;
  station_status: string;
  sensor_scores: {
    temperature: { score: number; status: string };
    humidity: { score: number; status: string };
    pressure: { score: number; status: string };
    communication: { score: number; status: string };
  };
}

export interface BenchmarkMetrics {
  name: string;
  precision: number;
  recall: number;
  f1_score: number;
  fpr: number;
  latency_ms: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
}

export interface LiveTelemetryPayload {
  type: 'TELEMETRY_UPDATE';
  station_id: string;
  timestamp: string;
  data: {
    temperature: number;
    humidity: number;
    pressure: number;
    is_anomaly: boolean;
    ensemble_score: number;
    root_cause: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affected_sensors: string[];
    corrected: {
      temperature?: number;
      humidity?: number;
      pressure?: number;
    };
    model_breakdown: {
      rule_engine: { violation: boolean; score: number; rules: any[] };
      isolation_forest: { flag: boolean; score: number };
      lstm_autoencoder: { flag: boolean; score: number };
      ensemble_weights: { rules: number; isolation_forest: number; lstm: number };
    };
    explanation: {
      summary: string;
      root_cause: string;
      diagnostic_rationale: string;
      evidence_points: string[];
      key_factors: any;
    };
    health: HealthSummary;
    alert_id?: number;
    protocol: {
      title: string;
      action: string;
      sla_hours: number;
      badge_color: string;
    };
    latency_ms: number;
  };
}
