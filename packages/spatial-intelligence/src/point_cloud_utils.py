"""RGB-D to point cloud utilities — deproject, downsample, fuse, normals."""
from __future__ import annotations
from typing import List, Tuple
import numpy as np


def deproject_depth_to_pointcloud(
    rgb: np.ndarray,
    depth: np.ndarray,
    fx: float, fy: float, cx: float, cy: float,
    depth_scale: float = 1.0,
    max_depth: float = 10.0,
) -> np.ndarray:
    """Backproject RGB-D frame to (N,6) float32 [x,y,z,r,g,b] point cloud."""
    H, W = depth.shape
    u, v = np.meshgrid(np.arange(W), np.arange(H))
    z = depth.astype(np.float32) * depth_scale
    mask = (z > 0.0) & (z < max_depth)
    z, u, v = z[mask], u[mask], v[mask]
    x = (u - cx) * z / fx
    y = (v - cy) * z / fy
    colors = rgb[mask].astype(np.float32)
    return np.stack([x, y, z, colors[:, 0], colors[:, 1], colors[:, 2]], axis=1)


def estimate_intrinsics(width: int, height: int, hfov_deg: float = 69.0
                        ) -> Tuple[float, float, float, float]:
    """Estimate (fx, fy, cx, cy) from image dimensions and horizontal FOV."""
    fx = (width / 2.0) / np.tan(np.deg2rad(hfov_deg) / 2.0)
    return fx, fx, width / 2.0, height / 2.0


def voxel_downsample(points: np.ndarray, voxel_size: float = 0.02) -> np.ndarray:
    """Reduce density via voxel grid; returns one point per occupied cell."""
    if len(points) == 0:
        return points
    grid = np.floor(points[:, :3] / voxel_size).astype(np.int64)
    keys = grid[:, 0] * 1_000_003 + grid[:, 1] * 1_009 + grid[:, 2]
    _, idx = np.unique(keys, return_index=True)
    return points[idx]


def fuse_clouds(clouds: List[np.ndarray], voxel_size: float = 0.02) -> np.ndarray:
    """Concatenate multiple (N_i, D) clouds and voxel-downsample the result."""
    if not clouds:
        return np.zeros((0, 6), dtype=np.float32)
    return voxel_downsample(np.concatenate(clouds, axis=0), voxel_size)


def remove_outliers(points: np.ndarray, k: int = 20, std_ratio: float = 2.0
                   ) -> np.ndarray:
    """Statistical outlier removal (Open3D if available, sklearn fallback)."""
    try:
        import open3d as o3d
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points[:, :3])
        _, ind = pcd.remove_statistical_outlier(nb_neighbors=k, std_ratio=std_ratio)
        return points[ind]
    except ImportError:
        from sklearn.neighbors import NearestNeighbors
        nbrs = NearestNeighbors(n_neighbors=k + 1).fit(points[:, :3])
        dists, _ = nbrs.kneighbors(points[:, :3])
        md = dists[:, 1:].mean(axis=1)
        return points[md < md.mean() + std_ratio * md.std()]


def to_open3d(points: np.ndarray):
    """Convert (N, 6|9) numpy array to Open3D PointCloud."""
    import open3d as o3d
    pcd = o3d.geometry.PointCloud()
    pcd.points = o3d.utility.Vector3dVector(points[:, :3])
    if points.shape[1] >= 6:
        c = points[:, 3:6].astype(np.float64)
        pcd.colors = o3d.utility.Vector3dVector(c / 255.0 if c.max() > 1.0 else c)
    if points.shape[1] >= 9:
        pcd.normals = o3d.utility.Vector3dVector(points[:, 6:9])
    return pcd