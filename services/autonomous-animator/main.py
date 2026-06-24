import os
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from orchestrator import process_bundle

app = FastAPI(title="Autonomous Animator API")

class BundleRequest(BaseModel):
    bundle_path: str
    project_id: str

@app.post("/api/v1/jobs/submit")
async def submit_job(request: BundleRequest, background_tasks: BackgroundTasks):
    if not os.path.exists(request.bundle_path):
        raise HTTPException(status_code=400, detail="Bundle path does not exist")
    
    # In a real system, this would go to Celery. For simplicity in the initial V6 deployment,
    # we use FastAPI BackgroundTasks.
    background_tasks.add_task(process_bundle, request.bundle_path, request.project_id)
    
    return {"status": "accepted", "job_id": request.project_id, "message": "Bundle processing started"}

@app.get("/api/v1/jobs/{job_id}/status")
async def get_status(job_id: str):
    # Mock status for now. In production, read from Redis/DB.
    return {"job_id": job_id, "status": "processing"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8050)
