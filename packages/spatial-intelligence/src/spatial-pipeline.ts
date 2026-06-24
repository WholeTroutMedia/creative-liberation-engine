/**
 * @cle/spatial-pipeline — Unified Spatial Runtime
 *
 * WS-3: Spatial/Video Pipeline
 *
 * Orchestrates the full perception-reasoning-generation pipeline:
 *   1. Perception — Depth estimation (DA3, DepthPro) → point clouds
 *   2. Reasoning — Utonia encoder → scene graphs → spatial queries
 *   3. Stabilization — FlowAnchor dual-anchoring for video editing
 *   4. Generation — UniVidX multimodal video generation
 *   5. MetaHuman — UE5 bridge via OSC/LiveLink
 *
 * All stages run on workstation RTX 4090 via gRPC to spatial-intelligence.
 */

import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DepthEstimationRequest {
  frameUri: string;
  model: 'da3-mono' | 'da3-stereo' | 'depthpro';
  outputFormat: 'raw_float32' | 'normalized_png' | 'point_cloud';
}

export interface DepthEstimationResult {
  depthMapUri: string;
  model: string;
  resolution: [number, number];
  minDepth: number;
  maxDepth: number;
  processingMs: number;
}

export interface SceneGraphNode {
  id: string;
  label: string;
  position: [number, number, number];
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
  confidence: number;
  relationships: Array<{
    targetId: string;
    type: 'above' | 'below' | 'left_of' | 'right_of' | 'in_front_of' | 'behind' | 'inside' | 'on_top_of';
    confidence: number;
  }>;
}

export interface SceneGraph {
  version: number;
  timestamp: string;
  nodes: SceneGraphNode[];
  roomEnergy: number;
  cameraOrigin: [number, number, number];
}

export interface FlowAnchorConfig {
  spatialAnchorStrength: number;
  motionAdaptiveStrength: number;
  temporalWindowFrames: number;
  inversionFree: boolean;
}

export interface VideoEditRequest {
  sourceVideoUri: string;
  editPrompt: string;
  anchorConfig: FlowAnchorConfig;
  outputResolution: '512x512' | '768x768' | '1024x576' | '1920x1080';
  fps: number;
}

export interface VideoEditResult {
  outputVideoUri: string;
  framesProcessed: number;
  stabilityScore: number;
  temporalConsistencyScore: number;
  processingMs: number;
}

export interface VideoGenerationRequest {
  prompt: string;
  conditionalInputs: Array<{
    modality: 'text' | 'image' | 'video' | 'audio' | 'depth' | 'pose' | 'sketch';
    uri: string;
  }>;
  diffusionSteps: number;
  guidanceScale: number;
  resolution: string;
  fps: number;
  durationSeconds: number;
}

export interface VideoGenerationResult {
  outputVideoUri: string;
  resolution: string;
  fps: number;
  durationSeconds: number;
  processingMs: number;
}

export interface MetaHumanBridgeConfig {
  oscHost: string;
  oscPort: number;
  arkitBlendshapes: boolean;
  liveLink: boolean;
  metaHumanId?: string;
}

export interface SpatialPipelineConfig {
  grpcEndpoint: string;
  ue5Config?: MetaHumanBridgeConfig;
  defaultAnchorConfig: FlowAnchorConfig;
}

// ─── Spatial Pipeline ────────────────────────────────────────────────────────

const DEFAULT_ANCHOR_CONFIG: FlowAnchorConfig = {
  spatialAnchorStrength: 0.7,
  motionAdaptiveStrength: 0.5,
  temporalWindowFrames: 16,
  inversionFree: true,
};

const DEFAULT_UE5_CONFIG: MetaHumanBridgeConfig = {
  oscHost: '127.0.0.1',
  oscPort: 7000,
  arkitBlendshapes: true,
  liveLink: true,
};

export class SpatialPipeline extends EventEmitter {
  private config: SpatialPipelineConfig;
  private sceneGraph: SceneGraph | null = null;
  private running = false;

  constructor(config: Partial<SpatialPipelineConfig> = {}) {
    super();
    this.config = {
      grpcEndpoint: config.grpcEndpoint || 'localhost:50051',
      ue5Config: config.ue5Config || DEFAULT_UE5_CONFIG,
      defaultAnchorConfig: config.defaultAnchorConfig || DEFAULT_ANCHOR_CONFIG,
    };
  }

  // ─── PERCEPTION STAGE ──────────────────────────────────────────────────

  /**
   * Estimate depth from an RGB frame using the spatial-intelligence gRPC server.
   * Supports DA3 Mono/Stereo and Apple DepthPro.
   */
  async estimateDepth(request: DepthEstimationRequest): Promise<DepthEstimationResult> {
    const startMs = Date.now();
    // gRPC call to spatial-intelligence depth_pipeline.py
    const response = await this.grpcCall('EstimateDepth', {
      frame_uri: request.frameUri,
      model: request.model,
      output_format: request.outputFormat,
    });

    const result: DepthEstimationResult = {
      depthMapUri: response.depth_map_uri,
      model: request.model,
      resolution: [response.width, response.height],
      minDepth: response.min_depth,
      maxDepth: response.max_depth,
      processingMs: Date.now() - startMs,
    };

    this.emit('depth:estimated', result);
    return result;
  }

  // ─── REASONING STAGE ───────────────────────────────────────────────────

  /**
   * Build a scene graph from depth + RGB using Utonia encoder.
   * Produces spatial relationships, object positions, and room energy.
   */
  async buildSceneGraph(
    rgbUri: string,
    depthUri: string
  ): Promise<SceneGraph> {
    const response = await this.grpcCall('BuildSceneGraph', {
      rgb_uri: rgbUri,
      depth_uri: depthUri,
    });

    this.sceneGraph = {
      version: (this.sceneGraph?.version || 0) + 1,
      timestamp: new Date().toISOString(),
      nodes: response.nodes.map((n: any) => ({
        id: n.id,
        label: n.label,
        position: n.position,
        boundingBox: n.bounding_box,
        confidence: n.confidence,
        relationships: n.relationships || [],
      })),
      roomEnergy: response.room_energy,
      cameraOrigin: response.camera_origin,
    };

    this.emit('scene:updated', this.sceneGraph);
    return this.sceneGraph;
  }

  /**
   * Query spatial relationships from the current scene graph.
   */
  async querySpatial(
    query: string
  ): Promise<{ answer: string; relevantNodes: SceneGraphNode[] }> {
    if (!this.sceneGraph) {
      throw new Error('No scene graph available. Call buildSceneGraph first.');
    }

    const response = await this.grpcCall('QuerySpatial', {
      query,
      scene_graph: this.sceneGraph,
    });

    return {
      answer: response.answer,
      relevantNodes: response.relevant_node_ids
        .map((id: string) => this.sceneGraph!.nodes.find((n) => n.id === id))
        .filter(Boolean),
    };
  }

  // ─── STABILIZATION STAGE (FLOWANCHOR) ──────────────────────────────────

  /**
   * Apply FlowAnchor dual-anchoring to stabilize video edits.
   *
   * FlowAnchor pattern:
   *   - Spatial anchor: locks unedited regions using optical flow correspondence
   *   - Motion adaptive anchor: dynamically adjusts stabilization strength
   *     based on motion magnitude per frame
   *   - Combined: produces temporally consistent edits without DDIM inversion
   */
  async editVideo(request: VideoEditRequest): Promise<VideoEditResult> {
    const startMs = Date.now();

    const response = await this.grpcCall('EditVideo', {
      source_video_uri: request.sourceVideoUri,
      edit_prompt: request.editPrompt,
      spatial_anchor_strength: request.anchorConfig.spatialAnchorStrength,
      motion_adaptive_strength: request.anchorConfig.motionAdaptiveStrength,
      temporal_window_frames: request.anchorConfig.temporalWindowFrames,
      inversion_free: request.anchorConfig.inversionFree,
      output_resolution: request.outputResolution,
      fps: request.fps,
    });

    const result: VideoEditResult = {
      outputVideoUri: response.output_video_uri,
      framesProcessed: response.frames_processed,
      stabilityScore: response.stability_score,
      temporalConsistencyScore: response.temporal_consistency_score,
      processingMs: Date.now() - startMs,
    };

    this.emit('video:edited', result);
    return result;
  }

  // ─── GENERATION STAGE (UNIVIDX) ────────────────────────────────────────

  /**
   * Generate video from multimodal inputs using UniVidX diffusion priors.
   *
   * Supports any combination of conditional inputs:
   *   text + image → video generation
   *   video + text → video editing/extension
   *   depth + pose → controlled generation
   *   sketch + text → creative generation
   */
  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const startMs = Date.now();

    const response = await this.grpcCall('GenerateVideo', {
      prompt: request.prompt,
      conditional_inputs: request.conditionalInputs.map((ci) => ({
        modality: ci.modality,
        uri: ci.uri,
      })),
      diffusion_steps: request.diffusionSteps,
      guidance_scale: request.guidanceScale,
      resolution: request.resolution,
      fps: request.fps,
      duration_seconds: request.durationSeconds,
    });

    const result: VideoGenerationResult = {
      outputVideoUri: response.output_video_uri,
      resolution: request.resolution,
      fps: request.fps,
      durationSeconds: request.durationSeconds,
      processingMs: Date.now() - startMs,
    };

    this.emit('video:generated', result);
    return result;
  }

  // ─── UE5 METAHUMAN BRIDGE ─────────────────────────────────────────────

  /**
   * Stream scene graph data to UE5 MetaHuman via OSC.
   * The MetaHuman responds to spatial events:
   *   - Person detection → head tracking
   *   - Room energy → animation intensity
   *   - Spatial queries → gesture responses
   */
  async streamToMetaHuman(): Promise<void> {
    if (!this.sceneGraph) {
      throw new Error('No scene graph. Build one first.');
    }

    const config = this.config.ue5Config!;

    await this.grpcCall('StreamToMetaHuman', {
      scene_graph: this.sceneGraph,
      osc_host: config.oscHost,
      osc_port: config.oscPort,
      arkit_blendshapes: config.arkitBlendshapes,
      live_link: config.liveLink,
      metahuman_id: config.metaHumanId,
    });

    this.emit('metahuman:synced', {
      sceneVersion: this.sceneGraph.version,
      nodeCount: this.sceneGraph.nodes.length,
    });
  }

  // ─── CONTINUOUS PIPELINE ───────────────────────────────────────────────

  /**
   * Run the full perception→reasoning→metahuman loop continuously.
   * Captures frames, builds scene graphs, and drives the MetaHuman.
   */
  async startContinuousPipeline(
    frameSource: () => Promise<string>,
    intervalMs: number = 2000
  ): Promise<void> {
    if (this.running) return;
    this.running = true;

    this.emit('pipeline:started');

    const loop = async () => {
      while (this.running) {
        try {
          const frameUri = await frameSource();

          // Perception
          const depth = await this.estimateDepth({
            frameUri,
            model: 'da3-mono',
            outputFormat: 'point_cloud',
          });

          // Reasoning
          await this.buildSceneGraph(frameUri, depth.depthMapUri);

          // MetaHuman sync
          if (this.config.ue5Config) {
            await this.streamToMetaHuman();
          }
        } catch (err) {
          this.emit('pipeline:error', err);
        }

        await new Promise((r) => setTimeout(r, intervalMs));
      }
    };

    loop().catch((err) => this.emit('pipeline:fatal', err));
  }

  /**
   * Stop the continuous pipeline.
   */
  stop(): void {
    this.running = false;
    this.emit('pipeline:stopped');
  }

  /**
   * Get the current scene graph.
   */
  getSceneGraph(): SceneGraph | null {
    return this.sceneGraph;
  }

  // ─── INTERNAL ──────────────────────────────────────────────────────────

  /**
   * gRPC call to the spatial-intelligence Python server.
   * In production, this uses @grpc/grpc-js against the spatial_pb2 service.
   * For now, uses HTTP/JSON bridge until the gRPC client is wired.
   */
  private async grpcCall(method: string, payload: any): Promise<any> {
    const endpoint = `http://${this.config.grpcEndpoint}`;
    const response = await fetch(`${endpoint}/api/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Spatial gRPC ${method} failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

// ─── CONVENIENCE FACTORY ──────────────────────────────────────────────────

/**
 * Create a fully configured SpatialPipeline with standard CLE defaults.
 */
export function createSpatialPipeline(
  overrides: Partial<SpatialPipelineConfig> = {}
): SpatialPipeline {
  return new SpatialPipeline({
    grpcEndpoint: 'localhost:50051',
    ue5Config: DEFAULT_UE5_CONFIG,
    defaultAnchorConfig: DEFAULT_ANCHOR_CONFIG,
    ...overrides,
  });
}
