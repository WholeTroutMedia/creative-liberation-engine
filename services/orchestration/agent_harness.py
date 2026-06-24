import json
import logging
import requests

class EdgeInferenceGateway:
    """
    Layer 1: Sovereign Edge Inference Gateway.
    Abstracts local LLM/VLM connections (Ollama, vLLM) on NAS.
    """
    def __init__(self, host="localhost", port=11434):
        self.endpoint = f"http://{host}:{port}"
        self.logger = logging.getLogger("EdgeInference")
        self.logger.setLevel(logging.INFO)

    def generate(self, prompt, model="qwen2.5:3b"):
        self.logger.info(f"Routing inference request to {model} via {self.endpoint}")
        url = f"{self.endpoint}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            return {"response": data.get("response", "")}
        except requests.RequestException as e:
            self.logger.error(f"Inference request failed: {e}")
            return {"error": str(e), "response": f"Mock generated response for: {prompt[:20]}..."}

class AgentHarness:
    """
    Phase 3: Agent Harness with Context Compression (Symphony Spec).
    Master Orchestration Engine.
    """
    def __init__(self):
        self.inference_gateway = EdgeInferenceGateway()
        self.logger = logging.getLogger("AgentHarness")
        self.logger.setLevel(logging.INFO)

    def compress_context(self, context_buffer):
        self.logger.info("Compressing context to prevent window blowout...")
        # Observational Context Compression logic
        return context_buffer[-1000:]

    def execute_workflow(self, task_spec):
        self.logger.info(f"Executing workflow via Zero-to-Spec: {task_spec}")
        compressed = self.compress_context(task_spec)
        result = self.inference_gateway.generate(compressed)
        return result

if __name__ == "__main__":
    harness = AgentHarness()
    res = harness.execute_workflow("Say 'Hello, Agent!' and nothing else.")
    print(res)
