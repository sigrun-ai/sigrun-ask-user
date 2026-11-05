/**
 * The card shown to the user (spec §7.2): a root `form` bound to
 * `/values` in submit mode, one `section` per question titled by its
 * header, each holding exactly one required `choice` named `q1`…`q4`
 * whose label is the full question text (the header is too short to
 * carry it). Options are `o1`…`o4`; a ` (Recommended)` suffix maps to
 * `recommended: true` with the suffix stripped. Every choice carries
 * the free-text row (`allowOther: {label: "Type something"}`) — the
 * reserved labels never appear in the model's options. There are no
 * note fields: the TUI stepper only takes input in a step's first
 * field, so a second field would be unreachable there.
 */

import type { ChoiceField, ChoiceOption, SectionBlock, Tree } from "@sigrun/shared/blocks";
import type { AskParams } from "./schema.js";
import { RECOMMENDED_SUFFIX } from "./validate.js";

/** The interaction kind the tool seeds with this card as its tree. */
export const ASK_KIND = "ask.questions";

function choiceOption(option: AskParams["questions"][number]["options"][number], index: number): ChoiceOption {
	const recommended = option.label.endsWith(RECOMMENDED_SUFFIX);
	const label = recommended ? option.label.slice(0, -RECOMMENDED_SUFFIX.length) : option.label;
	return {
		id: `o${index + 1}`,
		label,
		description: option.description,
		...(option.preview !== undefined ? { preview: option.preview } : {}),
		...(recommended ? { recommended: true } : {}),
	};
}

function questionSection(question: AskParams["questions"][number], index: number): SectionBlock {
	const choice: ChoiceField = {
		type: "choice",
		name: `q${index + 1}`,
		label: question.question,
		required: true,
		multi: question.multiSelect === true,
		allowOther: { label: "Type something" },
		options: question.options.map(choiceOption),
	};
	return { type: "section", title: question.header, children: [choice] };
}

export function buildCard(params: AskParams): Tree {
	return {
		v: 1,
		root: {
			type: "form",
			bind: "/values",
			mode: "submit",
			submitLabel: "Submit answers",
			children: params.questions.map(questionSection),
		},
	};
}
