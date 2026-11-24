// Side quests: the sub-agents a quest's heroes sent out, listed under the quest on the board.
//
// Two kinds:
// - Claude Code's own sub-agents (its Agent/Task tool). They run inside the claude process, and
//   Claude keeps each one as ~/.claude/projects/<folder>/<session>/subagents/agent-<id>.jsonl, with
//   a .meta.json (agentType, description). A running claude is in ~/.claude/sessions/<pid>.json, and
//   its environment has HC_TERMINAL_ID, the Herdr terminal it runs in: that ties a session to a hero.
//   A small Python script (run with `exec`, on each machine with districts) reads all of this.
//   A sub-agent is done when its meta says finished (or its log ends on a final answer), working while the log is
//   still being written, else stopped (interrupted).
// - Herdr's sub-agents: terminals an agent started with `hc run`, whose `parent` is the hero.

import { exec, terminals, checking } from "herdr";

const FRESH = 120; // s: a log written this recently, without a final answer, is still working
const EVERY = 4000; // ms between looks while any side quest is working
const IDLE_EVERY = 15000; // ...and when none is

const SCRIPT = String.raw`
import glob, json, os, re, subprocess, time
root = os.path.expanduser("~/.claude")
now = time.time()
out = {}

def terminal_of(pid):
    try:
        with open("/proc/%d/environ" % pid, "rb") as f:
            for kv in f.read().split(b"\0"):
                if kv.startswith(b"HC_TERMINAL_ID="): return kv.split(b"=", 1)[1].decode()
        return None
    except Exception:
        pass
    try:
        o = subprocess.run(["ps", "-E", "-ww", "-o", "command=", "-p", str(pid)], capture_output=True, text=True, timeout=5).stdout
        m = re.search(r"(?:^|\s)HC_TERMINAL_ID=(\S+)", o)
        return m.group(1) if m else None
    except Exception:
        return None

def iso(s):
    try: return time.mktime(time.strptime(s[:19], "%Y-%m-%dT%H:%M:%S")) - time.timezone
    except Exception: return None

def last_line(p):
    with open(p, "rb") as f:
        f.seek(0, 2); n = f.tell(); f.seek(max(0, n - 262144))
        lines = [l for l in f.read().split(b"\n") if l.strip()]
    return lines[-1] if lines else b""

def first_line(p):
    with open(p, "rb") as f: return f.readline()

try: names = os.listdir(os.path.join(root, "sessions"))
except Exception: names = []
for n in names:
    if not n.endswith(".json"): continue
    try:
        with open(os.path.join(root, "sessions", n)) as f: d = json.load(f)
        pid = int(d.get("pid") or n[:-5]); os.kill(pid, 0)
    except Exception:
        continue
    sid = d.get("sessionId")
    term = sid and terminal_of(pid)
    if not term: continue
    dirs = glob.glob(os.path.join(root, "projects", "*", sid, "subagents"))
    side = []
    for sd in dirs:
        for p in glob.glob(os.path.join(sd, "agent-*.jsonl")):
            try:
                st = os.stat(p)
                meta = {}
                try:
                    with open(p[:-6] + ".meta.json") as f: meta = json.load(f)
                except Exception: pass
                first = json.loads(first_line(p) or b"{}")
                last = json.loads(last_line(p) or b"{}")
                m = last.get("message") or {}
                if meta.get("finished") or (last.get("type") == "assistant" and m.get("stop_reason") == "end_turn"): state = "done"
                elif now - st.st_mtime < ${FRESH}: state = "working"
                else: state = "stopped"
                prompt = (first.get("message") or {}).get("content")
                if isinstance(prompt, list): prompt = " ".join(x.get("text", "") for x in prompt if isinstance(x, dict))
                side.append({"id": os.path.basename(p)[6:-6], "type": meta.get("agentType") or "agent",
                             "desc": meta.get("description") or "", "depth": meta.get("spawnDepth") or 1,
                             "prompt": " ".join(str(prompt or "").split())[:240], "state": state,
                             "start": iso(first.get("timestamp") or "") or st.st_mtime, "end": int(st.st_mtime)})
            except Exception:
                continue
    side.sort(key=lambda x: x["start"], reverse=True)
    out[term] = {"session": sid, "side": side[:40]}
print(json.dumps(out))
`;

export class SideQuests {
  constructor() {
    this.byTerminal = {}; // address (machine/tN for another machine) -> { session, side: [...] }
    this.busy = false;
    this.at = 0;
  }

  /** Look again when due. `machines`: the machines with districts (null: this computer). */
  tick(machines, cx) {
    if (this.busy || checking()) return;
    const working = Object.values(this.byTerminal).some((x) => x.side.some((s) => s.state === "working"));
    if (Date.now() - this.at < (working ? EVERY : IDLE_EVERY)) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      const next = {};
      for (const m of machines) {
        try {
          const r = await exec("python3", ["-c", SCRIPT], { on: m ?? undefined, timeout: 20_000 });
          if (r.code !== 0) continue;
          for (const [term, v] of Object.entries(JSON.parse(r.stdout))) next[m ? `${m}/${term}` : term] = v;
        } catch {}
      }
      const changed = JSON.stringify(next) !== JSON.stringify(this.byTerminal);
      this.byTerminal = next;
      this.at = Date.now();
      this.busy = false;
      if (changed) cx.notify();
    });
  }

  /** A quest's side quests, newest first: Claude sub-agents of its heroes and terminals they started. */
  of(heroes) {
    const out = [];
    const mine = new Set(heroes.map((a) => a.address));
    for (const a of heroes) {
      for (const s of this.byTerminal[a.address]?.side ?? []) out.push({ ...s, kind: "claude", hero: a.address });
    }
    for (const x of terminals()) {
      if (!x.parent || !mine.has(x.parent) || x.state === "gone") continue;
      const st = x.status === "working" || x.status === "blocked" ? x.status : x.state === "live" ? "idle" : "stopped";
      out.push({ id: x.address, kind: "herdr", type: x.program?.name ?? x.name ?? "terminal", desc: x.name || x.title || x.address,
        state: st, start: null, end: null, depth: 1, hero: x.parent, address: x.address });
    }
    return out.sort((a, b) => (b.start ?? Infinity) - (a.start ?? Infinity));
  }
}

/** "4m", "1h 5m": how long a side quest has run (or ran). */
export function span(secs) {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
}
