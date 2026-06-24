import { describe, it, expect, vi } from "vitest";
import React from "react";
import { GenesisCanvas, CanvasElement } from "../src/Canvas.js";
import { GenesisOverlay, AgentActionSuggestion } from "../src/Overlay.js";

describe("Genesis Co-Creation Canvas Component Suite", () => {
  it("should successfully build canvas properties and structure", () => {
    const initialElements: CanvasElement[] = [
      {
        id: "element-1",
        type: "layout",
        label: "Visual Panel Main",
        x: 100,
        y: 150,
        width: 320,
        height: 240
      }
    ];

    const elementMoveMock = vi.fn();
    const element = React.createElement(GenesisCanvas, {
      initialElements,
      onElementMove: elementMoveMock
    });

    expect(element.props.initialElements).toBe(initialElements);
    expect(element.props.onElementMove).toBe(elementMoveMock);
  });

  it("should successfully build overlay suggestions properties", () => {
    const suggestions: AgentActionSuggestion[] = [
      {
        id: "sug-1",
        agent: "CREATIVE_DIRECTOR",
        suggestion: "Upgrade grid system density for optimal contrast",
        severity: "info"
      }
    ];

    const applySuggestionMock = vi.fn();
    const overlay = React.createElement(GenesisOverlay, {
      suggestions,
      activeAgentStatus: "OPTIMIZING_GRID_SYSTEM",
      onApplySuggestion: applySuggestionMock
    });

    expect(overlay.props.suggestions).toBe(suggestions);
    expect(overlay.props.activeAgentStatus).toBe("OPTIMIZING_GRID_SYSTEM");
    expect(overlay.props.onApplySuggestion).toBe(applySuggestionMock);
  });
});
