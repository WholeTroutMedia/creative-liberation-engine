#!/usr/bin/env python3
"""
Luminous Gallery - Asset Optimization Pipeline
----------------------------------------------
Author: Lead Systems and Pipeline Architect
Target: Y:\\creative-liberation-engine\\surfaces\\luminous-gallery\\scripts\\optimize_assets.py

Description:
    Securely reads high-resolution raw prints from W:\\Photos\\LuminousGallery\\Prints\\
    and downscales them into highly-optimized WebP previews and thumbnails,
    writing directly to the public prints directory.
"""

import os
import sys
import time
from PIL import Image

# Enable ANSI escape sequences on Windows
if sys.platform == 'win32':
    os.system('color')

# --- CONFIGURATION CONSTANTS ---
SOURCE_DIR = r"W:\Photos\LuminousGallery\Prints"
OUTPUT_DIR = r"Y:\creative-liberation-engine\surfaces\luminous-gallery\public\prints"

FILE_NAMES = [
    "Serenity.jpg",
    "Duality.jpg",
    "No_Place_Like_Home.jpg"
]

# Widescreen Preview Settings (Max 1600px, 82% quality)
PREVIEW_MAX_SIZE = 1600
PREVIEW_QUALITY = 82

# Thumbnail Settings (Max 400px, 75% quality)
THUMB_MAX_SIZE = 400
THUMB_QUALITY = 75

# Resampling Method Fallback
try:
    RESAMPLE_METHOD = Image.Resampling.LANCZOS
except AttributeError:
    RESAMPLE_METHOD = Image.ANTIALIAS


class ColorLogger:
    BLUE = "\033[94m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    RESET = "\033[0m"
    BOLD = "\033[1m"

    @classmethod
    def info(cls, msg):
        print(f"{cls.BLUE}[INFO]{cls.RESET} {msg}")

    @classmethod
    def success(cls, msg):
        print(f"{cls.GREEN}{cls.BOLD}[SUCCESS]{cls.RESET} {msg}")

    @classmethod
    def warn(cls, msg):
        print(f"{cls.YELLOW}[WARN]{cls.RESET} {msg}")

    @classmethod
    def error(cls, msg):
        print(f"{cls.RED}{cls.BOLD}[ERROR]{cls.RESET} {msg}", file=sys.stderr)

    @classmethod
    def section(cls, msg):
        print(f"\n{cls.CYAN}{cls.BOLD}=== {msg} ==={cls.RESET}")

    @classmethod
    def file_status(cls, file_path, action, size_bytes):
        size_str = cls.format_size(size_bytes)
        print(f"  {cls.MAGENTA}-> {action}:{cls.RESET} {os.path.basename(file_path)} ({cls.GREEN}{size_str}{cls.RESET})")

    @staticmethod
    def format_size(size_bytes):
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} TB"


def init_directories():
    """Initializes the output public directories securely."""
    ColorLogger.section("Initializing Directories")
    if not os.path.exists(OUTPUT_DIR):
        ColorLogger.info(f"Creating output directory: {OUTPUT_DIR}")
        try:
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            ColorLogger.success(f"Successfully initialized output directory: {OUTPUT_DIR}")
        except Exception as e:
            ColorLogger.error(f"Failed to create output directory {OUTPUT_DIR}: {e}")
            raise
    else:
        ColorLogger.success(f"Output directory already exists: {OUTPUT_DIR}")


def resize_image(img, max_size):
    """Calculates aspect ratio and resizes image using high-quality resampling."""
    width, height = img.size
    
    # Do not upscale if image is already smaller
    if max(width, height) <= max_size:
        ColorLogger.info(f"Image dimensions ({width}x{height}) are within max limit ({max_size}px). Copying without resize.")
        return img.copy()
        
    if width > height:
        new_width = max_size
        new_height = int((height * max_size) / width)
    else:
        new_height = max_size
        new_width = int((width * max_size) / height)
        
    ColorLogger.info(f"Resizing from {width}x{height} to {new_width}x{new_height}")
    return img.resize((new_width, new_height), resample=RESAMPLE_METHOD)


def process_single_print(file_name):
    """Processes a single raw print file, producing preview and thumbnail WebPs."""
    source_path = os.path.join(SOURCE_DIR, file_name)
    base_name = os.path.splitext(file_name)[0]
    
    ColorLogger.section(f"Processing Print: {file_name}")
    
    # 1. Existence and Validation Check
    if not os.path.exists(source_path):
        ColorLogger.error(f"Source file does not exist at: {source_path}")
        return False
        
    start_time = time.time()
    source_size = os.path.getsize(source_path)
    ColorLogger.info(f"Source detected: {source_path} ({ColorLogger.format_size(source_size)})")
    
    try:
        with Image.open(source_path) as img:
            ColorLogger.success(f"Loaded image successfully. Format: {img.format}, Size: {img.size}")
            
            # --- PREVIEW GENERATION ---
            preview_path = os.path.join(OUTPUT_DIR, f"{base_name}_preview.webp")
            ColorLogger.info(f"Generating Preview (Max {PREVIEW_MAX_SIZE}px, Quality {PREVIEW_QUALITY}%)")
            
            preview_img = resize_image(img, PREVIEW_MAX_SIZE)
            preview_img.save(preview_path, "WEBP", quality=PREVIEW_QUALITY)
            
            preview_size = os.path.getsize(preview_path)
            ColorLogger.file_status(preview_path, "Saved Preview", preview_size)
            
            # --- THUMBNAIL GENERATION ---
            thumb_path = os.path.join(OUTPUT_DIR, f"{base_name}_thumb.webp")
            ColorLogger.info(f"Generating Thumbnail (Max {THUMB_MAX_SIZE}px, Quality {THUMB_QUALITY}%)")
            
            thumb_img = resize_image(img, THUMB_MAX_SIZE)
            thumb_img.save(thumb_path, "WEBP", quality=THUMB_QUALITY)
            
            thumb_size = os.path.getsize(thumb_path)
            ColorLogger.file_status(thumb_path, "Saved Thumbnail", thumb_size)
            
            # Close intermediate images to free memory
            preview_img.close()
            thumb_img.close()
            
        elapsed = time.time() - start_time
        ColorLogger.success(f"Finished processing {file_name} in {elapsed:.2f} seconds.")
        return True
        
    except Exception as e:
        ColorLogger.error(f"Failed to process image {file_name}: {e}")
        return False


def main():
    ColorLogger.section("LUMINOUS GALLERY - ASSET OPTIMIZATION PIPELINE START")
    print(f"Source Directory: {SOURCE_DIR}")
    print(f"Output Directory: {OUTPUT_DIR}")
    
    # Check if PIL is available
    try:
        import PIL
        ColorLogger.info(f"Pillow version: {PIL.__version__}")
    except ImportError:
        ColorLogger.error("Pillow (PIL) is not installed in the current Python environment.")
        ColorLogger.info("Please install it using: pip install Pillow")
        sys.exit(1)
        
    # Verify source directory exists
    if not os.path.exists(SOURCE_DIR):
        ColorLogger.error(f"Source directory does not exist: {SOURCE_DIR}")
        sys.exit(1)
        
    init_directories()
    
    success_count = 0
    for file_name in FILE_NAMES:
        if process_single_print(file_name):
            success_count += 1
            
    ColorLogger.section("PIPELINE SUMMARY")
    total_files = len(FILE_NAMES)
    if success_count == total_files:
        ColorLogger.success(f"Pipeline completed perfectly. {success_count}/{total_files} prints processed.")
    else:
        ColorLogger.warn(f"Pipeline completed with warnings/errors. {success_count}/{total_files} prints processed successfully.")


if __name__ == "__main__":
    main()
