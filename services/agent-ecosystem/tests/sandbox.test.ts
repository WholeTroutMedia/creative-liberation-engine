import { describe, it, expect, beforeAll } from "vitest";
import { AgentSandbox } from "../src/sandbox.js";
import { CLECLI } from "../src/cli.js";

describe("Agent Ecosystem Platform (IAEP) Sandbox Suite", () => {
  beforeAll(() => {
    // Setup environmental variables for credential masking tests
    process.env["GENAI_API_KEY"] = "super-secret-gemini-key-12345";
  });

  it("should securely execute a simple echo command", async () => {
    const result = await AgentSandbox.execute("echo", ["hello-sandbox"], {
      timeoutMs: 3000,
      maskedEnvKeys: [],
      prohibitedCommands: []
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toContain("hello-sandbox");
  });

  it("should automatically mask sensitive environmental variables", async () => {
    const result = await AgentSandbox.execute("echo", ["Key is super-secret-gemini-key-12345"], {
      timeoutMs: 3000,
      maskedEnvKeys: ["GENAI_API_KEY"],
      prohibitedCommands: []
    });

    expect(result.stdout.trim()).toContain("[MASKED:GENAI_API_KEY]");
    expect(result.stdout.trim()).not.toContain("super-secret-gemini-key-12345");
  });

  it("should fail gracefully and abort prohibited commands", async () => {
    const result = await CLECLI.executeAgentTask("sudo apt-get update");
    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toContain("Sandbox Block Violation");
    expect(result.error).toBe("PROHIBITED_COMMAND");
  });

  it("should terminate processes exceeding execution timeout limits", async () => {
    // Run a process that sleeps longer than timeout limits
    const result = await AgentSandbox.execute("ping", ["-n", "10", "127.0.0.1"], {
      timeoutMs: 500,
      maskedEnvKeys: [],
      prohibitedCommands: []
    });

    expect(result.wasKilledByTimeout).toBe(true);
    expect(result.exitCode).toBeNull();
    expect(result.error).toBe("TIMEOUT");
  });
});
