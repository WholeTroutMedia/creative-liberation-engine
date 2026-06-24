#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Creative Liberation Engine V6 -- Branded Show Poster Generator (Pillow Edition)
Takes a high-impact venue photo from The Vault, applies brand color grading,
overlays event text and the Barnstorm logo to produce a ready-to-post poster.

Dependencies: Pillow (pip install Pillow)

Usage:
    python poster_generator.py --venue "North Jersey Country Club" --year 2026 --date "June 27, 2025" --tagline "LIVE AT THE NORTH JERSEY CC"
    python poster_generator.py --photo "\\\\127.0.0.1\\...\\photo.jpg" --date "June 27" --tagline "BOOK US NOW"
"""

import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# --- Configuration --------------------------------------------------------

NAS_BASE = "W:\\" if os.path.exists("W:\\") else r"\\127.0.0.1\The Vault"
BRAND_ASSETS = {
    "logo_transparent_png": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\The Barnstorm Logo - Black Transparent.png"),
    "logo_transparent_jpg": os.path.join(NAS_BASE, r"RAW Backups\2025\Barnstorm 2025\The Barnstorm Logo - Black Transparent.jpg"),
}

# Poster dimensions (Instagram square and story)
POSTER_SIZES = {
    "square": (1080, 1080),   # Instagram feed
    "story": (1080, 1920),    # Instagram story / TikTok
    "landscape": (1920, 1080) # YouTube thumbnail / Facebook
}

OUTPUT_DIR_NAME = "_generated_posters"

# Font paths (Windows)
FONT_BOLD = r"C:\Windows\Fonts\arialbd.ttf"
FONT_REGULAR = r"C:\Windows\Fonts\arial.ttf"

# --- Image Processing -----------------------------------------------------

def find_best_photo(folder_path: str) -> str:
    """Find the highest quality photo in a venue folder."""
    candidates = []
    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if d != "@eaDir"]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in {".jpg", ".jpeg", ".png"}:
                full = os.path.join(root, f)
                try:
                    size = os.path.getsize(full)
                    candidates.append((full, size))
                except OSError:
                    continue

    if not candidates:
        return ""

    # Return largest file (likely highest quality)
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[0][0]


def crop_to_fill(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale and center-crop an image to exactly fill target dimensions."""
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    tgt_ratio = target_w / target_h

    if src_ratio > tgt_ratio:
        # Source is wider -- scale to target height, crop width
        new_h = target_h
        new_w = int(src_w * (target_h / src_h))
    else:
        # Source is taller -- scale to target width, crop height
        new_w = target_w
        new_h = int(src_h * (target_w / src_w))

    img = img.resize((new_w, new_h), Image.LANCZOS)

    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def apply_color_grade(img: Image.Image) -> Image.Image:
    """Apply brand color grading: vibrance boost, contrast, warm tone."""
    # Boost saturation
    enhancer = ImageEnhance.Color(img)
    img = enhancer.enhance(1.35)

    # Boost contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.15)

    # Slight brightness lift
    enhancer = ImageEnhance.Brightness(img)
    img = enhancer.enhance(1.03)

    return img


def apply_vignette(img: Image.Image, intensity: float = 0.6) -> Image.Image:
    """Apply a dark vignette effect around the edges."""
    w, h = img.size

    # Create radial gradient mask
    vignette = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(vignette)

    # Draw concentric ellipses from bright center to dark edges
    max_dim = max(w, h)
    steps = 80
    for i in range(steps):
        ratio = i / steps
        brightness = int(255 * (1.0 - ratio * intensity))
        inset_x = int(w * ratio * 0.5)
        inset_y = int(h * ratio * 0.5)
        draw.ellipse(
            [inset_x, inset_y, w - inset_x, h - inset_y],
            fill=brightness
        )

    # Apply as luminance mask via composite
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    return Image.composite(img, dark, vignette)


def overlay_logo(img: Image.Image, logo_path: str, scale: float = 0.30) -> Image.Image:
    """Overlay the brand logo centered at the bottom."""
    try:
        logo = Image.open(logo_path).convert("RGBA")
    except Exception as e:
        print(f"  [WARN] Could not load logo: {e}")
        return img

    w, h = img.size
    logo_w = int(w * scale)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)

    # Position: centered, bottom with margin
    x = (w - logo_w) // 2
    y = h - logo_h - int(h * 0.06)

    # Ensure base image has alpha channel for compositing
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    img.paste(logo, (x, y), logo)
    return img


def draw_text_with_shadow(
    draw: ImageDraw.Draw,
    text: str,
    font: ImageFont.FreeTypeFont,
    x: int, y: int,
    fill: str = "white",
    shadow_color: str = "black",
    shadow_offset: int = 3
):
    """Draw text with a drop shadow for readability."""
    # Shadow
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=shadow_color)
    # Main text
    draw.text((x, y), text, font=font, fill=fill)


def generate_poster(
    photo_path: str,
    output_path: str,
    logo_path: str,
    event_text: str,
    date_text: str,
    size_name: str = "story"
) -> bool:
    """Generate a branded poster using Pillow."""
    w, h = POSTER_SIZES.get(size_name, POSTER_SIZES["story"])

    try:
        # 1. Load and crop
        img = Image.open(photo_path).convert("RGB")
        img = crop_to_fill(img, w, h)

        # 2. Color grade
        img = apply_color_grade(img)

        # 3. Vignette
        img = apply_vignette(img)

        # 4. Logo overlay
        if logo_path and os.path.exists(logo_path):
            img = overlay_logo(img, logo_path)

        # Ensure RGB for JPEG output
        if img.mode == "RGBA":
            bg = Image.new("RGB", img.size, (0, 0, 0))
            bg.paste(img, mask=img.split()[3])
            img = bg

        # 5. Text overlays
        draw = ImageDraw.Draw(img)

        # Event title -- large, bold, centered at top
        title_size = int(h * 0.045)
        title_y = int(h * 0.08)

        try:
            title_font = ImageFont.truetype(FONT_BOLD, title_size)
        except Exception:
            title_font = ImageFont.load_default()

        # Center text
        bbox = draw.textbbox((0, 0), event_text, font=title_font)
        text_w = bbox[2] - bbox[0]
        title_x = (w - text_w) // 2
        draw_text_with_shadow(draw, event_text, title_font, title_x, title_y)

        # Date text -- smaller, below title
        if date_text:
            date_size = int(h * 0.03)
            date_y_pos = title_y + title_size + int(h * 0.02)

            try:
                date_font = ImageFont.truetype(FONT_REGULAR, date_size)
            except Exception:
                date_font = ImageFont.load_default()

            bbox = draw.textbbox((0, 0), date_text, font=date_font)
            text_w = bbox[2] - bbox[0]
            date_x = (w - text_w) // 2
            draw_text_with_shadow(draw, date_text, date_font, date_x, date_y_pos, shadow_offset=2)

        # 6. Save
        img.save(output_path, "JPEG", quality=95, subsampling=0)
        return True

    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


# --- Main Pipeline --------------------------------------------------------

def run_pipeline(
    photo_path: str,
    venue_name: str,
    event_text: str,
    date_text: str,
    sizes: list
):
    """Execute the poster generation pipeline."""

    print(f"\n{'='*60}")
    print(f"  BARNSTORM POSTER GENERATOR")
    print(f"  Venue: {venue_name}")
    print(f"{'='*60}\n")

    # Step 1: Find or validate source photo
    print("[1/3] Locating source photo...")

    if os.path.isdir(photo_path):
        source_photo = find_best_photo(photo_path)
        if not source_photo:
            print("  [ERROR] No photos found in folder.")
            sys.exit(1)
        print(f"  Auto-selected: {os.path.basename(source_photo)}")
        output_base = photo_path
    else:
        source_photo = photo_path
        output_base = os.path.dirname(photo_path)

    print(f"  Source: {source_photo}")
    size_mb = os.path.getsize(source_photo) / (1024 * 1024)
    print(f"  Size: {size_mb:.1f} MB")

    # Verify with Pillow
    try:
        test_img = Image.open(source_photo)
        print(f"  Dimensions: {test_img.size[0]}x{test_img.size[1]} ({test_img.mode})")
        test_img.close()
    except Exception as e:
        print(f"  [ERROR] Cannot open image: {e}")
        sys.exit(1)

    # Step 2: Find logo
    print("\n[2/3] Loading brand assets...")
    logo_path = BRAND_ASSETS["logo_transparent_png"]
    if not os.path.exists(logo_path):
        logo_path = BRAND_ASSETS["logo_transparent_jpg"]
    if not os.path.exists(logo_path):
        print("  [WARN] Logo not found. Generating without logo overlay.")
        logo_path = None
    else:
        print(f"  Logo: {os.path.basename(logo_path)}")

    # Step 3: Generate posters
    output_dir = os.path.join(output_base, OUTPUT_DIR_NAME)
    os.makedirs(output_dir, exist_ok=True)

    print(f"\n[3/3] Generating posters...")
    generated = []

    for size_name in sizes:
        w, h = POSTER_SIZES.get(size_name, POSTER_SIZES["story"])
        output_file = os.path.join(
            output_dir,
            f"poster_{venue_name.replace(' ', '_')}_{size_name}.jpg"
        )

        print(f"\n  -> {size_name} ({w}x{h})")

        success = generate_poster(
            source_photo, output_file, logo_path,
            event_text, date_text, size_name
        )

        if success:
            generated.append(output_file)
            out_size = os.path.getsize(output_file) / 1024
            print(f"    [OK] {output_file} ({out_size:.0f}KB)")
        else:
            print(f"    [FAIL] Failed to generate {size_name}")

    # Summary
    print(f"\n{'='*60}")
    print(f"  POSTER GENERATION COMPLETE")
    print(f"  Generated: {len(generated)}/{len(sizes)} posters")
    print(f"  Output dir: {output_dir}")
    for f in generated:
        print(f"    - {os.path.basename(f)}")
    print(f"{'='*60}\n")

    return generated


# --- CLI ------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Barnstorm Branded Poster Generator")
    parser.add_argument("--venue", type=str, help="Venue name")
    parser.add_argument("--year", type=int, default=2026, help="Year")
    parser.add_argument("--photo", type=str, help="Direct path to source photo or folder")
    parser.add_argument("--tagline", type=str, default="THE BARNSTORM LIVE", help="Event title text")
    parser.add_argument("--date", type=str, default="", help="Event date text")
    parser.add_argument("--sizes", nargs="+", default=["story", "square", "landscape"],
                       choices=["story", "square", "landscape"],
                       help="Poster sizes to generate")

    args = parser.parse_args()

    if args.photo:
        photo_path = args.photo
        venue_name = args.venue or os.path.basename(os.path.dirname(photo_path) if os.path.isfile(photo_path) else photo_path)
    elif args.venue:
        photo_path = os.path.join(NAS_BASE, f"Photos\\{args.year}\\Barnstorm\\Weddings\\{args.venue}")
        if not os.path.exists(photo_path):
            photo_path = os.path.join(NAS_BASE, f"RAW Backups\\{args.year}\\Barnstorm {args.year}\\Weddings\\{args.venue}")
        venue_name = args.venue
    else:
        parser.error("Either --venue or --photo is required")
        return

    if not os.path.exists(photo_path):
        print(f"[ERROR] Path not found: {photo_path}")
        sys.exit(1)

    run_pipeline(photo_path, venue_name, args.tagline, args.date, args.sizes)


if __name__ == "__main__":
    main()
