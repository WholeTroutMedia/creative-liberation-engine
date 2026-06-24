"""Vertex AI Engine - Production-ready integration with Google's latest models."""
import logging
import os
from typing import Dict, Any, Optional, List
import base64
import json
import time

logger = logging.getLogger(__name__)

try:
    import vertexai
    from vertexai.preview.vision_models import ImageGenerationModel, ImageGenerationResponse
    from vertexai.generative_models import GenerativeModel
    VERTEX_AI_AVAILABLE = True
except ImportError:
    VERTEX_AI_AVAILABLE = False
    logger.warning("Vertex AI SDK not installed. Install with: pip install google-cloud-aiplatform")


class VertexAIEngine:
    """
    Vertex AI integration for image, video, and text generation.
    
    Supports:
    - Imagen 3 (image generation)
    - Imagen 4 (preview)
    - Veo 2 (video generation)
    - Gemini 2.0 Flash (text generation)
    """
    
    def __init__(self):
        """Initialize Vertex AI engine."""
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.location = os.getenv("VERTEX_AI_LOCATION", "us-central1")
        
        if not self.project_id:
            logger.warning("GOOGLE_CLOUD_PROJECT not set. Vertex AI will not work.")
            self.initialized = False
            return
        
        if not VERTEX_AI_AVAILABLE:
            logger.error("Vertex AI SDK not available")
            self.initialized = False
            return
        
        try:
            vertexai.init(project=self.project_id, location=self.location)
            self.initialized = True
            logger.info(f"✅ Vertex AI initialized: {self.project_id} ({self.location})")
        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI: {str(e)}")
            self.initialized = False
    
    async def generate_image(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        model: str = "imagen-3.0-generate-001",
        aspect_ratio: str = "1:1",
        number_of_images: int = 1,
        guidance_scale: float = 7.0,
        seed: Optional[int] = None,
        safety_filter_level: str = "block_medium_and_above",
        person_generation: str = "allow_adult"
    ) -> Dict[str, Any]:
        """
        Generate images using Vertex AI Imagen.
        
        Args:
            prompt: Text description of desired image
            negative_prompt: What to avoid in the image
            model: Imagen model version
            aspect_ratio: Image dimensions (1:1, 16:9, 9:16, 4:3, 3:4)
            number_of_images: How many images to generate (1-4)
            guidance_scale: How closely to follow prompt (0-15)
            seed: Random seed for reproducibility
            safety_filter_level: Content filtering level
            person_generation: Person generation policy
            
        Returns:
            Dict with status, images, and metadata
        """
        if not self.initialized:
            return {
                "status": "error",
                "error": "Vertex AI not initialized. Check GOOGLE_CLOUD_PROJECT environment variable.",
                "cost_usd": 0
            }
        
        try:
            start_time = time.time()
            
            # Load Imagen model
            imagen_model = ImageGenerationModel.from_pretrained(model)
            
            # Generate images
            generation_params = {
                "prompt": prompt,
                "number_of_images": number_of_images,
                "aspect_ratio": aspect_ratio,
                "guidance_scale": guidance_scale,
                "safety_filter_level": safety_filter_level,
                "person_generation": person_generation
            }
            
            if negative_prompt:
                generation_params["negative_prompt"] = negative_prompt
            
            if seed is not None:
                generation_params["seed"] = seed
            
            response: ImageGenerationResponse = imagen_model.generate_images(**generation_params)
            
            # Process results
            images = []
            for idx, image in enumerate(response.images):
                # Convert to base64 for storage
                image_bytes = image._image_bytes
                image_base64 = base64.b64encode(image_bytes).decode('utf-8')
                
                images.append({
                    "index": idx,
                    "data": image_base64,
                    "format": "png",
                    "size": len(image_bytes)
                })
            
            generation_time = time.time() - start_time
            
            # Calculate cost (Imagen 3 pricing: ~$0.04 per image)
            cost_per_image = 0.04 if "imagen-3" in model else 0.02
            total_cost = cost_per_image * number_of_images
            
            logger.info(
                f"Generated {number_of_images} images with {model} "
                f"in {generation_time:.2f}s (${total_cost:.4f})"
            )
            
            return {
                "status": "success",
                "images": images,
                "metadata": {
                    "model": model,
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "generation_time_seconds": generation_time,
                    "seed": seed
                },
                "cost_usd": total_cost
            }
            
        except Exception as e:
            logger.error(f"Image generation failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "cost_usd": 0
            }
    
    async def generate_video(
        self,
        prompt: str,
        model: str = "veo-2",
        duration: int = 5,
        aspect_ratio: str = "16:9",
        guidance_scale: float = 7.0,
        seed: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generate videos using Vertex AI Veo.
        
        Args:
            prompt: Text description of desired video
            model: Veo model version (veo-2, veo-3)
            duration: Video length in seconds (2-8)
            aspect_ratio: Video dimensions
            guidance_scale: How closely to follow prompt
            seed: Random seed for reproducibility
            
        Returns:
            Dict with status, video URL, and metadata
        """
        if not self.initialized:
            return {
                "status": "error",
                "error": "Vertex AI not initialized",
                "cost_usd": 0
            }
        
        try:
            # TODO: Veo 2 API not yet available in SDK
            # This is a placeholder until Google releases the API
            
            logger.warning(f"Veo 2 API not yet available. Returning placeholder.")
            
            return {
                "status": "pending",
                "message": "Veo 2 video generation coming soon. API not yet released by Google.",
                "video_url": None,
                "metadata": {
                    "model": model,
                    "prompt": prompt,
                    "duration": duration,
                    "aspect_ratio": aspect_ratio
                },
                "cost_usd": 0.50  # Estimated
            }
            
        except Exception as e:
            logger.error(f"Video generation failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "cost_usd": 0
            }
    
    async def generate_text(
        self,
        prompt: str,
        model: str = "gemini-2.0-flash-exp",
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 0.95,
        system_instruction: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate text using Vertex AI Gemini.
        
        Args:
            prompt: Input text/question
            model: Gemini model version
            max_tokens: Maximum response length
            temperature: Randomness (0-2)
            top_p: Nucleus sampling threshold
            system_instruction: System prompt for behavior
            
        Returns:
            Dict with status, generated text, and metadata
        """
        if not self.initialized:
            return {
                "status": "error",
                "error": "Vertex AI not initialized",
                "cost_usd": 0
            }
        
        try:
            start_time = time.time()
            
            # Load Gemini model
            generation_config = {
                "max_output_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
            }
            
            gemini_model = GenerativeModel(
                model,
                generation_config=generation_config,
                system_instruction=system_instruction
            )
            
            # Generate response
            response = gemini_model.generate_content(prompt)
            
            generation_time = time.time() - start_time
            
            # Extract text
            generated_text = response.text
            
            # Calculate cost (Gemini 2.0 Flash: ~$0.001 per 1K tokens)
            # Rough estimate: 4 characters = 1 token
            estimated_tokens = len(prompt + generated_text) // 4
            cost = (estimated_tokens / 1000) * 0.001
            
            logger.info(
                f"Generated {len(generated_text)} chars with {model} "
                f"in {generation_time:.2f}s (${cost:.6f})"
            )
            
            return {
                "status": "success",
                "text": generated_text,
                "metadata": {
                    "model": model,
                    "prompt_length": len(prompt),
                    "response_length": len(generated_text),
                    "generation_time_seconds": generation_time,
                    "estimated_tokens": estimated_tokens
                },
                "cost_usd": cost
            }
            
        except Exception as e:
            logger.error(f"Text generation failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "cost_usd": 0
            }


# Singleton instance
vertex_engine = VertexAIEngine()
