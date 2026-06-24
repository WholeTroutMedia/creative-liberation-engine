"""Spatial Intelligence configuration for Creative Liberation Engine."""
from dataclasses import dataclass, field
from pathlib import Path

# Model storage directory
MODELS_DIR = Path(__file__).parent / "models"


@dataclass
class UtoniaConfig:
    """Utonia universal 3D encoder configuration."""
    model_name: str = "Utonia"
    weights_path: Path = MODELS_DIR / "utonia"
    num_classes: int = 0  # Feature extraction mode
    in_channels: int = 6  # xyz + rgb
    # Encoder backbone parameters
    enc_depths: tuple = (2, 2, 2, 6, 2)
    enc_channels: tuple = (32, 64, 128, 256, 512)
    enc_num_head: tuple = (2, 4, 8, 16, 32)
    enc_patch_size: tuple = (1024, 1024, 1024, 1024, 1024)
    dec_depths: tuple = (2, 2, 2, 2)
    dec_channels: tuple = (64, 64, 128, 256)
    dec_num_head: tuple = (4, 4, 8, 16)
    dec_patch_size: tuple = (1024, 1024, 1024, 1024)
    # Feature extraction
    channels: tuple = (54, 108, 216, 432, 576)
    depth_head_channels: int = 256
    heads_in_channels: int = 432
    input_transform: str = "serialization"  # Point serialization for feature extraction
    device: str = "cuda"
    frozen: bool = True  # Freeze encoder for feature extraction


@dataclass
class DepthConfig:
    """Depth estimation pipeline configuration."""
    # Depth Anything 3 - monocular + multi-view
    da3_model_id: str = "depth-anything/DA3MONO-LARGE"
    da3_weights_path: Path = MODELS_DIR / "da3-mono-large"
    # Apple DepthPro - metric depth with focal length
    depth_pro_model_id: str = "apple/DepthPro-hf"
    depth_pro_weights_path: Path = MODELS_DIR / "depth-pro"
    device: str = "cuda"


@dataclass
class ServerConfig:
    """gRPC inference server configuration."""
    host: str = "0.0.0.0"
    port: int = 50051
    max_workers: int = 4
    max_point_cloud_size: int = 1_000_000  # Max points per cloud


@dataclass
class SpatialIntelligenceConfig:
    """Top-level configuration."""
    utonia: UtoniaConfig = field(default_factory=UtoniaConfig)
    depth: DepthConfig = field(default_factory=DepthConfig)
    server: ServerConfig = field(default_factory=ServerConfig)
    cache_features: bool = True
    cache_ttl_seconds: int = 300  # 5 min feature cache


# Singleton config
config = SpatialIntelligenceConfig()