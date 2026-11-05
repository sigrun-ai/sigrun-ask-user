/**
 * The extension factory (Task 9): arity one so the loader passes the
 * host in; the result carries exactly the declared seam fields; the
 * lifecycle handlers drive the shared {@link Waiters}.
 */

import { describe, expect, it } from "vitest";
import type { ConversationId, ToolExecutionApi } from "@earendil-works/pi-durable";
import { BACKGROUND_CONTEXT, withAbortSignal } from "@earendil-works/chord/context";
import type { ExtensionLifecyclePayload } from "@sigrun/sigrun/extension";
import { ASK_KIND } from "../src/card.js";
import createAskUser from "../src/index.js";
import { createFakeHost } from "./fake-host.js";

const CID = 1 as ConversationId;

/** The minimal api the tool's execute body reads. */
function apiFor(callId: string): ToolExecutionApi {
	return { conversationId: CID, callId } as unknown as ToolExecutionApi;
}

const PARAMS = {
	questions: [
		{
			question: "Pick one?",
			header: "Pick",
			options: [
				{ label: "Alpha", description: "A" },
				{ label: "Beta", description: "B" },
			],
		},
	],
};

describe("createAskUser", () => {
	it("declares exactly one parameter (the loader passes the host only when factory.length > 0)", () => {
		expect(createAskUser.length).toBe(1);
	});

	it("returns exactly the extension, interaction kinds, interactive tools, and lifecycle handlers", async () => {
		const host = await createFakeHost();
		try {
			const result = createAskUser(host);
			expect(Object.keys(result).sort()).toEqual(
				["extension", "harnessShutdown", "interactionSettled", "interactiveTools", "interactionKinds"].sort(),
			);
			if (result.extension === undefined) throw new Error("extension missing");
			expect(result.extension.name).toBe("ask-user");
			expect(result.interactionKinds).toEqual([ASK_KIND]);
			expect(result.interactiveTools).toEqual(["ask_user_question"]);
			expect(typeof result.interactionSettled).toBe("function");
			expect(typeof result.harnessShutdown).toBe("function");
		} finally {
			await host.cleanup();
		}
	});

	it("the extension registers the ask_user_question tool and the prompt section", async () => {
		const host = await createFakeHost();
		try {
			const result = createAskUser(host);
			if (result.extension === undefined) throw new Error("extension missing");
			const toolNames = (result.extension.tools ?? []).map((tool) => tool.name);
			expect(toolNames).toEqual(["ask_user_question"]);
			expect((result.extension.sections ?? []).length).toBe(1);
		} finally {
			await host.cleanup();
		}
	});

	it("harnessShutdown sets the flag the tool's abort path reads", async () => {
		const host = await createFakeHost();
		try {
			const result = createAskUser(host);
			if (result.extension === undefined) throw new Error("extension missing");
			// Settling during shutdown must leave the record PENDING (the
			// rerun after restart re-seeds it). Probe: start a wait, flip the
			// flag, abort the wait — the record must NOT be cancelled.
			const tool = (result.extension.tools ?? []).find((t) => t.name === "ask_user_question");
			if (tool === undefined) throw new Error("tool missing");
			const controller = new AbortController();
			const context = withAbortSignal(controller.signal, BACKGROUND_CONTEXT);
			const executing = tool.execute(PARAMS, apiFor("call-shutdown"), context);
			const rejection = executing.then(
				() => "resolved",
				() => "rejected",
			);
			// Let the execute body reach the wait before aborting.
			await new Promise((resolve) => setImmediate(resolve));
			const shutdown = result.harnessShutdown as (() => void) | undefined;
			shutdown?.();
			controller.abort(new Error("harness closing"));
			expect(await rejection).toBe("rejected");
			// The record survives: a real cancel would have settled it.
			const snap = await host.snapshotInteraction(CID, "call-shutdown", BACKGROUND_CONTEXT);
			expect(snap?.status).toBe("pending");
		} finally {
			await host.cleanup();
		}
	});

	it("interactionSettled routes the event to a pending wait", async () => {
		const host = await createFakeHost();
		try {
			const result = createAskUser(host);
			if (result.extension === undefined) throw new Error("extension missing");
			const tool = (result.extension.tools ?? []).find((t) => t.name === "ask_user_question");
			if (tool === undefined) throw new Error("tool missing");
			const executing = tool.execute(PARAMS, apiFor("call-settle"), BACKGROUND_CONTEXT);
			// Let the execute body reach the wait before settling.
			await new Promise((resolve) => setImmediate(resolve));
			const settle = result.interactionSettled as
				| ((event: ExtensionLifecyclePayload["interactionSettled"]) => void)
				| undefined;
			if (settle === undefined) throw new Error("interactionSettled missing");
			settle({
				conversationId: CID,
				callId: "call-settle",
				kind: ASK_KIND,
				status: "answered",
				answer: { q1: ["o1"] },
			});
			const settled = await executing;
			expect(settled.isError).toBeUndefined();
		} finally {
			await host.cleanup();
		}
	});
});
