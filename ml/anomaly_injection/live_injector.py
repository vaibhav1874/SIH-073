"""
SkyGuard AI - Live Interactive Anomaly Injector
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Provides dynamic, stateful injection of sensor faults into active streaming AWS telemetry.
Used by the simulator and live test control endpoints.
"""

from typing import Dict, Any, Optional
import time


class LiveFaultInjector:
    def __init__(self):
        self.active_fault: Optional[Dict[str, Any]] = None
        self.steps_remaining: int = 0
        self.frozen_value: Optional[float] = None
        self.drift_accumulated: float = 0.0

    def trigger_fault(
        self,
        fault_type: str,
        target_sensor: str = "temperature",
        duration_steps: int = 10,
        magnitude: float = 15.0,
    ) -> Dict[str, Any]:
        """Activates a synthetic fault for the next N incoming telemetry packets."""
        self.active_fault = {
            "fault_type": fault_type,
            "target_sensor": target_sensor,
            "duration_steps": duration_steps,
            "magnitude": magnitude,
            "start_time": time.time(),
        }
        self.steps_remaining = duration_steps
        self.frozen_value = None
        self.drift_accumulated = 0.0
        return {
            "status": "active",
            "message": f"Fault '{fault_type}' activated for {duration_steps} steps on {target_sensor}.",
            "fault": self.active_fault,
        }

    def clear_fault(self) -> Dict[str, str]:
        """Immediately deactivates any active fault."""
        prev = self.active_fault
        self.active_fault = None
        self.steps_remaining = 0
        self.frozen_value = None
        self.drift_accumulated = 0.0
        return {"status": "cleared", "previous_fault": str(prev)}

    def apply(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Modifies telemetry packet in-place according to the active fault.
        Returns packet with additional injection metadata.
        """
        if not self.active_fault or self.steps_remaining <= 0:
            self.active_fault = None
            telemetry["injected_fault"] = None
            return telemetry

        fault_type = self.active_fault["fault_type"]
        sensor = self.active_fault["target_sensor"]
        mag = self.active_fault["magnitude"]

        modified = telemetry.copy()

        if fault_type == "temperature_spike":
            modified["temperature"] = round(modified.get("temperature", 25.0) + mag, 2)
        elif fault_type == "humidity_spike":
            modified["humidity"] = min(100.0, max(0.0, round(modified.get("humidity", 50.0) + mag, 2)))
        elif fault_type == "pressure_spike":
            modified["pressure"] = round(modified.get("pressure", 1013.2) + mag, 2)
        elif fault_type == "frozen_sensor":
            if self.frozen_value is None:
                self.frozen_value = modified.get(sensor, 25.0)
            modified[sensor] = self.frozen_value
        elif fault_type == "sensor_drift":
            self.drift_accumulated += mag
            modified[sensor] = round(modified.get(sensor, 25.0) + self.drift_accumulated, 2)
        elif fault_type == "communication_failure":
            modified["temperature"] = -99.0
            modified["humidity"] = 0.0
            modified["pressure"] = 0.0
        elif fault_type == "multivariate_inconsistency":
            modified["temperature"] = 46.5
            modified["humidity"] = 98.0

        self.steps_remaining -= 1
        modified["injected_fault"] = {
            "type": fault_type,
            "target_sensor": sensor,
            "steps_remaining": self.steps_remaining,
        }
        return modified


# Global singleton instance for live simulator integration
live_injector = LiveFaultInjector()
