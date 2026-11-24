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
      .child(div().id("pic-box").flex_1().min_h(0).w_full().overflow_hidden().rounded(2).bg(P.ink)
        .flex().items_center().justify_center()
        .on_size_change((size, cx) => { if (size.width !== this.box?.width || size.height !== this.box?.height) { this.box = size; cx.notify(); } })
        .child(this.picture(p)));
  }

  // gpui crops an image to its box rather than letterboxing it, so size it to fit (never above 1:1)
  picture(p) {
    if (!p.src) return txt(t("picFailed"), 14, P.dim, 700);
    const box = this.box;
    if (!box || !p.w || !p.h) return image(p.src).size_full();
    const room = { w: Math.max(1, box.width - 8), h: Math.max(1, box.height - 8) };
    const k = Math.min(1, room.w / p.w, room.h / p.h);
    return image(p.src).flex_none().w(Math.floor(p.w * k)).h(Math.floor(p.h * k));
  }
}
