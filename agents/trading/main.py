import os
import time
import json
import requests
import sseclient
from bull_agent import BullAgent
from bear_agent import BearAgent
from risk_manager import RiskManager

DISPATCH_URL = os.getenv("DISPATCH_URL", "http://dispatch:5050")

def dispatch_trade_decision(decision: bool, asset: str, task_id: str = None):
    print(f"[Dispatch] Sending trade decision to {DISPATCH_URL}...")
    try:
        endpoint = f"{DISPATCH_URL}/api/notify"
        payload = {
            "agent": "trading_architecture",
            "type": "trade_decision",
            "task_id": task_id,
            "decision": decision,
            "asset": asset
        }
        res = requests.post(endpoint, json=payload)
        res.raise_for_status()
        print(f"[Dispatch] Trade decision ({decision}) sent successfully.")
    except Exception as e:
        print(f"[Dispatch] Failed to send trade decision: {e}")

def poll_market_events():
    print("Trading Architecture Daemon Boot Sequence...")
    bull = BullAgent()
    bear = BearAgent()
    risk = RiskManager()
    
    print(f"Connected to Dispatch Bus at {DISPATCH_URL}")
    print("Listening for Polymarket/Binance arbitrage signals...")
    
    events_url = f"{DISPATCH_URL}/api/events"
    try:
        response = requests.get(events_url, stream=True)
        response.raise_for_status()
        client = sseclient.SSEClient(response)
        
        for event in client.events():
            if event.event == 'ping':
                continue
                
            print(f"Received event: {event.event}")
            
            # Listen for market/tick or news/alert
            if event.event in ['market/tick', 'news/alert']:
                start_time = time.time()
                try:
                    market_data = json.loads(event.data)
                    task_id = market_data.get("task_id", "unknown_task")
                    
                    # 1. Bull analyzes momentum
                    bull_signal = bull.analyze_momentum(market_data)
                    
                    # 2. Bear analyzes risk
                    bear_signal = bear.analyze_risk(market_data, bull_signal)
                    
                    # Calculate total latency so far
                    end_time = time.time()
                    current_latency_ms = int((end_time - start_time) * 1000)
                    
                    # 3. Risk Manager intercepts
                    approved = risk.evaluate_trade(bull_signal, bear_signal, current_latency_ms)
                    
                    # 4. Dispatch Result back
                    dispatch_trade_decision(approved, bull_signal.get("asset", "UNKNOWN"), task_id)

                except json.JSONDecodeError:
                    print("[Error] Failed to parse event data as JSON.")
                except Exception as e:
                    print(f"[Error] Processing market event: {e}")
            
    except Exception as e:
        print(f"Error connecting to dispatch SSE: {e}")
        time.sleep(5)

if __name__ == "__main__":
    while True:
        poll_market_events()

