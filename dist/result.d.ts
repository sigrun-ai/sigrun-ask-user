/**
 * The tool result text (spec §7.5): what the model reads when the wait
 * ends. An answer is one line per question, `<header>: <answer>`, where
 * the answer is the selected option LABELS joined `", "` — the model
 * knows its own labels; the option ids `o1`… would say nothing — with
 * the free-text answer quoted and marked `(own words)` last. Declines
 * and cancellations carry their own fixed sentences so the model never
 * has to guess whether to retry or move on.
 */
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
export declare const DECLINED_BUTTON_TEXT = "The user declined to answer.";
export declare const DECLINED_MESSAGE_TEXT = "The user declined to answer and replied in chat instead; their message follows.";
export declare const CANCELLED_TEXT = "The question was cancelled before the user answered.";
export declare function formatResult(params: AskParams, settled: Settled): {
    output: string;
    details: AskDetails;
    isError?: true;
};
