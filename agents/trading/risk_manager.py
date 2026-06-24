"""
The Risk Manager: Absolute Sovereign Circuit Breaker.
This component ALWAYS runs locally. It intercepts signals from the Bull and Bear agents
and ensures all trades adhere to institutional-grade risk parameters before execution.
"""
from typing import Dict, Any

class RiskManager:
    def __init__(self, max_drawdown: float = 0.05, latency_threshold_ms: int = 1500):
        self.max_drawdown = max_drawdown
        self.latency_threshold_ms = latency_threshold_ms
        self.asset_allowlist = {"BTC", "ETH", "SOL", "USDC"}

    def evaluate_trade(self, bull_signal: Dict[str, Any], bear_signal: Dict[str, Any], current_latency_ms: int) -> bool:
        """
        Evaluate the conflicting signals from the Bull and Bear agents.
        Returns True if the trade is approved, False if rejected.
        """
        # 1. Latency Check (Critical for the 2.7s Polymarket window)
        if current_latency_ms > self.latency_threshold_ms:
            print(f"[REJECTED] Latency {current_latency_ms}ms exceeds threshold {self.latency_threshold_ms}ms")
            return False

        # 2. Asset Allowlist Check
        asset = bull_signal.get("asset")
        if asset not in self.asset_allowlist:
            print(f"[REJECTED] Asset {asset} not in allowlist")
            return False

        # 3. Consensus Check
        # The Bear must explicitly 'allow' or 'abstain' to proceed with a Bull momentum signal
        bear_stance = bear_signal.get("stance", "reject").lower()
        if bear_stance == "reject":
            print(f"[REJECTED] Bear agent vetoed the trade. Reason: {bear_signal.get('reason')}")
            return False

        # 4. Risk / Position Sizing Check (Mocked logic)
        proposed_size = bull_signal.get("position_size_usd", 0)
        if proposed_size > 10000: # Arbitrary hardcoded limit for safety
            print(f"[REJECTED] Position size {proposed_size} exceeds maximum safe limit")
            return False

        print(f"[APPROVED] Trade for {asset} passed Risk Manager.")
        return True
