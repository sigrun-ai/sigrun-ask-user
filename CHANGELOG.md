# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-11-07

## [Unreleased]

### Changed

- peer pi-durable/pi-ai/chord ~1.5.0 (requires sigrun 0.11.0).

## [0.1.0] - 2026-11-05
### Added
- The `ask_user_question` argument contract: `AskParamsSchema` (1–4
  questions, 2–4 options, header ≤ 16 chars, label ≤ 60 chars) plus
  `prepareAskArguments` for models that stringify the array.
- `validateAsk`: unique option labels per question, unique headers, the
  reserved labels `Other` / `Type something.`, and no preview on
  multi-select questions.
- `buildCard`: the question card tree — a submit-mode form with one
  section per question, each holding a required choice labelled with the
  full question text, the ` (Recommended)` suffix mapping to
  `recommended: true`, and a free-text "Type something" row on every
  choice.
- The `ask_user_question` tool (model-only, `replay: "safe"`): validate,
  refuse in scheduled job runs, register the waiter, seed the card
  idempotently per call id, one snapshot read, then wait for the human.
  Declines come back as results, not errors; a clean shutdown leaves the
  card pending for the post-restart rerun; any other abort settles it
  `cancelled` and rethrows the original abort. No timer ever answers.
- `Waiters`: the callId-keyed registry joining `interactionSettled`
  events to in-flight waits.
- `formatResult`: the settled outcome folded into the tool output and
  `details`.
- The extension factory: `interactionKinds: ["ask.questions"]`,
  `interactiveTools: ["ask_user_question"]`, the `interactionSettled`
  and `harnessShutdown` lifecycle handlers.
- The prompt section: the asking discipline, rendered only when the
  run's agent carries `ask_user_question`.
