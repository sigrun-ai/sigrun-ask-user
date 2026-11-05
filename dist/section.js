/**
 * The static prompt section: the asking discipline, not the questions.
 * Question content must never appear here — prompt bytes that change
 * per call break every cache the provider keeps.
 */
import { section } from "@earendil-works/pi-durable";
export const ASK_SECTION_TEXT = "Asking the user: when a decision is genuinely the user's and the answer would change the work, call `ask_user_question` instead of guessing. Don't ask what the conversation or the project already answers. Group related questions into one call (up to 4). Write each option so its consequence is clear, and put the option you recommend first with \" (Recommended)\" at the end of its label. Use `preview` to show concrete artifacts — a mockup, a code snippet, a config — when comparing them helps. The user can always answer in their own words or decline; if they decline, continue from what they say next.";
export const askSection = section("ask-user", (input) => input.agent.tools.some((tool) => tool.name === "ask_user_question") ? ASK_SECTION_TEXT : undefined);
