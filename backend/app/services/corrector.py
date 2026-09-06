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
        self.x = initial_value  # State estimate
        self.p = 1.0            # Estimate error covariance
        self.q = process_noise  # Process noise covariance
        self.r = measurement_noise  # Measurement noise covariance
        self.k = 0.0            # Kalman gain

    def update(self, measurement: float, is_anomalous: bool = False) -> float:
        # Time update (Prediction)
        self.p = self.p + self.q

        if is_anomalous:
            # If measurement is an anomaly, don't assimilate outlier. Rely on process prediction.
            return round(float(self.x), 2)

        # Measurement update
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
            # Parameterize based on sensor physics
            if sensor == "temperature":
                # Temperature changes smoothly: low process noise
                kf = KalmanFilter1D(initial_value=current_val, process_noise=0.08, measurement_noise=0.6)
            elif sensor == "humidity":
                # Humidity has moderate variations
                kf = KalmanFilter1D(initial_value=current_val, process_noise=0.20, measurement_noise=1.5)
            elif sensor == "pressure":
                # Pressure changes very slowly
                kf = KalmanFilter1D(initial_value=current_val, process_noise=0.03, measurement_noise=0.4)
            else:
                kf = KalmanFilter1D(initial_value=current_val, process_noise=0.1, measurement_noise=1.0)
            self.filters[station_id][sensor] = kf

        return self.filters[station_id][sensor]

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

        for sensor in ["temperature", "humidity", "pressure"]:
            val = telemetry.get(sensor)
            if val is None:
                continue

            sensor_anomalous = is_anomaly and (sensor in affected_sensors or "all" in affected_sensors)
            kf = self._get_or_init_filter(station_id, sensor, val if not sensor_anomalous else 25.0)

            # Filter or impute
            smoothed_val = kf.update(val, is_anomalous=sensor_anomalous)
            corrected[sensor] = smoothed_val

        return corrected


sensor_corrector = SensorCorrector()
