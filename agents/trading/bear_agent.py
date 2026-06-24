"""
The Bear Agent: Risk and Anomaly Detection.
Tuned for extreme risk-aversion. Acts as the primary devil's advocate against the Bull.
Supports BYOK Cloud APIs for speed, with local inference as a fallback.
"""
import os
import time

class BearAgent:
    def __init__(self, provider: str = "local", model: str = "llama3:70b"):
        self.provider = provider
        self.model = model
        self.api_key = os.getenv(f"{provider.upper()}_API_KEY")

        if provider != "local" and not self.api_key:
            print(f"[WARN] No API key found for {provider}. Falling back to local inference.")
            self.provider = "local"

    def analyze_risk(self, market_data: dict, bull_signal: dict) -> dict:
        """
        Critique the market data and the Bull's proposed trade.
        """
        print(f"[Bear Agent] Analyzing risk via {self.provider} ({self.model})...")
        
        # Simulate inference latency (cloud vs local)
        latency = 0.2 if self.provider != "local" else 0.8
        time.sleep(latency)

        # Mocked risk signal (probabilistic veto)
        if bull_signal.get("confidence", 0) < 0.90:
            return {
                "stance": "reject",
                "reason": "Volatility too high, confidence threshold not met.",
                "latency_ms": int(latency * 1000)
            }
        
        return {
            "stance": "allow",
            "reason": "Acceptable risk metrics.",
            "latency_ms": int(latency * 1000)
        }
