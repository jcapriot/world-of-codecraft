// The picture window: an image from a Cmd-clicked terminal link (see link.js), with its name,
// Open (in the Mac's own viewer, local pictures only) and Close. Props { role: "picture", src, path, machine, overlay }.

import { div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, closeOverlay, exec } from "herdr";
import { t } from "./i18n.js";
import { P, title, txt, button, well } from "./ui.js";

export class Picture {
  render() {
    const p = props() ?? {};
    const name = String(p.path ?? "").split("/").pop();
    const where = (p.machine ? `${p.machine}:` : "") + (p.path ?? "");
    return well(v_flex().id("picture").size_full().p(8).gap(6), { bg: P.night, lit: P.bronze })
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .child(h_flex().gap(8).items_center().flex_none()
        .child(div().flex_1().min_w(0).child(title(name, 15)))
        .when(!p.machine, (e) => e.child(button("pic-open", txt(t("picOpen"), 13, P.cream, 800), (_e, cx) => { cx?.stop_propagation?.(); exec("open", [p.path]); })))
        .child(button("pic-close", txt(t("picClose"), 13, P.cream, 800), (_e, cx) => { cx?.stop_propagation?.(); closeOverlay(p.overlay); })))
      .child(txt(where, 12, P.dim, 700).truncate().flex_none())
      .child(div().flex_1().min_h(0).w_full().rounded(2).bg(P.ink).p(4)
        .child(p.src ? image(p.src).size_full() : txt(t("picFailed"), 14, P.dim, 700)));
  }
}
