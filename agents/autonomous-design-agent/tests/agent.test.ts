import { describe, it, expect } from "vitest";
import { DesignPlanner } from "../src/planner.js";
import { DesignGuidelinesVerifier } from "../src/guidelines.js";

describe("Autonomous Design Agent (ADA) Suite", () => {
  it("should compile a full spatial design plan matching dashboard prompts", () => {
    const plan = DesignPlanner.compilePlan("Build a telemetry monitoring dashboard");
    expect(plan.planId).toBeDefined();
    expect(plan.elements.length).toBe(4);
    expect(plan.elements[0].type).toBe("header");
    expect(plan.elements[1].type).toBe("grid");
  });

  it("should detect overlapping coordinate collisions between elements", () => {
    const overlappingElements = [
      { id: "el-1", type: "card" as const, label: "A2A", x: 10, y: 10, width: 100, height: 100 },
      { id: "el-2", type: "button" as const, label: "Trigger", x: 50, y: 50, width: 100, height: 100 }
    ];

    const report = DesignGuidelinesVerifier.verifyOverlapAndBounds(overlappingElements);
    expect(report.isValid).toBe(false);
    expect(report.issues.length).toBe(1);
    expect(report.issues[0]).toContain("Visual collision detected");
  });

  it("should pass verification for clean, non-overlapping layouts", () => {
    const cleanElements = [
      { id: "el-1", type: "card" as const, label: "A2A", x: 10, y: 10, width: 100, height: 100 },
      { id: "el-2", type: "button" as const, label: "Trigger", x: 120, y: 10, width: 100, height: 100 }
    ];

    const report = DesignGuidelinesVerifier.verifyOverlapAndBounds(cleanElements);
    expect(report.isValid).toBe(true);
    expect(report.issues.length).toBe(0);
  });
});
