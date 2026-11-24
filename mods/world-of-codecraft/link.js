// Cmd-click (Ctrl-click) an image path in a terminal, such as a plot Claude just saved, to see it
// in a window here. Herdr only shows images from its own folder, so the picture is copied into
// data/world-of-codecraft/pictures first (from another machine too, via base64). A copy is named by
// the path, size and time, so a redrawn plot shows fresh. Anything else passes on to the usual opener.

import { exec, appHome, home, openOverlay, notify, writeTextFile } from "herdr";
import { t } from "./i18n.js";

const DIR = "data/world-of-codecraft/pictures";
const KEEP = 40; // copies kept; older ones are removed

const COPY = String.raw`
import base64, hashlib, os, sys
src, out, ext, keep = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
os.makedirs(out, exist_ok=True)
if len(sys.argv) > 5:  # base64 text from another machine, in a file
    with open(sys.argv[5]) as f: data = base64.b64decode(f.read())
    os.remove(sys.argv[5])
else:
    with open(src, "rb") as f: data = f.read()
name = hashlib.sha1(src.encode() + b"|" + hashlib.sha1(data).digest()).hexdigest()[:16] + "." + ext
p = os.path.join(out, name)
if not os.path.exists(p):
    with open(p + ".part", "wb") as f: f.write(data)
    os.replace(p + ".part", p)
else:
    os.utime(p)
old = sorted((os.path.join(out, n) for n in os.listdir(out)), key=os.path.getmtime, reverse=True)
for q in old[keep:]:
    try: os.remove(q)
    except Exception: pass
w = h = 0
try:  # pixel size, so the window can fit the picture itself (sips: macOS; svg has none)
    import subprocess
    o = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", p], capture_output=True, text=True).stdout
    w = int(o.split("pixelWidth:")[1].split()[0]); h = int(o.split("pixelHeight:")[1].split()[0])
except Exception:
    pass
print(name, w, h)
`;

function where(raw) {
  // file:///x/y.png or /x/y.png:12 (a diagnostic suffix) -> the path
  let s = String(raw ?? "").trim();
  if (s.startsWith("file://")) s = decodeURIComponent(s.replace(/^file:\/\/[^/]*/, ""));
  return s.replace(/:\d+(:\d+)?$/, "");
}

export async function handleLink({ link, source }) {
  if (link.kind !== "file") return "pass";
  const machine = source.machine ?? null;
  let path = link.path ?? where(link.raw);
  if (path.startsWith("~/") && !machine) path = home() + path.slice(1);
  if (!path.startsWith("/") && source.cwd) path = `${source.cwd.replace(/\/$/, "")}/${path}`;
  const ext = (path.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? "png").toLowerCase();
  const out = `${appHome()}/${DIR}`;
  try {
    let r;
    if (machine) {
      const b = await exec("base64", [path], { on: machine, timeout: 20_000 });
      if (b.code !== 0) throw new Error(b.stderr || `base64 exit ${b.code}`);
      const tmp = `${out}/.incoming-${Date.now()}.b64`;
      await exec("mkdir", ["-p", out]);
      await writeTextFile(tmp, b.stdout, null);
      r = await exec("python3", ["-c", COPY, path, out, ext, String(KEEP), tmp], { timeout: 20_000 });
    } else {
      r = await exec("python3", ["-c", COPY, path, out, ext, String(KEEP)], { timeout: 20_000 });
    }
    if (r.code !== 0) throw new Error((r.stderr || `exit ${r.code}`).trim().split("\n").pop());
    const [file, w, h] = r.stdout.trim().split(/\s+/);
    const src = `${DIR}/${file}`;
    openOverlay({
      mod: "world-of-codecraft", kind: "window", key: "picture", width: 0.6, height: 0.75,
      props: { role: "picture", src, path, machine, w: Number(w) || 0, h: Number(h) || 0 },
    });
    return "handled";
  } catch (e) {
    notify({ title: t("picFailed"), body: `${path}\n${String(e?.message ?? e).slice(0, 200)}`, level: "warning" });
    return "pass";
  }
}
