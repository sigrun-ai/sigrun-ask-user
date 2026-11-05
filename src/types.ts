/**
 * Shared ask-types re-export: the argument contract (schema) plus the
 * interaction kind the tool and card agree on. Kept separate from
 * `index.ts` so the factory module (a later task) can import the types
 * without pulling the factory into test-only consumers.
 */

export { ASK_KIND } from "./card.js";
export type { AskOption, AskParams, AskQuestion } from "./schema.js";
