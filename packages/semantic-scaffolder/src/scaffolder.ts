export type ScaffolderNodeType = "paragraph" | "code_block" | "data_table" | "header" | "alert";

export interface ScaffolderNode {
  id: string;
  type: ScaffolderNodeType;
  content: string;
  metadata?: Record<string, any>;
}

export class SemanticScaffolder {
  /**
   * Parse a raw AI string response into an array of structured visual node maps
   */
  public static scaffold(rawText: string): ScaffolderNode[] {
    const lines = rawText.split(/\r?\n/);
    const nodes: ScaffolderNode[] = [];
    let currentBlock: string[] = [];
    let insideCode = false;
    let codeLanguage = "";
    let blockIdCounter = 0;

    const flushBlock = (type: ScaffolderNodeType, meta?: Record<string, any>) => {
      const content = currentBlock.join("\n").trim();
      if (content) {
        nodes.push({
          id: `node-${blockIdCounter++}`,
          type,
          content,
          metadata: meta
        });
      }
      currentBlock = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle Code Blocks
      if (line.trim().startsWith("```")) {
        if (insideCode) {
          flushBlock("code_block", { language: codeLanguage });
          insideCode = false;
          codeLanguage = "";
        } else {
          flushBlock("paragraph");
          insideCode = true;
          codeLanguage = line.trim().substring(3).trim() || "text";
        }
        continue;
      }

      if (insideCode) {
        currentBlock.push(line);
        continue;
      }

      // Handle Headers
      if (line.trim().startsWith("#")) {
        flushBlock("paragraph");
        currentBlock.push(line.replace(/^#+\s*/, "").trim());
        const headerLevel = (line.match(/^#+/) || ["#"])[0].length;
        flushBlock("header", { level: headerLevel });
        continue;
      }

      // Handle Tables
      if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().includes("-|-")) {
        flushBlock("paragraph");
        // Consume table lines
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        i--; // Adjust loop counter back
        currentBlock = tableLines;
        flushBlock("data_table");
        continue;
      }

      // Handle Alerts/Quotes
      if (line.trim().startsWith(">")) {
        flushBlock("paragraph");
        currentBlock.push(line.replace(/^>\s*/, "").trim());
        flushBlock("alert");
        continue;
      }

      // Normal paragraph accretion
      if (line.trim() === "") {
        flushBlock("paragraph");
      } else {
        currentBlock.push(line);
      }
    }

    // Flush any remaining content
    if (currentBlock.length > 0) {
      flushBlock(insideCode ? "code_block" : "paragraph", insideCode ? { language: codeLanguage } : undefined);
    }

    return nodes;
  }
}
