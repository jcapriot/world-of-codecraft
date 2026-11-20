// The quest menu: right-click a quest (tab) on the board. Opened as a popup with
// props { role: "questmenu", tab, space, overlay }. Rename, reset the name, move it up or
// down the board, mark it completed (settled: tucked under "Completed quests", still running)
// or bring it back, close it (a second click confirms: closing ends the quest's terminals).
// ↑/↓ move, Enter runs, Esc closes.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, run, props, closeOverlay } from "herdr";
import { clip } from "./kit.js";
import { t } from "./i18n.js";
import { P, title, txt, well } from "./ui.js";

export const QUEST_MENU = { width: 220, height: 262 };

export class QuestMenu {
  init(_props, cx) {
    this.at = 0;
    this.arm = false; // "Close" was clicked once
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  // The tab, live: it may have been renamed, moved or closed since the menu opened.
  where() {
    const p = props() ?? {};
    const sp = spaces().find((s) => s.id === p.space);
    const tab = (sp?.tabs ?? []).find((x) => x.id === p.tab);
    const tabs = (sp?.tabs ?? []).filter((x) => !x.settled);
    const i = tabs.findIndex((x) => x.id === p.tab);
    return { sp, tab, first: i <= 0, last: i === tabs.length - 1 || i < 0 };
  }

  items() {
    const { tab, first, last } = this.where();
    if (!tab) return [];
    const id = tab.id;
    return [
      { key: "rename", label: t("qmRename"), cmd: "tab.rename", args: { id } },
      ...(tab.named ? [{ key: "reset", label: t("qmReset"), cmd: "tab.rename", args: { id, name: "" } }] : []),
      ...(!first ? [{ key: "up", label: t("qmUp"), cmd: "tab.move", args: { id, by: -1 } }] : []),
      ...(!last ? [{ key: "down", label: t("qmDown"), cmd: "tab.move", args: { id, by: 1 } }] : []),
      tab.settled
        ? { key: "resume", label: t("qmResume"), cmd: "tab.unsettle", args: { id } }
        : { key: "complete", label: t("qmComplete"), cmd: "tab.settle", args: { id } },
      { key: "close", label: this.arm ? t("qmCloseSure") : t("qmClose"), cmd: "tab.close", args: { id }, danger: true },
    ];
  }

  choose(it, cx) {
    if (!it) return;
    if (it.danger && !this.arm) { this.arm = true; cx.notify(); return; }
    closeOverlay(props()?.overlay);
    run(it.cmd, it.args);
  }

  row(it, i, cx) {
    const on = i === this.at;
    const color = it.danger ? (this.arm ? "#ffd8cc" : P.blocked) : on ? P.goldHi : P.cream;
    return h_flex().id(`qm-${it.key}`).h(28).px(10).items_center().rounded(2).cursor_pointer()
      .bg(it.danger && this.arm ? "#3a1216" : on ? "#ffffff12" : "#00000000")
      .hover((s) => s.bg(it.danger ? "#3a1216" : "#ffffff12"))
      .on_hover((over, cx) => { if (over && this.at !== i) { this.at = i; cx.notify(); } })
      .on_click((_e, cx) => this.choose(it, cx))
      .child(txt(it.label, 15, color, 700));
  }

  render(cx) {
    const list = this.items();
    if (this.at >= list.length) this.at = Math.max(0, list.length - 1);
    const { tab } = this.where();
    const name = tab ? (tab.named ? tab.name : t("questN", tab.index)) : "";
    return well(v_flex().id("questmenu").track_focus(this.handle).size_full().p(6).gap(2),
      { bg: P.night, lit: P.bronze })
      .on_key_down((e, cx) => {
        if (!list.length) return;
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") return this.choose(list[this.at], cx);
        else if (e.key === "escape") return closeOverlay(props()?.overlay);
        else return;
        cx.notify();
      })
      .child(div().px(10).pt(2).pb(4).child(title(clip(name, 24), 15)))
      .child(div().mx(8).mb(2).h(1).flex_none().bg(P.bronze))
      .children(list.length ? list.map((it, i) => this.row(it, i, cx)) : [div().px(10).child(txt(t("qmGone"), 14, P.dim, 700))]);
  }
}
