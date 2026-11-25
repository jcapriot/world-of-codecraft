// The chronicle: a side quest's transcript (a Claude Code sub-agent's log), opened by clicking it on
// the board. Props { role: "chronicle", path, machine, title, type, overlay }.
// The orders it was given, what it said, and its tool calls as one line each (with the first line
// of what came back). While the sub-agent is still working it reads the log again every few seconds
// and follows the end.

import { div } from "gpui-kit";
import { h_flex, v_flex, ScrollHandle } from "gpui-base";
import { props, closeOverlay, exec, checking } from "herdr";
import { t } from "./i18n.js";
import { P, title, txt, button, well } from "./ui.js";

const MONO = "JetBrains Mono";

const SCRIPT = String.raw`
import json, os, sys
p = sys.argv[1]
out = []

def text_of(c):
    if isinstance(c, str): return c
    if isinstance(c, list):
        return "\n".join(x.get("text", "") for x in c if isinstance(x, dict) and x.get("type") == "text")
    return ""

def brief(name, i):
    if not isinstance(i, dict): return ""
    for k in ("command", "file_path", "path", "pattern", "url", "query", "description", "prompt", "skill"):
        v = i.get(k)
        if isinstance(v, str) and v.strip(): return " ".join(v.split())[:300]
    return " ".join(json.dumps(i)[:300].split())

with open(p, "rb") as f:
    for line in f:
        try: d = json.loads(line)
        except Exception: continue
        kind, m = d.get("type"), d.get("message") or {}
        c = m.get("content")
        if kind == "user" and not d.get("isMeta"):
            if isinstance(c, list):
                for x in c:
                    if not isinstance(x, dict): continue
                    if x.get("type") == "tool_result":
                        r = text_of(x.get("content")).strip()
                        out.append({"k": "result", "text": r[:400], "error": bool(x.get("is_error"))})
                    elif x.get("type") == "text" and x.get("text", "").strip():
                        out.append({"k": "prompt" if not out else "user", "text": x["text"][:6000]})
            elif isinstance(c, str) and c.strip():
                out.append({"k": "prompt" if not out else "user", "text": c[:6000]})
        elif kind == "assistant" and isinstance(c, list):
            for x in c:
                if not isinstance(x, dict): continue
                if x.get("type") == "text" and x.get("text", "").strip():
                    out.append({"k": "say", "text": x["text"][:6000]})
                elif x.get("type") == "tool_use":
                    out.append({"k": "tool", "name": x.get("name") or "tool", "text": brief(x.get("name"), x.get("input"))})
finished, meta = False, {}
try:
    with open(p[:-6] + ".meta.json") as f: meta = json.load(f)
    finished = bool(meta.get("finished"))
except Exception: pass

# The final report isn't in the sub-agent's log: Claude hands it back to the parent session, as an
# <agent-message> (background agents) or as the Agent tool's result (foreground ones).
aid = os.path.basename(p)[6:-6]
parent = os.path.dirname(os.path.dirname(p)) + ".jsonl"
tu = meta.get("toolUseId") or ""
report = None
try:
    keys = [('agent-message from=\\"%s\\"' % aid).encode()] + ([tu.encode()] if tu else [])
    with open(parent, "rb") as f:
        for line in f:
            if b'"type":"user"' not in line or not any(k in line for k in keys): continue
            try: d = json.loads(line)
            except Exception: continue
            c = (d.get("message") or {}).get("content")
            if isinstance(c, str) and ('<agent-message from="%s">' % aid) in c:
                body = c.split('<agent-message from="%s">' % aid, 1)[1].split("</agent-message>", 1)[0]
                if "The report follows:" in body: body = body.split("The report follows:", 1)[1]
                report = "\n".join(l[2:] if l.startswith("  ") else l for l in body.strip("\n").split("\n"))
            elif isinstance(c, list):
                for x in c:
                    if isinstance(x, dict) and x.get("type") == "tool_result" and x.get("tool_use_id") == tu:
                        r = text_of(x.get("content")).strip()
                        if r and not r.startswith("Async agent launched"): report = r
except Exception:
    pass
if report:
    out.append({"k": "report", "text": report[:20000]})
    finished = True
if len(out) > 400: out = out[:1] + [{"k": "gap", "text": str(len(out) - 400)}] + out[-399:]
print(json.dumps({"entries": out, "finished": finished, "mtime": os.path.getmtime(p)}))
`;

export class Chronicle {
  init(_props, cx) {
    this.entries = null;
    this.error = null;
    this.scroll = ScrollHandle.new();
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.load(cx);
    // while the sub-agent works, follow its log
    cx.timer.every(3000, () => { if (!this.finished && !this.busy) this.load(cx); });
  }

  load(cx) {
    const p = props() ?? {};
    if (!p.path || checking()) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const r = await exec("python3", ["-c", SCRIPT, p.path], { on: p.machine ?? undefined, timeout: 20_000 });
        if (r.code !== 0) throw new Error((r.stderr || `exit ${r.code}`).trim().split("\n").pop());
        const d = JSON.parse(r.stdout);
        const grew = !this.entries || d.entries.length !== this.entries.length;
        this.entries = d.entries;
        this.finished = d.finished || Date.now() / 1000 - d.mtime > 600;
        this.error = null;
        if (grew) this.scroll.scroll_to_item(Math.max(0, this.entries.length - 1));
      } catch (e) {
        this.error = String(e?.message ?? e).slice(0, 300);
        this.finished = true;
      }
      this.busy = false;
      cx.notify();
    });
  }

  lines(text, size, color, mono = false) {
    return v_flex().gap(1).min_w(0).children(String(text).split("\n").slice(0, 400).map((l) =>
      l.trim() ? div().min_w(0).text_size(size).text_color(color).when(mono, (e) => e.font_family(MONO)).child(l) : div().h(6)));
  }

  entry(x, i) {
    switch (x.k) {
      case "prompt":
        return well(v_flex().p(8).gap(4).min_w(0), { bg: P.parch, lit: P.goldLo })
          .child(txt(t("chronOrders"), 12, P.inkSoft, 800))
          .child(this.lines(x.text, 13, P.ink2));
      case "user":
        return v_flex().pl(8).border_l_2().border_color(P.goldLo).min_w(0).child(this.lines(x.text, 13, P.muted));
      case "report":
        return well(v_flex().p(8).gap(4).min_w(0), { bg: P.enamel, lit: P.gold })
          .child(txt(t("chronReport"), 12, P.gold, 800))
          .child(this.lines(x.text, 14, P.cream));
      case "say":
        return div().min_w(0).child(this.lines(x.text, 14, P.cream));
      case "tool":
        return h_flex().id(`chron-${i}`).gap(6).min_w(0).items_center()
          .child(txt("⚒", 12, P.bronze, 700).flex_none())
          .child(txt(x.name, 12, P.goldLo, 800).flex_none())
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(P.dim).font_family(MONO).child(x.text || ""));
      case "result": {
        const first = (x.text || "").split("\n").find((l) => l.trim()) ?? "";
        if (!first && !x.error) return div().h(0);
        return div().pl(18).min_w(0).truncate().text_size(11).text_color(x.error ? P.blocked : P.faint).font_family(MONO).child(first || t("chronError"));
      }
      case "gap":
        return txt(t("chronGap", Number(x.text)), 12, P.faint, 700);
      default:
        return div();
    }
  }

  render() {
    const p = props() ?? {};
    const where = (p.machine ? `${p.machine}:` : "") + (p.path ?? "");
    const body = this.error ? [txt(this.error, 13, P.blocked, 700)]
      : this.entries === null ? [txt(t("chronLoading"), 13, P.dim, 700)]
      : this.entries.map((x, i) => this.entry(x, i));
    return well(v_flex().id("chronicle").track_focus(this.handle).size_full().p(8).gap(6), { bg: P.night, lit: P.bronze })
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .child(h_flex().gap(8).items_center().flex_none()
        .child(v_flex().flex_1().min_w(0)
          .child(title(p.title || t("chronTitle"), 15).truncate())
          .child(txt(`${p.type ?? ""}${this.finished === false ? ` · ${t("sideState").working}` : ""}`, 12, this.finished === false ? P.working : P.dim, 700)))
        .child(button("chron-close", txt(t("picClose"), 13, P.cream, 800), () => closeOverlay(p.overlay))))
      .child(div().flex_none().text_size(11).text_color(P.faint).truncate().child(where))
      .child(v_flex().id("chron-list").track_scroll(this.scroll).flex_1().min_h(0).overflow_y_scrollbar()
        .px(6).py(6).gap(6).rounded(2).bg(P.ink)
        .children(body));
  }
}
