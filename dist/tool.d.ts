/**
 * The `ask_user_question` tool (spec §7.3–7.5): validate, seed the
 * card, wait for a human — no timer anywhere, the user answers or
 * declines, never a timeout.
 *
 * Order (load-bearing):
 *
 * 1. `validateAsk` — an uncardable call is a tool error with nothing
 *    seeded, so the model can fix the call instead of the user
 *    answering a broken card.
 * 2. `jobs.isJobRun` — a scheduled job has nobody to ask; error BEFORE
 *    seeding so no orphan card lingers.
 * 3. Register the waiter BEFORE seeding: an answer can only commit once
 *    the record exists, and the waiter is already listening by then.
 * 4. `seedInteraction` is idempotent per callId — on the `replay:
 *    "safe"` rerun after a restart, the first-write-wins commit
 *    re-reads the same PENDING record instead of duplicating the card.
 * 5. `snapshotInteraction` once after seeding: covers the answer that
 *    committed before the waiter attached, and the answer given while
 *    the process was down (the rerun path).
 * 6. Await the waiter.
 * 7. On abort: a settled waiter's answer or decline WON the race and
 *    stands; otherwise a clean shutdown (`waiters.shuttingDown`,
 *    `harnessShutdown` fires before closeHarness) leaves the record
 *    PENDING so the rerun re-seeds it, and any other abort settles the
 *    record `cancelled` — inside try/catch, because a closing session
 *    rejects the commit and the original abort must still propagate.
 *
 * The execute wrapper's finally discards the waiter entry: a throw
 * BEFORE the await on `pending` (a rejecting seed) never runs
 * `wait()`'s own finally, and without the discard the entry would
 * leak past the failed call.
 */
import { type ToolRegistration } from "@earendil-works/pi-durable";
import type { SigrunHost } from "@sigrun/sigrun/extension";
import { AskParamsSchema } from "./schema.js";
import { Waiters } from "./waiters.js";
/** The tool description the model sees. */
export declare const ASK_TOOL_DESCRIPTION = "Ask the user 1-4 structured questions and wait for the answers. Each question has 2-4 options; the user can also answer in their own words or decline. Use it when a decision belongs to the user and guessing would risk rework.";
export declare function createAskTool(deps: {
    host: SigrunHost;
    waiters: Waiters;
}): ToolRegistration<typeof AskParamsSchema>;
