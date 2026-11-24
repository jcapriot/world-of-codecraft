// World of Codecraft: French and English, picked automatically.
// The language is detected once per start from the system (WOCC_LANG if set, else macOS
// AppleLanguages, else LC_ALL / LC_MESSAGES / LANG): French when it starts with "fr", English
// otherwise. It is shared with every copy of the mod (shared "wocc.lang"), so the header, the board,
// the pane headers and the village all speak the same language. Force it with WOCC_LANG=fr|en in the
// environment Herdr starts from, or with "lang": "fr" | "en" in a block's props.

import { exec, shared, setShared, props } from "herdr";

const KEY = "wocc.lang";
let asked = false;

/** "fr" or "en". */
export function lang() {
  const p = props()?.lang;
  if (p === "fr" || p === "en") return p;
  return shared(KEY) === "fr" ? "fr" : "en";
}

/** Detects the system language once per start (call it from init). */
export function detectLang(cx) {
  if (asked) return;
  asked = true;
  cx.spawn(async () => {
    try {
      const r = await exec("sh", ["-c",
        'if [ -n "$WOCC_LANG" ]; then echo "$WOCC_LANG"; exit; fi; ' +
        '(defaults read -g AppleLanguages 2>/dev/null | sed -n 2p | tr -d " \\"(),"); ' +
        'echo "${LC_ALL:-${LC_MESSAGES:-$LANG}}"']);
      const first = (r.stdout ?? "").split("\n").map((s) => s.trim()).find(Boolean) ?? "";
      const l = /^fr/i.test(first) ? "fr" : "en";
      if (shared(KEY) !== l) setShared(KEY, l);
    } catch {}
  });
}

/** Every visible string, by key. A function takes the values it needs. */
const S = {
  en: {
    village: "Valbrume",
    villageOf: (v) => `village of ${v}`,
    pct: (n) => `${n}%`,
    // races and classes
    race: { elfe: "Elf", orque: "Orc", humain: "Human", "mort-vivant": "Undead", nain: "Dwarf" },
    cls: { mage: "mage", artificier: "artificer", guerrier: "warrior", pretre: "priest", rodeur: "ranger", voleur: "rogue" },
    hero: (race, cls) => `${race} ${cls}`,
    // states
    quest: {
      working: { mot: "On a quest", fr: "sets out on a quest" },
      blocked: { mot: "Help needed!", fr: "needs help" },
      done: { mot: "Quest to turn in", fr: "has finished the quest" },
      idle: { mot: "Resting", fr: "rests by the campfire" },
    },
    board: { blocked: "need help", done: "to turn in", working: "on a quest", idle: "resting" },
    hours: ["Matins", "Lauds", "Terce", "Sext", "None", "Vespers", "Compline"],
    days: "d",
    home: "Home",
    district: (n, name) => `District ${n} · ${name}`,
    // header
    accountNone: (label, acc) => `${label}: no reading for Claude account ${acc}`,
    account: (acc) => `account ${acc}`,
    five: (p) => `5h: ${p}%`,
    quotaTip: (label, acc, rem, fair, five, fiveLeft, stale) =>
      `${label} = Claude account ${acc}\n${rem}% left this week (fair in ${fair})${five != null ? `\n5-hour window: ${five}% left${fiveLeft ? ` (${fiveLeft})` : ""}` : ""}${stale ? "\nReading older than 30 min" : ""}`,
    gold: "Gold", wood: "Wood",
    waitingMany: (n, blocked) => `${n} ${blocked ? "waiting" : "quests to turn in"}`,
    waitingOne: (name, blocked) => `${name} ${blocked ? "is waiting" : "is done"}`,
    waitingTip: (title, blocked) => `${title} ${blocked ? "awaits your orders" : "is back from a quest"} (click: go there)`,
    questTab: (name) => `Quest: ${name}`,
    hourTip: (hour, night) => `${hour} (canonical hour) · ${night ? "night" : "day"}`,
    heroesAtWork: "heroes at work",
    heroesTip: (busy, all) => `${busy} heroes at work, ${all} agents in the village`,
    untilFair: "until the fair",
    fairTip: "The fair: the weekly reset of the Claude quotas",
    immersion: "Immersion", workshop: "Workshop",
    panelFiles: "Files", panelChanges: "Changes",
    worktrees: (n) => `Worktrees (${n})`, worktreesTip: "The repo's git worktrees (click: fold)",
    worktreeTip: (path, branch, scratch, gone) => `${branch}\n${path}${scratch ? "\nIn a temporary folder: gone after a reboot" : ""}${gone ? "\nIts folder is missing (git worktree prune)" : "\nClick: a new quest (terminal) here"}`,
    detached: "detached", wtDirty: (n) => `${n} uncommitted file${n === 1 ? "" : "s"}`, wtAhead: (n) => `${n} unpushed commit${n === 1 ? "" : "s"}`,
    wtGone: "missing", wtMore: (n) => `+${n} more`,
    panelFilesTip: "The district's files, beside the terminal (click again to close)",
    panelChangesTip: "Uncommitted changes in the district's repo, beside the terminal (cmd-shift-g; click again to close)",
    immersionTip: "Immersive mode: the village fills the window, the terminal goes below (ctrl-shift-i)",
    workshopTip: "Back to the workshop: the terminal fills the window, the village goes below (ctrl-shift-i)",
    // board
    questN: (n) => `Quest #${n}`,
    questTip: (n, name, panes) => `Quest ${n}: ${name}${panes > 1 ? ` (${panes} sessions)` : ""} (click: show it, right-click: options)`,
    qmComplete: "Complete quest", qmResume: "Resume quest",
    past: (n) => `Past quests (${n})`, pastN: "Past quests", pastTip: "Earlier Claude Code sessions in this district's folders, not running now (click: fold)",
    pastQuestTip: (title, prompt, when, turns, cwd) => `${title ?? "Untitled"}\n${prompt ? `“${prompt.slice(0, 160)}”\n` : ""}${when} ago · ${turns} prompt${turns === 1 ? "" : "s"} · ${cwd}\nClick: resume it as a new quest`,
    pastResumed: "Resumed quest", pastArchive: "Archive", pastUnarchive: "Bring back",
    pastLooking: "Looking through the logs…", pastFailed: "Could not read the session logs", pastNone: "No past sessions here",
    pastFewer: "Show fewer",
    sideMore: (n) => `+${n} earlier side quest${n === 1 ? "" : "s"}`,
    sideState: { working: "on the road", done: "returned", stopped: "abandoned", idle: "waiting", blocked: "needs you" },
    sideTip: (type, desc, prompt, state, time) => `Side quest · ${type} · ${state} (${time})\n${desc}${prompt && prompt !== desc ? `\n\n${prompt}` : ""}`, pastArchived: (n) => `Archived (${n})`,
    completed: (n) => `Completed quests (${n})`, completedTip: "Quests you marked completed: tucked away, still running (click: fold)",
    completedQuestTip: "Click: resume this quest. Right-click: more",
    qmRename: "Rename…", qmReset: "Reset name", qmUp: "Move up", qmDown: "Move down",
    qmClose: "Close quest", qmCloseSure: "Click again to close", qmGone: "This quest has ended",
    nqTitle: "New quest", nqTerminal: "Terminal", nqAgents: "Send a hero", nqChecking: "Checking installed agents…", nqFailed: "Could not check installed agents", nqNone: "No agents installed",
    picOpen: "Open", picClose: "Close", picFailed: "Could not show the picture",
    unitRenameTitle: "Rename this hero", unitRenameHint: "Kept on the terminal until it ends. Empty: the hero's own name.",
    unitRenameSave: "Save", unitRenameCancel: "Cancel", unitRenameReset: "Reset",
    unitRenameFailed: "Couldn't rename the hero", unitRenameTip: "Right-click: rename",
    goThere: "(click: go there)",
    foldDistrict: "Fold this district", unfoldDistrict: "Unfold this district", foldAll: "Fold all districts", unfoldAll: "Unfold all districts",
    sessions: (n) => `${n} ${n === 1 ? "session" : "sessions"}`,
    heroes: (n) => `${n} ${n === 1 ? "hero" : "heroes"}`,
    sessionsHere: (s) => `${s} in this district`,
    districts: "Districts",
    newQuest: "Quest", newQuestTip: "Start a new quest (a new tab in this district): a terminal or an agent",
    newDistrict: "District", newDistrictTip: "Found a new district (a new space)",
    // command panel
    map: "Map of Valbrume",
    selected: "Selected unit",
    noUnit: "No unit selected",
    clickHero: "Click a hero in the village",
    onGuard: "On guard",
    go: "Go", goTip: "Go to this hero",
    next: "Next", nextTip: "Next hero",
    animations: "Animations", yes: "on", no: "off",
    animOnTip: "Animations, scenes and enemies: on.\nClick: still images (saves CPU)",
    animOffTip: "Still images.\nClick: animate the village (scenes, enemies)",
    // pane header
    scroll: "Scroll",
    splitR: "Split right", splitD: "Split down", zoom: "Zoom", close: "Close",
    // places
    building: { grange: "Barn and fields", tour: "Mage Tower", atelier: "Forge Workshop", hotel: "Town Hall", taverne: "Tavern", temple: "Temple of Dawn", caserne: "Barracks" },
    market: "Market",
    campfire: "Campfire",
    gate: "Gate",
    crier: "Town Crier",
    recruit: { tour: "a mage (Claude)", atelier: "an artificer (Codex)", caserne: "a warrior (terminal)" },
    recruitTip: (name, what) => `${name}\nDouble-click: recruit ${what}`,
    mapTip: "Village map (click: move the view there)",
    // chronicle
    arrives: (title, prog) => `${title} (${prog}) arrives in the village`,
    leaves: (title) => `${title} leaves Valbrume`,
    hearYe: (n, b) => `Hear ye! ${n} ${n === 1 ? "hero" : "heroes"} in the village${b ? `, ${b} awaiting your orders` : ""}`,
    quoted: (s) => ` "${s}"`,
    unitTip: (title, prog, where, word) => `${title} · ${prog}\n${where}\n${word} (click: go there)`,
    onGuardTerm: "On guard (terminal)",
    help: ["Help!", "Help!", "Orders?", "Over here!"],
    demoTabs: ["PR review", "tests", "migration", "docs", "rest", "map", "triage", "build", "refactor", "fix"],
    // scenes
    ouch: "Ouch!", sealed: "Sealed!", sent: "Message sent!", testsOk: "Tests passed!", testsKo: "Tests failing",
    // village life
    treasury: (p) => `Valbrume treasury: ${p}% of account A left this week`,
    fair: (t) => `The fair: reset in ${t}`,
  },
  fr: {
    village: "Valbrume",
    villageOf: (v) => `village de ${v}`,
    pct: (n) => `${n} %`,
    race: { elfe: "elfe", orque: "orque", humain: "humain", "mort-vivant": "mort-vivant", nain: "nain" },
    cls: { mage: "mage", artificier: "artificier", guerrier: "soldat", pretre: "prêtre", rodeur: "rôdeur", voleur: "voleur" },
    hero: (race, cls) => `${cls} ${race}`,
    quest: {
      working: { mot: "En quête", fr: "part en quête" },
      blocked: { mot: "Aide requise !", fr: "a besoin d'aide" },
      done: { mot: "Quête à rendre", fr: "a terminé sa quête" },
      idle: { mot: "Au repos", fr: "se repose au feu de camp" },
    },
    board: { blocked: "aide", done: "à rendre", working: "en quête", idle: "repos" },
    hours: ["Matines", "Laudes", "Tierce", "Sexte", "Nones", "Vêpres", "Complies"],
    days: "j",
    home: "Logis",
    district: (n, name) => `Quartier ${n} · ${name}`,
    accountNone: (label, acc) => `${label} : pas de relevé du compte Claude ${acc}`,
    account: (acc) => `compte ${acc}`,
    five: (p) => `5 h : ${p} %`,
    quotaTip: (label, acc, rem, fair, five, fiveLeft, stale) =>
      `${label} = compte Claude ${acc}\nIl reste ${rem} % cette semaine (foire dans ${fair})${five != null ? `\nFenêtre 5 h : ${five} % restants${fiveLeft ? ` (${fiveLeft})` : ""}` : ""}${stale ? "\nRelevé de plus de 30 min" : ""}`,
    gold: "Or", wood: "Bois",
    waitingMany: (n, blocked) => `${n} ${blocked ? "attendent" : "quêtes à rendre"}`,
    waitingOne: (name, blocked) => `${name} ${blocked ? "attend" : "a fini"}`,
    waitingTip: (title, blocked) => `${title} ${blocked ? "attend tes ordres" : "revient de quête"} — clic : y aller`,
    questTab: (name) => `Quête : ${name}`,
    hourTip: (hour, night) => `${hour} (heure canoniale) · ${night ? "nuit" : "jour"}`,
    heroesAtWork: "héros à l'œuvre",
    heroesTip: (busy, all) => `${busy} héros travaillent, ${all} agents au village`,
    untilFair: "avant la foire",
    fairTip: "La foire : réinitialisation hebdomadaire des quotas Claude",
    immersion: "Immersion", workshop: "Atelier",
    panelFiles: "Fichiers", panelChanges: "Changements",
    worktrees: (n) => `Worktrees (${n})`, worktreesTip: "Les worktrees git du dépôt (clic : replier)",
    worktreeTip: (path, branch, scratch, gone) => `${branch}\n${path}${scratch ? "\nDans un dossier temporaire : perdu au redémarrage" : ""}${gone ? "\nSon dossier a disparu (git worktree prune)" : "\nClic : une nouvelle quête (terminal) ici"}`,
    detached: "détaché", wtDirty: (n) => `${n} fichier${n === 1 ? "" : "s"} non validé${n === 1 ? "" : "s"}`, wtAhead: (n) => `${n} commit${n === 1 ? "" : "s"} non poussé${n === 1 ? "" : "s"}`,
    wtGone: "absent", wtMore: (n) => `+${n} autres`,
    panelFilesTip: "Les fichiers du quartier, à côté du terminal (recliquer pour fermer)",
    panelChangesTip: "Les changements non validés du dépôt, à côté du terminal (cmd-shift-g ; recliquer pour fermer)",
    immersionTip: "Mode immersif : le village occupe la fenêtre, le terminal passe en bas (ctrl-shift-i)",
    workshopTip: "Retour à l'atelier : le terminal occupe la fenêtre, le village passe en bas (ctrl-shift-i)",
    questN: (n) => `Quête n° ${n}`,
    questTip: (n, name, panes) => `Quête ${n} : ${name}${panes > 1 ? ` (${panes} sessions)` : ""} — clic : l'afficher, clic droit : options`,
    qmComplete: "Quête accomplie", qmResume: "Reprendre la quête",
    past: (n) => `Quêtes passées (${n})`, pastN: "Quêtes passées", pastTip: "Les sessions Claude Code précédentes dans les dossiers de ce quartier, arrêtées (clic : replier)",
    pastQuestTip: (title, prompt, when, turns, cwd) => `${title ?? "Sans titre"}\n${prompt ? `« ${prompt.slice(0, 160)} »\n` : ""}il y a ${when} · ${turns} message${turns === 1 ? "" : "s"} · ${cwd}\nClic : la reprendre comme nouvelle quête`,
    pastResumed: "Quête reprise", pastArchive: "Archiver", pastUnarchive: "Ramener",
    pastLooking: "Lecture des journaux…", pastFailed: "Impossible de lire les journaux de session", pastNone: "Aucune session passée ici",
    pastFewer: "Moins",
    sideMore: (n) => `+${n} quête${n === 1 ? "" : "s"} annexe${n === 1 ? "" : "s"} plus ancienne${n === 1 ? "" : "s"}`,
    sideState: { working: "en route", done: "revenue", stopped: "abandonnée", idle: "en attente", blocked: "vous attend" },
    sideTip: (type, desc, prompt, state, time) => `Quête annexe · ${type} · ${state} (${time})\n${desc}${prompt && prompt !== desc ? `\n\n${prompt}` : ""}`, pastArchived: (n) => `Archivées (${n})`,
    completed: (n) => `Quêtes accomplies (${n})`, completedTip: "Les quêtes marquées accomplies : rangées, toujours actives (clic : replier)",
    completedQuestTip: "Clic : reprendre cette quête. Clic droit : plus",
    qmRename: "Renommer…", qmReset: "Nom par défaut", qmUp: "Monter", qmDown: "Descendre",
    qmClose: "Clore la quête", qmCloseSure: "Cliquer encore pour clore", qmGone: "Cette quête est terminée",
    nqTitle: "Nouvelle quête", nqTerminal: "Terminal", nqAgents: "Envoyer un héros", nqChecking: "Recherche des agents installés…", nqFailed: "Impossible de vérifier les agents installés", nqNone: "Aucun agent installé",
    picOpen: "Ouvrir", picClose: "Fermer", picFailed: "Impossible d'afficher l'image",
    unitRenameTitle: "Renommer ce héros", unitRenameHint: "Gardé sur le terminal jusqu'à sa fin. Vide : le nom d'origine.",
    unitRenameSave: "Enregistrer", unitRenameCancel: "Annuler", unitRenameReset: "Rétablir",
    unitRenameFailed: "Impossible de renommer le héros", unitRenameTip: "Clic droit : renommer",
    goThere: "— clic : y aller",
    foldDistrict: "Replier ce quartier", unfoldDistrict: "Déplier ce quartier", foldAll: "Replier tous les quartiers", unfoldAll: "Déplier tous les quartiers",
    sessions: (n) => `${n} ${n === 1 ? "session" : "sessions"}`,
    heroes: (n) => `${n} héros`,
    sessionsHere: (s) => `${s} dans ce quartier`,
    districts: "Quartiers",
    newQuest: "Quête", newQuestTip: "Lancer une nouvelle quête (nouvel onglet dans ce quartier) : un terminal ou un agent",
    newDistrict: "Quartier", newDistrictTip: "Fonder un nouveau quartier (nouvel espace)",
    map: "Carte de Valbrume",
    selected: "Unité choisie",
    noUnit: "Aucune unité choisie",
    clickHero: "Clic sur un héros du village",
    onGuard: "De garde",
    go: "Aller", goTip: "Aller à ce héros",
    next: "Suivant", nextTip: "Héros suivant",
    animations: "Animations", yes: "oui", no: "non",
    animOnTip: "Animations, scènes et ennemis : activés.\nClic : images fixes (économise le processeur)",
    animOffTip: "Images fixes.\nClic : animer le village (scènes, ennemis)",
    scroll: "Parchemin",
    splitR: "Fendre à droite", splitD: "Fendre en bas", zoom: "Agrandir", close: "Fermer",
    building: { grange: "Grange et champs", tour: "Tour des mages", atelier: "Atelier-forge", hotel: "Hôtel de ville", taverne: "Taverne", temple: "Temple de l'Aube", caserne: "Caserne" },
    market: "Marché",
    campfire: "Feu de camp",
    gate: "Porte",
    crier: "Crieur",
    recruit: { tour: "un mage (Claude)", atelier: "un artificier (Codex)", caserne: "un soldat (terminal)" },
    recruitTip: (name, what) => `${name}\nDouble-clic : recruter ${what}`,
    mapTip: "Carte du village — clic : y déplacer la vue",
    arrives: (title, prog) => `${title} (${prog}) arrive au village`,
    leaves: (title) => `${title} quitte Valbrume`,
    hearYe: (n, b) => `Oyez ! ${n} héros au village${b ? `, ${b} attendent tes ordres` : ""}`,
    quoted: (s) => ` « ${s} »`,
    unitTip: (title, prog, where, word) => `${title} · ${prog}\n${where}\n${word} — clic : y aller`,
    onGuardTerm: "De garde (terminal)",
    help: ["À l'aide !", "À l'aide !", "Tes ordres ?", "Par ici !"],
    demoTabs: ["revue PR", "tests", "migration", "doc", "repos", "carte", "tri", "build", "refonte", "correctif"],
    ouch: "Aïe !", sealed: "Scellé !", sent: "Message envoyé !", testsOk: "Tests réussis !", testsKo: "Tests en échec",
    treasury: (p) => `Trésor de Valbrume : ${p} % du compte A cette semaine`,
    fair: (t) => `La foire : réinitialisation dans ${t}`,
  },
};

/** The string (or the function's result) for a key in the current language. */
export function t(key, ...args) {
  const v = S[lang()][key] ?? S.en[key];
  return typeof v === "function" ? v(...args) : v;
}

/** A live view of a table (race, cls, quest, board, building, recruit): `tbl("race").elfe`. */
export const tbl = (key) => new Proxy({}, { get: (_o, k) => (S[lang()][key] ?? S.en[key])?.[k] });
