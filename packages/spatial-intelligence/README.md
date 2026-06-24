# @creative-liberation-engine/spatial-intelligence

Universal 3D perception backbone for the Creative Liberation Engine, powered by [Utonia](https://huggingface.co/papers/2603.03283).

## Overview

This package provides COMET and all Creative Liberation Engine agents with native spatial understanding through:

- **Utonia Encoder** -- Universal point cloud encoder (549 MB, Apache 2.0)
- **Depth Anything 3** -- RGB to depth maps (monocular + multi-view)
- **Apple DepthPro** -- Metric depth with focal length estimation
- **Spatial Reasoning API** -- Scene graphs, spatial queries, object segmentation

## Quick Start

```bash
# Create conda environment
conda env create -f environment.yml
conda activate spatial-intel

# Download models (~3.8 GB total)
./scripts/download_models.sh

# Start inference server
python src/server.py --port 50051
```

## Architecture

```
RGB Frame -> Depth Estimation -> Point Cloud -> Utonia Encoder -> Features
                                                                     |
                                                               Scene Graph
                                                                     |
                                                            Spatial Queries
```

## Models

| Model | Size | Purpose |
|-------|------|---------|
| Utonia (PTv3) | 549 MB | Universal 3D encoder |
| DA3Mono-Large | ~1.4 GB | Monocular depth |
| Apple DepthPro | ~1.8 GB | Metric depth |

## Related

- [Issue #20](../../../../issues/20) -- Full implementation plan
- [CometVision](../../apps/comet-vision) -- iOS spatial bridge
- [Paper](https://huggingface.co/papers/2603.03283) -- Utonia: Toward One Encoder for All Point Clouds