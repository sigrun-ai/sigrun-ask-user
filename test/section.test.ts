/**
 * The prompt section (Task 9): the exact guidance text renders only
 * when the run's agent carries `ask_user_question`; any other tool
 * list gets `undefined` — the pattern of sigrun-todo's section test.
 */

import { describe, expect, it } from "vitest";
import { ASK_SECTION_TEXT, askSection } from "../src/section.js";

/** The minimal section input: only `agent.tools` is read. */
function inputWithTools(tools: readonly { name: string }[]): {
	agent: { tools: readonly { name: string }[] };
} {
	return { agent: { tools } };
}

describe("askSection", () => {
	it("renders the exact guidance text when ask_user_question is among the tools", () => {
		const render = askSection.render ?? askSection;
		const text = (render as (input: unknown) => string | undefined)(
			inputWithTools([{ name: "other_tool" }, { name: "ask_user_question" }]),
		);
		expect(text).toBe(ASK_SECTION_TEXT);
		expect(text).toContain("call `ask_user_question` instead of guessing");
		expect(text).toContain('with " (Recommended)" at the end of its label');
		expect(text).toContain("if they decline, continue from what they say next");
	});

	it("renders undefined when the tool is absent", () => {
		const render = askSection.render ?? askSection;
		expect((render as (input: unknown) => string | undefined)(inputWithTools([{ name: "todo" }]))).toBeUndefined();
		expect((render as (input: unknown) => string | undefined)(inputWithTools([]))).toBeUndefined();
	});
});
