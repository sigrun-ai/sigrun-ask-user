# @sigrun/ask-user

Structured questions from the agent for [sigrun](https://github.com/sigrun-ai/sigrun).
The agent asks through its `ask_user_question` tool; the question card renders
in the conversation and waits for the user's answers — it never auto-selects
an answer, and it waits indefinitely.

## Install

Add the extension to `extensions[]` in the sigrun settings file and restart:

```json
{
  "extensions": ["@sigrun/ask-user"]
}
```

(a git source — `git:host/path[@ref]` — works too; the repo's committed
`dist/` is what git-source installs load.)

Until `@sigrun/ask-user` is published, install from a local path pointing at
the BUILT entry — `"/path/to/sigrun-ask-user/dist/index.js"` in
`extensions[]` — because the loader rejects a bare directory path
(`Directory import … is not supported`).

## What you get

- **The `ask_user_question` tool**: one to four questions per call, each
  with two to four options, a short header chip, and multi-select
  where it fits. A label ending in ` (Recommended)` renders with a
  recommended marker. The card always adds a free-text "Type something"
  row, so `Other` and `Type something.` are reserved labels the model
  must not offer.
- **The question card** in the conversation: one section per question,
  each a required choice, submitted with "Submit answers" — or declined.
  Questions wait for a human indefinitely; nothing answers on the user's
  behalf.

## Known limits

- The card is declined or answered — there is no timer and no default.
