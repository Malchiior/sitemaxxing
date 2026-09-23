#!/bin/sh
# Report this agent's token usage to the Agent Index every five minutes.
#
# Same register-then-report loop as Plow's Hermes image
# (plow-pbc/plow-hermes-agent, s6-rc.d/agent-index/run), plus two steps that
# OpenClaw 2.0 needs and Hermes does not:
#
#   1. openclaw_bridge.py exports OpenClaw's SQLite transcripts to the session
#      files agentsview reads. Without it this agent reports zero tokens.
#   2. `agentsview sync` before each report, so the numbers are current. The
#      client's own call starts agentsview's daemon and can return before its
#      first sync lands.
#
# Started by boot/ro-main.ts. Never exits on a failed pass: a crash would be
# restarted in a tight loop against the Index; a bad pass waits five minutes.

PATH=/usr/local/bin:/usr/bin:/bin
export PATH

CLIENT=/opt/ro/reporter/agent-index-client.py
BRIDGE=/opt/ro/reporter/openclaw_bridge.py
INTERVAL=300

# One persistent home for everything the reporter keeps:
#   ~/.openclaw/agents   the bridge's export, which agentsview reads
#   ~/.agentsview        agentsview's own index
#   ~/.agent-index       the client's install id and report key
# It must outlive the container: a new install id on every recreate would
# register again and strand the usage the old id already published.
HOME=/var/lib/plow/.reporter
export HOME
mkdir -p "$HOME"
# No Hermes store here. Unset, the client reads agentsview only, which is
# correct; set to a path without a store, it would refuse to report at all.
unset HERMES_HOME

if [ -z "${AGENT_ID:-}" ]; then
  echo "agent-index: no AGENT_ID, so there is no agent to report for -- standing down" >&2
  exec sleep 2147483647
fi

# Register arguments, built once. Optional flags only when set: the Index keeps
# what is on record for an absent field, and an installer joining an agent
# someone else published gets a 409 on the page and still receives its key.
set -- --register --agent "$AGENT_ID"
[ -n "${AGENT_NAME:-}" ] && set -- "$@" --name "$AGENT_NAME"
[ -n "${AGENT_BLURB:-}" ] && set -- "$@" --blurb "$AGENT_BLURB"
[ -n "${AGENT_REPO:-}" ] && set -- "$@" --repo "$AGENT_REPO"
[ -n "${AGENT_RUNTIME:-}" ] && set -- "$@" --runtime "$AGENT_RUNTIME"

while :; do
  python3 "$BRIDGE" >/dev/null || echo "agent-index: bridge pass had errors (above)" >&2
  agentsview sync >/dev/null 2>&1 || echo "agent-index: agentsview sync failed" >&2

  # 0 registered, 3 not registered, 2 state present but unreadable.
  # 2 is not 3: registering over unreadable state mints a new install id and
  # strands this install's published usage, so that pass is skipped instead.
  env -u PLOW_AGENT_TOKEN python3 "$CLIENT" status >/dev/null
  case $? in
    0) ;;
    3)
      if ! python3 "$CLIENT" "$@" >/dev/null; then
        echo "agent-index: no index key this pass, not reporting" >&2
        sleep "$INTERVAL"
        continue
      fi
      ;;
    *)
      echo "agent-index: could not read this install's state; not registering over it" >&2
      sleep "$INTERVAL"
      continue
      ;;
  esac

  # The report pass never sees the broad Plow bearer: the client reports with
  # the index key the registration stored.
  env -u PLOW_AGENT_TOKEN python3 "$CLIENT" --agent "$AGENT_ID" \
    || echo "agent-index: report pass exited non-zero" >&2
  sleep "$INTERVAL"
done
