/**
 * @cle/core — Result<T, E> Monad
 *
 * A lightweight, zero-dependency Result type for explicit error handling
 * without exceptions. Used throughout the Creative Liberation Engine for deterministic
 * error propagation.
 *
 * Constitutional: Article IX (Error Recovery) — graceful failure always.
 *
 * Usage:
 *   const result = try_parse(input);
 *   if (isOk(result)) { console.log(result.value); }
 *   else { console.error(result.error); }
 */
// ─── Constructors ─────────────────────────────────────────────────────────────
/** Wrap a successful value in a Result */
export function Ok(value) {
    return { ok: true, value };
}
/** Wrap an error in a Result */
export function Err(error) {
    return { ok: false, error };
}
// ─── Type Guards ──────────────────────────────────────────────────────────────
/** Returns true if the Result is Ok */
export function isOk(result) {
    return result.ok === true;
}
/** Returns true if the Result is Err */
export function isErr(result) {
    return result.ok === false;
}
// ─── Utilities ────────────────────────────────────────────────────────────────
/**
 * Unwrap a Result, throwing if it's Err.
 * Only use when failure is truly unexpected.
 */
export function unwrap(result) {
    if (isOk(result))
        return result.value;
    throw new Error(`Result unwrap failed: ${result.error}`);
}
/**
 * Unwrap a Result, returning a default value if it's Err.
 * Safe alternative to unwrap().
 */
export function unwrapOr(result, defaultValue) {
    return isOk(result) ? result.value : defaultValue;
}
/**
 * Map the value of an Ok result.
 * Returns the original Err unchanged.
 */
export function map(result, fn) {
    return isOk(result) ? Ok(fn(result.value)) : result;
}
/**
 * Map the error of an Err result.
 * Returns the original Ok unchanged.
 */
export function mapErr(result, fn) {
    return isErr(result) ? Err(fn(result.error)) : result;
}
/**
 * Flat-map an Ok result through a function that returns a Result.
 * Short-circuits on Err.
 */
export function flatMap(result, fn) {
    return isOk(result) ? fn(result.value) : result;
}
/**
 * Wrap a potentially-throwing function in a Result.
 * Returns Ok(value) or Err(error.message).
 */
export function tryResult(fn) {
    try {
        return Ok(fn());
    }
    catch (e) {
        return Err(e instanceof Error ? e.message : String(e));
    }
}
/**
 * Wrap an async potentially-throwing function in a Result.
 */
export async function tryResultAsync(fn) {
    try {
        return Ok(await fn());
    }
    catch (e) {
        return Err(e instanceof Error ? e.message : String(e));
    }
}
//# sourceMappingURL=result.js.map