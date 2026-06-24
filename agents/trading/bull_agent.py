"""
The Bull Agent: Momentum Identification.
Tuned for aggressive entry signals. Supports BYOK Cloud APIs for speed, 
with local inference as a fallback.
"""
import os
import time

class BullAgent:
    def __init__(self, provider: str = "local", model: str = "llama3:70b"):
        self.provider = provider
        self.model = model
        self.api_key = os.getenv(f"{provider.upper()}_API_KEY")

        if provider != "local" and not self.api_key:
            print(f"[WARN] No API key found for {provider}. Falling back to local inference.")
            self.provider = "local"

    def analyze_momentum(self, market_data: dict) -> dict:
        """
        Analyze order flow and price action to generate a momentum signal.
        """
        print(f"[Bull Agent] Analyzing data via {self.provider} ({self.model})...")
        
        # Simulate inference latency (cloud vs local)
        latency = 0.2 if self.provider != "local" else 0.8
        time.sleep(latency)

        # Mocked momentum signal
        signal = {
            "stance": "buy",
            "asset": market_data.get("asset", "BTC"),
            "confidence": 0.85,
            "position_size_usd": 5000,
            "latency_ms": int(latency * 1000)
        }
        return signal
