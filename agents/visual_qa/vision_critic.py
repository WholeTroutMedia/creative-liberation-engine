"""
Vision Critic: Layout and Design Assessment.
Assesses WebP screenshots of rendered components. Supports BYOK Cloud APIs (e.g., GPT-4o) 
for instant, high-accuracy critique, with local inference (LLaVA/Nemotron) as the sovereign default.
"""
import os
import time

class VisionCritic:
    def __init__(self, provider: str = "local", model: str = "llava:34b"):
        self.provider = provider
        self.model = model
        self.api_key = os.getenv(f"{provider.upper()}_API_KEY")

        if provider != "local" and not self.api_key:
            print(f"[WARN] No API key found for {provider}. Falling back to local vision inference.")
            self.provider = "local"

    def critique_screenshot(self, screenshot_path: str, prompt_context: str) -> dict:
        """
        Ingest the rendered screenshot and provide a structural/visual critique.
        """
        if not os.path.exists(screenshot_path):
            raise FileNotFoundError(f"Screenshot not found at {screenshot_path}")

        print(f"[Vision Critic] Assessing UI at {screenshot_path} via {self.provider} ({self.model})...")
        
        # Simulate inference latency
        latency = 1.5 if self.provider != "local" else 8.0
        time.sleep(latency)

        # Mocked critique output
        critique = {
            "status": "fail",
            "issues": [
                "Button contrast is too low against the background.",
                "Padding on the left sidebar is inconsistent with the design tokens."
            ],
            "fix_suggestions": "Increase background contrast to #1A1A1A and set sidebar padding to p-4."
        }
        return critique
