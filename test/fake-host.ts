/**
 * An in-memory host for the ask-user tool tests (Task 8): the
 * interaction seam members the tool drives (`seedInteraction`,
 * `snapshotInteraction`, `settleInteraction`) are functional over one
 * in-memory record table, `jobs.isJobRun` is configurable, and every
 * other member throws explicitly rather than hiding an accidental
 * dependency — the pattern of sigrun-todo's test/fake-host.ts.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConversationId } from "@earendil-works/pi-durable";
import type { InteractionRecord } from "@sigrun/shared/interactions";
import type { SigrunHost } from "@sigrun/sigrun/extension";

export interface FakeCall {
	readonly method: string;
	readonly args: readonly unknown[];
}

export interface FakeHostOptions {
	/** What `jobs.isJobRun` answers; default false. */
	readonly isJobRun?: boolean;
	/**
	 * A record `snapshotInteraction` returns for the seeded callId
	 * INSTEAD of the seeded record — the already-settled shape the
	 * post-seed snapshot read exists to catch (Review Focus 4). Set
	 * inside the seed hook so the very next snapshot sees it.
	 */
	readonly snapshotOverride?: (seeded: InteractionRecord) => InteractionRecord | undefined;
	/** Make `settleInteraction` reject (the closing-session path). */
	readonly settleRejects?: boolean;
}

export interface FakeHost extends SigrunHost {
	readonly calls: readonly FakeCall[];
	cleanup(): Promise<void>;
}

export async function createFakeHost(opts: FakeHostOptions = {}): Promise<FakeHost> {
	const root = await mkdtemp(join(tmpdir(), "sigrun-ask-user-fake-host-"));
	const calls: FakeCall[] = [];
	const record = (method: string, ...args: readonly unknown[]): void => {
		calls.push({ method, args });
	};
	const notUsed = (): (() => never) => {
		return () => {
			throw new Error("not used in ask-user tests");
		};
	};

	// The interaction table: one record per callId, terminal records stay
	// terminal (seeding a terminal record is a no-op, per the host doc).
	const records = new Map<string, InteractionRecord>();
	const terminal = (status: InteractionRecord["status"]): boolean =>
		status === "answered" || status === "skipped" || status === "expired" || status === "cancelled";

	const conversations: SigrunHost["conversations"] = {
		meta: notUsed(),
		entries: notUsed(),
		create: notUsed(),
		submit: notUsed(),
		entry: notUsed(),
		watch: notUsed(),
		list: notUsed(),
		abort: notUsed(),
		configure: notUsed(),
		compact: notUsed(),
		fork: notUsed(),
		patchMeta: notUsed(),
		upload: notUsed(),
		readFile: notUsed(),
	};

	const host: SigrunHost = {
		stores: {
			user: (user) => ({
				secrets: { get: notUsed(), set: notUsed(), delete: notUsed() },
				settings: { get: notUsed(), set: notUsed() },
				paths: {
					data: join(root, "data", "users", user),
					state: join(root, "state", "users", user),
					cache: join(root, "cache", "users", user),
				},
			}),
			secrets: { get: notUsed(), set: notUsed() },
			settings: { get: notUsed(), set: notUsed() },
			paths: {
				data: join(root, "data"),
				state: join(root, "state"),
				cache: join(root, "cache"),
			},
		},
		tools: { setUserTools: notUsed() },
		services: { connect: notUsed() },
		seedInteraction: async (_conversationId, interaction) => {
			record("seedInteraction", interaction);
			const existing = records.get(interaction.callId);
			if (existing !== undefined && terminal(existing.status)) return;
			records.set(interaction.callId, interaction);
		},
		answerInteraction: notUsed(),
		settleInteraction: async (_conversationId, callId, status) => {
			record("settleInteraction", callId, status);
			if (opts.settleRejects === true) throw new Error("session is closing");
			const existing = records.get(callId);
			if (existing === undefined || terminal(existing.status)) return false;
			records.set(callId, { ...existing, status });
			return true;
		},
		peekInteraction: notUsed(),
		snapshotInteraction: async (_conversationId, callId) => {
			record("snapshotInteraction", callId);
			const stored = records.get(callId);
			if (stored === undefined) return undefined;
			return opts.snapshotOverride?.(stored) ?? stored;
		},
		setAmbient: notUsed(),
		clearAmbient: notUsed(),
		conversations,
		jobs: {
			get: notUsed(),
			isJobRun: async () => {
				record("jobs.isJobRun");
				return opts.isJobRun ?? false;
			},
		},
		notify: notUsed(),
		notices: { post: notUsed(), clear: notUsed(), list: notUsed() },
		users: { list: notUsed(), get: notUsed() },
		accounts: {
			lookup: notUsed(),
			link: notUsed(),
			unlink: notUsed(),
			listForUser: notUsed(),
		},
		access: { accessOf: notUsed() },
		identity: { actingUser: notUsed() },
		surfaces: { changed: notUsed() },
		models: { list: notUsed() },
		commands: { list: notUsed(), run: notUsed() },
		curation: new Proxy({} as SigrunHost["curation"], {
			get: () => {
				throw new Error("not used in ask-user tests");
			},
		}),
		declineInteraction: notUsed(),
		publishedHooks: { get: notUsed(), call: notUsed() },
	};

	return {
		...host,
		calls,
		cleanup: async () => {
			await rm(root, { recursive: true, force: true });
		},
	};
}
