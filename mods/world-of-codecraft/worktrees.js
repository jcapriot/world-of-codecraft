// A district's git worktrees, for the board: each linked worktree of the repo a space is in, with its
// branch, uncommitted files and unpushed commits. Agents usually work in worktrees from a terminal that
// stays in the main checkout, so this lists the repo's worktrees, not where each agent is.
//
// It runs git (on the space's machine): `rev-parse` to find the repo, `worktree list --porcelain`, then
// `status` in each worktree. Looked at when a space appears, a minute after the last look while the
// window is in front, and right after an agent in that district finishes a turn.

import { exec, panes, spaces, window as appWindow } from "herdr";

const EVERY = 60_000;
const MAX = 15; // worktrees looked at per repo
const SCRATCH = /^(\/private)?\/(tmp|var\/folders)\/|\/scratch(pad|-workspaces)?\//;
const SAFE = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "safe.bareRepository=explicit"];

const base = (p) => p.replace(/\/+$/, "").split("/").pop();

// Where a space is now: its first terminal's live folder, else where it was made.
export function folderOf(sp, ps) {
  const tabs = new Set((sp.tabs ?? []).map((t) => t.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || sp.folder || null;
}

/** `git worktree list --porcelain` → [{ path, branch, detached, prunable }], main checkout first. */
export function parseWorktrees(text) {
  const out = [];
  let cur = null;
  for (const line of String(text ?? "").split("\n")) {
    if (line.startsWith("worktree ")) { cur = { path: line.slice(9), branch: null, detached: false, prunable: false }; out.push(cur); }
    else if (!cur) continue;
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
    else if (line === "detached") cur.detached = true;
    else if (line.startsWith("prunable")) cur.prunable = true;
  }
  return out;
}

/** `git status --porcelain=v2 --branch` → { dirty, ahead, behind }. */
function parseStatus(text) {
  const s = { dirty: 0, ahead: 0, behind: 0 };
  for (const line of String(text ?? "").split("\n")) {
    if (!line) continue;
    if (line.startsWith("# branch.ab ")) {
      const [a, b] = line.slice(12).split(" ");
      s.ahead = Math.abs(parseInt(a, 10)) || 0;
      s.behind = Math.abs(parseInt(b, 10)) || 0;
    } else if (!line.startsWith("# ")) s.dirty++;
  }
  return s;
}

export class Worktrees {
  constructor() {
    this.repoOf = {}; // JSON [machine, folder] -> JSON [machine, common git dir] | null
    this.data = {}; // repo key -> { main, list: [{ path, name, branch, detached, prunable, scratch, dirty, ahead, behind }] }
    this.checked = {}; // repo key or folder key -> last look
    this.due = new Set(); // space ids to look at next
    this.busy = new Set(); // space id -> was an agent working at the last look
    this.running = false;
  }

  start(cx) {
    cx.timer.every(5000, (cx) => this.tick(cx));
    this.tick(cx);
  }

  /** The worktree list for a space, or null (not a repo, not looked at yet). */
  of(sp) {
    const key = this.repoOf[JSON.stringify([sp.machine ?? null, folderOf(sp, panes())])];
    return key ? this.data[key] ?? null : null;
  }

  /** Called on every board render with the agents: a turn that ended makes its district due. */
  watch(list, agents) {
    const now = new Set(agents.filter((a) => a.status === "working").map((a) => a.space));
    for (const id of this.busy) if (!now.has(id)) this.due.add(id);
    this.busy = now;
    for (const sp of list) if (!(JSON.stringify([sp.machine ?? null, folderOf(sp, panes())]) in this.repoOf)) this.due.add(sp.id);
  }

  tick(cx) {
    if (this.running) return;
    const ps = panes();
    const t = Date.now();
    const front = appWindow()?.active === true;
    const todo = [];
    for (const sp of spaces()) {
      const fkey = JSON.stringify([sp.machine ?? null, folderOf(sp, ps)]);
      const rkey = this.repoOf[fkey];
      const stale = front && t - (this.checked[rkey ?? fkey] ?? 0) > EVERY;
      if (this.due.has(sp.id) || !(fkey in this.repoOf) || (rkey !== null && stale)) todo.push(sp);
    }
    this.due.clear();
    if (!todo.length) return;
    this.running = true;
    cx.spawn(async (cx) => {
      const done = new Set();
      for (const sp of todo) {
        try { await this.look(sp, ps, done); } catch {}
      }
      this.running = false;
      cx.notify();
    });
  }

  async look(sp, ps, done) {
    const on = sp.machine ?? undefined;
    const folder = folderOf(sp, ps);
    const fkey = JSON.stringify([sp.machine ?? null, folder]);
    this.checked[fkey] = Date.now();
    if (!folder) { this.repoOf[fkey] = null; return; }
    const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
    if (common.code !== 0) { this.repoOf[fkey] = null; return; }
    const rkey = JSON.stringify([sp.machine ?? null, common.stdout.trim()]);
    this.repoOf[fkey] = rkey;
    if (done.has(rkey)) return; // two districts in one repo: one look
    done.add(rkey);
    this.checked[rkey] = Date.now();
    const wl = await exec("git", ["worktree", "list", "--porcelain"], { cwd: folder, on });
    if (wl.code !== 0) return;
    const [main, ...linked] = parseWorktrees(wl.stdout);
    const list = [];
    for (const w of linked.slice(0, MAX)) {
      const item = { ...w, name: base(w.path), scratch: SCRATCH.test(w.path), dirty: 0, ahead: 0, behind: 0 };
      if (!w.prunable) {
        const st = await exec("git", [...SAFE, "status", "--porcelain=v2", "--branch"], { cwd: w.path, on }).catch(() => null);
        if (st?.code === 0) Object.assign(item, parseStatus(st.stdout));
        else item.prunable = true; // its folder is gone
      }
      list.push(item);
    }
    this.data[rkey] = { main: main?.path ?? null, list, more: Math.max(0, linked.length - MAX) };
  }
}
