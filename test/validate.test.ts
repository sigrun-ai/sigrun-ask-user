/**
 * The ask_user_question argument contract: `AskParamsSchema` pins the
 * limits the spec keeps from rpiv (1–4 questions, 2–4 options, header
 * ≤ 16 chars, label ≤ 60 chars), and `validateAsk` carries the rules a
 * schema cannot — unique labels per question, unique headers, reserved
 * free-text labels, and no preview on multi-select.
 */

import { describe, expect, it } from "vitest";
import { Value } from "typebox/value";
import { AskParamsSchema, prepareAskArguments, type AskParams } from "../src/schema.js";
import { validateAsk } from "../src/validate.js";

type QuestionOverrides = Partial<AskParams["questions"][number]>;

function question(overrides: QuestionOverrides = {}) {
	return {
		question: "Which database should this service use?",
		header: "Database",
		options: [
			{ label: "Postgres", description: "Relational store with transactions" },
			{ label: "SQLite", description: "Embedded, zero-ops file store" },
		],
		...overrides,
	};
}

function params(questions: AskParams["questions"]) {
	return { questions };
}

describe("AskParamsSchema", () => {
	it("accepts a minimal valid call", () => {
		expect(Value.Check(AskParamsSchema, params([question()]))).toBe(true);
	});

	it("rejects 0 and 5 questions", () => {
		expect(Value.Check(AskParamsSchema, params([]))).toBe(false);
		expect(Value.Check(AskParamsSchema, params([question(), question(), question(), question(), question()]))).toBe(false);
	});

	it("rejects 1 and 5 options", () => {
		const oneOption = question({ options: [{ label: "Postgres", description: "Only choice" }] });
		expect(Value.Check(AskParamsSchema, params([oneOption]))).toBe(false);

		const fiveOptions = question({
			options: [
				{ label: "Postgres", description: "A" },
				{ label: "SQLite", description: "B" },
				{ label: "MySQL", description: "C" },
				{ label: "DuckDB", description: "D" },
				{ label: "LevelDB", description: "E" },
			],
		});
		expect(Value.Check(AskParamsSchema, params([fiveOptions]))).toBe(false);
	});

	it("rejects a 17-character header", () => {
		expect(Value.Check(AskParamsSchema, params([question({ header: "x".repeat(17) })]))).toBe(false);
		expect(Value.Check(AskParamsSchema, params([question({ header: "x".repeat(16) })]))).toBe(true);
	});

	it("rejects a 61-character label", () => {
		const longLabel = question({
			options: [
				{ label: "l".repeat(61), description: "Too long" },
				{ label: "SQLite", description: "Fine" },
			],
		});
		expect(Value.Check(AskParamsSchema, params([longLabel]))).toBe(false);
	});
});

describe("validateAsk", () => {
	it("returns null for valid params", () => {
		expect(validateAsk(params([question()]))).toBeNull();
	});

	it("rejects duplicate option labels within a question", () => {
		const dup = question({
			options: [
				{ label: "Postgres", description: "A" },
				{ label: "Postgres", description: "B" },
			],
		});
		expect(validateAsk(params([dup]))).toBe("question 1: option labels must be unique");
	});

	it("compares labels without the recommended suffix", () => {
		const dup = question({
			options: [
				{ label: "Postgres", description: "A" },
				{ label: "Postgres (Recommended)", description: "B" },
			],
		});
		expect(validateAsk(params([dup]))).toBe("question 1: option labels must be unique");

		const reserved = question({
			options: [
				{ label: "Postgres", description: "A" },
				{ label: "Other (Recommended)", description: "B" },
			],
		});
		expect(validateAsk(params([reserved]))).toBe(
			'question 1: "Other" is reserved — the free-text row is added automatically',
		);
	});

	it("numbers the failing question", () => {
		const dup = question({
			header: "Cache",
			options: [
				{ label: "Redis", description: "A" },
				{ label: "Redis", description: "B" },
			],
		});
		expect(validateAsk(params([question(), dup]))).toBe("question 2: option labels must be unique");
	});

	it("rejects the reserved labels Other and Type something.", () => {
		const other = question({
			options: [
				{ label: "Postgres", description: "A" },
				{ label: "Other", description: "B" },
			],
		});
		expect(validateAsk(params([other]))).toBe(
			'question 1: "Other" is reserved — the free-text row is added automatically',
		);

		const typeSomething = question({
			options: [
				{ label: "Postgres", description: "A" },
				{ label: "Type something.", description: "B" },
			],
		});
		expect(validateAsk(params([typeSomething]))).toBe(
			'question 1: "Type something." is reserved — the free-text row is added automatically',
		);
	});

	it("rejects preview on a multiSelect question", () => {
		const multi = question({
			multiSelect: true,
			options: [
				{ label: "Postgres", description: "A", preview: "Markdown preview" },
				{ label: "SQLite", description: "B" },
			],
		});
		expect(validateAsk(params([multi]))).toBe("question 1: preview is only allowed on single-select questions");
	});

	it("rejects duplicate headers across questions", () => {
		expect(validateAsk(params([question(), question()]))).toBe("question headers must be unique");
	});
});

describe("prepareAskArguments", () => {
	it("JSON.parses a string questions argument", () => {
		const list = [question()];
		const result = prepareAskArguments({ questions: JSON.stringify(list) });
		expect(result).toEqual({ questions: list });
	});

	it("returns non-string arguments unchanged (same reference)", () => {
		const args = params([question()]);
		expect(prepareAskArguments(args)).toBe(args);
	});
});
