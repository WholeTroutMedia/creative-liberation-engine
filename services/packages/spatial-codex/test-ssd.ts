import { DiffusionStateSpaceBackbone, StructuralNode } from './src';

console.log("[Test] Creating a nested architectural node tree (High Resolution)");

const mockAST: StructuralNode = {
    id: "Root_Service",
    type: "Microservice",
    weight: 10,
    children: [
        {
            id: "API_Layer",
            type: "Router",
            weight: 5,
            children: [
                { id: "Route_GET", type: "Endpoint", weight: 2 },
                { id: "Route_POST", type: "Endpoint", weight: 8 }
            ]
        },
        {
            id: "DB_Layer",
            type: "ConnectionPool",
            weight: 20
        }
    ]
};

console.log("[Test] Initial State:");
console.dir(mockAST, { depth: null });

const backbone = new DiffusionStateSpaceBackbone();

console.log("\n[Test] Running Forward Process (Diffusing structural integrity over 3 steps)...");
const diffusionSequence = backbone.forwardProcess(mockAST, 2);

diffusionSequence.forEach(step => {
    console.log(`\n--- Timestep: ${step.t} | Sigma (Blur/Depth Limit): ${step.sigma} ---`);
    console.dir(step.state[0], { depth: null });
});

console.log("\n[Test] SSD Logic Validation Complete.");
