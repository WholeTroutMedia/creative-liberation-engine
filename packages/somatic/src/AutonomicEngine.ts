import { ARKitFrame, ARKitBlendshapeName } from './types/ARKit.js';
import { UDPEmitter } from './UDPEmitter.js';

export interface AutonomicOptions {
  emitter: UDPEmitter;
  tickRateMs?: number; // Default 16ms (~60Hz)
  breathingAmplitude?: number; // 0.0 - 1.0, default 0.1
  breathingSpeed?: number; // Default 1.0
  saccadeFrequency?: number; // 0.0 - 1.0 (likelihood per tick)
}

export class AutonomicEngine {
  private emitter: UDPEmitter;
  private intervalId: NodeJS.Timeout | null = null;
  private tickRateMs: number;
  
  private baseFrame: Partial<ARKitFrame> = {};
  private currentFrame: ARKitFrame;
  
  private startTime: number = 0;
  
  private breathingAmplitude: number;
  private breathingSpeed: number;
  private saccadeFrequency: number;

  // Saccade state
  private targetSaccade: { x: number, y: number } = { x: 0, y: 0 };
  private currentSaccade: { x: number, y: number } = { x: 0, y: 0 };
  private saccadeInterpolationSpeed: number = 0.2;

  constructor(options: AutonomicOptions) {
    this.emitter = options.emitter;
    this.tickRateMs = options.tickRateMs || 16;
    this.breathingAmplitude = options.breathingAmplitude ?? 0.1;
    this.breathingSpeed = options.breathingSpeed ?? 1.0;
    this.saccadeFrequency = options.saccadeFrequency ?? 0.02;

    this.currentFrame = this.createEmptyFrame();
  }

  private createEmptyFrame(): ARKitFrame {
    // Return an explicit zeroed object to prevent undefined errors when serializing to OSC
    // (This requires casting, but functionally in JS we can just use a Proxy or initialize explicitly)
    const frame: any = {};
    return frame as ARKitFrame;
  }

  /**
   * Updates the core explicit semantic intent. The autonomic noise is added on top of this.
   */
  public setBaseFrame(frame: Partial<ARKitFrame>) {
    this.baseFrame = { ...frame };
  }

  public setEmotionalBaseline(params: { breathingAmplitude?: number; breathingSpeed?: number; saccadeFrequency?: number }) {
    if (params.breathingAmplitude !== undefined) this.breathingAmplitude = params.breathingAmplitude;
    if (params.breathingSpeed !== undefined) this.breathingSpeed = params.breathingSpeed;
    if (params.saccadeFrequency !== undefined) this.saccadeFrequency = params.saccadeFrequency;
  }

  public start() {
    if (this.intervalId) return;
    this.startTime = Date.now();
    this.intervalId = setInterval(() => this.tick(), this.tickRateMs);
    console.log(`[somatic] AutonomicEngine started at ${Math.round(1000/this.tickRateMs)}Hz`);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`[somatic] AutonomicEngine stopped.`);
    }
  }

  private tick() {
    const timeMs = Date.now() - this.startTime;
    const timeSec = timeMs / 1000.0;

    // 1. Math: Sine-wave breathing (JawOpen)
    const breathPhase = timeSec * this.breathingSpeed * Math.PI;
    // Map sine -1..1 to 0..1
    const breathValue = ((Math.sin(breathPhase) + 1) / 2) * this.breathingAmplitude;

    // 2. Math: Saccades (Eye Look darts)
    if (Math.random() < this.saccadeFrequency) {
      // Pick a new random target for eye dart
      // Typical human darts are small. Range: -0.3 to 0.3
      this.targetSaccade = {
        x: (Math.random() - 0.5) * 0.6,
        y: (Math.random() - 0.5) * 0.6
      };
    }
    
    // Smooth interpolate towards saccade target
    this.currentSaccade.x += (this.targetSaccade.x - this.currentSaccade.x) * this.saccadeInterpolationSpeed;
    this.currentSaccade.y += (this.targetSaccade.y - this.currentSaccade.y) * this.saccadeInterpolationSpeed;

    // Convert abstract X/Y to specific Blendshapes
    const eyeLookUp = Math.max(0, this.currentSaccade.y);
    const eyeLookDown = Math.max(0, -this.currentSaccade.y);
    const eyeLookRight = Math.max(0, this.currentSaccade.x);
    const eyeLookLeft = Math.max(0, -this.currentSaccade.x);

    // 3. Composite logic: Base LLM Intent + Autonomic Noise
    const output: any = { ...this.baseFrame };

    // Apply breathing
    output.JawOpen = Math.min(1.0, (output.JawOpen || 0) + breathValue);
    
    // Apply saccades
    output.EyeLookUpLeft = Math.min(1.0, (output.EyeLookUpLeft || 0) + eyeLookUp);
    output.EyeLookUpRight = Math.min(1.0, (output.EyeLookUpRight || 0) + eyeLookUp);
    
    output.EyeLookDownLeft = Math.min(1.0, (output.EyeLookDownLeft || 0) + eyeLookDown);
    output.EyeLookDownRight = Math.min(1.0, (output.EyeLookDownRight || 0) + eyeLookDown);
    
    output.EyeLookInLeft = Math.min(1.0, (output.EyeLookInLeft || 0) + eyeLookRight);
    output.EyeLookOutRight = Math.min(1.0, (output.EyeLookOutRight || 0) + eyeLookRight);

    output.EyeLookOutLeft = Math.min(1.0, (output.EyeLookOutLeft || 0) + eyeLookLeft);
    output.EyeLookInRight = Math.min(1.0, (output.EyeLookInRight || 0) + eyeLookLeft);

    // 4. Dispatch the final mixed frame
    this.currentFrame = output as ARKitFrame;
    this.emitter.sendFrame(this.currentFrame);
  }
}
