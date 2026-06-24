"""Gradio demo for Spatial Intelligence pipeline.

Provides interactive UI for:
- Depth estimation from RGB images (DA3 / DepthPro)
- Point cloud encoding + feature visualization
- Spatial scene queries (natural language)
- Scene graph generation + visualization

Usage:
    python -m src.gradio_demo
    # or via docker: exposed on port 7860
"""
import io
import json
import logging

import gradio as gr
import numpy as np

logger = logging.getLogger(__name__)


def create_demo(servicer=None):
    """Build the Gradio interface."""
    if servicer is None:
        from .server import SpatialIntelligenceServicer
        servicer = SpatialIntelligenceServicer()
        servicer.load_models()

    def estimate_depth(image, method):
        if image is None:
            return None, "Upload an image."
        result = servicer.depth.estimate(image, method=method)
        dm = result["depth_map"]
        d_min, d_max = dm.min(), dm.max()
        viz = ((dm - d_min) / (d_max - d_min + 1e-8) * 255).astype(np.uint8)
        info = f"Shape: {dm.shape}, Range: [{d_min:.2f}, {d_max:.2f}]"
        if "focal_length" in result:
            info += f"\nFocal: {result['focal_length']:.1f}px"
        return viz, info

    def encode_pc(file):
        if file is None:
            return "Upload a point cloud."
        data = np.load(file.name) if file.name.endswith(".npy") else np.loadtxt(file.name)
        coords = data[:, :3].astype(np.float32)
        colors = data[:, 3:6].astype(np.float32) if data.shape[1] >= 6 else None
        result = servicer.encoder.encode(coords, colors)
        f = result["feat"]
        return f"Encoded {len(coords)} pts -> {list(f.shape)}, dim={f.shape[-1]}"

    def query_scene(file, query):
        if file is None or not query:
            return "Upload scene + enter query."
        import torch
        data = np.load(file.name) if file.name.endswith(".npy") else np.loadtxt(file.name)
        coords = data[:, :3].astype(np.float32)
        colors = data[:, 3:6].astype(np.float32) if data.shape[1] >= 6 else None
        features = servicer.encoder.encode(coords, colors)
        tokens = servicer.vlm_adapter.encode_scene(features["feat"], torch.from_numpy(coords).float())
        result = servicer.vlm_adapter.build_spatial_prompt(tokens, query)
        out = f"Answer: {result.get('answer', 'N/A')}\n"
        for r in result.get("regions", []):
            out += f"  - {r.get('label','?')} ({r.get('confidence',0):.2f})\n"
        return out

    def scene_graph(file, rels):
        if file is None:
            return "Upload a scene."
        import torch
        data = np.load(file.name) if file.name.endswith(".npy") else np.loadtxt(file.name)
        coords = data[:, :3].astype(np.float32)
        colors = data[:, 3:6].astype(np.float32) if data.shape[1] >= 6 else None
        features = servicer.encoder.encode(coords, colors)
        tokens = servicer.vlm_adapter.encode_scene(features["feat"], torch.from_numpy(coords).float())
        graph = servicer.vlm_adapter.build_scene_graph(tokens, include_relationships=rels)
        return json.dumps(graph, indent=2, default=str)

    with gr.Blocks(title="Spatial Intelligence", theme=gr.themes.Soft(primary_hue="violet")) as demo:
        gr.Markdown("# Spatial Intelligence Pipeline\n*Creative Liberation Engine - Utonia + DA3 + DepthPro*")
        with gr.Tab("Depth"):
            with gr.Row():
                with gr.Column():
                    img = gr.Image(type="pil", label="RGB Image")
                    method = gr.Radio(["da3", "depthpro"], value="da3", label="Method")
                    gr.Button("Estimate", variant="primary").click(estimate_depth, [img, method], [gr.Image(label="Depth"), gr.Textbox(label="Info", lines=3)])
        with gr.Tab("Encode"):
            with gr.Row():
                with gr.Column():
                    f1 = gr.File(label="Point Cloud (.npy/.txt)")
                    gr.Button("Encode", variant="primary").click(encode_pc, [f1], [gr.Textbox(label="Result", lines=4)])
        with gr.Tab("Query"):
            with gr.Row():
                with gr.Column():
                    f2 = gr.File(label="Scene")
                    q = gr.Textbox(label="Query", placeholder="What is left of the table?")
                    gr.Button("Ask", variant="primary").click(query_scene, [f2, q], [gr.Textbox(label="Answer", lines=6)])
        with gr.Tab("Scene Graph"):
            with gr.Row():
                with gr.Column():
                    f3 = gr.File(label="Scene")
                    rels = gr.Checkbox(value=True, label="Include relationships")
                    gr.Button("Build", variant="primary").click(scene_graph, [f3, rels], [gr.Code(label="Graph", language="json")])
    return demo


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    create_demo().launch(server_name="0.0.0.0", server_port=7860, share=False)
