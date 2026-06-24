import os
import json
import logging
from modules.director import Director
from modules.animator import Animator
from modules.synthesizer import Synthesizer
from modules.compositor import Compositor
from schemas import AssetBundleManifest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def process_bundle(bundle_path: str, project_id: str):
    logger.info(f"Starting processing for project {project_id} at {bundle_path}")
    
    try:
        # 1. Ingestion & Validation
        config_path = os.path.join(bundle_path, "config.json")
        if not os.path.exists(config_path):
            raise FileNotFoundError("config.json missing from bundle")
        
        with open(config_path, "r") as f:
            manifest = AssetBundleManifest(**json.load(f))
            
        script_path = os.path.join(bundle_path, "script.md")
        if not os.path.exists(script_path):
            raise FileNotFoundError("script.md missing from bundle")
            
        # 2. Module A: The Director
        logger.info("Executing Module A: Director")
        director = Director(manifest)
        script_schema = director.parse_script(script_path)
        timeline_schema = director.generate_timeline(script_schema)
        
        # Save intermediate artifacts for debugging/resumption
        with open(os.path.join(bundle_path, "script_parsed.json"), "w") as f:
            f.write(script_schema.model_dump_json(indent=2))
        with open(os.path.join(bundle_path, "timeline.json"), "w") as f:
            f.write(timeline_schema.model_dump_json(indent=2))
            
        # 3. Module B: The Animator
        logger.info("Executing Module B: Animator")
        animator = Animator(manifest, timeline_schema, bundle_path)
        structural_frames_dir = animator.render_structure()
        
        # 4. Module C: The Synthesizer
        logger.info("Executing Module C: Synthesizer")
        synthesizer = Synthesizer(manifest, bundle_path)
        synthesized_frames_dir = synthesizer.synthesize(structural_frames_dir)
        
        # 5. Module D: The Compositor
        logger.info("Executing Module D: Compositor")
        compositor = Compositor(manifest, bundle_path)
        final_video_path = compositor.composite(synthesized_frames_dir)
        
        logger.info(f"Processing complete! Final video at {final_video_path}")
        
    except Exception as e:
        logger.error(f"Pipeline failed for project {project_id}: {str(e)}")
        raise
