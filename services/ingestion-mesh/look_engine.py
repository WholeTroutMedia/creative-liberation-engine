#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
from pathlib import Path
import numpy as np
from PIL import Image

DEFAULT_LUT_PATH = os.environ.get("LUT_PATH", "/app/presets/Lightroom_To_Resolve_Complete.cube")

def load_cube_lut(cube_path):
    """Parses a standard BMD DaVinci Resolve .cube 3D Lookup Table file."""
    if not os.path.exists(cube_path):
        raise FileNotFoundError(f"LUT file not found: {cube_path}")
        
    print(f"[look-engine] Loading 3D LUT: {cube_path}")
    with open(cube_path, 'r') as f:
        lines = f.readlines()
    
    size = None
    lut_data = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('LUT_3D_SIZE'):
            size = int(line.split()[1])
            continue
        # Check if line contains numbers
        parts = line.split()
        if len(parts) == 3:
            try:
                lut_data.append([float(p) for p in parts])
            except ValueError:
                pass
                
    if size is None:
        raise ValueError("Could not find LUT_3D_SIZE in cube file")
        
    # BMD DaVinci Resolve ordering: R fastest, G middle, B slowest.
    # We reshape to (size, size, size, 3) representing dimensions in B, G, R order.
    lut = np.array(lut_data, dtype=np.float32).reshape((size, size, size, 3))
    return size, lut

def apply_lut_trilinear(img_arr, lut, size=33):
    """Vectorized trilinear 3D LUT lookup in pure NumPy."""
    h, w, _ = img_arr.shape
    # Rescale RGB coordinates [0, 1] to [0, size - 1]
    coords = img_arr * (size - 1)
    
    # Split coordinates into RGB channels
    r = coords[:, :, 0]
    g = coords[:, :, 1]
    b = coords[:, :, 2]
    
    # Grid corner indices (floor and ceiling)
    r0 = np.floor(r).astype(np.int32)
    r1 = np.minimum(r0 + 1, size - 1)
    g0 = np.floor(g).astype(np.int32)
    g1 = np.minimum(g0 + 1, size - 1)
    b0 = np.floor(b).astype(np.int32)
    b1 = np.minimum(b0 + 1, size - 1)
    
    # Fractional weights
    dr = np.expand_dims(r - r0, axis=-1)
    dg = np.expand_dims(g - g0, axis=-1)
    db = np.expand_dims(b - b0, axis=-1)
    
    # Retrieve the 8 corner values from the LUT
    # LUT ordering axes are B, G, R (slowest to fastest)
    c000 = lut[b0, g0, r0]
    c001 = lut[b0, g0, r1]
    c010 = lut[b0, g1, r0]
    c011 = lut[b0, g1, r1]
    c100 = lut[b1, g0, r0]
    c101 = lut[b1, g0, r1]
    c110 = lut[b1, g1, r0]
    c111 = lut[b1, g1, r1]
    
    # Interpolate along R axis
    c00 = c000 * (1 - dr) + c001 * dr
    c01 = c010 * (1 - dr) + c011 * dr
    c10 = c100 * (1 - dr) + c101 * dr
    c11 = c110 * (1 - dr) + c111 * dr
    
    # Interpolate along G axis
    c0 = c00 * (1 - dg) + c01 * dg
    c1 = c10 * (1 - dg) + c11 * dg
    
    # Interpolate along B axis
    c = c0 * (1 - db) + c1 * db
    
    return c

def process_raw_to_staged(raw_path, output_jpg_path, lut_path=DEFAULT_LUT_PATH):
    raw_path_obj = Path(raw_path)
    if not raw_path_obj.exists():
        raise FileNotFoundError(f"RAW file not found: {raw_path}")

    # Ensure output parent directory exists
    Path(output_jpg_path).parent.mkdir(parents=True, exist_ok=True)

    flat_jpg_path = output_jpg_path.replace(".jpg", "_flat.jpg")

    # --------------------------------------------------------------------------
    # ENGINE B: darktable-cli + XMP Sidecar
    # --------------------------------------------------------------------------
    xmp_candidates = [
        raw_path_obj.with_suffix(".xmp"),
        raw_path_obj.parent / f"{raw_path_obj.name}.xmp"
    ]
    xmp_path = None
    for candidate in xmp_candidates:
        if candidate.exists():
            xmp_path = candidate
            break

    darktable_cli = shutil.which("darktable-cli")
    if darktable_cli and xmp_path:
        print(f"[look-engine] 🚀 Found darktable-cli and XMP sidecar: {xmp_path}")
        print(f"[look-engine] Developing RAW using darktable-cli...")
        # On some systems, darktable-cli needs output format specified or automatically detects from filename
        cmd = [darktable_cli, str(raw_path_obj), str(xmp_path), flat_jpg_path]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode == 0 and os.path.exists(flat_jpg_path):
            print(f"[look-engine] ✅ Darktable development complete (flat): {flat_jpg_path}")
            try:
                img = Image.open(flat_jpg_path)
                img_arr = np.array(img, dtype=np.float32) / 255.0
                size, lut = load_cube_lut(lut_path)
                print("[look-engine] 🎨 Applying trilinear color mapping to darktable JPEG...")
                graded_arr = apply_lut_trilinear(img_arr, lut, size)
                graded_arr = np.clip(graded_arr * 255.0, 0.0, 255.0).astype(np.uint8)
                graded_img = Image.fromarray(graded_arr)
                graded_img.save(output_jpg_path, quality=92)
                print(f"[look-engine] ✅ Developed graded JPEG written to: {output_jpg_path}")
                return
            except Exception as e:
                print(f"[look-engine WARNING] Failed to apply LUT to darktable JPEG: {e}. Falling back.")
        else:
            print(f"[look-engine WARNING] darktable-cli failed: {result.stderr.decode('utf-8')}. Falling back.")

    # --------------------------------------------------------------------------
    # ENGINE A: dcraw_emu (16-bit sRGB TIFF) + 3D LUT
    # --------------------------------------------------------------------------
    dcraw_emu = shutil.which("dcraw_emu")
    if dcraw_emu:
        print(f"[look-engine] ⚙️ Found dcraw_emu. Developing 16-bit sRGB TIFF...")
        # -6 = 16-bit, -T = TIFF, -w = camera WB, -h = half-size (fast/low-RAM), -Z tiff = replace ext with .tiff
        cmd = [dcraw_emu, "-6", "-T", "-w", "-h", "-Z", "tiff", str(raw_path_obj)]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        tiff_path = raw_path_obj.with_suffix(".tiff")
        if result.returncode == 0 and tiff_path.exists():
            try:
                print(f"[look-engine] Loading Developed TIFF: {tiff_path}")
                img = Image.open(tiff_path)
                raw_arr = np.array(img)
                if raw_arr.dtype == np.uint8:
                    print("[look-engine] Loaded 8-bit image data.")
                    img_arr = raw_arr.astype(np.float32) / 255.0
                else:
                    print("[look-engine] Loaded 16-bit image data.")
                    img_arr = raw_arr.astype(np.float32) / 65535.0
                
                # Save flat version
                flat_arr = np.clip(img_arr * 255.0, 0.0, 255.0).astype(np.uint8)
                flat_img = Image.fromarray(flat_arr)
                flat_img.save(flat_jpg_path, quality=92)
                print(f"[look-engine] ✅ Flat JPEG written to: {flat_jpg_path}")

                # Apply LUT
                size, lut = load_cube_lut(lut_path)
                print("[look-engine] 🎨 Applying trilinear color mapping to 16-bit linear data...")
                graded_arr = apply_lut_trilinear(img_arr, lut, size)
                
                # Scale back to uint8
                graded_arr = np.clip(graded_arr * 255.0, 0.0, 255.0).astype(np.uint8)
                graded_img = Image.fromarray(graded_arr)
                graded_img.save(output_jpg_path, quality=92)
                print(f"[look-engine] ✅ Developed high-precision JPEG written to: {output_jpg_path}")
                return
            finally:
                if tiff_path.exists():
                    try:
                        os.remove(tiff_path)
                    except Exception as e:
                        print(f"[look-engine] Warning: Could not clean up {tiff_path}: {e}")
        else:
            print(f"[look-engine WARNING] dcraw_emu failed or TIFF not found. Falling back to embedded preview.")

    # --------------------------------------------------------------------------
    # ENGINE C (Fallback): exiftool JPEG preview extraction + 3D LUT
    # --------------------------------------------------------------------------
    print(f"[look-engine] ⚙️ Extracting embedded JPEG preview from: {raw_path}")
    thumb_path = raw_path_obj.parent / f"{raw_path_obj.stem}.thumb.jpg"
    
    tags = ["-PreviewImage", "-JpgFromRaw", "-ThumbnailImage"]
    extracted = False
    
    for tag in tags:
        cmd = ["exiftool", tag, "-b", str(raw_path_obj)]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode == 0 and len(result.stdout) > 0:
            with open(thumb_path, "wb") as f_out:
                f_out.write(result.stdout)
            extracted = True
            print(f"[look-engine] Extracted preview using tag: {tag} ({len(result.stdout)} bytes)")
            break
            
    if not extracted:
        raise RuntimeError("exiftool failed to extract any preview image (-PreviewImage, -JpgFromRaw, -ThumbnailImage)")

    try:
        # Save flat version
        shutil.copy2(thumb_path, flat_jpg_path)
        print(f"[look-engine] ✅ Flat JPEG written to: {flat_jpg_path}")

        # Load extracted thumbnail
        img = Image.open(thumb_path)
        img_arr = np.array(img, dtype=np.float32) / 255.0
        
        # Load and apply LUT
        size, lut = load_cube_lut(lut_path)
        print("[look-engine] 🎨 Applying trilinear color mapping...")
        graded_arr = apply_lut_trilinear(img_arr, lut, size)
        
        # Scale back to uint8
        graded_arr = np.clip(graded_arr * 255.0, 0.0, 255.0).astype(np.uint8)
        graded_img = Image.fromarray(graded_arr)
        # Save output
        graded_img.save(output_jpg_path, quality=92)
        print(f"[look-engine] ✅ Developed JPEG written to: {output_jpg_path}")

    finally:
        # Clean up temporary thumbnail
        if thumb_path.exists():
            try:
                os.remove(thumb_path)
            except Exception as e:
                print(f"[look-engine] Warning: Could not clean up {thumb_path}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 look_engine.py <raw_path> <output_jpg_path> [lut_path]")
        sys.exit(1)
        
    raw_in = sys.argv[1]
    jpg_out = sys.argv[2]
    lut_in = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_LUT_PATH
    
    try:
        process_raw_to_staged(raw_in, jpg_out, lut_in)
    except Exception as e:
        print(f"[look-engine ERROR] {e}", file=sys.stderr)
        sys.exit(1)
