/**
 * The waiter registry: the `interactionSettled` lifecycle handler
 * resolves the promise the tool registered under the same callId
 * (spec §7.4). An event for another kind, or one with no waiter —
 * replayed history, a card answered while the process was down, a
 * settle that raced the waiter away — is dropped: the tool re-reads
 * the record itself via `snapshotInteraction`, so nothing is lost.
 *
 * `shuttingDown` is the flag `harnessShutdown` sets BEFORE the harness
 * closes. The tool's abort path reads it: a wait interrupted with the
 * flag set is a clean restart, and the record stays PENDING so the
 * rerun after restart seeds the same card again (spec §7.5); without
 * the flag the abort is a real cancellation and the record settles
 * `cancelled`. NO timers: a question never expires on its own (ruling:
 * the user answers or declines, never a timeout).
 */
import type { Context } from "@earendil-works/chord/context";
import type { JsonValue } from "@earendil-works/chord";
import type { ExtensionLifecyclePayload } from "@sigrun/sigrun/extension";
/** The terminal outcome of one wait. */
export type Settled = {
    status: "answered";
    values: Record<string, JsonValue>;
} | {
    status: "skipped";
    declinedVia?: "button" | "message";
} | {
    status: "expired" | "cancelled";
};
type SettleEvent = ExtensionLifecyclePayload["interactionSettled"];
/** Fold a lifecycle event into the waiter's `Settled` shape. */
export declare function settledOf(event: SettleEvent): Settled;
export declare class Waiters {
    #private;
    /** True once the harness shutdown sequence starts; read by the abort path. */
    shuttingDown: boolean;
    /**
     * The promise the tool awaits: resolves on `settle` with the same
     * callId, rejects when `context` aborts. Register BEFORE seeding the
     * card — an answer committed between seeding and registration would
     * otherwise be missed (the tool's snapshot read is the belt to this
     * suspender).
     */
    wait(callId: string, context: Context): Promise<Settled>;
    /**
     * Delete the waiter for `callId` outright. Called from the tool's
     * execute-body finally so a throw BEFORE the await (a rejecting seed)
     * cannot leak the entry. No identity guard is needed here: a callId
     * belongs to exactly one in-flight execute, and the only
     * re-registration under the same callId is the post-restart rerun,
     * which registers after this execute has finished.
     */
    discard(callId: string): void;
    /** The `interactionSettled` handler: resolves the matching waiter, drops everything else. */
    settle(event: SettleEvent): void;
}
export {};
