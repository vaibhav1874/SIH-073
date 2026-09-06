"""
SkyGuard AI - Sensor Health & Reliability Index Calculator
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Computes rolling health scores (0-100%) for individual sensors and AWS stations:
- Penalizes recent anomalies, frozen stagnation, persistent drift, and packet drops
- Decays penalties over time as normal clean telemetry is observed (recovery)
- Categorizes status: Healthy (90-100), Warning (70-89), Degraded (50-69), Critical (<50)
"""

from typing import Dict, Any, List


class SensorHealthTracker:
    def __init__(self):
        # station_id -> { "temperature": score, "humidity": score, "pressure": score, "comms": score }
        self.station_health: Dict[str, Dict[str, float]] = {}
        # station_id -> rolling history of recent events for degradation tracking
        self.recent_events: Dict[str, List[Dict[str, Any]]] = {}

    def _init_station(self, station_id: str):
        if station_id not in self.station_health:
            self.station_health[station_id] = {
                "temperature": 100.0,
                "humidity": 100.0,
                "pressure": 100.0,
                "communication": 100.0,
                "overall": 100.0,
            }
            self.recent_events[station_id] = []

    def update(
        self,
        station_id: str,
        is_anomaly: bool,
        root_cause: str,
        affected_sensors: List[str],
        severity: str,
    ) -> Dict[str, Any]:
        self._init_station(station_id)
        scores = self.station_health[station_id]

        if is_anomaly:
            # Penalize affected sensors
            penalty = 8.0 if severity == "low" else (15.0 if severity == "medium" else (25.0 if severity == "high" else 40.0))

            if "all" in affected_sensors or root_cause == "communication_failure":
                for k in ["temperature", "humidity", "pressure", "communication"]:
                    scores[k] = max(0.0, scores[k] - penalty)
            else:
                for s in affected_sensors:
                    if s in scores:
                        scores[s] = max(0.0, scores[s] - penalty)

            self.recent_events[station_id].append({
                "severity": severity,
                "root_cause": root_cause,
                "affected": affected_sensors,
            })
            if len(self.recent_events[station_id]) > 50:
                self.recent_events[station_id].pop(0)
        else:
            # Gradual passive recovery when receiving clean packets (+0.5% per normal cycle, max 100)
            for k in ["temperature", "humidity", "pressure", "communication"]:
                scores[k] = min(100.0, scores[k] + 0.5)

        # Station overall weighted health index
        overall = (
            0.35 * scores["temperature"] +
            0.30 * scores["humidity"] +
            0.25 * scores["pressure"] +
            0.10 * scores["communication"]
        )
        scores["overall"] = round(overall, 1)

        for k in ["temperature", "humidity", "pressure", "communication"]:
            scores[k] = round(scores[k], 1)

        def get_status(score: float) -> str:
            if score >= 90.0:
                return "Healthy"
            elif score >= 70.0:
                return "Warning"
            elif score >= 50.0:
                return "Degraded"
            else:
                return "Critical"

        return {
            "station_id": station_id,
            "overall_score": scores["overall"],
            "station_status": get_status(scores["overall"]),
            "sensor_scores": {
                "temperature": {"score": scores["temperature"], "status": get_status(scores["temperature"])},
                "humidity": {"score": scores["humidity"], "status": get_status(scores["humidity"])},
                "pressure": {"score": scores["pressure"], "status": get_status(scores["pressure"])},
                "communication": {"score": scores["communication"], "status": get_status(scores["communication"])},
            },
        }

    def get_health(self, station_id: str) -> Dict[str, Any]:
        self._init_station(station_id)
        scores = self.station_health[station_id]
        return {
            "station_id": station_id,
            "overall_score": scores["overall"],
            "sensor_scores": {k: scores[k] for k in ["temperature", "humidity", "pressure", "communication"]},
        }


sensor_health_tracker = SensorHealthTracker()
