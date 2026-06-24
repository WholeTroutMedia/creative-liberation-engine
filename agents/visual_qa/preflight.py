"""
Pre-flight Validator: Structural pre-flight checks.
This service ensures the generated code contains the required semantic structures
(e.g., Tailwind classes, proper tags) BEFORE spinning up the heavy Playwright
render and Vision API. This fail-fast mechanism saves time and API costs.
"""
import re

class PreflightValidator:
    def __init__(self, required_classes=None):
        self.required_classes = required_classes or ["flex", "p-", "bg-", "text-"]

    def validate_code(self, source_code: str) -> bool:
        """
        Perform a fast regex/AST validation on the source code.
        """
        print("[Pre-flight Validator] Running structural checks...")
        
        # Simple regex check for Tailwind class presence
        for req in self.required_classes:
            if not re.search(r'className=.*?[''"\s]' + re.escape(req) + r'[\s''"]', source_code):
                print(f"[FAIL] Missing required structural class pattern: {req}")
                return False
                
        print("[PASS] Structural pre-flight complete. Ready for render.")
        return True
