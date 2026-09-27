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

## Outbound attachments

The pinned `reply_payload_sending` hook runs after MEDIA parsing and before
channel delivery (`src/auto-reply/reply/reply-payload-sending-hook.ts`). The RO
plugin now cancels guest attachments unless their real paths belong to this
conversation and match a generated report/card/fix artifact. This also prevents
plain assistant MEDIA output from bypassing the generic-tool restriction.
Unknown scopes and remote attachment URLs fail closed. Ordinary text is kept.
Owner exemptions are bound to the exact host run ID and session key recorded by
`inbound_claim` or `before_tool_call`, never inferred from model arguments or a
previous turn. Bindings are bounded in memory; missing bindings fail closed.

`tests/media-policy.test.ts` verifies allowed report/fix attachments, file URLs,
cross-chat paths, known workspace filenames, missing context, remote URLs, and
that owner authority does not transfer to another run or conversation.
