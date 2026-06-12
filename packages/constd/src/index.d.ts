export interface ValidationResult {
    passed: boolean;
    score: number;
    reason: string;
    articleFlags: string[];
}
export declare class ConstitutionDaemon {
    name: string;
    constitutionalPreflightCheck(prompt: string): Promise<ValidationResult>;
    private checkSacredMissionAlignment;
    private checkIntegrityConstraints;
    private checkGlobalImpact;
}
export declare const constd: ConstitutionDaemon;
//# sourceMappingURL=index.d.ts.map