/**
 * The validation rules the schema cannot express (spec §7.1):
 * per-question option-label uniqueness, the reserved free-text labels
 * (the extension always adds that row itself), no preview on
 * multi-select questions, and globally unique headers. Each failure is
 * one actionable sentence — the message is what the model reads, so it
 * says exactly what to change.
 */
import type { AskParams } from "./schema.js";
/** The suffix a label may carry to mark the recommended option. */
export declare const RECOMMENDED_SUFFIX = " (Recommended)";
/**
 * The first validation failure, or null when the params are card-shaped.
 * Assumes the schema already holds (`AskParams`); the schema's numeric
 * limits are not re-checked here.
 */
export declare function validateAsk(params: AskParams): string | null;
