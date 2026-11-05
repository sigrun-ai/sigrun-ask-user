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
`extensions[]`.

## What you get

- **The `ask_user_question` tool**: one to four questions per call, each
  with two to four options, a short header chip, and multi-select
  where it fits. A label ending in ` (Recommended)` renders with a
  recommended marker. The card always adds a free-text "Type something"
  row, so `Other` and `Type something.` are reserved labels the model
  must not offer. The numeric limits: 1–4 questions per call, 2–4
  options per question, header ≤ 16 characters, label ≤ 60 characters.
- **The question card** in the conversation: one section per question,
  each a required choice, submitted with "Submit answers" — or declined.
  Questions wait for a human indefinitely; nothing answers on the user's
  behalf.

## Decline

The user can always decline a question instead of answering. A decline
does not error the agent — it is a result: the tool returns "declined"
and the agent continues from what the user says next (reply-to-decline
is an ordinary conversation message; the tool never second-guesses it).

## Where it is hidden

- **Scheduled job runs**: there is nobody to ask. The tool refuses with
  a tool error *before* seeding any card, telling the model to escalate
  instead.
- **Curator runs and other non-interactive agents**: the extension
  declares `ask_user_question` an interactive tool, so core withholds it
  from agents a human never watches.

## Known limits

- The card is declined or answered — there is no timer and no default.
- One to four questions per call; two to four options per question;
  headers at most 16 characters; option labels at most 60.
- A question is bound to its tool call: on a process restart the pending
  card is re-seeded from the same call id rather than duplicated.
