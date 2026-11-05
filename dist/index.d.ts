/**
 * The ask-user extension factory (Task 9): one {@link Waiters} registry
 * shared by the tool's waits and the `interactionSettled` lifecycle
 * handler, with `harnessShutdown` flipping the flag the tool's abort
 * path reads to tell a clean restart from a real cancellation.
 *
 * The factory declares ONE parameter so the loader passes the host in
 * (`factory.length > 0` gates the host argument); a defaulted first
 * parameter would swallow it instead.
 */
import type { SigrunExtensionResult, SigrunHost } from "@sigrun/sigrun/extension";
/**
 * The ask-user extension: the agent asks the user structured questions
 * through `ask_user_question` and waits for the answer — no timer ever
 * auto-selects an answer; the user answers or declines.
 * The required host parameter keeps the factory at arity one for the loader.
 */
export default function createAskUser(host: SigrunHost): SigrunExtensionResult;
