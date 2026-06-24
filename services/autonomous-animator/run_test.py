import os
from orchestrator import process_bundle

if __name__ == "__main__":
    bundle_path = os.path.join(os.path.dirname(__file__), "test_bundle")
    process_bundle(bundle_path, "test_1924_animation")
