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

import { withoutAbortSignal, type Context } from "@earendil-works/chord/context";
import { defineTool, type ToolRegistration, type ToolExecutionApi, type ToolExecutionResult } from "@earendil-works/pi-durable";
import type { SigrunHost } from "@sigrun/sigrun/extension";
import type { InteractionRecord } from "@sigrun/shared/interactions";
import { ASK_KIND, buildCard } from "./card.js";
import { formatResult } from "./result.js";
import { AskParamsSchema, prepareAskArguments, type AskParams } from "./schema.js";
import { validateAsk } from "./validate.js";
import { Waiters, type Settled } from "./waiters.js";

/** A stored record folded into the waiter's `Settled` shape. */
function settledOfRecord(record: InteractionRecord): Settled {
	switch (record.status) {
		case "answered":
			return { status: "answered", values: { ...(record.answer?.values ?? {}) } };
		case "skipped":
			return {
				status: "skipped",
				...(record.declinedVia !== undefined ? { declinedVia: record.declinedVia } : {}),
			};
		case "expired":
		case "cancelled":
			return { status: record.status };
		default:
			throw new Error("pending is not settled");
	}
}

/** The job-run refusal (verbatim; spec §7.5). */
const JOB_RUN_TEXT =
	"ask_user_question is not available in scheduled job runs: no one is there to answer. If the escalate tool is available, use it to hand the user the decision instead.";

/** The tool description the model sees. */
export const ASK_TOOL_DESCRIPTION =
	"Ask the user 1-4 structured questions and wait for the answers. Each question has 2-4 options; the user can also answer in their own words or decline. Use it when a decision belongs to the user and guessing would risk rework.";

/** One sentence, `isError`, no seed. */
function errorResult(message: string): { output: [{ type: "text"; text: string }]; isError: true } {
	return { output: [{ type: "text" as const, text: message }], isError: true };
}

export function createAskTool(deps: { host: SigrunHost; waiters: Waiters }): ToolRegistration<typeof AskParamsSchema> {
	const { host, waiters } = deps;

	async function executeBody(
		args: AskParams,
		api: ToolExecutionApi,
		context: Context,
	): Promise<ToolExecutionResult> {
		/**
		 * The abort path shared by the snapshot read and the wait. The
		 * record is re-read FIRST: a non-pending record means the human's
		 * answer or decline won the race and stands. Only a still-pending
		 * record is settled `cancelled` (when this abort is not a clean
		 * shutdown), so our own settle can never masquerade as the race
		 * winner — and the ORIGINAL abort error is what rethrows.
		 */
		const onAbort = async (error: unknown): Promise<{ error: unknown } | { settled: Settled }> => {
			const before = await host
				.snapshotInteraction(api.conversationId, api.callId, withoutAbortSignal(context))
				.catch(() => undefined);
			if (before !== undefined && before.status !== "pending") {
				return { settled: settledOfRecord(before) };
			}
			if (!waiters.shuttingDown) {
				try {
					await host.settleInteraction(
						api.conversationId,
						api.callId,
						"cancelled",
						withoutAbortSignal(context),
					);
				} catch (settleError) {
					console.warn("ask_user_question: cancelling the seeded card failed", settleError);
				}
			}
			return { error };
		};

		const invalid = validateAsk(args);
		if (invalid !== null) return errorResult(invalid);

		if (await host.jobs.isJobRun(api.conversationId, context)) {
			return errorResult(JOB_RUN_TEXT);
		}

		const pending = waiters.wait(api.callId, context);
		// Mark the waiter observed NOW: a throw before the await below (a
		// rejecting seed, an aborted snapshot) would otherwise leave its
		// rejection unhandled at shutdown.
		void pending.catch(() => undefined);
		await host.seedInteraction(
			api.conversationId,
			{
				kind: ASK_KIND,
				callId: api.callId,
				status: "pending",
				createdAt: Date.now(),
				declinable: true,
				// SAFETY: AskParams is Static<AskParamsSchema> — plain JSON by
				// construction (validated against the schema by the harness), but
				// the typebox interface carries no index signature.
				details: args as unknown as Record<string, import("@earendil-works/chord").JsonValue>,
				body: buildCard(args),
			},
			context,
		);

		let settled: Settled;
		let terminal = false;
		let snap: Awaited<ReturnType<SigrunHost["snapshotInteraction"]>> | undefined;
		try {
			snap = await host.snapshotInteraction(api.conversationId, api.callId, context);
		} catch (error) {
			const outcome = await onAbort(error);
			if ("error" in outcome) throw outcome.error;
			settled = outcome.settled;
			terminal = true;
		}
		if (!terminal && snap !== undefined && snap.status !== "pending") {
			settled = settledOfRecord(snap);
			terminal = true;
		}
		if (!terminal) {
			try {
				settled = await pending;
			} catch (error) {
				const outcome = await onAbort(error);
				if ("error" in outcome) throw outcome.error;
				settled = outcome.settled;
			}
		}
		if (settled! === undefined) throw new Error("ask_user_question: settled without a settle");

		const result = formatResult(args, settled);
		return {
			output: [{ type: "text" as const, text: result.output }],
			// SAFETY: AskDetails is built here from schema-typed fields only
			// (strings/arrays), hence JSON; its interface lacks an index
			// signature, so it is not structurally a JsonValue.
			details: result.details as unknown as import("@earendil-works/chord").JsonValue,
			...(result.isError ? { isError: true as const } : {}),
		};
	}

	return defineTool({
		name: "ask_user_question",
		description: ASK_TOOL_DESCRIPTION,
		// Model-only: a code-mode script calling this would block a run no
		// human watches (and its result is never recorded for replay).
		callers: ["model"],
		// Safe to rerun after a restart: the callId-keyed seed is idempotent,
		// and the snapshot read picks up an answer given while down.
		replay: "safe",
		parameters: AskParamsSchema,
		prepareArguments: prepareAskArguments,
		execute: async (args: AskParams, api, context) => {
			try {
				return await executeBody(args, api, context);
			} finally {
				// A throw before the await on `pending` (a rejecting seed, an
				// aborted snapshot) never runs wait()'s own finally — drop the
				// entry here so it cannot leak.
				waiters.discard(api.callId);
			}
		},
	});
}
