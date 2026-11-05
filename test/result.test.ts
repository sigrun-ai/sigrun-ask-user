/**
 * The result text the model reads after the wait ends (Task 8): one
 * line per question (`<header>: <answer>`), the answer being the
 * selected option labels joined ", ", with the free-text answer quoted
 * and marked "(own words)" last. Declines and cancellations carry their
 * own single-sentence copy — the exact strings the spec fixes.
 */

import { describe, expect, it } from "vitest";
import { formatResult, type AskDetails } from "../src/result.js";
import type { AskParams } from "../src/schema.js";
import type { Settled } from "../src/waiters.js";

const params: AskParams = {
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

const multiParams: AskParams = {
	questions: [
		{
			question: "Which stacks apply?",
			header: "Stack",
			multiSelect: true,
			options: [
				{ label: "Alpha", description: "A" },
				{ label: "Beta", description: "B" },
			],
		},
	],
};

describe("formatResult", () => {
	it("answered with one selected option: '<header>: <label>'", () => {
		const settled: Settled = { status: "answered", values: { q1: "o2" } };
		const result = formatResult(params, settled);
		expect(result.output).toBe("Stack: Beta");
		expect(result.isError).toBeUndefined();
		expect(result.details.status).toBe("answered");
	});

	it("multi-select joins labels with ', ' and puts own-words text last", () => {
		const settled: Settled = {
			status: "answered",
			values: { q1: ["o1", { other: "mine" }] },
		};
		const result = formatResult(multiParams, settled);
		expect(result.output).toBe('Stack: Alpha, "mine" (own words)');
		const details: AskDetails = result.details;
		expect(details.answers[0]).toEqual({
			question: multiParams.questions[0].question,
			header: "Stack",
			selected: ["Alpha"],
			other: "mine",
		});
	});

	it("own-words-only answer reads '<header>: \"<text>\" (own words)'", () => {
		const settled: Settled = { status: "answered", values: { q1: { other: "neither" } } };
		const result = formatResult(params, settled);
		expect(result.output).toBe('Stack: "neither" (own words)');
	});

	it("answered lines cover every question in order", () => {
		const two: AskParams = {
			questions: [
				params.questions[0],
				{
					question: "Deploy now?",
					header: "Deploy",
					options: [
						{ label: "Yes", description: "Ship it" },
						{ label: "No", description: "Hold" },
					],
				},
			],
		};
		const settled: Settled = { status: "answered", values: { q1: "o1", q2: "o2" } };
		const result = formatResult(two, settled);
		expect(result.output).toBe("Stack: Alpha\nDeploy: No");
		expect(result.details.answers).toHaveLength(2);
	});

	it("declined via button reads the decline sentence", () => {
		const result = formatResult(params, { status: "skipped", declinedVia: "button" });
		expect(result.output).toBe("The user declined to answer.");
		expect(result.details.status).toBe("skipped");
		expect(result.details.declinedVia).toBe("button");
	});

	it("declined via message reads the reply-follows sentence", () => {
		const result = formatResult(params, { status: "skipped", declinedVia: "message" });
		expect(result.output).toBe(
			"The user declined to answer and replied in chat instead; their message follows.",
		);
	});

	it("cancelled and expired are isError with the cancelled copy", () => {
		for (const status of ["cancelled", "expired"] as const) {
			const result = formatResult(params, { status });
			expect(result.output).toBe("The question was cancelled before the user answered.");
			expect(result.isError).toBe(true);
			expect(result.details.status).toBe(status);
		}
	});
});
