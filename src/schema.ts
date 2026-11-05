/**
 * The `ask_user_question` argument shape: the typebox schema the tool
 * declares, and `prepareAskArguments` for models that stringify the
 * array. The limits (1–4 questions, 2–4 options, header ≤ 16, label
 * ≤ 60) are the ones the design keeps from rpiv so prompting habits
 * carry over (spec §7.1); rules a schema cannot express live in
 * `validate.ts`.
 */

import { Type, type Static } from "@earendil-works/pi-ai";

export const AskOptionSchema = Type.Object({
	label: Type.String({ maxLength: 60, description: "Short option label" }),
	description: Type.String({ description: "What this option implies" }),
	preview: Type.Optional(Type.String({ description: "Markdown preview (single-select questions only)" })),
});

export const AskQuestionSchema = Type.Object({
	question: Type.String({ description: "The full question text" }),
	header: Type.String({ maxLength: 16, description: "Short chip label, at most 16 characters" }),
	multiSelect: Type.Optional(Type.Boolean({ description: "Allow choosing more than one option" })),
	options: Type.Array(AskOptionSchema, { minItems: 2, maxItems: 4 }),
});

export const AskParamsSchema = Type.Object({
	questions: Type.Array(AskQuestionSchema, { minItems: 1, maxItems: 4 }),
});

export type AskOption = Static<typeof AskOptionSchema>;
export type AskQuestion = Static<typeof AskQuestionSchema>;
export type AskParams = Static<typeof AskParamsSchema>;

/**
 * Models occasionally send the array as a JSON string; normalize that to
 * parsed form. Anything else passes through unchanged (null/undefined throw
 * here — the tool's own argument validation rejects them upstream as
 * invalid_arguments). Pure.
 */
export function prepareAskArguments(args: unknown): AskParams {
	if (typeof (args as { questions?: unknown }).questions === "string") {
		const raw = args as { questions: string };
		return { ...raw, questions: JSON.parse(raw.questions) } as AskParams;
	}
	return args as AskParams;
}
