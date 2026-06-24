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
/** A successful result wrapping a value */
export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}
/** A failed result wrapping an error */
export interface Err<E = string> {
    readonly ok: false;
    readonly error: E;
}
/** A value that is either Ok<T> or Err<E> */
export type Result<T, E = string> = Ok<T> | Err<E>;
/** Wrap a successful value in a Result */
export declare function Ok<T>(value: T): Ok<T>;
/** Wrap an error in a Result */
export declare function Err<E = string>(error: E): Err<E>;
/** Returns true if the Result is Ok */
export declare function isOk<T, E>(result: Result<T, E>): result is Ok<T>;
/** Returns true if the Result is Err */
export declare function isErr<T, E>(result: Result<T, E>): result is Err<E>;
/**
 * Unwrap a Result, throwing if it's Err.
 * Only use when failure is truly unexpected.
 */
export declare function unwrap<T>(result: Result<T>): T;
/**
 * Unwrap a Result, returning a default value if it's Err.
 * Safe alternative to unwrap().
 */
export declare function unwrapOr<T>(result: Result<T>, defaultValue: T): T;
/**
 * Map the value of an Ok result.
 * Returns the original Err unchanged.
 */
export declare function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>;
/**
 * Map the error of an Err result.
 * Returns the original Ok unchanged.
 */
export declare function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>;
/**
 * Flat-map an Ok result through a function that returns a Result.
 * Short-circuits on Err.
 */
export declare function flatMap<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>;
/**
 * Wrap a potentially-throwing function in a Result.
 * Returns Ok(value) or Err(error.message).
 */
export declare function tryResult<T>(fn: () => T): Result<T, string>;
/**
 * Wrap an async potentially-throwing function in a Result.
 */
export declare function tryResultAsync<T>(fn: () => Promise<T>): Promise<Result<T, string>>;
//# sourceMappingURL=result.d.ts.map