/**
 * The ask card: one root `form` per call, one `section` per question,
 * each holding exactly one `choice` named `q<n>` whose label is the full
 * question text. The ` (Recommended)` suffix is stripped from the label
 * and maps to `recommended: true` on the option; every choice carries
 * the free-text row (`allowOther: {label: "Type something"}`).
 */

import { describe, expect, it } from "vitest";
import { validateTree, type Tree } from "@sigrun/sigrun/blocks";
import { buildCard } from "../src/card.js";
import type { AskParams } from "../src/schema.js";

describe("buildCard", () => {
	it("one single-select question with a recommended second option", () => {
		const params: AskParams = {
			questions: [
				{
					question: "Which database should this service use?",
					header: "Database",
					options: [
						{ label: "SQLite", description: "Embedded, zero-ops file store" },
						{ label: "Postgres (Recommended)", description: "Relational store with transactions" },
					],
				},
			],
		};

		const tree = buildCard(params);
		const expected: Tree = {
			v: 1,
			root: {
				type: "form",
				id: "ask",
				bind: "/values",
				mode: "submit",
				submitLabel: "Submit answers",
				children: [
					{
						type: "section",
						title: "Database",
						children: [
							{
								type: "choice",
								name: "q1",
								label: "Which database should this service use?",
								required: true,
								multi: false,
								allowOther: { label: "Type something" },
								options: [
									{ id: "o1", label: "SQLite", description: "Embedded, zero-ops file store" },
									{
										id: "o2",
										label: "Postgres",
										description: "Relational store with transactions",
										recommended: true,
									},
								],
							},
						],
					},
				],
			},
		};
		expect(tree).toEqual(expected);
	});

	it("two questions produce two sections, each holding only its own choice", () => {
		const params: AskParams = {
			questions: [
				{
					question: "Which database should this service use?",
					header: "Database",
					options: [
						{ label: "SQLite", description: "Embedded, zero-ops file store" },
						{ label: "Postgres", description: "Relational store with transactions" },
					],
				},
				{
					question: "Which caches belong in front of it?",
					header: "Caching",
					multiSelect: true,
					options: [
						{ label: "Redis", description: "In-memory key-value store" },
						{ label: "In-process", description: "No extra service" },
					],
				},
			],
		};

		const tree = buildCard(params);
		if (tree.root.type !== "form") throw new Error("root must be a form");
		expect(tree.root.children).toHaveLength(2);

		const [first, second] = tree.root.children;
		if (first?.type !== "section" || second?.type !== "section") {
			throw new Error("each question must be a section");
		}
		expect(first.title).toBe("Database");
		expect(second.title).toBe("Caching");
		expect(first.children).toHaveLength(1);
		expect(second.children).toHaveLength(1);
		expect(first.children[0]).toMatchObject({ type: "choice", name: "q1" });
		expect(second.children[0]).toMatchObject({ type: "choice", name: "q2", multi: true });
	});

	it("passes description and preview through on single-select options", () => {
		const params: AskParams = {
			questions: [
				{
					question: "Which queue should the worker drain?",
					header: "Queue",
					options: [
						{ label: "Main", description: "Default queue", preview: "**Main** queue detail" },
						{ label: "Retry", description: "Failed deliveries" },
					],
				},
			],
		};

		const tree = buildCard(params);
		if (tree.root.type !== "form") throw new Error("root must be a form");
		const section = tree.root.children[0];
		if (section?.type !== "section") throw new Error("expected a section");
		const choice = section.children[0];
		if (choice?.type !== "choice") throw new Error("expected a choice");
		if (!Array.isArray(choice.options)) throw new Error("options must be literal rows");
		expect(choice.options[0]).toEqual({
			id: "o1",
			label: "Main",
			description: "Default queue",
			preview: "**Main** queue detail",
		});
	});

	it("passes core's tree validation for the interaction placement", () => {
		// The guard for the root-form id rule: core's seedInteraction runs
		// this same validateTree and rejects a form without an id.
		const params: AskParams = {
			questions: [
				{
					question: "Which database should this service use?",
					header: "Database",
					options: [
						{ label: "SQLite", description: "Embedded, zero-ops file store" },
						{ label: "Postgres", description: "Relational store with transactions" },
					],
				},
				{
					question: "Which caches belong in front of it?",
					header: "Caching",
					multiSelect: true,
					options: [
						{ label: "Redis", description: "In-memory key-value store" },
						{ label: "In-process", description: "No extra service" },
					],
				},
			],
		};

		const result = validateTree(buildCard(params), { placement: "interaction" });
		expect(result.ok).toBe(true);
	});
});
