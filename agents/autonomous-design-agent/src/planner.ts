export interface CanvasElement {
  id: string;
  type: "card" | "header" | "button" | "chart" | "grid";
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignPlan {
  planId: string;
  version: string;
  theme: "dark" | "light" | "glassmorphic";
  elements: CanvasElement[];
  timestamp: number;
}

export class DesignPlanner {
  /**
   * Parse prompt instructions and compile them into structured coordinate maps
   */
  public static compilePlan(prompt: string): DesignPlan {
    const plan: DesignPlan = {
      planId: `plan-${Math.random().toString(36).substring(7)}`,
      version: "1.0.0",
      theme: "glassmorphic",
      elements: [],
      timestamp: Date.now()
    };

    if (prompt.toLowerCase().includes("dashboard") || prompt.toLowerCase().includes("workspace")) {
      plan.elements.push(
        { id: "el-1", type: "header", label: "Agent Space Workspace HUD", x: 20, y: 20, width: 800, height: 60 },
        { id: "el-2", type: "grid", label: "Container Topology Map", x: 20, y: 100, width: 500, height: 400 },
        { id: "el-3", type: "chart", label: "Resource CPU Metrics", x: 540, y: 100, width: 280, height: 180 },
        { id: "el-4", type: "card", label: "Action Control Panel", x: 540, y: 300, width: 280, height: 200 }
      );
    } else {
      // Basic fallback mock layout
      plan.elements.push(
        { id: "el-1", type: "header", label: "Dynamic Spatial View", x: 50, y: 50, width: 600, height: 80 },
        { id: "el-2", type: "card", label: "A2A Capability Core", x: 50, y: 150, width: 280, height: 200 },
        { id: "el-3", type: "button", label: "Revoke payment mandate", x: 350, y: 150, width: 200, height: 50 }
      );
    }

    return plan;
  }
}
