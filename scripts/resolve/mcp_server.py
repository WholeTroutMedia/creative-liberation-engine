"""
DaVinci Resolve MCP Server
Provides an MCP interface to control DaVinci Resolve timelines autonomously.
"""

import sys
import json
import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ResolveMCP")

class ResolveController:
    def __init__(self):
        self.resolve = None
        self.project_manager = None
        self.current_project = None
        self.media_pool = None
        
        self.connect()

    def connect(self):
        """Connects to the DaVinci Resolve scripting API."""
        try:
            import DaVinciResolveScript as dvr_script
            self.resolve = dvr_script.scriptapp("Resolve")
            if not self.resolve:
                logger.error("Could not connect to DaVinci Resolve. Is it running?")
                return False
                
            self.project_manager = self.resolve.GetProjectManager()
            self.current_project = self.project_manager.GetCurrentProject()
            if self.current_project:
                self.media_pool = self.current_project.GetMediaPool()
                logger.info(f"Connected to project: {self.current_project.GetName()}")
            return True
        except ImportError:
            logger.error("DaVinciResolveScript module not found. Ensure PYTHONPATH is set correctly.")
            return False

    def add_splat_to_timeline(self, filepath: str, track_name: str = "V1"):
        """Adds a rendered 3DGS sequence or splat render to the timeline."""
        if not self.current_project or not self.media_pool:
            return {"error": "Not connected to an active project."}
            
        # 1. Import media
        media_storage = self.resolve.GetMediaStorage()
        imported_items = media_storage.AddItemListToMediaPool(filepath)
        
        if not imported_items:
            return {"error": f"Failed to import {filepath}"}
            
        # 2. Add to timeline (Simplified stub)
        timeline = self.current_project.GetCurrentTimeline()
        if not timeline:
            # Create a new timeline if none exists
            timeline = self.media_pool.CreateEmptyTimeline("Autogen_Splat_Timeline")
            
        # Append to end of timeline
        # In a real scenario, we'd use MediaPool.AppendToTimeline(imported_items)
        # Note: DaVinci Scripting API for timeline manipulation is limited, 
        # often requires appending clips.
        self.media_pool.AppendToTimeline(imported_items)
        
        return {
            "status": "success",
            "message": f"Added {filepath} to timeline {timeline.GetName()}",
            "timeline": timeline.GetName()
        }

# --- MCP Protocol Stubs ---

def handle_request(req: Dict[str, Any], controller: ResolveController) -> Dict[str, Any]:
    method = req.get("method")
    params = req.get("params", {})
    
    if method == "ping":
        return {"result": "pong"}
        
    elif method == "addSplat":
        filepath = params.get("filepath")
        intent_rationale = params.get("intent_rationale")
        
        if not filepath:
            return {"error": "Missing filepath parameter"}
        if not intent_rationale:
            return {"error": "Missing intent_rationale parameter. All autonomous operations require an explicit rationale."}
            
        logger.info(f"Intent Rationale: {intent_rationale}")
        return controller.add_splat_to_timeline(filepath)
        
    else:
        return {"error": f"Unknown method: {method}"}

def main():
    logger.info("Starting DaVinci Resolve MCP Server...")
    controller = ResolveController()
    
    # Simple stdio server loop
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
                
            req = json.loads(line.strip())
            res = handle_request(req, controller)
            
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except json.JSONDecodeError:
            logger.error("Invalid JSON received.")
        except Exception as e:
            logger.error(f"Error processing request: {e}")

if __name__ == "__main__":
    main()
