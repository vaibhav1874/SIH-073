"""
SkyGuard AI - Anomaly Severity Assessment & IMD Action Engine
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Classifies anomaly severity level (LOW, MEDIUM, HIGH, CRITICAL) based on:
- Combined ensemble confidence score
- Magnitude of physical deviation from meteorological bounds
- Number of sensors compromised simultaneously
- Root cause diagnosis (e.g. communication failure is immediately critical)

Generates standardized IMD operational response protocols and SLA deadlines.
"""

from typing import Dict, Any, List


class SeverityEngine:
    SEVERITY_LEVELS = ["low", "medium", "high", "critical"]

    PROTOCOL_MAP = {
        "low": {
            "title": "Advisory / Transient Outlier",
            "action": "Flag telemetry for review; monitor sensor for 3 consecutive cycles. No data purge required.",
            "sla_hours": 24,
            "badge_color": "yellow",
        },
        "medium": {
            "title": "Moderate Sensor Anomaly",
            "action": "Sensor showing persistent drift or repeated spikes. Trigger remote diagnostic self-test and calibrate baseline.",
            "sla_hours": 12,
            "badge_color": "orange",
        },
        "high": {
            "title": "Severe Sensor Malfunction",
            "action": "Discard sensor reading from numerical weather models. Switch to Kalman-imputed fallback. Alert regional IMD duty officer.",
            "sla_hours": 4,
            "badge_color": "red",
        },
        "critical": {
            "title": "Critical Station Hardware Failure",
            "action": "IMMEDIATE ACTION REQUIRED: Transducer disconnected or station power outage. Dispatch field engineer for on-site repair.",
            "sla_hours": 1,
            "badge_color": "purple",
        },
    }

    def assess_severity(
        self,
        ensemble_score: float,
        root_cause: str,
        affected_sensors: List[str],
        rule_severity: str = "none",
    ) -> Dict[str, Any]:
        """Calculates severity grade and prescribed IMD standard operating procedure."""
        # 1. Hardware/telemetry communication drop is always critical
        if root_cause in ["communication_failure"] or rule_severity == "critical":
            level = "critical"
        # 2. Multi-sensor failure or high ensemble confidence
        elif len(affected_sensors) >= 2 or ensemble_score >= 0.75 or rule_severity == "high":
            level = "high"
        # 3. Moderate confidence or persistent drift/freezing
        elif ensemble_score >= 0.50 or root_cause in ["frozen_sensor", "sensor_drift"] or rule_severity == "medium":
            level = "medium"
        # 4. Low confidence transient anomaly
        elif ensemble_score >= 0.35:
            level = "low"
        else:
            level = "low"

        protocol = self.PROTOCOL_MAP[level]
        return {
            "severity": level,
            "title": protocol["title"],
            "action": protocol["action"],
            "sla_hours": protocol["sla_hours"],
            "badge_color": protocol["badge_color"],
        }


severity_engine = SeverityEngine()
