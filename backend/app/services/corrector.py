"""
SkyGuard AI - Sensor Imputation & Kalman Filter Correction Service
SIH26073 - Intelligent Real-Time Anomaly Detection System for AWS

Provides dynamic reconstruction and correction of anomalous sensor readings:
- 1D Kalman Filter tracking state and velocity per sensor
- Provides smoothed state estimate (true meteorological state)
- In the event of sensor fault / outlier / dropout, generates imputed corrected value
"""

from typing import Dict, Any, Optional


class KalmanFilter1D:
    def __init__(self, initial_value: float = 25.0, process_noise: float = 0.05, measurement_noise: float = 0.5):
        self.x = float(initial_value)  # State estimate
        self.p = 1.0                   # Estimate error covariance
        self.q = process_noise         # Process noise covariance
        self.r = measurement_noise     # Measurement noise covariance
        self.k = 0.0                   # Kalman gain
        self.consecutive_rejects = 0   # Recovery counter for regime switches

    def update(self, measurement: float, is_anomalous: bool = False, max_residual: float = 5.0) -> float:
        # Time update (Prediction)
        self.p = self.p + self.q

        residual = abs(measurement - self.x)

        # Innovation gating:
        # If upstream ensemble flags the sensor as anomalous OR innovation residual exceeds physical plausibility
        if is_anomalous or residual > max_residual:
            self.consecutive_rejects += 1
            # If the measurement is physically plausible and persists for 3+ ticks,
            # this is a station regime change or geographic switch, not a transient spike!
            is_physically_sane = -20.0 <= measurement <= 60.0 or 800.0 <= measurement <= 1080.0
            if self.consecutive_rejects >= 3 and is_physically_sane and not (measurement in [-99.0, 0.0, 999.0]):
                self.x = float(measurement)
                self.p = 1.0
                self.consecutive_rejects = 0
                return round(float(self.x), 2)

            # Outlier rejected! Maintain estimated atmospheric baseline without corrupting state.
            return round(float(self.x), 2)

        # Valid measurement update
        self.consecutive_rejects = 0
        self.k = self.p / (self.p + self.r)
        self.x = self.x + self.k * (measurement - self.x)
        self.p = (1.0 - self.k) * self.p

        return round(float(self.x), 2)


class SensorCorrector:
    def __init__(self):
        # Per-station, per-sensor Kalman filters
        self.filters: Dict[str, Dict[str, KalmanFilter1D]] = {}

    def _get_or_init_filter(self, station_id: str, sensor: str, current_val: float) -> KalmanFilter1D:
        if station_id not in self.filters:
            self.filters[station_id] = {}

        if sensor not in self.filters[station_id]:
            # Sanity check: if initial measurement is beyond physical limits, don't start the filter in an anomalous state!
            safe_initial = float(current_val)
            if sensor == "temperature" and (safe_initial > 50.0 or safe_initial < -10.0):
                safe_initial = 25.0
            elif sensor == "humidity" and (safe_initial > 100.0 or safe_initial < 0.0):
                safe_initial = 65.0
            elif sensor == "pressure" and (safe_initial > 1080.0 or safe_initial < 900.0):
                safe_initial = 1000.0

            # Parameterize based on sensor physics
            if sensor == "temperature":
                kf = KalmanFilter1D(initial_value=safe_initial, process_noise=0.04, measurement_noise=0.8)
            elif sensor == "humidity":
                kf = KalmanFilter1D(initial_value=safe_initial, process_noise=0.15, measurement_noise=1.8)
            elif sensor == "pressure":
                kf = KalmanFilter1D(initial_value=safe_initial, process_noise=0.02, measurement_noise=0.5)
            else:
                kf = KalmanFilter1D(initial_value=safe_initial, process_noise=0.1, measurement_noise=1.0)
            self.filters[station_id][sensor] = kf

        return self.filters[station_id][sensor]

    def reset_station(self, station_id: Optional[str] = None):
        """Clears cached filter states so new station/city starts clean."""
        if station_id and station_id in self.filters:
            del self.filters[station_id]
        elif not station_id:
            self.filters.clear()

    def correct_telemetry(
        self,
        station_id: str,
        telemetry: Dict[str, Any],
        is_anomaly: bool,
        affected_sensors: list,
    ) -> Dict[str, Any]:
        """
        Calculates Kalman-filtered smoothed and corrected values for all sensors.
        Returns telemetry dictionary enriched with 'corrected' field.
        """
        corrected: Dict[str, float] = {}

        # Physical innovation gating thresholds per sensor type
        # Jumps larger than these are guaranteed outliers / spikes
        MAX_INNOVATION_GATES = {
            "temperature": 4.5,   # > 4.5°C step jump is rejected
            "humidity": 18.0,     # > 18% step jump is rejected
            "pressure": 5.0,      # > 5 hPa step jump is rejected
        }

        SENSOR_DEFAULTS = {
            "temperature": 25.0,
            "humidity": 65.0,
            "pressure": 1000.0,
        }

        for sensor in ["temperature", "humidity", "pressure"]:
            val = telemetry.get(sensor)
            if val is None:
                continue

            sensor_anomalous = is_anomaly and (sensor in affected_sensors or "all" in affected_sensors)
            default_val = SENSOR_DEFAULTS.get(sensor, 25.0)
            kf = self._get_or_init_filter(station_id, sensor, val if not sensor_anomalous else default_val)

            gate = MAX_INNOVATION_GATES.get(sensor, 6.0)
            smoothed_val = kf.update(val, is_anomalous=sensor_anomalous, max_residual=gate)
            corrected[sensor] = smoothed_val

        return corrected


sensor_corrector = SensorCorrector()
