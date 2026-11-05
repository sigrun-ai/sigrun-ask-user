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
import { awaitWithContext } from "@earendil-works/chord/context";
import { ASK_KIND } from "./card.js";
/** Fold a lifecycle event into the waiter's `Settled` shape. */
export function settledOf(event) {
    switch (event.status) {
        case "answered":
            return { status: "answered", values: { ...(event.answer?.values ?? {}) } };
        case "skipped":
            return {
                status: "skipped",
                ...(event.declinedVia !== undefined ? { declinedVia: event.declinedVia } : {}),
            };
        case "expired":
        case "cancelled":
            return { status: event.status };
    }
}
export class Waiters {
    /** True once the harness shutdown sequence starts; read by the abort path. */
    shuttingDown = false;
    #waiters = new Map();
    /**
     * The promise the tool awaits: resolves on `settle` with the same
     * callId, rejects when `context` aborts. Register BEFORE seeding the
     * card — an answer committed between seeding and registration would
     * otherwise be missed (the tool's snapshot read is the belt to this
     * suspender).
     */
    wait(callId, context) {
        let resolveFn = () => undefined;
        const promise = new Promise((resolve) => {
            resolveFn = resolve;
        });
        this.#waiters.set(callId, resolveFn);
        // Drop the map entry when the wait ends for ANY reason — an aborted
        // wait never sees a settle, and a stale resolver would swallow a
        // later call's event under a reused callId. Only OUR entry is
        // removed: settle() deletes on the resolve path, and a re-registered
        // waiter for the same callId owns its own entry.
        return awaitWithContext(promise, context).finally(() => {
            if (this.#waiters.get(callId) === resolveFn)
                this.#waiters.delete(callId);
        });
    }
    /**
     * Delete the waiter for `callId` outright. Called from the tool's
     * execute-body finally so a throw BEFORE the await (a rejecting seed)
     * cannot leak the entry. No identity guard is needed here: a callId
     * belongs to exactly one in-flight execute, and the only
     * re-registration under the same callId is the post-restart rerun,
     * which registers after this execute has finished.
     */
    discard(callId) {
        this.#waiters.delete(callId);
    }
    /** The `interactionSettled` handler: resolves the matching waiter, drops everything else. */
    settle(event) {
        if (event.kind !== ASK_KIND)
            return;
        const resolve = this.#waiters.get(event.callId);
        if (resolve === undefined)
            return;
        this.#waiters.delete(event.callId);
        resolve(settledOf(event));
    }
}
