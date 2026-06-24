import os
import time
import json
import requests
import sseclient
from preflight import PreflightValidator
from vision_critic import VisionCritic
from playwright.sync_api import sync_playwright

DISPATCH_URL = os.getenv("DISPATCH_URL", "http://dispatch:5050")

def capture_screenshot(url: str, output_path: str):
    print(f"[Playwright] Navigating to {url} to capture screenshot...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.goto(url, wait_until='networkidle')
        page.screenshot(path=output_path, full_page=True)
        browser.close()
    print(f"[Playwright] Screenshot saved to {output_path}")

def dispatch_feedback(critique: dict, task_id: str = None):
    print(f"[Dispatch] Sending feedback to {DISPATCH_URL}...")
    try:
        # Assuming dispatch has an endpoint to receive agent feedback/handoffs
        # Adjust as needed based on dispatch API
        endpoint = f"{DISPATCH_URL}/api/notify"
        payload = {
            "agent": "visual_qa",
            "type": "visual_critique",
            "task_id": task_id,
            "feedback": critique
        }
        res = requests.post(endpoint, json=payload)
        res.raise_for_status()
        print("[Dispatch] Feedback sent successfully.")
    except Exception as e:
        print(f"[Dispatch] Failed to send feedback: {e}")

def start_visual_feedback_loop():
    print("Visual QA Feedback Loop Daemon Boot Sequence...")
    preflight = PreflightValidator()
    vision = VisionCritic()
    
    print(f"Connected to Dispatch Bus at {DISPATCH_URL}")
    print("Waiting for build/complete events from ATELIER/STITCH...")
    
    events_url = f"{DISPATCH_URL}/api/events"
    try:
        response = requests.get(events_url, stream=True)
        response.raise_for_status()
        client = sseclient.SSEClient(response)
        
        for event in client.events():
            if event.event == 'ping':
                continue
                
            print(f"Received event: {event.event}")
            
            if event.event == 'build/complete':
                try:
                    data = json.loads(event.data)
                    url = data.get("url", "http://localhost:3000") # fallback for demo
                    source_code = data.get("source_code", "")
                    task_id = data.get("task_id", "unknown_task")
                    
                    # 1. Run pre-flight checks
                    if source_code and not preflight.validate_code(source_code):
                        print("[Preflight] Code validation failed. Skipping vision critique.")
                        dispatch_feedback({"status": "fail", "issues": ["Preflight validation failed."]}, task_id)
                        continue
                    
                    # 2. Trigger Playwright capture
                    screenshot_path = f"/tmp/capture_{int(time.time())}.webp"
                    capture_screenshot(url, screenshot_path)
                    
                    # 3. Run Vision critique
                    critique = vision.critique_screenshot(screenshot_path, prompt_context="Assess UI adherence to design tokens.")
                    
                    # 4. Dispatch feedback loop event back to ATELIER
                    dispatch_feedback(critique, task_id)
                    
                except json.JSONDecodeError:
                    print("[Error] Failed to parse event data as JSON.")
                except Exception as e:
                    print(f"[Error] Processing build/complete event: {e}")
            
    except Exception as e:
        print(f"Error connecting to dispatch SSE: {e}")
        time.sleep(5)

if __name__ == "__main__":
    while True:
        start_visual_feedback_loop()

