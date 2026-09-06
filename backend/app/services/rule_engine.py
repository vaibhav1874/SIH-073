"""
SkyGuard AI - IMD Meteorological Physical Rule Engine
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Deterministic domain-expert rule verification for automatic weather stations:
1. Physical Sensor Boundary Validation (IMD standards)
2. Maximum Allowable Rate-of-Change (Step differences)
3. Sensor Stagnation / Frozen Persistence Detection
4. Cross-Sensor Meteorological Inconsistency Checks
5. Communication Dropout Sentinel Identification
"""

from typing import Dict, List, Optional, Any
import numpy as np


class RuleEngine:
    # Sensor physical plausibility limits
    TEMP_MIN = -10.0
    TEMP_MAX = 55.0
    HUMIDITY_MIN = 0.0
    HUMIDITY_MAX = 100.0
    PRESSURE_MIN = 900.0
    PRESSURE_MAX = 1080.0

    # Max single-step rate of change (hourly delta)
    MAX_TEMP_DELTA = 8.0     # °C/hr
    MAX_HUMIDITY_DELTA = 35.0 # %/hr
    MAX_PRESSURE_DELTA = 8.0  # hPa/hr

    def evaluate(
        self,
        current: Dict[str, float],
        previous: Optional[Dict[str, float]] = None,
        history_window: Optional[List[Dict[str, float]]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates current sensor reading against physical meteorological constraints.
        Returns:
            is_violation: bool
            rule_score: float in [0.0, 1.0]
            violated_rules: list of violated rule IDs and descriptions
            affected_sensors: list of suspect sensor names
        """
        temp = current.get("temperature")
        hum = current.get("humidity")
        pres = current.get("pressure")

        violations: List[Dict[str, str]] = []
        affected = set()
        severity = "none"

        # 1. Check for Communication Dropout Sentinels
        if temp is not None and temp <= -90.0:
            violations.append({
                "rule_id": "COMM_PACKET_LOSS",
                "sensor": "temperature",
                "message": f"Temperature reading {temp}°C indicates communication drop/sentinel.",
            })
            affected.add("temperature")
            severity = "critical"

        if pres is not None and pres <= 50.0:
            violations.append({
                "rule_id": "COMM_PACKET_LOSS",
                "sensor": "pressure",
                "message": f"Pressure reading {pres} hPa indicates lost telemetry or disconnected transducer.",
            })
            affected.add("pressure")
            severity = "critical"

        # 2. Physical Sensor Bounds
        if temp is not None and not (self.TEMP_MIN <= temp <= self.TEMP_MAX):
            violations.append({
                "rule_id": "PHYSICAL_BOUND_TEMP",
                "sensor": "temperature",
                "message": f"Temperature {temp}°C exceeds physical limit [{self.TEMP_MIN}, {self.TEMP_MAX}°C].",
            })
            affected.add("temperature")
            severity = "high"

        if hum is not None and not (self.HUMIDITY_MIN <= hum <= self.HUMIDITY_MAX):
            violations.append({
                "rule_id": "PHYSICAL_BOUND_HUMIDITY",
                "sensor": "humidity",
                "message": f"Humidity {hum}% exceeds physical bounds [0, 100%].",
            })
            affected.add("humidity")
            severity = "high"

        if pres is not None and not (self.PRESSURE_MIN <= pres <= self.PRESSURE_MAX):
            violations.append({
                "rule_id": "PHYSICAL_BOUND_PRESSURE",
                "sensor": "pressure",
                "message": f"Atmospheric pressure {pres} hPa outside realistic limits [{self.PRESSURE_MIN}, {self.PRESSURE_MAX} hPa].",
            })
            affected.add("pressure")
            severity = "high"

        # 3. Rate-of-Change (Delta) Verification
        if previous is not None:
            prev_temp = previous.get("temperature")
            prev_hum = previous.get("humidity")
            prev_pres = previous.get("pressure")

            if temp is not None and prev_temp is not None:
                d_temp = abs(temp - prev_temp)
                if d_temp > self.MAX_TEMP_DELTA:
                    violations.append({
                        "rule_id": "RATE_OF_CHANGE_TEMP",
                        "sensor": "temperature",
                        "message": f"Temperature jump of {d_temp:.1f}°C exceeds max hourly rate ({self.MAX_TEMP_DELTA}°C/hr).",
                    })
                    affected.add("temperature")
                    if severity in ["none", "low", "medium"]:
                        severity = "high"

            if hum is not None and prev_hum is not None:
                d_hum = abs(hum - prev_hum)
                if d_hum > self.MAX_HUMIDITY_DELTA:
                    violations.append({
                        "rule_id": "RATE_OF_CHANGE_HUMIDITY",
                        "sensor": "humidity",
                        "message": f"Humidity jump of {d_hum:.1f}% exceeds max allowable rate ({self.MAX_HUMIDITY_DELTA}%/hr).",
                    })
                    affected.add("humidity")
                    if severity in ["none", "low", "medium"]:
                        severity = "high"

            if pres is not None and prev_pres is not None:
                d_pres = abs(pres - prev_pres)
                if d_pres > self.MAX_PRESSURE_DELTA:
                    violations.append({
                        "rule_id": "RATE_OF_CHANGE_PRESSURE",
                        "sensor": "pressure",
                        "message": f"Pressure surge of {d_pres:.1f} hPa exceeds max barometric rate ({self.MAX_PRESSURE_DELTA} hPa/hr).",
                    })
                    affected.add("pressure")
                    if severity in ["none", "low", "medium"]:
                        severity = "high"

        # 4. Cross-Sensor Meteorological Inconsistency
        if temp is not None and hum is not None:
            # Extreme heat with tropical saturation
            if temp > 42.0 and hum > 85.0:
                violations.append({
                    "rule_id": "CROSS_SENSOR_HEAT_SATURATION",
                    "sensor": "temperature,humidity",
                    "message": f"Multivariate violation: Temperature {temp}°C with Relative Humidity {hum}% is physically impossible in North India.",
                })
                affected.add("temperature")
                affected.add("humidity")
                severity = "critical"

        # 5. Stagnation / Frozen Sensor Detection (requires at least 6 consecutive points)
        if history_window and len(history_window) >= 6:
            for s in ["temperature", "humidity", "pressure"]:
                vals = [p[s] for p in history_window if s in p and p[s] is not None]
                if len(vals) >= 6:
                    diffs = [abs(vals[i] - vals[i - 1]) for i in range(1, len(vals))]
                    if max(diffs) < 1e-4:
                        violations.append({
                            "rule_id": "FROZEN_SENSOR_STAGNATION",
                            "sensor": s,
                            "message": f"{s.capitalize()} sensor is invariant across the last {len(vals)} readings (stuck at {vals[-1]}).",
                        })
                        affected.add(s)
                        if severity in ["none", "low"]:
                            severity = "medium"

        is_violation = len(violations) > 0
        rule_score = min(1.0, len(violations) * 0.4) if is_violation else 0.0

        return {
            "is_violation": is_violation,
            "rule_score": round(rule_score, 3),
            "violated_rules": violations,
            "affected_sensors": list(affected),
            "rule_severity": severity,
        }


# Singleton instance
rule_engine = RuleEngine()
