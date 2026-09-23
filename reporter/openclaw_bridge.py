#!/usr/bin/env python3
"""Make OpenClaw 2.0 usage visible to agentsview, and so to the Agent Index.

OpenClaw 2026.9.x keeps transcripts in one SQLite store per agent:

    $OPENCLAW_STATE_DIR/agents/<agent>/agent/openclaw-agent.sqlite
        transcript_events(session_id, seq, event_json, created_at)

agentsview (v0.44) only reads the older layout:

    ~/.openclaw/agents/<agent>/sessions/<session>.jsonl

so the Agent Index client, which reads usage through agentsview, reports zero
tokens for an OpenClaw 2.0 agent. Each `event_json` row is exactly one line of
the older format, so this writes them out as those files and changes nothing
else: the official client and agentsview still do all the counting.

Append-only on purpose. The Index REPLACES a (day, model) total with what it
is sent, so an export that shrank -- because OpenClaw compacted or archived old
events out of the store -- would overwrite a correct number with a smaller one.
Events already exported stay exported; new ones are added by event id.

Standard library only. Never raises out of main: a failed pass reports what it
could and says why, and the next pass (five minutes later) tries again.
"""
import glob
import json
import os
import sqlite3
import sys

STATE_DIR = os.environ.get("OPENCLAW_STATE_DIR", "/var/lib/plow")
OUT_ROOT = os.path.join(os.path.expanduser("~"), ".openclaw", "agents")


def read_store(db_path):
    """session_id -> [event_json, ...] in seq order, read-only."""
    sessions = {}
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=10)
    try:
        rows = conn.execute(
            "SELECT session_id, event_json FROM transcript_events ORDER BY session_id, seq")
        for session_id, event_json in rows:
            sessions.setdefault(session_id, []).append(event_json)
    finally:
        conn.close()
    return sessions


def event_id(line):
    try:
        return json.loads(line).get("id")
    except (ValueError, AttributeError):
        return None


def merge_session(path, fresh_lines):
    """Union of what is already exported and what the store holds now.

    Returns how many new events were written (0 means the file was untouched).
    """
    existing = []
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            existing = [line.rstrip("\n") for line in f if line.strip()]
    seen = {event_id(line) for line in existing}
    seen.discard(None)
    added = [line for line in fresh_lines if event_id(line) not in seen]
    if not added and existing:
        return 0
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("\n".join(existing + added) + "\n")
    os.replace(tmp, path)
    return len(added)


def export(state_dir=STATE_DIR, out_root=OUT_ROOT):
    """Export every agent's store. Returns (sessions_seen, events_added, errors)."""
    sessions_seen = events_added = 0
    errors = []
    for db_path in sorted(glob.glob(os.path.join(state_dir, "agents", "*", "agent", "openclaw-agent.sqlite"))):
        agent = db_path.split(os.sep)[-3]
        try:
            sessions = read_store(db_path)
        except sqlite3.Error as e:
            errors.append(f"{agent}: {type(e).__name__}: {e}")
            continue
        out_dir = os.path.join(out_root, agent, "sessions")
        os.makedirs(out_dir, exist_ok=True)
        for session_id, lines in sessions.items():
            # Session ids are uuids; refuse anything that could leave out_dir.
            if not session_id or "/" in session_id or session_id.startswith("."):
                errors.append(f"{agent}: skipped unsafe session id {session_id!r}")
                continue
            sessions_seen += 1
            events_added += merge_session(os.path.join(out_dir, f"{session_id}.jsonl"), lines)
    return sessions_seen, events_added, errors


def main():
    try:
        sessions_seen, events_added, errors = export()
    except Exception as e:  # never take the reporter loop down
        print(f"openclaw-bridge: failed: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    for error in errors:
        print(f"openclaw-bridge: {error}", file=sys.stderr)
    print(f"openclaw-bridge: {sessions_seen} sessions, {events_added} new events")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
