/**
 * Shared test harness (Task 8's real-harness case): a REAL pi-durable
 * Harness with a faux provider and the real `ask_user_question` tool
 * installed, proving the round trip through pi-durable's argument
 * repair (`prepareArguments` runs before validation) and the tool's
 * own wait — the fake host records the seeded card, and the test
 * settles it through the waiters.
 *
 * Pattern: sigrun-todo's test/harness.ts.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { createModels } from "@earendil-works/pi-ai/models";
import {
	createRegistry,
	defineExtension,
	Harness,
	type ModelRef,
} from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { createAskTool } from "../src/tool.js";
import { Waiters } from "../src/waiters.js";
import type { FakeHost } from "./fake-host.js";

export interface OpenedHarness {
	readonly harness: Harness;
	readonly defaultModel: ModelRef;
	readonly registry: ReturnType<typeof createRegistry>;
	readonly faux: ReturnType<typeof fauxProvider>;
	readonly waiters: Waiters;
}

/**
 * Open a real harness with the real tool over the given host. The faux
 * provider's responses script the model; the host's seeded card is the
 * interaction the test settles.
 */
export async function openAskHarness(
	dir: string,
	host: FakeHost,
	responses: Parameters<ReturnType<typeof fauxProvider>["setResponses"]>[0] = [
		fauxAssistantMessage("done"),
	],
): Promise<OpenedHarness> {
	const faux = fauxProvider({
		provider: "faux",
		models: [{ id: "m", contextWindow: 128_000 }],
	});
	faux.setResponses(responses);
	const models = createModels();
	models.setProvider(faux.provider);
	const defaultModel: ModelRef = { provider: "faux", modelId: "m" };

	const waiters = new Waiters();
	const registry = createRegistry();
	registry.install(
		defineExtension({
			name: "ask-user",
			tools: [createAskTool({ host, waiters })],
		}),
	);

	const harness = await Harness.open(
		await openNodeSqliteStorage(join(dir, "sigrun.db")),
		{ models, registry },
		BACKGROUND_CONTEXT,
	);
	harness.resume();

	return { harness, defaultModel, registry, faux, waiters };
}

/** Fresh temp dir; the test body receives it and must clean up. */
export async function tempDir(prefix: string): Promise<string> {
	return mkdtemp(join(tmpdir(), prefix));
}

export async function cleanupDir(dir: string): Promise<void> {
	await rm(dir, { recursive: true, force: true });
}

/** Close an opened harness; safe in test finally blocks. */
export async function closeOpened(opened: OpenedHarness): Promise<void> {
	await opened.harness.close(BACKGROUND_CONTEXT).catch(() => undefined);
}
