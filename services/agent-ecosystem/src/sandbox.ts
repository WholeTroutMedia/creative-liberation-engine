import { spawn, ChildProcess } from "child_process";

export interface SandboxOptions {
  timeoutMs: number;
  maskedEnvKeys: string[];
  prohibitedCommands: string[];
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: string;
  wasKilledByTimeout: boolean;
}

export class AgentSandbox {
  /**
   * Run a shell command in a secured sandboxed context
   */
  public static async execute(command: string, args: string[], options: SandboxOptions): Promise<SandboxResult> {
    const wasProhibited = options.prohibitedCommands.some(cmd => 
      command.toLowerCase().includes(cmd.toLowerCase()) || 
      args.some(arg => arg.toLowerCase().includes(cmd.toLowerCase()))
    );

    if (wasProhibited) {
      return {
        stdout: "",
        stderr: "Sandbox Block Violation: Prohibited command execution detected.",
        exitCode: -1,
        wasKilledByTimeout: false,
        error: "PROHIBITED_COMMAND"
      };
    }

    return new Promise((resolve) => {
      const child: ChildProcess = spawn(command, args, {
        env: { ...process.env },
        shell: true
      });

      let stdoutAccum = "";
      let stderrAccum = "";
      let isTimeout = false;

      // Setup Timeout
      const timer = setTimeout(() => {
        isTimeout = true;
        if (process.platform === "win32" && child.pid) {
          spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
        } else {
          child.kill("SIGKILL");
        }
      }, options.timeoutMs);

      child.stdout?.on("data", (data) => {
        stdoutAccum += data.toString("utf-8");
      });

      child.stderr?.on("data", (data) => {
        stderrAccum += data.toString("utf-8");
      });

      child.on("close", (code) => {
        clearTimeout(timer);

        // Apply Credential Masking
        const finalStdout = this.maskCredentials(stdoutAccum, options.maskedEnvKeys);
        const finalStderr = this.maskCredentials(stderrAccum, options.maskedEnvKeys);

        resolve({
          stdout: finalStdout,
          stderr: finalStderr,
          exitCode: isTimeout ? null : code,
          wasKilledByTimeout: isTimeout,
          error: isTimeout ? "TIMEOUT" : undefined
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          stdout: "",
          stderr: err.message,
          exitCode: -1,
          wasKilledByTimeout: false,
          error: err.name
        });
      });
    });
  }

  /**
   * Scan text outputs and swap secret environmental credentials with masking placeholders
   */
  public static maskCredentials(text: string, envKeys: string[]): string {
    let masked = text;
    for (const key of envKeys) {
      const value = process.env[key];
      if (value && value.length > 3) {
        // Escaping regex characters
        const escaped = value.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const regex = new RegExp(escaped, "g");
        masked = masked.replace(regex, `[MASKED:${key}]`);
      }
    }
    return masked;
  }
}
