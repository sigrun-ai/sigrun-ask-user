/**
 * The `ask_user_question` tool (Task 8): validate, seed the card, wait
 * for the human. The fake host's calls prove the order (validate →
 * job check → seed → snapshot → wait) and that failure paths seed
 * NOTHING; the abort cases pin Review Focus 1 (shutdown flag → no
 * cancel) and 4 (already-settled snapshot → return without settling);
 * the harness case proves the JSON-string repair end to end.
 */

import { describe, expect, it } from "vitest";
import { Value } from "typebox/value";
import {
	BACKGROUND_CONTEXT,
	withAbortSignal,
	type Context,
} from "@earendil-works/chord/context";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import type {
	ConversationId,
	ToolExecutionApi,
	ToolExecutionResult,
	ToolRegistration,
} from "@earendil-works/pi-durable";
import { ASK_KIND } from "../src/card.js";
import { AskParamsSchema, type AskParams } from "../src/schema.js";
import { createAskTool } from "../src/tool.js";
import { validateAsk } from "../src/validate.js";
import { Waiters } from "../src/waiters.js";
import { createFakeHost, type FakeHost } from "./fake-host.js";
import { cleanupDir, closeOpened, openAskHarness, tempDir } from "./harness.js";

const CID = 1 as ConversationId;

/** Synthetic question params; tests own their literals. */
const PARAMS: AskParams = {
	questions: [
		{
			question: "Which stack should this service use?",
			header: "Stack",
			options: [
				{ label: "Alpha", description: "The fast path" },
				{ label: "Beta", description: "The safe path" },
			],
		},
	],
};

interface Setup {
	host: FakeHost;
	waiters: Waiters;
	tool: ToolRegistration;
}

async function setup(opts: Parameters<typeof createFakeHost>[0] = {}): Promise<Setup> {
	const host = await createFakeHost(opts);
	const waiters = new Waiters();
	const tool = createAskTool({ host, waiters });
	return { host, waiters, tool };
}

/** The api the tool reads; the rest of the execution api is unused. */
function apiFor(callId = "call-1"): ToolExecutionApi {
	return { conversationId: CID, callId } as unknown as ToolExecutionApi;
}

function textOf(result: ToolExecutionResult): string {
	if (result.output === undefined) throw new Error("the tool returned no output text");
	return result.output.map((part) => (part.type === "text" ? part.text : "")).join("");
}

describe("the happy path", () => {
	it("seeds a declinable card and returns the answer lines on settle", async () => {
		const { host, waiters, tool } = await setup();
		try {
			const pending = tool.execute(PARAMS, apiFor(), BACKGROUND_CONTEXT);
			// Let execute reach the wait before settling.
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			const seeded = host.calls.find((c) => c.method === "seedInteraction");
			expect(seeded).toBeDefined();
			const record = seeded!.args[0] as { kind: string; callId: string; status: string; declinable?: true; body: unknown };
			expect(record.kind).toBe(ASK_KIND);
			expect(record.callId).toBe("call-1");
			expect(record.status).toBe("pending");
			expect(record.declinable).toBe(true);

			waiters.settle({
				conversationId: CID,
				callId: "call-1",
				kind: ASK_KIND,
				status: "answered",
				answer: { values: { q1: "o2" } },
			});
			const result = await pending;
			expect(result.isError).toBeUndefined();
			expect(textOf(result)).toBe("Stack: Beta");
			expect(host.calls.some((c) => c.method === "settleInteraction")).toBe(false);
		} finally {
			await host.cleanup();
		}
	});
});

describe("Review Focus 4: an already-settled snapshot resolves without any settle", () => {
	it("returns the answer from the record and never settles", async () => {
		const { host, tool } = await setup({
			snapshotOverride: (seeded) => ({
				...seeded,
				status: "answered",
				answer: { values: { q1: "o1" } },
				answeredBy: "human",
			}),
		});
		try {
			const result = await tool.execute(PARAMS, apiFor(), BACKGROUND_CONTEXT);
			expect(textOf(result)).toBe("Stack: Alpha");
			expect(host.calls.some((c) => c.method === "settleInteraction")).toBe(false);
		} finally {
			await host.cleanup();
		}
	});
});

describe("Review Focus 1: the abort path", () => {
	function abortedContext(): { context: Context; abort: () => void } {
		const controller = new AbortController();
		return {
			context: withAbortSignal(controller.signal, BACKGROUND_CONTEXT),
			abort: () => controller.abort(new Error("run aborted")),
		};
	}

	it("shuttingDown: no settleInteraction, the abort propagates", async () => {
		const { host, waiters, tool } = await setup();
		try {
			const { context, abort } = abortedContext();
			const pending = tool.execute(PARAMS, apiFor(), context);
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			waiters.shuttingDown = true;
			abort();
			await expect(pending).rejects.toThrow("run aborted");
			expect(host.calls.some((c) => c.method === "settleInteraction")).toBe(false);
		} finally {
			await host.cleanup();
		}
	});

	it("without the flag: exactly one settleInteraction(..., \"cancelled\"), then the abort propagates", async () => {
		const { host, tool } = await setup();
		try {
			const { context, abort } = abortedContext();
			const pending = tool.execute(PARAMS, apiFor(), context);
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			abort();
			await expect(pending).rejects.toThrow("run aborted");
			const settles = host.calls.filter((c) => c.method === "settleInteraction");
			expect(settles).toHaveLength(1);
			expect(settles[0].args).toEqual(["call-1", "cancelled"]);
		} finally {
			await host.cleanup();
		}
	});

	it("a rejecting settle still propagates the original abort, with no unhandled rejection", async () => {
		const { host, tool } = await setup({ settleRejects: true });
		try {
			const { context, abort } = abortedContext();
			const pending = tool.execute(PARAMS, apiFor(), context);
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			abort();
			await expect(pending).rejects.toThrow("run aborted");
			const settles = host.calls.filter((c) => c.method === "settleInteraction");
			expect(settles).toHaveLength(1);
		} finally {
			await host.cleanup();
		}
	});
});

describe("a job run asks nobody", () => {
	it("isJobRun → true returns the job-run error and seeds nothing", async () => {
		const { host, tool } = await setup({ isJobRun: true });
		try {
			const result = await tool.execute(PARAMS, apiFor(), BACKGROUND_CONTEXT);
			expect(result.isError).toBe(true);
			expect(textOf(result)).toBe(
				"ask_user_question is not available in scheduled job runs: no one is there to answer. If the escalate tool is available, use it to hand the user the decision instead.",
			);
			expect(host.calls.some((c) => c.method === "seedInteraction")).toBe(false);
		} finally {
			await host.cleanup();
		}
	});
});

describe("validation failures seed nothing", () => {
	it("a validateAsk failure returns its message with no seed", async () => {
		const { host, tool } = await setup();
		try {
			const bad: AskParams = {
				questions: [
					{
						...PARAMS.questions[0],
						options: [
							{ label: "Same", description: "A" },
							{ label: "Same", description: "B" },
						],
					},
				],
			};
			const result = await tool.execute(bad, apiFor(), BACKGROUND_CONTEXT);
			expect(result.isError).toBe(true);
			expect(textOf(result)).toBe("question 1: option labels must be unique");
			expect(host.calls.some((c) => c.method === "seedInteraction")).toBe(false);
		} finally {
			await host.cleanup();
		}
	});
});

describe("Review Focus 5: malformed inputs fail before any seed", () => {
	const cases: { name: string; input: unknown }[] = [
		{
			name: "five questions",
			input: { questions: Array.from({ length: 5 }, () => PARAMS.questions[0]) },
		},
		{
			name: "one option",
			input: {
				questions: [
					{ ...PARAMS.questions[0], options: [{ label: "Only", description: "One" }] },
				],
			},
		},
		{
			name: "a reserved label",
			input: {
				questions: [
					{
						...PARAMS.questions[0],
						options: [
							{ label: "Other", description: "A" },
							{ label: "Fine", description: "B" },
						],
					},
				],
			},
		},
		{
			name: "preview on multi-select",
			input: {
				questions: [
					{
						...PARAMS.questions[0],
						multiSelect: true,
						options: [
							{ label: "Alpha", description: "A", preview: "preview" },
							{ label: "Beta", description: "B" },
						],
					},
				],
			},
		},
		{
			name: "a 17-char header",
			input: { questions: [{ ...PARAMS.questions[0], header: "x".repeat(17) }] },
		},
	];

	for (const { name, input } of cases) {
		it(`${name}: an error, nothing seeded`, async () => {
			const { host, tool } = await setup();
			try {
				// The pipeline the harness runs: repair, schema check, validate.
				const prepared = tool.prepareArguments!(input);
				if (Value.Check(AskParamsSchema, prepared)) {
					const invalid = validateAsk(prepared);
					if (invalid === null) throw new Error("expected the input to be malformed");
					const result = await tool.execute(prepared, apiFor(), BACKGROUND_CONTEXT);
					expect(result.isError).toBe(true);
					expect(textOf(result)).toBe(invalid);
				} else {
					// Schema-level rejections fail the call before execute ever runs.
					expect(Value.Check(AskParamsSchema, prepared)).toBe(false);
				}
				expect(host.calls.some((c) => c.method === "seedInteraction")).toBe(false);
			} finally {
				await host.cleanup();
			}
		});
	}
});

describe("the real harness round trip", () => {
	it("a JSON-string questions argument parses, seeds, and answers", async () => {
		const dir = await tempDir("sigrun-ask-user-tool-");
		const host = await createFakeHost();
		try {
			const opened = await openAskHarness(dir, host, [
				fauxAssistantMessage(
					fauxToolCall(
						"ask_user_question",
						{ questions: JSON.stringify(PARAMS.questions) },
						{ id: "call-1" },
					),
					{ stopReason: "toolUse" },
				),
				fauxAssistantMessage("answered"),
			]);
			try {
				const root = await opened.harness.root(BACKGROUND_CONTEXT, {
					agent: { model: opened.defaultModel },
				});
				const submission = await root.submit({ type: "input", content: "pick one" }, BACKGROUND_CONTEXT);

				// Wait until the tool seeded its card, then settle it.
				const deadline = Date.now() + 5000;
				while (!host.calls.some((c) => c.method === "seedInteraction")) {
					if (Date.now() > deadline) throw new Error("the card was never seeded");
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
				opened.waiters.settle({
					conversationId: root.id,
					callId: "call-1",
					kind: ASK_KIND,
					status: "answered",
					answer: { values: { q1: "o2" } },
				});

				expect((await submission.wait(BACKGROUND_CONTEXT)).status).toBe("done");
				await root.waitForIdle(BACKGROUND_CONTEXT);

				const seeded = host.calls.find((c) => c.method === "seedInteraction");
				expect(seeded).toBeDefined();

				// The transcript's tool result carries the answer line.
				const conversation = await opened.harness.conversation(root.id, BACKGROUND_CONTEXT);
				if (conversation === undefined) throw new Error("missing conversation");
				const page = await conversation.entries({ order: "ascending" }, 100, undefined, BACKGROUND_CONTEXT);
				const toolResult = page.items.find((e) => e.kind === "pi.tool-result");
				const message = toolResult?.model?.[0] as { content?: { type: string; text?: string }[] } | undefined;
				expect(message?.content?.[0]?.text).toBe("Stack: Beta");
			} finally {
				await closeOpened(opened);
			}
		} finally {
			await host.cleanup();
			await cleanupDir(dir);
		}
	});
});
