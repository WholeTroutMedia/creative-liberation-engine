import os
import logging
from moviepy.editor import ImageSequenceClip, AudioFileClip
from schemas import AssetBundleManifest

logger = logging.getLogger(__name__)

class Compositor:
    def __init__(self, manifest: AssetBundleManifest, bundle_path: str):
        self.manifest = manifest
        self.bundle_path = bundle_path
        
    def composite(self, synthesized_frames_dir: str) -> str:
        logger.info("Compositing final video...")
        output_path = os.path.join(self.bundle_path, "final_output.mp4")
        
        # 1. Gather frames
        frame_files = sorted([
            os.path.join(synthesized_frames_dir, f) 
            for f in os.listdir(synthesized_frames_dir) 
            if f.endswith('.png')
        ])
        
        if not frame_files:
            raise ValueError(f"No frames found in {synthesized_frames_dir}")
            
        # 2. Apply Temporal Decimation / Frame Rate
        fps = self.manifest.fps_target # e.g., 12 fps for that hand-drawn look
        logger.info(f"Setting final render FPS to {fps}")
        
        # 3. Create clip
        clip = ImageSequenceClip(frame_files, fps=fps)
        
        # 4. Attach Audio (if present in bundle)
        audio_dir = os.path.join(self.bundle_path, "audio")
        if os.path.exists(audio_dir):
            audio_files = [f for f in os.listdir(audio_dir) if f.endswith(('.mp3', '.wav'))]
            if audio_files:
                # Just take the first one for the prototype
                audio_path = os.path.join(audio_dir, audio_files[0])
                logger.info(f"Attaching audio track: {audio_path}")
                audio_clip = AudioFileClip(audio_path)
                clip = clip.set_audio(audio_clip)
                
        # 5. Render
        logger.info(f"Writing video to {output_path}")
        clip.write_videofile(
            output_path, 
            codec="libx264", 
            audio_codec="aac",
            logger=None # Suppress moviepy stdout
        )
        
        return output_path
