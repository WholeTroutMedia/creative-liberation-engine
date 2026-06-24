declare module '@cle/core' {
    export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };
    export function okResult<T>(value: T): { ok: true; value: T };
    export function errResult<E>(error: E): { ok: false; error: E };
}

declare module '@cle/memory' {
    export class ContextCompressor {
        compressObservation(rawInput: string, strategy: 'dom' | 'terminal'): Promise<{ ok: true; value: string } | { ok: false; error: string }>;
    }
}
