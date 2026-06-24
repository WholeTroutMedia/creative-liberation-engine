import logger from 'pino';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export interface FaceSceneResult {
  tags: string[];
  facesDetected: number;
  primaryScene: string;
}

export class FaceSceneTagger {
  public catalog(rawDetections: string[], rawScene?: string, facesCount?: number): FaceSceneResult {
    const tags: string[] = [];
    const facesDetected = facesCount || (rawDetections.includes('person') ? 1 : 0);
    const primaryScene = rawScene || 'unknown_scene';

    // Map raw detections to structured tags
    rawDetections.forEach(det => {
      if (det === 'person') {
        tags.push('portrait');
      } else if (['car', 'bicycle', 'bus', 'motorcycle', 'truck'].includes(det)) {
        tags.push('vehicle_shoot');
      } else if (['dog', 'cat', 'bird', 'horse', 'sheep', 'cow'].includes(det)) {
        tags.push('animal_shoot');
      } else {
        tags.push(`subject:${det}`);
      }
    });

    // Scene tags
    if (primaryScene !== 'unknown_scene') {
      tags.push(`scene:${primaryScene}`);
    }

    // Face metadata tagging
    if (facesDetected > 0) {
      tags.push('people_present');
      if (facesDetected > 3) {
        tags.push('group_shot');
      } else {
        tags.push('solo_or_duo');
      }
    }

    log.info(`[FACE_SCENE_TAGGER] Scene/Face analysis: Scene=${primaryScene}, Faces=${facesDetected} -> Tags: ${tags.join(', ')}`);

    return {
      tags,
      facesDetected,
      primaryScene
    };
  }
}
