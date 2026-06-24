import asyncio
import json
import psutil
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                pass

manager = ConnectionManager()

# Try to import GPUtil for GPU stats, otherwise mock
try:
    import GPUtil
    HAS_GPU = True
except ImportError:
    HAS_GPU = False

async def collect_telemetry():
    """Gathers real-time OS metrics."""
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory().percent
    
    gpu_load = 0
    gpu_temp = 0
    if HAS_GPU:
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu_load = gpus[0].load * 100
            gpu_temp = gpus[0].temperature

    # In a real setup, we'd read this from a Redis/Qdrant queue
    dispatch_pending = 2
    dispatch_active = 1
    
    return {
        "latency": 5,
        "systemsNominal": True,
        "globalHeat": gpu_temp if gpu_temp > 0 else 45.0,
        "nodesActive": 14210,
        "dispatch": {
            "pending": dispatch_pending,
            "active": dispatch_active,
            "resolved": 12
        },
        "agents": [
            {
                "id": "ATHENA",
                "name": "ATHENA",
                "status": "ONLINE // CORE_SYSTEM",
                "statusColor": "#00ff41",
                "cpu": int(cpu),
                "gpu": int(gpu_load),
                "uptime": "142:12:05",
                "isActive": True
            },
            {
                "id": "VERA",
                "name": "VERA",
                "status": "BUSY // INTEL_SCAN",
                "statusColor": "#00ff41",
                "cpu": int(cpu * 0.8),
                "gpu": int(gpu_load * 0.9),
                "uptime": "89:44:12",
                "isActive": True
            }
        ],
        "memoryLogs": [
            {"id": int(time.time()), "time": time.strftime("%H:%M:%S"), "tag": "[SYS]", "text": "Telemetry WebSocket Active.", "type": "sys"}
        ]
    }

async def telemetry_loop():
    while True:
        data = await collect_telemetry()
        await manager.broadcast(data)
        await asyncio.sleep(1.0) # 1Hz refresh rate

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_loop())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We don't expect messages from the client yet, just keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5160)
