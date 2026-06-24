export interface SpatialPipeline {
    estimateDepth(input: any): Promise<any>;
    buildSceneGraph(rgbUri: string, depthUri: string): Promise<any>;
    querySpatial(query: string): Promise<any>;
    editVideo(input: any): Promise<any>;
    generateVideo(input: any): Promise<any>;
    getSceneGraph(): any;
    streamToMetaHuman(): Promise<void>;
}

export function createSpatialPipeline(config: { grpcEndpoint: string }): SpatialPipeline {
    return {
        async estimateDepth(input: any) { return {}; },
        async buildSceneGraph(rgbUri: string, depthUri: string) { return { version: 1, timestamp: new Date().toISOString(), nodes: [], roomEnergy: 0 }; },
        async querySpatial(query: string) { return { answer: '', relevantNodes: [] }; },
        async editVideo(input: any) { return {}; },
        async generateVideo(input: any) { return {}; },
        getSceneGraph() { return null; },
        async streamToMetaHuman() {}
    };
}
