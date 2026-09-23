"""Tests for reporter/openclaw_bridge.py. Standard library only.

Run: python3 -m unittest discover -s tests -p 'test_*.py'
"""
import importlib.util
import json
import os
import sqlite3
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "openclaw_bridge", os.path.join(HERE, "..", "reporter", "openclaw_bridge.py"))
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def assistant_event(event_id, tokens, response_id=None):
    return json.dumps({
        "type": "message", "id": event_id, "parentId": None,
        "timestamp": "2026-09-22T21:14:48.499Z",
        "message": {"role": "assistant", "model": "z-ai/glm-5.2",
                    "responseId": response_id or f"resp-{event_id}",
                    "usage": {"input": tokens, "output": 10, "cacheRead": 0, "cacheWrite": 0}},
    })


class BridgeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = os.path.join(self.tmp.name, "state")
        self.out = os.path.join(self.tmp.name, "home", ".openclaw", "agents")
        os.makedirs(os.path.join(self.state, "agents", "main", "agent"))
        self.db = os.path.join(self.state, "agents", "main", "agent", "openclaw-agent.sqlite")
        conn = sqlite3.connect(self.db)
        conn.execute("CREATE TABLE transcript_events (session_id TEXT, seq INTEGER, event_json TEXT, created_at TEXT)")
        conn.commit()
        conn.close()

    def tearDown(self):
        self.tmp.cleanup()

    def insert(self, session_id, seq, event_json):
        conn = sqlite3.connect(self.db)
        conn.execute("INSERT INTO transcript_events VALUES (?, ?, ?, '')", (session_id, seq, event_json))
        conn.commit()
        conn.close()

    def exported(self, session_id):
        path = os.path.join(self.out, "main", "sessions", f"{session_id}.jsonl")
        with open(path, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    def test_exports_events_in_agentsview_layout(self):
        self.insert("s1", 1, assistant_event("e1", 100))
        self.insert("s1", 2, assistant_event("e2", 200))
        sessions, added, errors = bridge.export(self.state, self.out)
        self.assertEqual((sessions, added, errors), (1, 2, []))
        events = self.exported("s1")
        self.assertEqual([e["id"] for e in events], ["e1", "e2"])
        self.assertEqual(sum(e["message"]["usage"]["input"] for e in events), 300)

    def test_second_pass_adds_only_new_events(self):
        self.insert("s1", 1, assistant_event("e1", 100))
        bridge.export(self.state, self.out)
        self.insert("s1", 2, assistant_event("e2", 200))
        _, added, _ = bridge.export(self.state, self.out)
        self.assertEqual(added, 1)
        self.assertEqual(len(self.exported("s1")), 2)

    def test_events_removed_from_store_stay_exported(self):
        # The Index replaces a day's total with what it is sent; if OpenClaw
        # compacts events away, the exported history must not shrink.
        self.insert("s1", 1, assistant_event("e1", 100))
        self.insert("s1", 2, assistant_event("e2", 200))
        bridge.export(self.state, self.out)
        conn = sqlite3.connect(self.db)
        conn.execute("DELETE FROM transcript_events WHERE seq = 1")
        conn.commit()
        conn.close()
        bridge.export(self.state, self.out)
        self.assertEqual([e["id"] for e in self.exported("s1")], ["e1", "e2"])

    def test_unsafe_session_ids_are_skipped(self):
        self.insert("../escape", 1, assistant_event("e1", 100))
        sessions, added, errors = bridge.export(self.state, self.out)
        self.assertEqual((sessions, added), (0, 0))
        self.assertEqual(len(errors), 1)
        self.assertFalse(os.path.exists(os.path.join(self.out, "main", "escape.jsonl")))

    def test_no_store_is_not_an_error(self):
        os.remove(self.db)
        self.assertEqual(bridge.export(self.state, self.out), (0, 0, []))


if __name__ == "__main__":
    unittest.main()
