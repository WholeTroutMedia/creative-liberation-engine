/**
 * Spatial Pipeline Genkit Tools
 *
 * Exposes the WS-3 Unified Spatial Pipeline to the Genkit agent framework.
 * Agents can: estimate depth, build scene graphs, query spatial relationships,
 * edit video (FlowAnchor), generate video (UniVidX), and drive MetaHuman.
 */

import { ai, z } from '../ai.js';
import { SpatialPipeline, createSpatialPipeline } from '@cle/spatial-intelligence/spatial-pipeline';

let _pipeline: SpatialPipeline | null = null;
function getPipeline(): SpatialPipeline {
  if (!_pipeline) {
    _pipeline = createSpatialPipeline({
      grpcEndpoint: process.env.SPATIAL_GRPC_ENDPOINT || 'localhost:50051',
    });
  }
  return _pipeline;
}

// ─── Depth Estimation Tool ───────────────────────────────────────────────────

export const estimateDepthTool = ai.defineTool(
  {
    name: 'estimateDepth',
    description:
      'Estimate depth from an RGB image using monocular depth models (DA3 or DepthPro). ' +
      'Returns a depth map URI and point cloud data for spatial reasoning.',
    inputSchema: z.object({
      frameUri: z.string().describe('URI to the RGB image/frame'),
      model: z.enum(['da3-mono', 'da3-stereo', 'depthpro']).default('da3-mono'),
      outputFormat: z.enum(['raw_float32', 'normalized_png', 'point_cloud']).default('point_cloud'),
    }),
    outputSchema: z.object({
      depthMapUri: z.string(),
      model: z.string(),
      resolution: z.array(z.number()),
      minDepth: z.number(),
      maxDepth: z.number(),
      processingMs: z.number(),
    }),
  },
  async (input) => {
    const pipeline = getPipeline();
    return pipeline.estimateDepth(input);
  }
);

// ─── Scene Graph Tool ────────────────────────────────────────────────────────

export const buildSceneGraphTool = ai.defineTool(
  {
    name: 'buildSceneGraph',
    description:
      'Build a 3D scene graph from RGB + depth data using the Utonia encoder. ' +
      'Produces object positions, spatial relationships, and room energy metrics.',
    inputSchema: z.object({
      rgbUri: z.string().describe('URI to the RGB image'),
      depthUri: z.string().describe('URI to the corresponding depth map'),
    }),
    outputSchema: z.object({
      version: z.number(),
      timestamp: z.string(),
      nodeCount: z.number(),
      roomEnergy: z.number(),
    }),
  },
  async (input) => {
    const pipeline = getPipeline();
    const graph = await pipeline.buildSceneGraph(input.rgbUri, input.depthUri);
    return {
      version: graph.version,
      timestamp: graph.timestamp,
      nodeCount: graph.nodes.length,
      roomEnergy: graph.roomEnergy,
    };
  }
);

// ─── Spatial Query Tool ──────────────────────────────────────────────────────

export const querySpatialTool = ai.defineTool(
  {
    name: 'querySpatial',
    description:
      'Query spatial relationships from the current scene graph. ' +
      'Ask questions like "what is to the left of the monitor?" or "how far is the chair from the desk?"',
    inputSchema: z.object({
      query: z.string().describe('Natural language spatial question'),
    }),
    outputSchema: z.object({
      answer: z.string(),
      relevantNodeCount: z.number(),
    }),
  },
  async (input) => {
    const pipeline = getPipeline();
    const result = await pipeline.querySpatial(input.query);
    return {
      answer: result.answer,
      relevantNodeCount: result.relevantNodes.length,
    };
  }
);

// ─── Video Edit Tool (FlowAnchor) ────────────────────────────────────────────

export const editVideoTool = ai.defineTool(
  {
    name: 'editVideoFlowAnchor',
    description:
      'Edit a video using FlowAnchor dual-anchoring stabilization. ' +
      'Applies text-guided edits while maintaining temporal consistency across frames. ' +
      'No DDIM inversion required — uses spatial + motion adaptive anchoring.',
    inputSchema: z.object({
      sourceVideoUri: z.string().describe('URI to the source video file'),
      editPrompt: z.string().describe('Text description of the desired edit'),
      spatialAnchorStrength: z.number().min(0).max(1).default(0.7),
      motionAdaptiveStrength: z.number().min(0).max(1).default(0.5),
      temporalWindowFrames: z.number().int().min(1).default(16),
      outputResolution: z.enum(['512x512', '768x768', '1024x576', '1920x1080']).default('1024x576'),
      fps: z.number().int().default(24),
    }),
    outputSchema: z.object({
      outputVideoUri: z.string(),
      framesProcessed: z.number(),
      stabilityScore: z.number(),
      temporalConsistencyScore: z.number(),
      processingMs: z.number(),
    }),
  },
  async (input) => {
    const pipeline = getPipeline();
    return pipeline.editVideo({
      sourceVideoUri: input.sourceVideoUri,
      editPrompt: input.editPrompt,
      anchorConfig: {
        spatialAnchorStrength: input.spatialAnchorStrength,
        motionAdaptiveStrength: input.motionAdaptiveStrength,
        temporalWindowFrames: input.temporalWindowFrames,
        inversionFree: true,
      },
      outputResolution: input.outputResolution,
      fps: input.fps,
    });
  }
);

// ─── Video Generation Tool (UniVidX) ─────────────────────────────────────────

export const generateVideoTool = ai.defineTool(
  {
    name: 'generateVideoUniVidX',
    description:
      'Generate video from multimodal inputs using UniVidX diffusion priors. ' +
      'Supports any combination: text+image→video, video+text→edit, depth+pose→controlled generation.',
    inputSchema: z.object({
      prompt: z.string().describe('Text prompt for video generation'),
      conditionalInputs: z.array(z.object({
        modality: z.enum(['text', 'image', 'video', 'audio', 'depth', 'pose', 'sketch']),
        uri: z.string(),
      })).optional().default([]),
      diffusionSteps: z.number().int().default(50),
      guidanceScale: z.number().default(7.5),
      resolution: z.enum(['512x512', '768x768', '1024x576', '1920x1080']).default('1024x576'),
      fps: z.number().int().default(24),
      durationSeconds: z.number().default(4),
    }),
    outputSchema: z.object({
      outputVideoUri: z.string(),
      resolution: z.string(),
      fps: z.number(),
      durationSeconds: z.number(),
      processingMs: z.number(),
    }),
  },
  async (input) => {
    const pipeline = getPipeline();
    return pipeline.generateVideo(input);
  }
);

// ─── MetaHuman Sync Tool ─────────────────────────────────────────────────────

export const syncMetaHumanTool = ai.defineTool(
  {
    name: 'syncMetaHuman',
    description:
      'Stream the current scene graph to UE5 MetaHuman via OSC/LiveLink. ' +
      'The MetaHuman responds to spatial events: head tracking, animation intensity, gesture responses.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      synced: z.boolean(),
      sceneVersion: z.number(),
      nodeCount: z.number(),
    }),
  },
  async () => {
    const pipeline = getPipeline();
    const graph = pipeline.getSceneGraph();
    if (!graph) {
      return { synced: false, sceneVersion: 0, nodeCount: 0 };
    }
    await pipeline.streamToMetaHuman();
    return { synced: true, sceneVersion: graph.version, nodeCount: graph.nodes.length };
  }
);
