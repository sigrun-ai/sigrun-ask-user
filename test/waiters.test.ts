/**
 * The waiter registry (Task 8): `waiters.settle` is the
 * `interactionSettled` handler, resolving the `wait` promise the tool
 * registered under the SAME callId. Events for other kinds, unknown
 * callIds, or events that arrive before the waiter registers are
 * dropped — an event with no waiter carries no state worth keeping.
 * `shuttingDown` is the flag `harnessShutdown` sets: an aborted wait
 * after it is a clean restart, not a cancelled question.
 */

import { describe, expect, it } from "vitest";
import { withAbortSignal, BACKGROUND_CONTEXT, type Context } from "@earendil-works/chord/context";
import type { ExtensionLifecyclePayload } from "@sigrun/sigrun/extension";
import { Waiters } from "../src/waiters.js";
import type { Settled } from "../src/waiters.js";

const CID = 7 as ExtensionLifecyclePayload["interactionSettled"]["conversationId"];

function settledEvent(
	overrides: Partial<ExtensionLifecyclePayload["interactionSettled"]> = {},
): ExtensionLifecyclePayload["interactionSettled"] {
	return {
		conversationId: CID,
		callId: "call-1",
		kind: "ask.questions",
		status: "answered",
		answer: { values: { q1: "o2" } },
		...overrides,
	};
}

describe("Waiters", () => {
	it("a settle with no waiter is dropped without throwing", () => {
		const waiters = new Waiters();
		expect(() => waiters.settle(settledEvent())).not.toThrow();
	});

	it("settle before wait is dropped; a later wait still waits", async () => {
		const waiters = new Waiters();
		waiters.settle(settledEvent());

		let resolved: Settled | undefined;
		const pending = waiters.wait("call-1", BACKGROUND_CONTEXT).then((s) => {
			resolved = s;
		});
		// The dropped event must NOT resolve this waiter.
		await Promise.resolve();
		expect(resolved).toBeUndefined();

		waiters.settle(settledEvent());
		await pending;
		expect(resolved).toEqual({ status: "answered", values: { q1: "o2" } });
	});

	it("wait resolves with the settle event's status", async () => {
		const waiters = new Waiters();
		const pending = waiters.wait("call-1", BACKGROUND_CONTEXT);
		waiters.settle(settledEvent({ status: "skipped", declinedVia: "message", answer: undefined }));
		await expect(pending).resolves.toEqual({ status: "skipped", declinedVia: "message" });
	});

	it("an aborted context rejects the wait", async () => {
		const waiters = new Waiters();
		const controller = new AbortController();
		const context: Context = withAbortSignal(controller.signal, BACKGROUND_CONTEXT);
		const pending = waiters.wait("call-1", context);
		controller.abort(new Error("run aborted"));
		await expect(pending).rejects.toThrow("run aborted");
	});

	it("an aborted wait drops its map entry: a later settle does not throw", async () => {
		const waiters = new Waiters();
		const controller = new AbortController();
		const context: Context = withAbortSignal(controller.signal, BACKGROUND_CONTEXT);
		const pending = waiters.wait("call-1", context);
		controller.abort(new Error("run aborted"));
		await expect(pending).rejects.toThrow("run aborted");
		// The aborted waiter's entry is gone: a late settle for the same
		// callId is a dropped event, not a resolve of nothing.
		expect(() => waiters.settle(settledEvent())).not.toThrow();
	});

	it("a settle for another kind is ignored", async () => {
		const waiters = new Waiters();
		let resolved: Settled | undefined;
		const pending = waiters.wait("call-1", BACKGROUND_CONTEXT).then((s) => {
			resolved = s;
		});
		waiters.settle(settledEvent({ kind: "gate.ask" }));
		await Promise.resolve();
		expect(resolved).toBeUndefined();

		waiters.settle(settledEvent());
		await pending;
		expect(resolved).toBeDefined();
	});

	it("a waiter for another callId is not resolved", async () => {
		const waiters = new Waiters();
		let resolved: Settled | undefined;
		const pending = waiters.wait("call-2", BACKGROUND_CONTEXT).then((s) => {
			resolved = s;
		});
		waiters.settle(settledEvent({ callId: "call-1" }));
		await Promise.resolve();
		expect(resolved).toBeUndefined();
		waiters.settle(settledEvent({ callId: "call-2" }));
		await pending;
		expect(resolved).toBeDefined();
	});

	it("shuttingDown starts false and flips true", () => {
		const waiters = new Waiters();
		expect(waiters.shuttingDown).toBe(false);
		waiters.shuttingDown = true;
		expect(waiters.shuttingDown).toBe(true);
	});
});
