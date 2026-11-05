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
import type { Tree } from "@sigrun/shared/blocks";
import type { AskParams } from "./schema.js";
/** The interaction kind the tool seeds with this card as its tree. */
export declare const ASK_KIND = "ask.questions";
export declare function buildCard(params: AskParams): Tree;
