# Multiplayer report isolation

Each tool factory receives trusted OpenClaw context. Reports live under
`ro/conversations/<SHA-256 of agentId, sessionKey, sessionId>/runs`.
Separate direct conversations have separate latest-report pointers and history.
Group participants share their group's session. `/new` or `/reset` starts fresh.
Old installation-wide reports are not automatically migrated because their
conversation ownership cannot be proved. Send the URL again to create a report.
Missing session identity refuses report tools instead of guessing the owner.

The pinned OpenClaw v2026.9.4 `src/plugins/tool-types.ts` specifies factory
context; the third `execute` argument is not a conversation context.
Acknowledgements use host-bound `delivery.send`, never an owner-chat fallback.

A `before_tool_call` hook enforces a guest allowlist of the six report/chat
helper tools. Non-owner and unverified requests cannot use generic filesystem,
shell, memory, cross-session, delegation, browser, messaging, or scheduled tools.
Ordinary conversational replies remain available. Report PDF/fix attachments
come directly from the scoped tools' MEDIA output and do not require a generic
file-reading or messaging tool. New tools default to owner-only until reviewed.
The installation owner retains administrative tool access; this is not a sandbox
against that owner. External handoff requires an explicit host-confirmed owner.

## Verification

`node --test tests/multiplayer.test.ts` exercises two independent conversations,
shared group scope, session reset, legacy-pointer refusal, pointer containment,
and the host tool allowlist. Build tests strip types using the production build
logic and verify every relative plugin import has a generated sibling.

Before claiming end-to-end multiplayer verification, use two consenting people
in separate real chats, audit different sites, and request `status`, `fix`, and
`pages` in each. Confirm each receives only their own report. In a group chat,
have the second participant request the first participant's group report.
This live messaging test is distinct from automated host-contract tests.
