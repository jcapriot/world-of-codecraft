// Past quests: a district's earlier Claude Code sessions, for the board. Like the session list in
// VS Code: newest first, click one to resume it as a new quest (`claude --resume <id>` in a new tab),
// archive the ones you're done with (kept per screen, in this mod's localStorage).
//
// Claude Code keeps each session as ~/.claude/projects/<folder, non-alphanumerics as "-">/<id>.jsonl,
// and each running one in ~/.claude/sessions/<pid>.json. A small Python script (run with `exec`, on the
// space's machine) lists the logs for the district's folders, reads each one's title (the last
// custom or AI title, else its first prompt), and leaves out sessions that are running now. It caches
// what it read in ~/.cache/wocc-past-quests.json, keyed by size and modified time, so a look only
// reads logs that changed.

import { exec, panes } from "herdr";
import { folderOf } from "./worktrees.js";

const EVERY = 120_000; // a look at most this often per district, and only while its list is open

const SCRIPT = String.raw`
import json, os, re, sys, time
root = os.path.expanduser("~/.claude")
cache_path = os.path.expanduser("~/.cache/wocc-past-quests.json")
try:
    with open(cache_path) as f: cache = json.load(f)
except Exception:
    cache = {}
live = set()
try:
    for n in os.listdir(os.path.join(root, "sessions")):
        if not n.endswith(".json"): continue
        try:
            with open(os.path.join(root, "sessions", n)) as f: d = json.load(f)
            os.kill(int(d.get("pid") or n[:-5]), 0)
            if d.get("sessionId"): live.add(d["sessionId"])
        except Exception:
            pass
except Exception:
    pass

def text_of(c):
    if isinstance(c, str): return c
    if isinstance(c, list): return " ".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")
    return ""

def scan(p):
    title = custom = prompt = cwd = None
    turns = 0
    with open(p, "rb") as f:
        for line in f:
            if b'"type":"user"' in line and b'"tool_result"' not in line:
                try: d = json.loads(line)
                except Exception: continue
                if d.get("isMeta") or d.get("isSidechain"): continue
                t = text_of(d.get("message", {}).get("content")).strip()
                if not t or t.startswith("<") or t.startswith("Caveat:"): continue
                turns += 1
                if prompt is None: prompt = " ".join(t.split())[:300]
                if cwd is None: cwd = d.get("cwd")
            elif b'-title"' in line:
                try: d = json.loads(line)
                except Exception: continue
                if d.get("type") == "custom-title": custom = d.get("customTitle") or custom
                elif d.get("type") == "ai-title": title = d.get("aiTitle") or title
            elif cwd is None and b'"cwd":"' in line:
                m = re.search(rb'"cwd":"((?:[^"\\]|\\.)*)"', line)
                if m:
                    try: cwd = json.loads(b'"' + m.group(1) + b'"')
                    except Exception: pass
    return {"title": custom or title, "prompt": prompt, "cwd": cwd, "turns": turns}

out, keep = {}, {}
for folder in sys.argv[1:]:
    d = os.path.join(root, "projects", re.sub(r"[^A-Za-z0-9]", "-", folder))
    items = []
    try: names = os.listdir(d)
    except Exception: names = []
    for n in names:
        if not n.endswith(".jsonl"): continue
        p = os.path.join(d, n)
        try: st = os.stat(p)
        except Exception: continue
        key = "%d|%d" % (st.st_size, int(st.st_mtime))
        c = cache.get(p)
        if not c or c.get("k") != key:
            try: c = dict(scan(p), k=key)
            except Exception: continue
        keep[p] = c
        sid = n[:-6]
        if not c.get("turns") or sid in live: continue
        items.append({"id": sid, "title": c.get("title"), "prompt": c.get("prompt"), "cwd": c.get("cwd") or folder,
                      "folder": folder, "mtime": int(st.st_mtime), "turns": c.get("turns")})
    out[folder] = items
try:
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    tmp = cache_path + ".%d" % os.getpid()
    with open(tmp, "w") as f: json.dump(keep, f)
    os.replace(tmp, cache_path)
except Exception:
    pass
print(json.dumps(out))
`;

/** A district's folders: where it lives now, where it was made, and its repo's worktrees. */
function foldersOf(sp, trees) {
  const set = new Set([folderOf(sp, panes()), sp.folder].filter(Boolean));
  for (const w of trees?.list ?? []) if (!w.prunable) set.add(w.path);
  if (trees?.main) set.add(trees.main);
  return [...set];
}

export class PastQuests {
  constructor() {
    this.data = {}; // space id -> { list, at, error }
    this.busy = new Set();
    this.archived = new Set();
    try { this.archived = new Set(JSON.parse(localStorage.getItem("past.archived") ?? "[]")); } catch {}
  }

  /** The space's past sessions (newest first), or null before the first look. */
  of(sp) { return this.data[sp.id] ?? null; }

  isArchived(id) { return this.archived.has(id); }

  setArchived(id, on) {
    on ? this.archived.add(id) : this.archived.delete(id);
    try { localStorage.setItem("past.archived", JSON.stringify([...this.archived])); } catch {}
  }

  /** Look again if the list is old (or `force`). Called while the district's list is open. */
  want(sp, trees, cx, force = false) {
    const d = this.data[sp.id];
    if (this.busy.has(sp.id) || (!force && d && Date.now() - d.at < EVERY)) return;
    const folders = foldersOf(sp, trees);
    if (!folders.length) return;
    this.busy.add(sp.id);
    cx.spawn(async (cx) => {
      try {
        const r = await exec("python3", ["-c", SCRIPT, ...folders], { on: sp.machine ?? undefined, timeout: 60_000 });
        if (r.code !== 0) throw new Error(r.stderr || `exit ${r.code}`);
        const byFolder = JSON.parse(r.stdout);
        const seen = new Set();
        const list = Object.values(byFolder).flat().filter((x) => !seen.has(x.id) && seen.add(x.id));
        list.sort((a, b) => b.mtime - a.mtime);
        this.data[sp.id] = { list, at: Date.now() };
      } catch (e) {
        this.data[sp.id] = { list: this.data[sp.id]?.list ?? [], at: Date.now(), error: String(e?.message ?? e).slice(0, 200) };
      }
      this.busy.delete(sp.id);
      cx.notify();
    });
  }

  /** Forget a district's list so the next look is fresh (after resuming one, say). */
  stale(sp) { if (this.data[sp.id]) this.data[sp.id].at = 0; }
}

/** "3m", "5h", "2d", "Nov 3": how long ago a session was last touched. */
export function ago(secs) {
  const s = Math.max(0, Date.now() / 1000 - secs);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 86400 * 14) return `${Math.round(s / 86400)}d`;
  return new Date(secs * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
