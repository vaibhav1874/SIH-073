"""
SkyGuard AI - Verifiable Transparent Anomaly Explainer
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Generates deterministic, audit-ready natural language explanations for detected anomalies.
- Pinpoints violated physical bounds
- Quantifies deviation relative to 24h baseline (Z-scores)
- Identifies primary contributing sensor and rate of change
- Outlines root-cause rationale without black-box hallucinations
"""

from typing import Dict, Any, List


class AnomalyExplainer:
    def explain(
        self,
        telemetry: Dict[str, Any],
        features: Dict[str, float],
        rule_result: Dict[str, Any],
        root_cause: str,
        ensemble_score: float,
        affected_sensors: List[str],
    ) -> Dict[str, Any]:
        """Generates clear structured and narrative explanations for operators."""
        points: List[str] = []

        # 1. Rule Engine Violations
        if rule_result.get("is_violation"):
            for v in rule_result.get("violated_rules", []):
                points.append(f"Physical constraint breach: {v['message']}")

        # 2. Sensor Specific Deviations & Z-Scores
        for s in ["temperature", "humidity", "pressure"]:
            prefix = "temp" if s == "temperature" else s
            z_score = features.get(f"{prefix}_zscore_24h", 0.0)
            diff_1 = features.get(f"{prefix}_diff_1", 0.0)
            rolling_mean = features.get(f"{prefix}_rolling_mean_24h", telemetry.get(s, 0.0))

            if abs(z_score) >= 2.5:
                direction = "above" if z_score > 0 else "below"
                unit = "°C" if s == "temperature" else ("%" if s == "humidity" else "hPa")
                val = telemetry.get(s)
                points.append(
                    f"{s.capitalize()} reading ({val} {unit}) is {abs(z_score):.1f} standard deviations "
                    f"{direction} the 24-hour diurnal baseline ({rolling_mean:.1f} {unit})."
                )

            if abs(diff_1) >= (6.0 if s == "temperature" else (25.0 if s == "humidity" else 6.0)):
                points.append(
                    f"Abrupt 1-hour rate of change observed on {s}: {diff_1:+.1f} unit/hr."
                )

        # 3. Root cause diagnostic statement
        root_cause_descriptions = {
            "temperature_spike": "Sudden sharp temperature transient exceeding atmospheric thermal inertia.",
            "humidity_spike": "Abrupt hygrometric fluctuation or rapid condensation transient on sensor surface.",
            "pressure_spike": "Sudden barometric step change unlikely under non-cyclonic ambient conditions.",
            "frozen_sensor": "Zero variance detected across sequential observation cycles, indicating mechanical stickiness or ADC freeze.",
            "sensor_drift": "Progressive cumulative baseline shift indicating aging transducer calibration loss.",
            "communication_failure": "Null or sentinel frame received, indicating telemetry modem or power supply interruption.",
            "multivariate_inconsistency": "Incompatible temperature and humidity combination violating thermodynamic moisture limits.",
            "normal": "Readings conform to local meteorological patterns.",
        }
        rationale = root_cause_descriptions.get(root_cause, "Multivariate anomaly pattern detected.")

        if not points:
            points.append(f"Ensemble anomaly score elevated ({ensemble_score:.2f}) based on multivariate feature combination.")

        summary_sentence = f"Flagged as {root_cause.replace('_', ' ').title()}: {points[0]}"

        return {
            "summary": summary_sentence,
            "root_cause": root_cause,
            "diagnostic_rationale": rationale,
            "evidence_points": points,
            "key_factors": {
                "ensemble_confidence": round(ensemble_score, 3),
                "suspect_sensors": affected_sensors,
                "temp_zscore": round(features.get("temp_zscore_24h", 0.0), 2),
                "humidity_zscore": round(features.get("humidity_zscore_24h", 0.0), 2),
                "pressure_zscore": round(features.get("pressure_zscore_24h", 0.0), 2),
            },
        }


anomaly_explainer = AnomalyExplainer()
