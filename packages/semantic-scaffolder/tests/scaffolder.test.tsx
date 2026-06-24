import { describe, it, expect } from "vitest";
import { SemanticScaffolder } from "../src/scaffolder.js";

describe("Semantic Scaffolder Suite", () => {
  it("should successfully split AI output text into structured paragraph nodes", () => {
    const rawText = "This is a basic paragraph.\n\nAnd here is a second paragraph.";
    const nodes = SemanticScaffolder.scaffold(rawText);

    expect(nodes.length).toBe(2);
    expect(nodes[0].type).toBe("paragraph");
    expect(nodes[0].content).toBe("This is a basic paragraph.");
    expect(nodes[1].content).toBe("And here is a second paragraph.");
  });

  it("should detect headers and separate them cleanly", () => {
    const rawText = "### CLE Header\nParagraph matching the header context.";
    const nodes = SemanticScaffolder.scaffold(rawText);

    expect(nodes.length).toBe(2);
    expect(nodes[0].type).toBe("header");
    expect(nodes[0].metadata?.level).toBe(3);
    expect(nodes[1].type).toBe("paragraph");
  });

  it("should parse code blocks and attach matching metadata", () => {
    const rawText = "Check this code:\n```typescript\nconst a = 10;\n```";
    const nodes = SemanticScaffolder.scaffold(rawText);

    expect(nodes.length).toBe(2);
    expect(nodes[0].type).toBe("paragraph");
    expect(nodes[1].type).toBe("code_block");
    expect(nodes[1].metadata?.language).toBe("typescript");
    expect(nodes[1].content).toContain("const a = 10;");
  });
});
