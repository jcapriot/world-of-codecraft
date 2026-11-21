#!/usr/bin/env python3
"""Claude Code status line: show this account's session (5-hour) and weekly usage, and save it
for World of Codecraft's Gold plaque and Fair countdown.

Claude Code runs this after each turn with the session's JSON on stdin, including
`rate_limits.five_hour` and `rate_limits.seven_day` (`used_percentage`, `resets_at` in epoch
seconds). It writes {"at": now, "rate_limits": ...} to ~/.local/state/claude-duo/quota-A.json,
the file the theme already reads, and prints one short line.

settings.json: "statusLine": {"type": "command", "command": "python3 ~/.claude/wocc-statusline.py"}
"""
import json
import os
import sys
import time

try:
    data = json.load(sys.stdin)
except Exception:
    data = {}

limits = data.get("rate_limits") or {}
if limits:
    path = os.path.expanduser("~/.local/state/claude-duo/quota-A.json")
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = "%s.%d" % (path, os.getpid())
        with open(tmp, "w") as f:
            json.dump({"at": int(time.time()), "rate_limits": limits}, f)
        os.replace(tmp, path)
    except Exception:
        pass


def part(label, key):
    w = limits.get(key) or {}
    pct = w.get("used_percentage")
    if not isinstance(pct, (int, float)):
        return None
    out = "%s %d%%" % (label, round(pct))
    reset = w.get("resets_at")
    if isinstance(reset, (int, float)):
        left = max(0, reset - time.time())
        h, m = int(left // 3600), int(left % 3600 // 60)
        out += " (%s)" % ("%dd %dh" % (h // 24, h % 24) if h >= 48 else "%dh %02dm" % (h, m) if h else "%dm" % m)
    return out


model = (data.get("model") or {}).get("display_name")
bits = [b for b in (model, part("session", "five_hour"), part("week", "seven_day")) if b]
print(" · ".join(bits))
