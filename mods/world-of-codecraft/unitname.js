// Rename a unit (hero): a small dialog opened by right-clicking a unit in the village, the
// selected-unit card or a pane header. Props { role: "unitname", address, overlay }.
// Saves the name as the terminal's label wocc.name with `hc label`; an empty name removes it,
// bringing back the hero's own name. Enter saves, Esc cancels.

import { div } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { exec, props, closeOverlay, openOverlay, notify, setShared } from "herdr";
import { customName, forgetNames, NAME_LABEL, NAMES_KEY } from "./kit.js";
import { t } from "./i18n.js";
import { P, title, txt, button, well } from "./ui.js";

const MAX = 24;
// Drops control and text-direction characters, collapses spaces, keeps MAX characters.
const bad = (c) => c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
function clean(s) {
  const kept = [...String(s ?? "")].filter((ch) => !bad(ch.codePointAt(0))).join("");
  return [...kept.replace(/\s+/g, " ").trim()].slice(0, MAX).join("");
}

/** Opens the dialog for a terminal address (t3, or machine/t3). */
export function renameUnit(address) {
  if (address) openOverlay({ mod: "world-of-codecraft", kind: "dialog", width: 340, height: 196, props: { role: "unitname", address } });
}

export class UnitName {
  init(_props, cx) {
    const value = customName(props()?.address) ?? "";
    this.input = InputState.new({ value });
    if (value) this.input.set_selected_range({ start: 0, end: value.length });
    this.input.on("submit", () => this.save());
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
  }

  save(name) {
    const p = props() ?? {};
    const text = clean(name ?? this.input.value());
    closeOverlay(p.overlay);
    if (!p.address) return;
    exec("hc", ["label", p.address, `${NAME_LABEL}=${text}`])
      .then((r) => { forgetNames(); setShared(NAMES_KEY, Date.now()); if (r.code !== 0) notify({ title: t("unitRenameFailed"), body: (r.stderr || "").trim(), level: "error" }); })
      .catch((e) => notify({ title: t("unitRenameFailed"), body: String(e), level: "error" }));
  }

  render() {
    const p = props() ?? {};
    return well(v_flex().id("unitname").size_full().p(14).gap(8), { bg: P.night, lit: P.bronze })
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .child(title(t("unitRenameTitle"), 17))
      .child(Input.new(this.input).h(34).px(10).rounded(2).border_1().border_color(P.goldLo).bg(P.ink).text_size(15).text_color(P.cream))
      .child(txt(t("unitRenameHint"), 13, P.dim, 700))
      .child(h_flex().pt(4).gap(8).justify_end()
        .child(button("un-reset", txt(t("unitRenameReset"), 14, P.cream, 800), () => this.save("")))
        .child(button("un-cancel", txt(t("unitRenameCancel"), 14, P.cream, 800), () => closeOverlay(p.overlay)))
        .child(button("un-save", txt(t("unitRenameSave"), 14, P.goldHi, 800), () => this.save())));
  }
}
