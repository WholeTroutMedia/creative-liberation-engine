/**
 * GenMedia — generative media orchestration.
 *
 * Routes media generation requests to the appropriate backend:
 * FAL.ai, Stability, DALL-E, local ComfyUI, etc.
 *
 * @capabilityId cap_genmedia
 */

import { getConfig } from '@cle/config';

export class GenMedia {
  constructor(opts = {}) {
    this.falApiKey = opts.falApiKey || getConfig('FAL_API_KEY', '');
  }

  async generateImage({ prompt, model = 'fal-ai/flux/dev', width = 1024, height = 1024 }) {
    // Future: route to FAL, Stability, or local ComfyUI based on model arbitrage
    return { status: 'queued', prompt, model, dimensions: { width, height } };
  }

  async generateVideo({ prompt, model = 'fal-ai/kling-video', duration = 5 }) {
    return { status: 'queued', prompt, model, duration };
  }

  async generateAudio({ prompt, model = 'fal-ai/stable-audio', duration = 30 }) {
    return { status: 'queued', prompt, model, duration };
  }
}

export function generateImage(opts) { return new GenMedia().generateImage(opts); }
export function generateVideo(opts) { return new GenMedia().generateVideo(opts); }
export function generateAudio(opts) { return new GenMedia().generateAudio(opts); }
