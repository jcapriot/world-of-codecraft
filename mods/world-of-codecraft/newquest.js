// The new-quest menu: what a new quest (tab) starts with, like the + menu in Herdr's own layout.
// Opened as a popup from the board's "Quest" button with props { role: "newquest", space, overlay }.
// A plain terminal, or any agent Herdr knows how to start (programs.json's `run`), installed ones
// first and numbered 1-9. ↑/↓ move, Enter or a digit starts, Esc closes.

import { div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, run, props, closeOverlay, knownAgents, shared, setShared } from "herdr";
import { t } from "./i18n.js";
import { P, title, txt, well } from "./ui.js";

// The last agents each machine reported (shared with Herdr's own menu), shown while we ask again.
const KNOWN = "new-menu.agents";
const ROW = 28;

// n: installed agents, null when not known yet (room for a few, the list scrolls).
export const newQuestSize = (n) => ({ width: 240, height: Math.min(440, 130 + Math.max(2, n ?? 6) * ROW) });

/** Ask a machine which agents it has, ahead of the menu, so the menu opens at the right size. */
export async function prefetchAgents(machine) {
  const where = machine ?? "";
  try {
    const list = await knownAgents({ on: machine ?? undefined });
    setShared(KNOWN, { ...(shared(KNOWN) ?? {}), [where]: list });
  } catch {}
}

/** Installed agents for a machine from the cache, or null if never asked. */
export function cachedInstalled(machine) {
  const list = (shared(KNOWN) ?? {})[machine ?? ""];
  return list ? list.filter((a) => a.installed).length : null;
}

export class NewQuest {
  init(_props, cx) {
    this.at = 0;
    const machine = this.space()?.machine ?? null;
    const where = machine ?? "";
    this.agents = shared(KNOWN)?.[where] ?? [];
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      try {
        this.agents = await knownAgents({ on: machine ?? undefined });
        setShared(KNOWN, { ...(shared(KNOWN) ?? {}), [where]: this.agents });
      } catch { this.failed = true; }
      cx.notify();
    });
  }

  space() {
    const id = props()?.space;
    return spaces().find((s) => s.id === id) ?? spaces().find((s) => s.active);
  }

  items() {
    const space = this.space()?.id;
    const shell = { key: "terminal", label: t("nqTerminal"), icon: "icons/shell.svg", tint: true, args: { space } };
    const ready = this.agents.filter((a) => a.installed).map((a) => ({
      key: a.key, label: a.name, icon: a.icon, tint: a.tint, args: { space, name: a.name, argv: a.run },
    }));
    return [shell, ...ready];
  }

  choose(it) {
    if (!it) return;
    closeOverlay(props()?.overlay);
    run("tab.new", it.args);
  }

  icon(it, color) {
    if (!it.icon) return div().w(14).flex_none();
    return (it.tint ? svg(it.icon).text_color(color) : image(it.icon)).size(14).flex_none();
  }

  row(it, i, agentIndex) {
    const on = i === this.at;
    const color = on ? P.goldHi : P.cream;
    const hint = agentIndex >= 1 && agentIndex <= 9 ? String(agentIndex) : "";
    return h_flex().id(`nq-${it.key}`).h(ROW).px(10).gap(9).items_center().rounded(2).cursor_pointer()
      .bg(on ? "#ffffff12" : "#00000000")
      .hover((s) => s.bg("#ffffff12"))
      .on_hover((over, cx) => { if (over && this.at !== i) { this.at = i; cx.notify(); } })
      .on_click(() => this.choose(it))
      .child(this.icon(it, color))
      .child(txt(it.label, 15, color, 700).flex_1().min_w(0).truncate())
      .child(txt(hint, 13, P.dim, 700).flex_none());
  }

  render(_cx) {
    const list = this.items();
    if (this.at >= list.length) this.at = Math.max(0, list.length - 1);
    const [shell, ...agents] = list;
    const note = this.failed ? t("nqFailed") : this.agents.length === 0 ? t("nqChecking") : agents.length === 0 ? t("nqNone") : null;
    // one scrolling column: if the popup is short, it scrolls rather than squeezing the agents out
    return well(v_flex().id("newquest").track_focus(this.handle).size_full().overflow_y_scrollbar().p(6).gap(2),
      { bg: P.night, lit: P.bronze })
      .on_key_down((e, cx) => {
        if (e.modifiers?.control || e.modifiers?.platform || e.modifiers?.alt) return;
        if (/^[1-9]$/.test(e.key)) return this.choose(agents[Number(e.key) - 1]);
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") return this.choose(list[this.at]);
        else if (e.key === "escape") return closeOverlay(props()?.overlay);
        else return;
        cx.notify();
      })
      .child(div().px(10).pt(2).pb(4).child(title(t("nqTitle"), 15)))
      .child(div().mx(8).mb(2).h(1).flex_none().bg(P.bronze))
      .child(this.row(shell, 0, 0))
      .child(div().px(10).pt(6).pb(2).child(txt(t("nqAgents"), 13, P.muted, 800)))
      .children(agents.map((a, i) => this.row(a, i + 1, i + 1)))
      .when(Boolean(note), (e) => e.child(div().px(10).py(4).child(txt(note, 14, P.dim, 700))));
  }
}
