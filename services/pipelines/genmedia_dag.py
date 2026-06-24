import logging
import asyncio
import json
import uuid
import redis.asyncio as redis
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class GenMediaTask:
    task_id: str
    media_type: str
    prompt: str

class GenMediaPipeline:
    """
    Phase 4: Confluent/Spark pipelines driving GenMedia DAGs
    (Vision Banana, Foley Engine, Flow Studio).
    """
    def __init__(self):
        self.logger = logging.getLogger("GenMedia")
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            ch = logging.StreamHandler()
            ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
            self.logger.addHandler(ch)

    async def trigger_spark_job(self, task: GenMediaTask) -> Dict[str, Any]:
        self.logger.info(f"Submitting {task.media_type} task {task.task_id} to Spark pipeline...")
        await asyncio.sleep(1) # Simulate network delay
        return {"status": "queued", "topic": "media-gen-tasks", "job_id": f"spark-{task.task_id}"}

    async def execute_dag(self, task: GenMediaTask) -> Dict[str, Any]:
        job_info = await self.trigger_spark_job(task)
        self.logger.info(f"Wiring Vision Banana / Flow Studio DAG for {task.task_id}...")
        
        # Simulate DAG execution nodes
        await self._node_vision_banana(task)
        
        if task.media_type == "video":
            await self._node_foley_engine(task)
            result = f"nas://media/output_{task.task_id}.mp4"
        else:
            result = f"nas://media/output_{task.task_id}.png"
            
        self.logger.info(f"DAG execution complete for {task.task_id}.")
        return {"status": "completed", "output": result, "spark_job": job_info}

    async def _node_vision_banana(self, task: GenMediaTask):
        self.logger.info(f"[Node: Vision Banana] Rendering visual frames for prompt: '{task.prompt[:30]}...'")
        await asyncio.sleep(1)
        self.logger.info("[Node: Vision Banana] Completed.")

    async def _node_foley_engine(self, task: GenMediaTask):
        self.logger.info(f"[Node: Foley Engine] Synthesizing audio track for task {task.task_id}...")
        await asyncio.sleep(1)
        self.logger.info("[Node: Foley Engine] Completed.")

class MobileBridge:
    """
    Control Plane via Mobile Bridge / iMessage (Photon Spectrum / CORTEX).
    Listens on Redis message bus for genmedia_tasks.
    """
    def __init__(self, redis_host: str = "127.0.0.1", redis_port: int = 6379):
        import os
        host = os.environ.get("REDIS_HOST", redis_host)
        port = os.environ.get("REDIS_PORT", str(redis_port))
        self.redis_url = f"redis://{host}:{port}"
        self.pipeline = GenMediaPipeline()
        self.logger = logging.getLogger("MobileBridge")
        self.logger.setLevel(logging.INFO)
        if not self.logger.handlers:
            ch = logging.StreamHandler()
            ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
            self.logger.addHandler(ch)

    async def receive_command(self, user_id: str, command: str):
        self.logger.info(f"Received from {user_id}: {command}")
        task = GenMediaTask(task_id=str(uuid.uuid4())[:8], media_type="video", prompt=command)
        result = await self.pipeline.execute_dag(task)
        self.logger.info(f"Response to {user_id}: {result}")
        return result

    async def start_listening(self):
        self.logger.info(f"Connecting to Redis at {self.redis_url}...")
        try:
            client = redis.from_url(self.redis_url)
            pubsub = client.pubsub()
            await pubsub.subscribe("genmedia_tasks")
            self.logger.info("Subscribed to channel: genmedia_tasks. Waiting for tasks...")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"].decode("utf-8"))
                        user_id = data.get("user_id", "unknown")
                        command = data.get("command", "")
                        if command:
                            # Execute the DAG asynchronously without blocking the listener loop
                            asyncio.create_task(self.receive_command(user_id, command))
                    except json.JSONDecodeError:
                        self.logger.error("Failed to decode message payload.")
                    except Exception as e:
                        self.logger.error(f"Error processing message: {e}")
        except Exception as e:
            self.logger.error(f"Redis connection failed: {e}")

if __name__ == "__main__":
    bridge = MobileBridge()
    try:
        asyncio.run(bridge.start_listening())
    except KeyboardInterrupt:
        print("\nShutting down Mobile Bridge.")
