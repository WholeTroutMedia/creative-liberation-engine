export type NpuTaskType = 'object_detection' | 'pose_estimation' | 'depth_estimation';

export interface ModelConfig {
  id: string;
  name: string;
  path: string;
  type: NpuTaskType;
  resolution: [number, number];
}

export class ModelRegistry {
  private activeModelId = 'yolov5s_coco';
  
  private models: Record<string, ModelConfig> = {
    yolov5s_coco: {
      id: 'yolov5s_coco',
      name: 'YOLOv5s Object Detection (Coco80)',
      path: '/opt/sixfab-dx/yolov5s_ppu.dxnn',
      type: 'object_detection',
      resolution: [512, 512]
    },
    yolov8_pose: {
      id: 'yolov8_pose',
      name: 'YOLOv8-Pose Skeletal Tracking',
      path: '/opt/sixfab-dx/yolov8s_pose.dxnn',
      type: 'pose_estimation',
      resolution: [640, 640]
    },
    midas_depth: {
      id: 'midas_depth',
      name: 'MiDaS Grayscale Depth Mapping',
      path: '/opt/sixfab-dx/midas_v21.dxnn',
      type: 'depth_estimation',
      resolution: [256, 256]
    }
  };

  public getModelsList(): ModelConfig[] {
    return Object.values(this.models);
  }

  public getModel(id: string): ModelConfig | undefined {
    return this.models[id];
  }

  public getActiveModel(): ModelConfig {
    return this.models[this.activeModelId] || this.models['yolov5s_coco'];
  }

  public setActiveModel(id: string): boolean {
    if (this.models[id]) {
      this.activeModelId = id;
      return true;
    }
    return false;
  }
}
