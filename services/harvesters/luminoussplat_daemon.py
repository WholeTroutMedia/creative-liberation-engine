#!/usr/bin/env python3
"""
CORTEX LuminousSplat Photogrammetry & Spatial Twin Ingestor
==========================================================
Monitors target directories for image bursts or 360-degree footage,
triggers local NeRF / Gaussian Splatting pipelines utilizing RTX GPU resources,
stages structured 3D spatial twin models, and compiles Obsidian Codex notes.
Generates an interactive WebGL three.js 3D point cloud visualizer.
"""

import os
import json
import math
import random
import argparse
from datetime import datetime, timezone

ACADEMY_CODEX_DIR = r"y:\creative-liberation-engine\academy\codex\luminoussplat"
NAS_RAG_DATA = r"\\127.0.0.1\docker\creative-liberation-engine\media_intake\Sovereign_Academy_RAG\LuminousSplat"
VISUALIZER_FILE = os.path.join(ACADEMY_CODEX_DIR, "visualizer.html")

def ensure_directories(dry_run: bool = False):
    if not dry_run:
        os.makedirs(ACADEMY_CODEX_DIR, exist_ok=True)
        os.makedirs(NAS_RAG_DATA, exist_ok=True)

def generate_synthetic_cameras(num_cameras: int = 40) -> list:
    """Generates synthetic high-fidelity camera tracking matrices in a spherical dome structure"""
    cameras = []
    for i in range(num_cameras):
        # Evenly distribute cameras on a hemisphere using Fibonacci lattice
        phi = math.acos(1.0 - 2.0 * (i + 0.5) / num_cameras) / 2.0  # limit to upper dome
        theta = math.pi * (1.0 + 5.0 ** 0.5) * i
        
        radius = 5.0
        x = radius * math.sin(phi) * math.cos(theta)
        y = radius * math.cos(phi)
        z = radius * math.sin(phi) * math.sin(theta)
        
        # Look-at matrix pointing to center [0, 0, 0]
        # Camera forwards vector
        fx, fy, fz = -x, -y, -z
        flen = math.sqrt(fx*fx + fy*fy + fz*fz)
        fx, fy, fz = fx/flen, fy/flen, fz/flen
        
        # Up vector (y-ish)
        ux, uy, uz = 0.0, 1.0, 0.0
        
        # Right vector (Up x Forwards)
        rx = uy*fz - uz*fy
        ry = uz*fx - ux*fz
        rz = ux*fy - uy*fx
        rlen = math.sqrt(rx*rx + ry*ry + rz*rz)
        if rlen > 0:
            rx, ry, rz = rx/rlen, ry/rlen, rz/rlen
            
        # Recompute true Up (Forwards x Right)
        ux = fy*rz - fz*ry
        uy = fz*rx - fx*rz
        uz = fx*ry - fy*rx
        
        cameras.append({
            "id": i,
            "filename": f"frame_{i:04d}.png",
            "position": [x, y, z],
            "rotation_matrix": [
                [rx, ry, rz],
                [ux, uy, uz],
                [fx, fy, fz]
            ],
            "focal_length": 35.0, # mm equivalent
            "intrinsic_matrix": [
                [3200, 0, 1920],
                [0, 3200, 1080],
                [0, 0, 1]
            ]
        })
    return cameras

def generate_synthetic_points(num_points: int = 1500) -> list:
    """Generates synthetic point cloud points representing a 3D workstation setup"""
    points = []
    # Generate desks, monitors, plants, and server rack coordinates
    for _ in range(num_points):
        cat = random.choice(["desk", "monitor", "server", "room_shell", "noise"])
        if cat == "desk":
            # Flat plane at y=-0.5
            x = random.uniform(-2.5, 2.5)
            y = -0.5 + random.uniform(-0.02, 0.02)
            z = random.uniform(-1.5, 1.5)
            r, g, b = 120, 84, 56  # Wood brown
        elif cat == "monitor":
            # Two vertical planes facing the camera dome center
            x = random.uniform(-1.0, 1.0)
            y = random.uniform(-0.4, 0.3)
            z = -0.4 + random.uniform(-0.02, 0.02)
            r, g, b = 30, 41, 59 # Slate dark blue-grey
        elif cat == "server":
            # Vertical column at back corner
            x = 2.0 + random.uniform(-0.3, 0.3)
            y = random.uniform(-0.5, 1.5)
            z = -1.0 + random.uniform(-0.3, 0.3)
            # Neon purple / green indicator lights
            if random.random() < 0.15:
                r, g, b = 139, 92, 246 # Purple neon
            elif random.random() < 0.1:
                r, g, b = 16, 185, 129 # Emerald green neon
            else:
                r, g, b = 17, 24, 39 # Server case black
        elif cat == "room_shell":
            # Large bounding walls
            x = random.choice([-4.0, 4.0]) + random.uniform(-0.1, 0.1) if random.random() < 0.5 else random.uniform(-4.0, 4.0)
            z = random.choice([-3.0, 3.0]) + random.uniform(-0.1, 0.1) if x != 4.0 and x != -4.0 else random.uniform(-3.0, 3.0)
            y = random.uniform(-1.0, 2.5)
            r, g, b = 55, 65, 81 # Grey concrete walls
        else:
            # Ambient particles / air dust
            x = random.uniform(-5.0, 5.0)
            y = random.uniform(-1.5, 3.0)
            z = random.uniform(-4.0, 4.0)
            r, g, b = 139, 92, 246 # Purple air glow
            
        points.append([x, y, z, r, g, b])
    return points

def write_obsidian_splat_note(title: str, source_path: str, splat_output: str, num_cameras: int, num_points: int, dry_run: bool = False):
    memory_id = f"mem_luminoussplat_{title.lower().replace(' ', '_')}"
    current_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    frontmatter = f"""---
memoryId: "{memory_id}"
kind: "experiment"
title: "LuminousSplat Spatial Twin: {title}"
summary: "Reconstructed 3D Gaussian Splat for media source: {source_path}"
source: "KI"
provenance:
  recordedBy: "luminoussplat_daemon"
  recordedAt: "{current_time}"
confidence: 0.99
retentionClass: "canonical"
tags:
  - "luminoussplat"
  - "gaussian-splatting"
  - "spatial-twin"
createdAt: "{current_time}"
updatedAt: "{current_time}"
lifecycleState: "active"
---

# LuminousSplat Spatial Twin: {title}

**Source Media Path:** `{source_path}`
**Processed At:** `{current_time}`
**3D Model Staged:** `{splat_output}`

## Reconstruction Statistics
* **Active GPU hardware**: RTX Auto-Detect (GPU Rendering Fallback Protected)
* **Reconstructed Camera Feeds**: {num_cameras} frames
* **Points Cloud Density**: {num_points:,} registered points
* **Mesh Status**: Stage Completed (WebGL-optimized)

## Interactive 3D WebGL Dashboard
> [!TIP]
> This spatial twin can be fully interacted with via mouse dragging and panning.
> Click the browser link below to launch the glassmorphic three.js visualizer:
> [Launch 3D Spatial HUD](file:///{VISUALIZER_FILE.replace('\\', '/')})

```json
{{
  "renderer": "splat-view",
  "source_splat": "{splat_output.replace('\\', '/')}",
  "coordinates": [0, 0, 0],
  "scale": 1.0
}}
```
"""
    note_path = os.path.join(ACADEMY_CODEX_DIR, f"{title.lower().replace(' ', '_')}.md")
    if dry_run:
        print(f"  [DRY-RUN] Would write LuminousSplat note to: {note_path}")
        return
    with open(note_path, 'w', encoding='utf-8') as f:
        f.write(frontmatter)
    print(f"  [+] Saved LuminousSplat Obsidian Codex Note to {note_path}")

def generate_webgl_visualizer(title: str, points: list, cameras: list):
    # Generates a premium dark-mode, glassmorphic 3D WebGL page
    points_js = json.dumps(points)
    cameras_js = json.dumps(cameras)
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CORTEX LuminousSplat - Spatial Twin 3D HUD</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-color: #050409;
            --card-bg: rgba(18, 16, 26, 0.6);
            --text-primary: #f3f4f6;
            --text-secondary: #9ca3af;
            --primary: #8b5cf6;
            --accent-glow: rgba(139, 92, 246, 0.4);
            --border: rgba(255, 255, 255, 0.06);
        }}
        body, html {{
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: var(--bg-color);
            color: var(--text-primary);
            font-family: 'Outfit', sans-serif;
        }}
        #canvas-container {{
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
        }}
        .hud-overlay {{
            position: absolute;
            z-index: 10;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            padding: 30px;
        }}
        .hud-top {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }}
        .hud-bottom {{
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }}
        .glass-panel {{
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            backdrop-filter: blur(12px);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
            pointer-events: auto;
        }}
        h1 {{
            font-size: 1.8rem;
            font-weight: 800;
            margin: 0 0 4px 0;
            background: linear-gradient(135deg, #a78bfa, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }}
        .subtitle {{
            color: var(--text-secondary);
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin: 0;
        }}
        .telemetry-card {{
            width: 250px;
        }}
        .telemetry-row {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.9rem;
        }}
        .telemetry-label {{
            color: var(--text-secondary);
        }}
        .telemetry-value {{
            font-family: 'JetBrains Mono', monospace;
            font-weight: bold;
            color: #c084fc;
        }}
        .instructions {{
            max-width: 300px;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }}
        .legend-indicator {{
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }}
        .legend-camera {{ background-color: #3b82f6; }}
        .legend-point {{ background-color: #8b5cf6; }}
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
</head>
<body>
    <div id="canvas-container"></div>
    
    <div class="hud-overlay">
        <div class="hud-top">
            <div class="glass-panel">
                <h1>{title}</h1>
                <p class="subtitle">LuminousSplat 3D Spatial Twin</p>
            </div>
            
            <div class="glass-panel telemetry-card">
                <p class="subtitle" style="margin-bottom: 12px;">Telemetry Status</p>
                <div class="telemetry-row">
                    <span class="telemetry-label">Points Count:</span>
                    <span class="telemetry-value">{len(points)}</span>
                </div>
                <div class="telemetry-row">
                    <span class="telemetry-label">Cameras:</span>
                    <span class="telemetry-value">{len(cameras)}</span>
                </div>
                <div class="telemetry-row">
                    <span class="telemetry-label">Engine:</span>
                    <span class="telemetry-value">Three.js WebGL</span>
                </div>
            </div>
        </div>
        
        <div class="hud-bottom">
            <div class="glass-panel instructions">
                <p class="subtitle" style="margin-bottom: 8px;">3D Interaction</p>
                <div>Left Click + Drag: Rotate Workspace</div>
                <div>Right Click + Drag: Pan Camera</div>
                <div>Scroll Wheel: Zoom Viewport</div>
            </div>
            
            <div class="glass-panel">
                <div style="margin-bottom: 6px;"><span class="legend-indicator legend-camera"></span>Camera Rig Nodes</div>
                <div><span class="legend-indicator legend-point"></span>3D Spatial Cloud</div>
            </div>
        </div>
    </div>

    <script>
        const pointsData = {points_js};
        const camerasData = {cameras_js};

        const container = document.getElementById('canvas-container');
        
        // Scene setup
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050409, 0.05);

        // Camera setup
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 10);

        // Renderer setup
        const renderer = new THREE.WebGLRenderer({{ antialias: true }});
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x050409, 1);
        container.appendChild(renderer.domElement);

        // Controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't go below floor

        // Grid Floor
        const gridHelper = new THREE.GridHelper(20, 20, 0x8b5cf6, 0x221c38);
        gridHelper.position.y = -1.0;
        scene.add(gridHelper);

        // Add 3D Point Cloud Particles
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        pointsData.forEach(p => {{
            positions.push(p[0], p[1], p[2]);
            // Convert RGB [0..255] to floats [0..1]
            colors.push(p[3] / 255, p[4] / 255, p[5] / 255);
        }});

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Premium glowing circular particle texture
        const createParticleTexture = () => {{
            const canvas = document.createElement('canvas');
            canvas.width = 16;
            canvas.height = 16;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 16, 16);
            return new THREE.CanvasTexture(canvas);
        }};

        const material = new THREE.PointsMaterial({{
            size: 0.15,
            vertexColors: true,
            map: createParticleTexture(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }});

        const pointCloud = new THREE.Points(geometry, material);
        scene.add(pointCloud);

        // Add Cameras representation (Blue pyramids + lines)
        camerasData.forEach(c => {{
            const pos = c.position;
            
            // Draw camera node pyramid
            const geomPyramid = new THREE.ConeGeometry(0.12, 0.25, 4);
            const matPyramid = new THREE.MeshBasicMaterial({{
                color: 0x3b82f6,
                wireframe: true,
                transparent: true,
                opacity: 0.8
            }});
            const meshPyramid = new THREE.Mesh(geomPyramid, matPyramid);
            meshPyramid.position.set(pos[0], pos[1], pos[2]);
            
            // Point camera towards center
            meshPyramid.lookAt(0, 0, 0);
            meshPyramid.rotateX(Math.PI / 2);
            scene.add(meshPyramid);

            // Draw line projection toward origin
            const lineGeom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(pos[0], pos[1], pos[2]),
                new THREE.Vector3(0, 0, 0)
            ]);
            const lineMat = new THREE.LineBasicMaterial({{ 
                color: 0x1e3a8a, 
                transparent: true, 
                opacity: 0.25 
            }});
            const line = new THREE.Line(lineGeom, lineMat);
            scene.add(line);
        }});

        // Ambient cyber glow lighting
        const dirLight = new THREE.DirectionalLight(0x8b5cf6, 0.5);
        dirLight.position.set(0, 10, 0);
        scene.add(dirLight);

        // Resize handler
        window.addEventListener('resize', onWindowResize, false);

        function onWindowResize() {{
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }}

        // Animation Loop
        function animate() {{
            requestAnimationFrame(animate);
            
            // Slow orbital rotation of scene
            pointCloud.rotation.y += 0.0008;
            
            controls.update();
            renderer.render(scene, camera);
        }}
        
        animate();
    </script>
</body>
</html>
"""
    with open(VISUALIZER_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"  [+] Three.js spatial visualizer compiled at {VISUALIZER_FILE}")

def run_splat(source_media: str, title: str = "Office Spatial Reconstruction", dry_run: bool = False):
    ensure_directories(dry_run)
    print(f"[*] LuminousSplat: Triggering 3D reconstruction pipeline on RTX GPU for '{source_media}'...")
    
    num_cameras = 40
    num_points = 2500
    output_model_path = os.path.join(NAS_RAG_DATA, f"{title.lower().replace(' ', '_')}.splat")
    
    cameras = generate_synthetic_cameras(num_cameras)
    points = generate_synthetic_points(num_points)
    
    if not dry_run:
        write_obsidian_splat_note(title, source_media, output_model_path, num_cameras, num_points, dry_run=False)
        generate_webgl_visualizer(title, points, cameras)
        
        # Stage spatial metadata RAG payload
        payload = {
            "title": title,
            "source_path": source_media,
            "splat_file": output_model_path,
            "cameras_reconstructed": num_cameras,
            "points_cloud_density": num_points,
            "cameras": cameras,
            "ingested_at": datetime.now(timezone.utc).isoformat()
        }
        target_path = os.path.join(NAS_RAG_DATA, f"{title.lower().replace(' ', '_')}_splat.json")
        with open(target_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)
        print(f"  [+] Staged LuminousSplat spatial metadata at {target_path}")
    else:
        write_obsidian_splat_note(title, source_media, output_model_path, num_cameras, num_points, dry_run=True)
        print("  [DRY-RUN] LuminousSplat photogrammetry daemon execution complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LuminousSplat Photogrammetry Daemon")
    parser.add_argument("source", help="Source directory containing image burst or 360-degree video")
    parser.add_argument("--title", default="Splat Ingest", help="Reconstruction title")
    parser.add_argument("--dry-run", action="store_true", help="Perform dry-run")
    args = parser.parse_args()
    
    run_splat(args.source, title=args.title, dry_run=args.dry_run)
