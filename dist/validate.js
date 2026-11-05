/**
 * The validation rules the schema cannot express (spec §7.1):
 * per-question option-label uniqueness, the reserved free-text labels
 * (the extension always adds that row itself), no preview on
 * multi-select questions, and globally unique headers. Each failure is
 * one actionable sentence — the message is what the model reads, so it
 * says exactly what to change.
 */
/** The suffix a label may carry to mark the recommended option. */
export const RECOMMENDED_SUFFIX = " (Recommended)";
/** Labels the card adds itself; offering them as options would duplicate the row. */
const RESERVED_LABELS = new Set(["Other", "Type something."]);
/**
 * The first validation failure, or null when the params are card-shaped.
 * Assumes the schema already holds (`AskParams`); the schema's numeric
 * limits are not re-checked here.
 */
export function validateAsk(params) {
    const headers = new Set();
    for (const [index, question] of params.questions.entries()) {
        const n = index + 1;
        if (headers.has(question.header))
            return "question headers must be unique";
        headers.add(question.header);
        const labels = new Set();
        for (const option of question.options) {
            // Compare on the rendered label: the recommended suffix is stripped
            // before the card draws the option, so "A" and "A (Recommended)" are
            // the same label, and "Other (Recommended)" is still reserved.
            const label = option.label.endsWith(RECOMMENDED_SUFFIX)
                ? option.label.slice(0, -RECOMMENDED_SUFFIX.length)
                : option.label;
            if (labels.has(label))
                return `question ${n}: option labels must be unique`;
            labels.add(label);
            if (RESERVED_LABELS.has(label)) {
                return `question ${n}: "${label}" is reserved — the free-text row is added automatically`;
            }
            if (question.multiSelect === true && option.preview !== undefined) {
                return `question ${n}: preview is only allowed on single-select questions`;
            }
        }
    }
    return null;
}
