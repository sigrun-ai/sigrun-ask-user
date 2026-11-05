/**
 * The tool result text (spec §7.5): what the model reads when the wait
 * ends. An answer is one line per question, `<header>: <answer>`, where
 * the answer is the selected option LABELS joined `", "` — the model
 * knows its own labels; the option ids `o1`… would say nothing — with
 * the free-text answer quoted and marked `(own words)` last. Declines
 * and cancellations carry their own fixed sentences so the model never
 * has to guess whether to retry or move on.
 */

import type { JsonValue } from "@earendil-works/chord";
import type { AskParams } from "./schema.js";
import type { Settled } from "./waiters.js";

/** The structured payload the tool result carries as `details`. */
export type AskDetails = {
	status: Settled["status"];
	answers: {
		question: string;
		header: string;
		selected: string[];
		other?: string;
	}[];
	declinedVia?: "button" | "message";
};

/** The copy the model reads verbatim. */
export const DECLINED_BUTTON_TEXT = "The user declined to answer.";
export const DECLINED_MESSAGE_TEXT =
	"The user declined to answer and replied in chat instead; their message follows.";
export const CANCELLED_TEXT = "The question was cancelled before the user answered.";

type AnswerPart = { selected: string[]; other?: string };

/** One question's value under `q<n>`: an option id, or ids/other for multi. */
function answerPart(question: AskParams["questions"][number], value: JsonValue | undefined): AnswerPart {
	const labels = new Map(question.options.map((option, index) => [`o${index + 1}`, option.label]));
	const one = (v: JsonValue | undefined, into: AnswerPart): void => {
		if (typeof v === "string") {
			const label = labels.get(v);
			if (label !== undefined) into.selected.push(label);
		} else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
			const other = (v as { other?: unknown }).other;
			if (typeof other === "string") into.other = other;
		}
	};
	const part: AnswerPart = { selected: [] };
	if (Array.isArray(value)) {
		for (const v of value) one(v, part);
	} else {
		one(value, part);
	}
	return part;
}

/** The answer sentence for one question: labels joined, own words last. */
function answerText(part: AnswerPart): string {
	const pieces = [...part.selected];
	if (part.other !== undefined) pieces.push(`"${part.other}" (own words)`);
	return pieces.join(", ");
}

export function formatResult(
	params: AskParams,
	settled: Settled,
): { output: string; details: AskDetails; isError?: true } {
	if (settled.status === "skipped") {
		// Decision: a skip without declinedVia reads as the button sentence.
		// The field is only absent for declines older than the field, and the
		// chat-reply copy would claim a message follows when none does.
		return {
			output: settled.declinedVia === "message" ? DECLINED_MESSAGE_TEXT : DECLINED_BUTTON_TEXT,
			details: { status: "skipped", answers: [], ...(settled.declinedVia !== undefined ? { declinedVia: settled.declinedVia } : {}) },
		};
	}
	if (settled.status !== "answered") {
		return {
			output: CANCELLED_TEXT,
			details: { status: settled.status, answers: [] },
			isError: true,
		};
	}
	const answers = params.questions.map((question, index) => {
		const part = answerPart(question, settled.values[`q${index + 1}`]);
		return {
			question: question.question,
			header: question.header,
			selected: part.selected,
			...(part.other !== undefined ? { other: part.other } : {}),
		};
	});
	const output = answers.map((answer) => `${answer.header}: ${answerText(answer)}`).join("\n");
	return { output, details: { status: "answered", answers } };
}
