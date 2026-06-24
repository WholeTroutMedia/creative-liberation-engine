/**
 * Scale Space Degradation
 * 
 * Based on the mathematical principles of Scale Space Diffusion (SSD),
 * highly noisy states are functionally equivalent to downsampled versions.
 * 
 * This module applies structural downsampling to JSON/AST hierarchies 
 * instead of image pixels. By applying a 'ScaleSpaceFilter', we can 
 * simulate the continuous degradation of nested information.
 */

export interface StructuralNode {
    id: string;
    type: string;
    weight: number;
    children?: StructuralNode[];
    data?: any;
}

export class ScaleSpaceFilter {
    private maxDepth: number;

    constructor(initialScale: number = 3) {
        this.maxDepth = initialScale;
    }

    /**
     * Applies the spatial degradation (downsampling).
     * At lower resolutions, leaf nodes are pruned, and their semantic weights 
     * are aggregated into the parent nodes, mirroring spatial blurring.
     */
    public downsample(node: StructuralNode, currentDepth: number = 0): StructuralNode {
        if (currentDepth >= this.maxDepth || !node.children || node.children.length === 0) {
            // Reached maximum resolution scale or leaf node
            return {
                id: node.id,
                type: `Aggregated[${node.type}]`,
                weight: this.aggregateWeight(node),
                // Children are 'blurred' out of existence at this scale
            };
        }

        const degradedChildren = node.children.map(child => this.downsample(child, currentDepth + 1));
        
        return {
            ...node,
            weight: this.aggregateWeight(node),
            children: degradedChildren
        };
    }

    /**
     * Helper to blur weights upward.
     */
    private aggregateWeight(node: StructuralNode): number {
        let total = node.weight;
        if (node.children) {
            for (const child of node.children) {
                total += this.aggregateWeight(child); // Recursive aggregation
            }
        }
        return total;
    }

    /**
     * Set the continuous scale factor.
     */
    public setScale(depth: number) {
        this.maxDepth = Math.max(0, depth);
    }
}
