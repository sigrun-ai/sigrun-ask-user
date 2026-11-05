# AGENTS.md — sigrun-ask-user

Guidance for coding agents working in this repository.

## What this is

The ask-user extension for [sigrun](https://github.com/sigrun-ai/sigrun):
the agent asks the user structured questions through the
`ask_user_question` tool and waits for the answer. A question never has a
timer that auto-selects an answer — the user answers or declines.

A sigrun extension (pi-durable loader contract): a default-export factory
taking the `SigrunHost` and returning a `SigrunExtensionResult` (types from
`@sigrun/sigrun/extension`, a types-only subpath — never a runtime import).

## Layout

- `src/schema.ts` — `AskParamsSchema` (typebox) and `prepareAskArguments`
  (parses a stringified `questions` argument; otherwise returns the args
  unchanged). The schema carries the numeric limits: 1–4 questions,
  2–4 options, header ≤ 16 chars, label ≤ 60 chars.
- `src/validate.ts` — `validateAsk` and `RECOMMENDED_SUFFIX`: the rules
  the schema cannot express (unique option labels per question, unique
  headers, the reserved labels `Other` / `Type something.`, no preview on
  multi-select).
- `src/card.ts` — `buildCard` and `ASK_KIND` (`"ask.questions"`): the
  interaction tree. Root `form` bound to `/values` in submit mode with
  submit label "Submit answers"; one `section` per question titled by its
  header, each holding exactly one required `choice` named `q<n>` labelled
  with the full question text; options `o1`…`o4`, the ` (Recommended)`
  suffix stripped into `recommended: true`, and every choice carrying
  `allowOther: {label: "Type something"}`. No note fields — the TUI
  stepper only takes input in a step's first field.
- `src/types.ts` — the shared type/constant re-exports.
- `src/tool.ts` — the `ask_user_question` tool: validate, `jobs.isJobRun`
  check, waiter registration, idempotent seed, one snapshot read, then
  the wait. The abort path distinguishes a clean shutdown (record stays
  pending for the post-restart rerun) from a real cancel (record settles
  `cancelled`); the original abort always rethrows. Model-only,
  `replay: "safe"`.
- `src/waiters.ts` — `Waiters`: the callId-keyed promise registry
  joining `interactionSettled` events to the tool's waits, plus the
  `shuttingDown` flag; `discard` drops a waiter whose execute body threw
  before awaiting (a rejecting seed). NO timers anywhere.
- `src/result.ts` — `formatResult`: the settled outcome folded into the
  tool's text output (`Header: Label` lines, free-text replies,
  declined/cancelled phrasings) plus the renderable `details`.
- `src/section.ts` — the static prompt section (the asking discipline,
  verbatim; renders only when the run's agent carries
  `ask_user_question`).
- `src/index.ts` — the default-export factory: ONE `Waiters` shared by
  the tool and the `interactionSettled` handler, plus `harnessShutdown`
  flipping the flag.
- `test/fake-host.ts` — the in-memory `SigrunHost` (unit tests never
  boot core); `test/harness.ts` — a real pi-durable `Harness` helper.
- `dist/` — **committed build output** (git-source installs load
  `dist/index.js` with no build step). Rebuild with `npm run build` and
  commit whenever `src/` moves; a stale dist is ship-blocking.

## Run and test

```sh
npm install
npm test            # check-manifest + vitest
npm run typecheck   # tsc --noEmit
npm run build       # tsc -> dist/ (commit the result)
```

## Conventions

- The extension's seams: `interactionKinds: ["ask.questions"]`,
  `interactiveTools: ["ask_user_question"]` (core withholds the tool from
  job runs and curator agents), `interactionSettled` resolving waits,
  `harnessShutdown` arming the clean-restart abort path.
- **Commit dist**: tracked by design. If `git status` shows `dist/` changes
  after a build, those belong in the same commit as the source change.
- **Verification before completion**: `npm test` + `npm run typecheck` +
  `npm run build` with a clean `git status -- dist` before claiming done.
- The factory declares one `host` parameter (arity one) and no default: the
  loader passes the host only when `factory.length > 0`.
- The card tree is a plain object with type-only imports from
  `@sigrun/shared/blocks` — never a runtime import of host packages: an
  installed extension resolves only its own files.
- Validation errors are tool errors the model reads: one sentence, naming
  the failing question and the rule, so the model can fix the call.
- Tests own their literals: synthetic questions and labels; no real hosts,
  tokens, or private URLs in fixtures.
- Host modules (`@earendil-works/*`) are peerDependencies; development pins
  exact devDependencies. The `dependencies` field stays empty.
- Keep the `@sigrun/*` devDependencies as `file:` links to the sibling
  checkouts (`../sigrun`, `../sigrun/shared`) and keep `dependencies`
  empty; `scripts/check-manifest.mjs` (part of `npm test`) enforces the
  published shape.
