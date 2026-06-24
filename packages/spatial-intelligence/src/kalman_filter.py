"""
1D Kalman Filter for BLE RSSI Smoothing
Based on the Millennium-Grade Spatial Mesh Architecture

Tuning Parameters:
Q (Process Noise) = 0.008  - High confidence in physical trajectory model
R (Measurement Noise) = 15.0 - Extreme distrust of RSSI jitter
"""


class RSSIKalmanFilter:
    def __init__(self, q: float = 0.008, r: float = 15.0, initial_rssi: float = -70.0):
        self.q = q
        self.r = r
        self.x = initial_rssi  # Estimated signal strength
        self.p = 1.0  # Estimation error covariance

    def filter(self, measurement: float) -> float:
        """Apply 1D Kalman Filter, returning the smoothed RSSI value."""
        # Predictive step
        # Assuming stationary or slightly moving target (1D model: x = x)
        self.p = self.p + self.q

        # Update step
        # k is the Kalman Gain
        k = self.p / (self.p + self.r)

        self.x = self.x + k * (measurement - self.x)
        self.p = (1 - k) * self.p

        return self.x

    def reset(self, initial_rssi: float = -70.0):
        """Force reset the filter if a device abruptly leaves bounds."""
        self.x = initial_rssi
        self.p = 1.0
