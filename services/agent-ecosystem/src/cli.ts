import { AgentSandbox, SandboxResult } from "./sandbox.js";

export class CLECLI {
  /**
   * Run a commands pipeline via CLE CLI
   */
  public static async executeAgentTask(taskCmd: string): Promise<SandboxResult> {
    const defaultOptions = {
      timeoutMs: 5000,
      maskedEnvKeys: ["AWS_SECRET_ACCESS_KEY", "GENAI_API_KEY", "DISPATCH_TOKEN"],
      prohibitedCommands: ["rm -rf /", "mkfs", "netstat -a", "sudo"]
    };

    const parts = taskCmd.split(" ");
    const command = parts[0];
    const args = parts.slice(1);

    return AgentSandbox.execute(command, args, defaultOptions);
  }
}
