import * as THREE from 'three';

/**
 * CLE ENGINE V6 ── NEXUS Spatial Segmenter & Telemetry Controller
 * ======================================================================
 * Implements real-time WebGPU/Three.js uniform buffer mapping and local 
 * spatial transformation controllers to animate segmented 3D Gaussian Splats 
 * and meshes via high-frequency telemetry streams.
 * 
 * Complies with V6 Schema: schemas/nexus.telemetry-binding.schema.json
 */

export interface ProcessingPipeline {
    multiplier: number;
    offset: number;
    smoothing: number; // Exponential moving average coefficient (0.0 to 1.0)
}

export interface TelemetrySource {
    type: 'WEBSOCKET_TELEMETRY' | 'OSC_STREAM' | 'MIDI_CC' | 'SYSTEM_METRIC' | 'TRACKCRAFT3R_POINT';
    clientId: string;
    channel: string;
    processing?: ProcessingPipeline;
}

export interface TelemetryTarget {
    segmentId: number;
    parameter: string;
}

export interface TelemetryBinding {
    bindingId: string;
    friendlyName?: string;
    active: boolean;
    source: TelemetrySource;
    target: TelemetryTarget;
}

/**
 * Handles smooth exponential filtering and damping of incoming real-time signals
 */
export class TelemetrySignal {
    public rawValue: number = 0;
    public filteredValue: number = 0;
    
    constructor(public defaultValue: number = 0) {
        this.rawValue = defaultValue;
        this.filteredValue = defaultValue;
    }

    public update(newValue: number, smoothing: number = 0.12): number {
        this.rawValue = newValue;
        this.filteredValue = this.filteredValue + (newValue - this.filteredValue) * (1 - smoothing);
        return this.filteredValue;
    }
}

/**
 * Represents a segmented 3D object / Gaussian Splat point group in the Three.js viewport
 */
export class SplatSegmentNode {
    public segmentId: number;
    public object3D: THREE.Object3D;
    
    // Smooth target transforms to prevent visual jittering on network latency spikes
    public targetPosition: THREE.Vector3 = new THREE.Vector3();
    public targetRotation: THREE.Quaternion = new THREE.Quaternion();
    public targetScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1);
    public targetOpacity: number = 1.0;
    public targetColorOverride: THREE.Color = new THREE.Color(1, 1, 1);

    constructor(segmentId: number, object3D: THREE.Object3D) {
        this.segmentId = segmentId;
        this.object3D = object3D;
        
        // Sync initial states
        this.targetPosition.copy(object3D.position);
        this.targetRotation.copy(object3D.quaternion);
        this.targetScale.copy(object3D.scale);
    }

    /**
     * Smoothly interpolates the Three.js object transformations toward target states
     */
    public lerpTransform(smoothingFactor: number = 0.15): void {
        this.object3D.position.lerp(this.targetPosition, 1 - smoothingFactor);
        this.object3D.quaternion.slerp(this.targetRotation, 1 - smoothingFactor);
        this.object3D.scale.lerp(this.targetScale, 1 - smoothingFactor);
    }
}

/**
 * The master spatial routing controller managing telemetry bindings and dynamic transforms
 */
export class NexusSpatialController {
    private segments: Map<number, SplatSegmentNode> = new Map();
    private bindings: Map<string, TelemetryBinding> = new Map();
    private signals: Map<string, TelemetrySignal> = new Map();
    
    // Uniform Matrix buffer representing the 256 segmented groups (uploaded to WebGPU/WebGL shader)
    public segmentTransformMatrices: Float32Array;

    constructor() {
        // Allocate space for 256 4x4 matrices (256 segments * 16 floats = 4096 floats)
        this.segmentTransformMatrices = new Float32Array(256 * 16);
        this.initializeIdentityMatrices();
    }

    private initializeIdentityMatrices(): void {
        const identity = new THREE.Matrix4();
        for (let i = 0; i < 256; i++) {
            this.writeMatrixToBuffer(i, identity);
        }
    }

    /**
     * Registers a Three.js mesh/splat group under a specific Segment ID
     */
    public registerSegment(segmentId: number, object: THREE.Object3D): void {
        const node = new SplatSegmentNode(segmentId, object);
        this.segments.set(segmentId, node);
        console.log(`[Nexus] Segment ID ${segmentId} successfully registered to spatial scene.`);
    }

    /**
     * Dynamically registers or updates an operational telemetry binding rule
     */
    public registerBinding(binding: TelemetryBinding): void {
        this.bindings.set(binding.bindingId, binding);
        
        // Allocate dynamic signal tracker if not present
        const sigKey = `${binding.source.clientId}:${binding.source.channel}`;
        if (!this.signals.has(sigKey)) {
            this.signals.set(sigKey, new TelemetrySignal());
        }
        
        console.log(`[Nexus] Binding ${binding.bindingId} registered: [${sigKey}] ──► [Segment ${binding.target.segmentId}:${binding.target.parameter}]`);
    }

    /**
     * Processes high-frequency incoming telemetry updates and maps them to target segmented nodes
     */
    public feedTelemetry(clientId: string, payload: Record<string, any>): void {
        // ZIG SIM payloads often contain sensordata block
        const sensordata = payload.sensordata || payload;

        // Iterate over active binding schemas
        this.bindings.forEach((binding) => {
            if (!binding.active || binding.source.clientId !== clientId) return;

            // Extract sensor path value, e.g. "gravity.x" from sensordata
            const value = this.resolvePath(sensordata, binding.source.channel);
            if (value === undefined || value === null) return;

            const sigKey = `${clientId}:${binding.source.channel}`;
            const signal = this.signals.get(sigKey);
            if (!signal) return;

            // Apply standard mathematical pipeline filters (smoothing, scaling, offset)
            const proc = binding.source.processing || { multiplier: 1.0, offset: 0.0, smoothing: 0.15 };
            const processedValue = (value * (proc.multiplier ?? 1.0)) + (proc.offset ?? 0.0);
            const filteredValue = signal.update(processedValue, proc.smoothing ?? 0.15);

            // Apply mapped parameters directly to target segment transforms
            this.applyParameterToSegment(binding.target.segmentId, binding.target.parameter, filteredValue, payload);
        });
    }

    private applyParameterToSegment(segmentId: number, parameter: string, value: number, rawPayload: any): void {
        const segment = this.segments.get(segmentId);
        if (!segment) return;

        switch (parameter) {
            case 'transform.position.x':
                segment.targetPosition.x = value;
                break;
            case 'transform.position.y':
                segment.targetPosition.y = value;
                break;
            case 'transform.position.z':
                segment.targetPosition.z = value;
                break;
            case 'transform.rotation.x':
                // Handles Euler rotations dynamically
                const curEulerX = new THREE.Euler().setFromQuaternion(segment.targetRotation);
                curEulerX.x = value;
                segment.targetRotation.setFromEuler(curEulerX);
                break;
            case 'transform.rotation.y':
                const curEulerY = new THREE.Euler().setFromQuaternion(segment.targetRotation);
                curEulerY.y = value;
                segment.targetRotation.setFromEuler(curEulerY);
                break;
            case 'transform.rotation.z':
                const curEulerZ = new THREE.Euler().setFromQuaternion(segment.targetRotation);
                curEulerZ.z = value;
                segment.targetRotation.setFromEuler(curEulerZ);
                break;
            case 'transform.scale.x':
                segment.targetScale.x = value;
                break;
            case 'transform.scale.y':
                segment.targetScale.y = value;
                break;
            case 'transform.scale.z':
                segment.targetScale.z = value;
                break;
            case 'visual.opacity':
                segment.targetOpacity = Math.max(0, Math.min(1, value));
                break;
        }

        // Special absolute Quaternion bypass mapping (Direct orientation pass-through without Euler translation)
        const sensordata = rawPayload.sensordata || rawPayload;
        if (sensordata.quaternion && (parameter.startsWith('transform.rotation'))) {
            const quat = sensordata.quaternion;
            if (quat.x !== undefined && quat.y !== undefined && quat.z !== undefined && quat.w !== undefined) {
                // Apply absolute quaternion mapping to avoid gimbal locks
                segment.targetRotation.set(quat.x, quat.y, quat.z, quat.w);
            }
        }
    }

    /**
     * Executes the frame-loop animation update, writes output matrices to shared WebGL/WebGPU Float32 buffer
     */
    public updateFrame(): void {
        this.segments.forEach((segment, id) => {
            // Apply fluid interpolation
            segment.lerpTransform(0.12);
            
            // Build absolute model transformation matrix
            segment.object3D.updateMatrix();
            const matrix = segment.object3D.matrix;
            
            // Write direct matrix floats into our shared Float32Array buffer array
            this.writeMatrixToBuffer(id, matrix);
        });
    }

    private writeMatrixToBuffer(segmentId: number, matrix: THREE.Matrix4): void {
        const offset = segmentId * 16;
        for (let i = 0; i < 16; i++) {
            this.segmentTransformMatrices[offset + i] = matrix.elements[i];
        }
    }

    private resolvePath(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }
}
