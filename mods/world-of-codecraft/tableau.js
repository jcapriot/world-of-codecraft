// The board (left column): every district (space) of the village at a glance, in a carved
// oak frame with gold corners. Each district is a small iron-framed card (gold when shown,
// red lacquer when a hero needs you) with, without clicking: its banner and name, how many
// sessions (terminals) and heroes (agents) it holds, a count per state (gems: on a quest /
// help / to turn in / resting), then each of its quests (tabs) on one line with its state and
// the portraits of its heroes. Text always sits on flat enamel or parchment, never on texture.
// Click a district: go there; a quest line: show that quest.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, agents, run, props, openOverlay, checking, shared } from "herdr";
import { Worktrees } from "./worktrees.js";
import { PastQuests, ago } from "./pastquests.js";
import { SideQuests, span } from "./sidequests.js";
import { QUEST_MENU } from "./questmenu.js";
import { newQuestSize, prefetchAgents, cachedInstalled } from "./newquest.js";
import { district, clip, heroOf } from "./kit.js";
import { gradient } from "./kit.js";
import { t } from "./i18n.js";
import { DEMO_SPACES, DEMO_AGENTS } from "./demo.js";
import { P, TITRE, frame, frameT, bar, pic, txt, title, button, gem, mark, banner, portrait, well } from "./ui.js";

const ORDER = ["blocked", "done", "working", "idle"];
const COLOR = { blocked: P.blocked, done: P.done, working: P.working, idle: P.idle };
const STATE = new Proxy({}, { get: (_o, k) => ({ mot: t("board")[k], color: COLOR[k] }) });

export default class Tableau {
  init(_props, cx) {
    this.wt = new Worktrees();
    this.folded = new Set();
    try { this.folded = new Set(JSON.parse(localStorage.getItem("worktrees.folded") ?? "[]")); } catch {}
    this.past = new PastQuests();
    this.pastOpen = new Set(); // districts whose past quests are unfolded
    this.pastAll = new Set(); // ...showing every one, not just the newest
    this.pastArch = new Set(); // ...with their archived ones unfolded
    try { this.pastOpen = new Set(JSON.parse(localStorage.getItem("past.open") ?? "[]")); } catch {}
    this.done = new Set(); // districts whose completed quests are unfolded
    try { this.done = new Set(JSON.parse(localStorage.getItem("completed.open") ?? "[]")); } catch {}
    this.shut = new Set(); // districts folded down to their head
    try { this.shut = new Set(JSON.parse(localStorage.getItem("districts.shut") ?? "[]")); } catch {}
    this.side = new SideQuests();
    this.sideAll = new Set(); // quests whose older side quests are shown too
    this.drag = null; // district being dragged by its head (to reorder), and the one it's over
    this.over = null;
    if (!props()?.demo && !checking()) {
      this.wt.start(cx);
      cx.timer.every(2000, () => this.side.tick([...new Set(spaces().map((s) => s.machine ?? null))], cx));
      cx.spawn(async () => { for (const m of new Set([null, ...spaces().map((s) => s.machine ?? null)])) await prefetchAgents(m); });
    }
  }

  // The district's worktrees: a fold-out list under its quests. Click one: a new quest (shell) there.
  worktrees(sp) {
    const w = this.wt?.of(sp);
    if (!w || !w.list.length) return null;
    const open = !this.folded.has(sp.id);
    const head = h_flex().id(`arbres-${sp.id}`).h(22).px(5).gap(5).items_center().cursor_pointer().rounded(2)
      .hover((s) => s.bg("#ffffff10"))
      .tooltip(t("worktreesTip"))
      .on_click((_e, cx) => {
        open ? this.folded.add(sp.id) : this.folded.delete(sp.id);
        try { localStorage.setItem("worktrees.folded", JSON.stringify([...this.folded])); } catch {}
        cx.notify();
      })
      .child(txt(open ? "▾" : "▸", 12, P.dim, 700).w(10).flex_none())
      .child(txt(t("worktrees", w.list.length + w.more), 13, P.muted, 800).flex_1());
    const row = (x) => {
      const fg = x.prunable ? P.faint : x.scratch ? P.dim : P.parch;
      return h_flex().id(`arbre-${sp.id}-${x.path}`).h(22).pl(17).pr(4).gap(5).items_center().rounded(2).cursor_pointer()
        .hover((s) => s.bg("#ffffff10"))
        .tooltip(t("worktreeTip", x.path, x.branch ?? (x.detached ? t("detached") : "?"), x.scratch, x.prunable))
        .on_click(() => { if (!x.prunable) run("tab.new", { space: sp.id, folder: x.path, name: x.name }); })
        .child(txt("⎇", 12, x.scratch ? P.faint : P.goldLo, 700).flex_none())
        .child(txt(x.branch ?? (x.detached ? t("detached") : x.name), 13, fg, 700).flex_1().min_w(0).truncate())
        .when(x.dirty > 0, (e) => e.child(txt(`●${x.dirty}`, 12, P.done, 800).flex_none().tooltip(t("wtDirty", x.dirty))))
        .when(x.ahead > 0, (e) => e.child(txt(`↑${x.ahead}`, 12, P.working, 800).flex_none().tooltip(t("wtAhead", x.ahead))))
        .when(x.prunable, (e) => e.child(txt(t("wtGone"), 12, P.faint, 700).flex_none()));
    };
    return v_flex().gap(0).pt(2).child(head).when(open, (e) => e.children(w.list.map(row))
      .when(w.more > 0, (e) => e.child(txt(t("wtMore", w.more), 12, P.dim, 700).pl(17))));
  }

  // Completed quests (settled tabs): folded by default under the open ones. Click one: resume it.
  completed(sp, all) {
    const done = sp.tabs.filter((x) => x.settled && !x.active);
    if (!done.length) return null;
    const open = this.done.has(sp.id);
    const head = h_flex().id(`accomplies-${sp.id}`).h(22).px(5).gap(5).items_center().cursor_pointer().rounded(2)
      .hover((s) => s.bg("#ffffff10"))
      .tooltip(t("completedTip"))
      .on_click((_e, cx) => {
        open ? this.done.delete(sp.id) : this.done.add(sp.id);
        try { localStorage.setItem("completed.open", JSON.stringify([...this.done])); } catch {}
        cx.notify();
      })
      .child(txt(open ? "▾" : "▸", 12, P.dim, 700).w(10).flex_none())
      .child(txt(t("completed", done.length), 13, P.muted, 800).flex_1());
    const row = (tab) => {
      const heroes = all.filter((a) => a.tab === tab.id);
      const name = tab.named ? tab.name : (heroes[0]?.title && heroes[0].title !== heroes[0].program?.name ? heroes[0].title : t("questN", tab.index));
      return h_flex().id(`accomplie-${tab.id}`).h(24).pl(17).pr(4).gap(6).items_center().rounded(2).cursor_pointer()
        .hover((s) => s.bg("#ffffff10"))
        .tooltip(t("completedQuestTip"))
        .on_click(() => { run("tab.unsettle", { id: tab.id }); if (!sp.active) run("space.select", { id: sp.id }); run("tab.select", { id: tab.id }); })
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          openOverlay({ mod: "world-of-codecraft", kind: "popup", ...QUEST_MENU, props: { role: "questmenu", tab: tab.id, space: sp.id } });
        })
        .child(txt("✓", 12, P.goldLo, 800).flex_none())
        .child(txt(clip(name, 32), 13, P.dim, 700).flex_1().min_w(0).truncate())
        .child(h_flex().flex_none().gap(2).children(heroes.slice(0, 3).map((a) => portrait(heroOf(a.address, a.program), 22))));
    };
    return v_flex().gap(0).pt(2).child(head).when(open, (e) => e.children(done.map(row)));
  }

  // Past quests: earlier Claude Code sessions in this district's folders, not running now. Folded by
  // default; unfolding looks them up. Click one: resume it as a new quest. ×: archive it (↺: bring back).
  pastQuests(sp, cx) {
    if (props()?.demo) return null;
    const open = this.pastOpen.has(sp.id);
    const d = this.past.of(sp);
    if (open) this.past.want(sp, this.wt?.of(sp), cx);
    const fold = (set, key, id) => (_e, cx) => {
      set.has(id) ? set.delete(id) : set.add(id);
      if (key) try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
      cx.notify();
    };
    const live = (d?.list ?? []).filter((x) => !this.past.isArchived(x.id));
    const gone = (d?.list ?? []).filter((x) => this.past.isArchived(x.id));
    const head = h_flex().id(`passees-${sp.id}`).h(22).px(5).gap(5).items_center().cursor_pointer().rounded(2)
      .hover((s) => s.bg("#ffffff10"))
      .tooltip(t("pastTip"))
      .on_click(fold(this.pastOpen, "past.open", sp.id))
      .child(txt(open ? "▾" : "▸", 12, P.dim, 700).w(10).flex_none())
      .child(txt(d ? t("past", live.length) : t("pastN"), 13, P.muted, 800).flex_1());
    if (!open) return v_flex().gap(0).pt(2).child(head);
    const row = (x, archived) => {
      const name = x.title || x.prompt || x.id.slice(0, 8);
      return h_flex().id(`passee-${x.id}`).h(24).pl(17).pr(2).gap(6).items_center().rounded(2).cursor_pointer()
        .hover((s) => s.bg("#ffffff10"))
        .tooltip(t("pastQuestTip", x.title, x.prompt, ago(x.mtime), x.turns, x.cwd))
        .on_click(() => {
          if (!sp.active) run("space.select", { id: sp.id });
          run("tab.new", { space: sp.id, folder: x.folder, name: clip(x.title || t("pastResumed"), 40), argv: ["claude", "--resume", x.id] });
          this.past.setArchived(x.id, false);
          this.past.stale(sp);
        })
        .child(txt("❧", 13, archived ? P.faint : P.goldLo, 700).flex_none())
        .child(txt(clip(name, 40), 13, archived ? P.faint : P.dim, 700).flex_1().min_w(0).truncate())
        .child(txt(ago(x.mtime), 12, P.faint, 700).flex_none())
        .child(div().id(`passee-x-${x.id}`).w(16).h(18).flex_none().flex().items_center().justify_center().rounded(2)
          .hover((s) => s.bg("#ffffff20"))
          .tooltip(archived ? t("pastUnarchive") : t("pastArchive"))
          .on_click((_e, cx) => { cx.stop_propagation(); this.past.setArchived(x.id, !archived); cx.notify(); })
          .child(txt(archived ? "↺" : "×", 13, P.faint, 800)));
    };
    const SHOW = 8;
    const all = this.pastAll.has(sp.id);
    const shown = all ? live : live.slice(0, SHOW);
    let body = v_flex().gap(0).children(shown.map((x) => row(x, false)));
    if (!d) body = body.child(txt(t("pastLooking"), 12, P.dim, 700).pl(17));
    else if (d.error && !d.list.length) body = body.child(txt(t("pastFailed"), 12, P.blocked, 700).pl(17).tooltip(d.error));
    else if (!live.length) body = body.child(txt(t("pastNone"), 12, P.dim, 700).pl(17));
    if (live.length > SHOW) body = body.child(h_flex().id(`passees-plus-${sp.id}`).h(20).pl(17).cursor_pointer().rounded(2)
      .hover((s) => s.bg("#ffffff10")).on_click(fold(this.pastAll, null, sp.id))
      .child(txt(all ? t("pastFewer") : t("wtMore", live.length - SHOW), 12, P.dim, 700)));
    if (gone.length) {
      const ao = this.pastArch.has(sp.id);
      body = body.child(h_flex().id(`archives-${sp.id}`).h(20).pl(17).gap(5).items_center().cursor_pointer().rounded(2)
        .hover((s) => s.bg("#ffffff10")).on_click(fold(this.pastArch, null, sp.id))
        .child(txt(ao ? "▾" : "▸", 11, P.faint, 700).w(10).flex_none())
        .child(txt(t("pastArchived", gone.length), 12, P.faint, 700)));
      if (ao) body = body.children(gone.map((x) => row(x, true)));
    }
    return v_flex().gap(0).pt(2).child(head).child(body);
  }

  heading(text, extra, tail) {
    return div().relative().flex_none().h(30)
      .children(bar("bandeau"))
      .child(h_flex().absolute().left(24).right(24).top(0).bottom(0).gap(8).items_center()
        .child(title(text, 17, P.goldHi).flex_1())
        .when(Boolean(extra), (e) => e.child(txt(extra, 14, P.muted, 700)))
        .when(Boolean(tail), (e) => e.child(tail)));
  }

  saveShut() { try { localStorage.setItem("districts.shut", JSON.stringify([...this.shut])); } catch {} }

  // ▾/▸ in the Districts heading: fold every district if any is open, else unfold them all.
  foldAll(list) {
    const anyOpen = list.some((sp) => !this.shut.has(sp.id));
    return div().id("quartiers-plier").flex_none().w(16).h(22).flex().items_center().justify_center().rounded(2).cursor_pointer()
      .hover((s) => s.bg("#ffffff14"))
      .tooltip(anyOpen ? t("foldAll") : t("unfoldAll"))
      .on_click((_e, cx) => {
        if (anyOpen) list.forEach((sp) => this.shut.add(sp.id)); else this.shut.clear();
        this.saveShut(); cx.notify();
      })
      .child(txt(anyOpen ? "▾" : "▸", 14, P.muted, 700));
  }

  // One state counter: a gem, the number, the word, on a flat enamel well.
  chip(st, n) {
    const s = STATE[st];
    const b = st === "blocked";
    return well(h_flex().flex_none().h(22).pl(3).pr(7).gap(3).items_center().rounded(2),
      { bg: b ? "#4a1418" : P.night, lit: b ? "#a0303a" : "#3e3040" })
      .child(gem(st, true))
      .child(txt(`${n} ${s.mot}`, 14, b ? "#ffd8cc" : P.parch, 700));
  }

  quest(sp, tab, heroes) {
    const st = tab.status;
    const on = sp.active && tab.active;
    const name = tab.named ? tab.name : (heroes[0]?.title && heroes[0].title !== heroes[0].program?.name ? heroes[0].title : t("questN", tab.index));
    const fg = on ? P.ink2 : st === "blocked" ? "#ffd8cc" : P.cream;
    let line = h_flex().id(`quete-${tab.id}`).relative().h(28).pl(5).pr(4).gap(6).items_center().rounded(2).cursor_pointer()
      .bg(on ? P.parch : st === "blocked" ? "#3a1216" : "#00000000").hover((s) => s.bg(on ? P.parch : "#ffffff10"))
      .tooltip(t("questTip", tab.index, tab.name, tab.panes))
      .on_click(() => { if (!sp.active) run("space.select", { id: sp.id }); run("tab.select", { id: tab.id }); })
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        openOverlay({ mod: "world-of-codecraft", kind: "popup", ...QUEST_MENU, props: { role: "questmenu", tab: tab.id, space: sp.id } });
      })
      .child(div().w(16).flex_none().flex().justify_center().child(mark(st) ?? (st ? gem(st, true) : div().size(5).rounded(1).bg(on ? P.inkSoft : P.faint))))
      .child(txt(clip(name, 32), 15, fg, on ? 800 : 700).flex_1().min_w(0).truncate())
      .when(tab.panes > 1, (e) => e.child(txt(`×${tab.panes}`, 14, on ? P.inkSoft : P.dim, 700).flex_none()))
      .child(h_flex().flex_none().gap(2).children(heroes.slice(0, 3).map((a) => portrait(heroOf(a.address, a.program), 22))))
      .when(heroes.length > 3, (e) => e.child(txt(`+${heroes.length - 3}`, 14, on ? P.inkSoft : P.dim, 700).flex_none()));
    if (on) line = line.child(div().absolute().left(0).top(0).bottom(0).w(2).bg(P.wax));
    return line;
  }

  // Side quests: sub-agents a quest's heroes sent out, branching under it. Working ones always show,
  // finished ones from the last half hour (a few), the rest behind "+n earlier".
  sideQuests(sp, tab, heroes) {
    const list = this.side.of(heroes);
    if (!list.length) return null;
    const now = Date.now() / 1000;
    const all = this.sideAll.has(tab.id);
    const recent = list.filter((x) => x.state === "working" || x.state === "blocked" || x.kind === "herdr" || now - (x.end ?? now) < 1800);
    const shown = all ? list.slice(0, 20) : [...recent.filter((x) => x.state === "working" || x.kind === "herdr"), ...recent.filter((x) => !(x.state === "working" || x.kind === "herdr")).slice(0, 3)];
    const hidden = list.length - shown.length;
    const icon = (x) => x.state === "working" || x.state === "blocked" ? gem(x.state, true)
      : txt(x.state === "done" ? "✓" : x.state === "idle" ? "•" : "✗", 12, x.state === "done" ? P.done : P.faint, 800);
    const row = (x, i) => {
      const live = x.state === "working";
      const when = x.kind === "herdr" ? "" : live ? span(now - x.start) : ago(x.end);
      const fg = live ? P.parch : x.state === "done" ? P.muted : P.dim;
      return h_flex().id(`side-${tab.id}-${x.id}`).h(22).pl(12 + 10 * Math.min(2, x.depth - 1)).pr(6).gap(5).items_center().rounded(2).cursor_pointer()
        .hover((s) => s.bg("#ffffff10"))
        .tooltip(t("sideTip", x.type, x.desc, x.prompt, t("sideState")[x.state] ?? x.state, x.kind === "herdr" ? x.address : live ? span(now - x.start) : span((x.end ?? now) - (x.start ?? now))))
        .on_click(() => {
          if (x.kind === "herdr") return run("terminal.peek", { terminal: x.address });
          // its transcript, in a window (one at a time: opening another replaces it)
          openOverlay({ mod: "world-of-codecraft", kind: "window", key: "chronicle", width: 0.5, height: 0.8,
            props: { role: "chronicle", path: x.path, machine: sp.machine ?? null, title: x.desc || x.type, type: x.type } });
        })
        .child(txt("↳", 12, P.bronze, 700).flex_none())
        .child(div().w(15).flex_none().flex().justify_center().child(icon(x)))
        // the default type says nothing, so only named ones (Explore, Plan, ...) get a label
        .when(x.type !== "general-purpose" && x.type !== "agent", (e) => e.child(txt(x.type, 12, live ? P.gold : P.goldLo, 800).flex_none()))
        .child(txt(x.desc || x.prompt || "", 13, fg, 700).flex_1().min_w(0).truncate())
        .when(Boolean(when), (e) => e.child(txt(when, 12, P.faint, 700).flex_none()));
    };
    let box = v_flex().gap(0).children(shown.map(row));
    if (hidden > 0 || all) box = box.child(h_flex().id(`side-more-${tab.id}`).h(18).pl(29).items_center().cursor_pointer()
      .hover((s) => s.bg("#ffffff10"))
      .on_click((_e, cx) => { all ? this.sideAll.delete(tab.id) : this.sideAll.add(tab.id); cx.notify(); })
      .child(txt(all ? t("pastFewer") : t("sideMore", hidden), 12, P.faint, 700)));
    return box;
  }

  district(sp, all, cx) {
    const d = district(sp);
    const heroes = all.filter((a) => a.space === sp.id);
    const tabs = sp.tabs.filter((t) => !t.settled || t.active); // a shown tab is never settled for long
    const sessions = sp.tabs.reduce((n, t) => n + (t.panes || 0), 0);
    const counts = ORDER.map((st) => [st, heroes.filter((a) => a.status === st).length]).filter(([, n]) => n > 0);
    const blocked = heroes.some((a) => a.status === "blocked");
    const kind = blocked ? "fin-rubis" : sp.active ? "fin-or" : "fin";
    const shut = this.shut.has(sp.id);

    // the district's head: banner, name, sessions and heroes, the big counter
    const head = h_flex().id(`quartier-tete-${sp.id}`).h(46).pl(6).pr(4).gap(8).items_center().cursor_pointer()
      .hover((s) => s.bg("#ffffff08"))
      .tooltip(`${d.titre}${sp.machine ? ` @${sp.machine}` : ""} ${t("goThere")}`)
      .on_click(() => run("space.select", { id: sp.id }))
      // press here and drag onto another district to move this one there (Herdr's own spaces list does the same)
      .on_mouse_down("left", () => { this.drag = sp.id; this.over = sp.id; })
      // fold the district down to this head (and its counters), or open it again
      .child(div().id(`quartier-plier-${sp.id}`).flex_none().w(14).h(30).flex().items_center().justify_center().rounded(2)
        .hover((s) => s.bg("#ffffff14"))
        .tooltip(shut ? t("unfoldDistrict") : t("foldDistrict"))
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .on_click((_e, cx) => {
          cx.stop_propagation();
          shut ? this.shut.delete(sp.id) : this.shut.add(sp.id);
          this.saveShut(); cx.notify();
        })
        .child(txt(shut ? "▸" : "▾", 14, P.muted, 700)))
      .child(div().flex_none().mt(-6).child(banner(d)))
      .child(v_flex().flex_1().min_w(0).gap(0)
        .child(txt(`${d.num} · ${d.nom}`, 18, sp.active ? P.goldHi : P.cream, 800).truncate())
        .child(txt(`${t("sessions", sessions)} · ${t("heroes", heroes.length)}`, 14, P.muted, 700).truncate()))
      .child(div().relative().flex_none().size(32).tooltip(t("sessionsHere", t("sessions", sessions)))
        .child(pic("medaillon", 32, 32).absolute().left(0).top(0))
        .child(div().absolute().left(0).top(0).size(32).flex().items_center().justify_center()
          .child(div().font_family(TITRE).font_weight(700).text_size(15).text_color(P.goldHi).child(String(sessions)))));

    let inner = v_flex().relative().gap(2).p(6).child(head);
    if (counts.length) inner = inner.child(h_flex().flex_wrap().gap(4).px(2).pb(3).children(counts.map(([st, n]) => this.chip(st, n))));
    if (shut) return this.card(sp, inner, kind, blocked);
    inner = inner.child(v_flex().gap(1).children(tabs.flatMap((t) => {
      const mine = heroes.filter((a) => a.tab === t.id);
      const side = this.sideQuests(sp, t, mine);
      return side ? [this.quest(sp, t, mine), side] : [this.quest(sp, t, mine)];
    })));
    const done = this.completed(sp, all);
    if (done) inner = inner.child(done);
    const past = this.pastQuests(sp, cx);
    if (past) inner = inner.child(past);
    const trees = this.worktrees(sp);
    if (trees) inner = inner.child(trees);
    return this.card(sp, inner, kind, blocked);
  }

  card(sp, inner, kind, blocked) {
    const list = spaces();
    const from = this.drag === null ? -1 : list.findIndex((s) => s.id === this.drag);
    const here = list.findIndex((s) => s.id === sp.id);
    const target = from !== -1 && this.over === sp.id && this.drag !== sp.id;
    let card = div().id(`quartier-${sp.id}`).relative().flex_none().mx(2).mt(6)
      .bg(sp.active ? P.enamelHi : P.enamel)
      .child(inner)
      .children(frame(kind))
      .when(this.drag === sp.id && this.over !== sp.id, (e) => e.opacity(0.5))
      // where it would land: a gold bar above (moving up) or below (moving down)
      .when(target, (e) => e.child(div().absolute().left(4).right(4).h(3).rounded(2).bg(P.goldHi)
        .when(from < here, (b) => b.bottom(-5)).when(from > here, (b) => b.top(-5))))
      .on_mouse_move((_e, cx) => {
        if (this.drag === null) return;
        const src = list.find((s) => s.id === this.drag);
        // Herdr keeps each machine's spaces together, so a district only moves among its machine's
        const over = src && (src.machine ?? null) === (sp.machine ?? null) ? sp.id : null;
        if (this.over !== over) { this.over = over; cx.notify(); }
      })
      .on_mouse_up("left", (_e, cx) => {
        const drag = this.drag, over = this.over;
        this.drag = this.over = null;
        if (drag !== null && over === sp.id && drag !== sp.id && here !== -1) run("space.move", { id: drag, index: here + 1 });
        cx.notify();
      });
    if (blocked && !target) card = card.loop("opacity", { from: 0.86, to: 1, period: 900 });
    return card;
  }

  render(cx) {
    const demo = Boolean(props()?.demo); // screenshots: generic districts instead of the person's
    const all = demo ? DEMO_AGENTS : agents();
    const list = demo ? DEMO_SPACES : spaces();
    const sessions = list.reduce((n, sp) => n + sp.tabs.reduce((m, t) => m + (t.panes || 0), 0), 0);
    if (!demo) this.wt?.watch(list, all);
    const T = frameT("cadre");
    const add = (id, label, tip, fn) => button(id, [pic("ic-plus", 11, 11), txt(label, 15, P.cream, 800)], fn, { tip }).flex_1();
    return div().id("tableau").size_full().relative().bg(P.leather)
      // a drag let go anywhere else is dropped
      .on_mouse_up("left", (_e, cx) => { if (this.drag !== null) { this.drag = this.over = null; cx.notify(); } })
      .child(gradient("#2b1e16", "#100b0a", 165))
      .child(v_flex().absolute().left(T).right(T).top(T).bottom(T)
        .child(this.heading(t("districts"), t("sessions", sessions), list.length ? this.foldAll(list) : null))
        .child(v_flex().id("quartiers").flex_1().min_h(0).overflow_y_scrollbar().px(2).pb(8)
          .children(list.map((sp) => this.district(sp, all, cx))))
        // pinned under the list, not scrolled with it
        .child(div().flex_none().mx(4).h(1).bg(P.bronze))
        .child(h_flex().flex_none().mx(4).pt(8).pb(4).gap(6)
            .child(add("nouvelle-quete", t("newQuest"), t("newQuestTip"), () => {
              const sp = list.find((s) => s.active);
              openOverlay({ mod: "world-of-codecraft", kind: "popup", ...newQuestSize(cachedInstalled(sp?.machine)), props: { role: "newquest", space: sp?.id } });
            }))
            .child(add("nouveau-quartier", t("newDistrict"), t("newDistrictTip"), () => run("space.new", {})))))
      .children(frame("cadre"));
  }
}
