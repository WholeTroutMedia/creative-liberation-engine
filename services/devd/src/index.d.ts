export interface CodeTask {
    filePath: string;
    instruction: string;
    action: "create" | "refactor" | "analyze";
}
export declare class DeveloperDaemon {
    name: string;
    capabilities: string[];
    handleCodeTask(task: CodeTask): Promise<{
        success: boolean;
        log: string;
    }>;
}
//# sourceMappingURL=index.d.ts.map