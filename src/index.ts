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

import { defineExtension } from "@earendil-works/pi-durable";
import type { SigrunExtensionResult, SigrunHost } from "@sigrun/sigrun/extension";
import { ASK_KIND } from "./card.js";
import { askSection } from "./section.js";
import { createAskTool } from "./tool.js";
import { Waiters } from "./waiters.js";

/**
 * The ask-user extension: the agent asks the user structured questions
 * through `ask_user_question` and waits for the answer — no timer ever
 * auto-selects an answer; the user answers or declines.
 * The required host parameter keeps the factory at arity one for the loader.
 */
export default function createAskUser(host: SigrunHost): SigrunExtensionResult {
	// ONE registry: the tool's pending waits and the lifecycle handler's
	// settles must meet in the same map.
	const waiters = new Waiters();

	return {
		extension: defineExtension({
			name: "ask-user",
			tools: [createAskTool({ host, waiters })],
			sections: [askSection],
		}),
		interactionKinds: [ASK_KIND],
		interactiveTools: ["ask_user_question"],
		interactionSettled: (event) => waiters.settle(event),
		harnessShutdown: () => {
			waiters.shuttingDown = true;
		},
	};
}
