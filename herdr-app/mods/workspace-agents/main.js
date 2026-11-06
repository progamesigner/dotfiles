// The workspace list: every space with its agents and plain terminals (grouped), or
// agents by urgency then the terminals (priority). Parents take their most urgent
// sub-agent's place. A viewed done agent stays in Done until left. Hovering a row turns
// its status into a close button: the tab when the row is its only pane, else the pane.
// Spaces show their git and fold; their + opens the New menu there. See spaces.js.
// The sort button lives in the sidebar's top bar (shepherd-brand); it opens sortMenu here.
// In a space, drag a row onto another to reorder its tab, as in the tabs bar.
//
// Shepherd additions, all kept on herdr-core terminal labels so every Herdr client sees them:
//   shepherd.tab-name   a request to rename the terminal's tab (cleared once applied)
//   shepherd.space-name a request to show the terminal in the space with that name, made when
//                       missing (cleared once herdr.space is set)
//   shepherd.pane-name  a name for the terminal, shown after the tab's name
//   shepherd.session    model, effort, cache and pull request from `shepherd-report`
//   shepherd.snooze     {"until": ms, "from": status}: hidden in Snoozed until then
//   agent-resume        (Sleipnir) a saved session; lost ones are offered for resume

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, panes, focused, spaces, run, hc, exec, notify, theme, shared, setShared, setAgentOrder, openOverlay, closeOverlay, props, window, layout, home } from "herdr";
import { SpaceState, assignColors, avatarFill, gitTail, chevron } from "./spaces.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag. Shepherd hides the sidebar instead of
// narrowing it, so the rail only shows until the check in render() hides it: dragging the
// edge down to the rail hides it too.
const WIDE = 160;
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < WIDE;

// The last full width seen, so a drag down to the rail still comes back at the width it
// had before the drag started.
let lastWide = null;
function noteWidth() {
  const px = find(layout(), "sidebar")?.size?.px;
  if (px >= WIDE) lastWide = px;
}

// Shepherd: the toggle takes the sidebar away entirely; the tabs bar's sidebar button
// (shepherd-tabs) brings it back at the width it had.
function hideSidebar() {
  const sidebar = find(layout(), "sidebar");
  if (!sidebar || sidebar.hidden) return;
  const width = sidebar.size?.px;
  const keep = width >= WIDE ? width : lastWide;
  if (keep) setShared("sidebar.width", keep);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", true);
  // Back at full width while hidden, so showing it again never lands on the rail.
  if (!(width >= WIDE)) run("layout.resize", { id: "sidebar", px: shared("sidebar.width") ?? 268 });
  run("layout.hide", { id: "sidebar" });
}

function toggleSidebar() {
  const sidebar = find(layout(), "sidebar");
  if (!sidebar) return;
  if (!sidebar.hidden) return hideSidebar();
  setShared("sidebar.collapsed", false);
  run("layout.resize", { id: "sidebar", px: shared("sidebar.width") ?? 268 });
  run("layout.show", { id: "sidebar" });
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

// A tab Herdr named itself ("tb3") says nothing: its program's name instead.
const tabLabel = (tab, program) => (tab?.name && !/^tb\d+$/.test(tab.name) ? tab.name : program?.name || "Terminal");

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function terminalTitle(pane, agent) {
  return clean(pane?.title || agent.title) || pane?.program?.name || agent.program?.name || "Terminal";
}

// One line, no control characters, at most 80 characters.
function oneLine(value) {
  if (typeof value !== "string") return "";
  return [...value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()]
    .slice(0, 80)
    .join("");
}

// `herdr.tab-name` is the request's old name: still honored, and cleared with the new one.
const TAB_NAME_LABELS = ["shepherd.tab-name", "herdr.tab-name"];
const SPACE_NAME = "shepherd.space-name";
const PANE_NAME = "shepherd.pane-name";
const SESSION = "shepherd.session";
const SNOOZE = "shepherd.snooze";
const RESUME = "agent-resume";

function jsonLabel(terminal, key) {
  const raw = terminal?.labels?.[key];
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function snoozeOf(terminal) {
  const s = jsonLabel(terminal, SNOOZE);
  return typeof s?.until === "number" ? s : null;
}

// Remote terminals are `machine/t7`; labels are written with the full address, exec runs `on` the machine.
const machineOf = (address) => (address?.includes("/") ? address.slice(0, address.indexOf("/")) : null);

function clock(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function until(ms, now) {
  const d = new Date(ms), today = new Date(now);
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? `until ${clock(ms)}` : `until ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]} ${clock(ms)}`;
}

// The snooze menu's choices: an hour, tonight at 19:00 (while that's more than an
// hour away), tomorrow at 09:00.
function snoozeChoices(now) {
  const at = (days, hour) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.getTime(); };
  const tonight = at(0, 19);
  return [
    { id: "hour", label: "1 hour", until: now + 3600000 },
    ...(tonight - now > 3600000 ? [{ id: "tonight", label: "Tonight", until: tonight }] : []),
    { id: "tomorrow", label: "Tomorrow morning", until: at(1, 9) },
  ];
}

function openURL(url) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return;
  const platform = window()?.platform;
  const [command, args] = platform === "macos" ? ["open", [url]] : platform === "windows" ? ["explorer.exe", [url]] : ["xdg-open", [url]];
  exec(command, args).catch(() => {});
}

const PR_STATE = { approved: "Approved", changes_requested: "Changes requested", pending: "Waiting for review", draft: "Draft" };

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};
const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
const sortOf = () => SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[1];
const SECTION = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" };
const SECTION_STATUS = { 4: "blocked", 3: "done", 2: "working" };

// What `sleipnir-agent-resume status` says about a session it would not type in.
// These two mean the conversation is open elsewhere: nothing to offer.
const RESUME_ELSEWHERE = new Set(["open in another terminal", "resumed in another terminal"]);
const RESUME_POLL_MS = 60000;
// A machine without the resume command isn't asked again for this long.
const RESUME_RETRY_MS = 30 * 60000;

// The agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Agents extends View {
  init(_props, cx) {
    if (props()?.sortMenu || props()?.snoozeMenu) return;
    // Snoozed starts folded.
    this.folded = new Set(["snoozed"]);
    this.sp = new SpaceState(cx);
    this.pressed = null; // spaces() index of the space header being dragged
    this.over = null;
    this.tabPressed = null; // { space, tab } of the row being dragged (grouped list only)
    this.tabOver = null; // the tab id under the pointer, in the same space
    // Each agent's last state and when it changed (ms), kept across restarts.
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    this.pendingPins = JSON.parse(localStorage.getItem("pins") ?? "[]");
    if (!this.pendingPins.length) localStorage.removeItem("pins");
    this.migratingPins = new Set();
    this.tabNameObserved = new Map();
    this.tabNamePending = new Map();
    this.tabNameBusy = new Set();
    this.tabNameNotified = new Map();
    this.spaceNamePending = new Map();
    this.spaceNameBusy = new Set();
    this.spaceNameNotified = new Set();
    // Snoozed agents whose status moved since the snooze, and labels being cleared.
    this.snoozeMoved = new Set();
    this.waking = new Set();
    // Per machine ("" for this one): { at, items } from `sleipnir-agent-resume status`.
    this.resume = new Map();
    this.resumeSkip = new Map();
    this.resumeBusy = new Set();
    cx.timer.every(30000, (cx) => {
      this.processTabNameRequests(cx);
      this.processSpaceNameRequests(cx);
      // Snoozes run out on time even when nothing else redraws the list.
      cx.notify();
    });
    cx.timer.every(RESUME_POLL_MS, (cx) => this.pollResume(cx));
  }

  // shepherd.space-name=<name> on an hc-started terminal: Herdr only shows terminals labelled
  // herdr.space=<id>, and hc can't make spaces. So find the space with that name on the
  // terminal's machine ("<machine>/t7"), make it when there is none, then set herdr.space.
  collectSpaceNameRequests(allTerminals) {
    const groups = new Map();
    for (const terminal of allTerminals) {
      if (terminal.state === "finished") continue;
      const name = oneLine(terminal.labels?.[SPACE_NAME]);
      if (!name) continue;
      const slash = terminal.address.indexOf("/");
      const machine = slash < 0 ? null : terminal.address.slice(0, slash);
      const key = JSON.stringify([machine, name]);
      const group = groups.get(key) ?? { machine, name, folder: terminal.cwd ?? "", addresses: [] };
      group.addresses.push(terminal.address);
      groups.set(key, group);
    }
    return groups;
  }

  processSpaceNameRequests(cx, allTerminals = terminals(), allSpaces = spaces()) {
    const groups = this.collectSpaceNameRequests(allTerminals);
    for (const key of this.spaceNamePending.keys()) if (!groups.has(key)) this.spaceNamePending.delete(key);
    for (const key of this.spaceNameNotified) if (!groups.has(key)) this.spaceNameNotified.delete(key);
    for (const [key, group] of groups) {
      if (this.spaceNameBusy.has(key)) continue;
      const space = allSpaces.find((s) => s.name === group.name && (s.machine ?? null) === group.machine);
      if (space) {
        cx.spawn(async (cx) => this.joinSpace(cx, key, group, space));
        continue;
      }
      // run() returns nothing: the new space turns up in spaces() on a later pass.
      const pending = this.spaceNamePending.get(key) ?? { attempts: 0, at: 0 };
      if (pending.at && Date.now() - pending.at < 10000) continue;
      if (pending.attempts >= 3) {
        if (!this.spaceNameNotified.has(key)) {
          this.spaceNameNotified.add(key);
          notify({
            title: "Shepherd",
            body: `Could not make space ${group.name}; the ${SPACE_NAME} labels remain for inspection.`,
            level: "error",
          });
        }
        continue;
      }
      pending.at = Date.now();
      pending.attempts += 1;
      this.spaceNamePending.set(key, pending);
      run("space.new", { name: group.name, folder: group.folder, machine: group.machine ?? "" });
    }
  }

  async joinSpace(cx, key, group, space) {
    this.spaceNameBusy.add(key);
    // Labels on a machine carry its own ids, without the "<machine>/" prefix.
    const id = space.id.slice(space.id.indexOf("/") + 1);
    try {
      for (const address of group.addresses) {
        const result = await hc(["label", address, `herdr.space=${id}`, `${SPACE_NAME}=`]);
        if (result.code !== 0) throw Error(result.stderr || `Could not move ${address} into space ${group.name}`);
      }
      this.spaceNamePending.delete(key);
    } catch (error) {
      notify({ title: "Shepherd", body: String(error.message ?? error), level: "error" });
    } finally {
      this.spaceNameBusy.delete(key);
      cx.notify();
    }
  }

  collectTabNameRequests(allTerminals, allPanes, allSpaces) {
    const terminalByAddress = new Map(allTerminals.map((terminal) => [terminal.address, terminal]));
    const paneByTerminal = new Map(allPanes.filter((pane) => pane.terminal).map((pane) => [pane.terminal, pane]));
    const tabsByID = new Map(allSpaces.flatMap((space) => space.tabs ?? []).map((tab) => [tab.id, tab]));
    const paneFor = (terminal) => {
      const seen = new Set();
      let current = terminal;
      while (current?.address && !seen.has(current.address)) {
        const pane = paneByTerminal.get(current.address);
        if (pane) return pane;
        seen.add(current.address);
        current = terminalByAddress.get(current.parent);
      }
      return null;
    };
    const requestsByTab = new Map();

    for (const terminal of allTerminals) {
      const keys = TAB_NAME_LABELS.filter((key) => typeof terminal.labels?.[key] === "string" && terminal.labels[key] !== "");
      const name = keys.map((key) => oneLine(terminal.labels[key])).find(Boolean);
      if (!name) continue;
      const pane = paneFor(terminal);
      const tab = pane && tabsByID.get(pane.tab);
      if (!tab) continue;
      const group = requestsByTab.get(tab.id) ?? { tab, requests: [] };
      group.requests.push({ address: terminal.address, name, keys });
      requestsByTab.set(tab.id, group);
    }
    return requestsByTab;
  }

  observeTabNameRequests(cx, requestsByTab) {
    const live = new Set();
    for (const [tabID, group] of requestsByTab) {
      live.add(tabID);
      const signature = JSON.stringify([
        group.tab.name,
        group.requests.map((request) => [request.address, request.name]).sort(([a], [b]) => a.localeCompare(b)),
      ]);
      if (this.tabNameObserved.get(tabID) === signature) continue;
      this.tabNameObserved.set(tabID, signature);
      cx.spawn(async (cx) => this.processTabNameGroup(cx, tabID, group));
    }
    for (const tabID of this.tabNameObserved.keys()) {
      if (live.has(tabID)) continue;
      this.tabNameObserved.delete(tabID);
      this.tabNamePending.delete(tabID);
      this.tabNameNotified.delete(tabID);
    }
  }

  processTabNameRequests(cx) {
    const requests = this.collectTabNameRequests(terminals(), panes(), spaces());
    if (!requests.size) return;
    cx.spawn(async (cx) => {
      for (const [tabID, group] of requests) await this.processTabNameGroup(cx, tabID, group);
    });
  }

  async processTabNameGroup(cx, tabID, group) {
    if (this.tabNameBusy.has(tabID)) return;
    const names = [...new Set(group.requests.map((request) => request.name))].sort();
    if (names.length > 1) {
      const signature = `conflict:${names.join("\u0000")}`;
      if (this.tabNameNotified.get(tabID) !== signature) {
        this.tabNameNotified.set(tabID, signature);
        notify({
          title: "Shepherd",
          body: `Conflicting shepherd.tab-name requests for tab ${group.tab.name}; use one name per tab.`,
          level: "warning",
        });
      }
      this.tabNamePending.delete(tabID);
      return;
    }

    const name = names[0];
    if (this.tabNameNotified.has(tabID) && this.tabNameNotified.get(tabID) !== `failed:${name}`)
      this.tabNameNotified.delete(tabID);
    if (group.tab.name !== name) {
      let pending = this.tabNamePending.get(tabID);
      if (pending?.name !== name) pending = { name, attempts: 0, at: 0 };
      if (pending.at && Date.now() - pending.at < 1500) return;
      if (pending.attempts >= 3) {
        const signature = `failed:${name}`;
        if (this.tabNameNotified.get(tabID) !== signature) {
          this.tabNameNotified.set(tabID, signature);
          notify({
            title: "Shepherd",
            body: `Could not apply the requested name to tab ${group.tab.name}; the label remains for inspection.`,
            level: "error",
          });
        }
        return;
      }
      pending.at = Date.now();
      pending.attempts += 1;
      this.tabNamePending.set(tabID, pending);
      run("tab.rename", { id: tabID, name });
      return;
    }

    this.tabNameBusy.add(tabID);
    try {
      for (const request of group.requests) {
        const result = await hc(["label", request.address, ...request.keys.map((key) => `${key}=`)]);
        if (result.code !== 0)
          throw Error(result.stderr || `Could not clear tab-name label from ${request.address}`);
      }
      this.tabNamePending.delete(tabID);
      this.tabNameNotified.delete(tabID);
    } catch (error) {
      notify({ title: "Shepherd", body: String(error.message ?? error), level: "error" });
    } finally {
      this.tabNameBusy.delete(tabID);
      cx.notify();
    }
  }

  // Stamps agents whose state changed. Done and idle count as one: looking at a
  // finished agent turns done into idle, and looking isn't the agent doing anything.
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now };
      dirty = true;
    }
    if (!dirty) return;
    // Gone and old: the list alone is empty right after a start.
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(this.changed)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete this.changed[k];
    localStorage.setItem("changed", JSON.stringify(this.changed));
  }

  // Keep offline pins until their terminal returns, and keep each pending until
  // core echoes the label so a failed write doesn't erase the old pin.
  migratePins(all) {
    const listed = new Map(all.filter((t) => t.state === "live").map((t) => [t.address, t]));
    const pending = this.pendingPins.filter((address) => {
      const terminal = listed.get(address);
      if (!terminal) return true;
      if (terminal.labels?.["herdr.pinned"]) return false;
      if (!this.migratingPins.has(address)) {
        this.migratingPins.add(address);
        run("terminal.pin", { terminal: address, pinned: true });
      }
      return true;
    });
    if (pending.length === this.pendingPins.length) return;
    this.pendingPins = pending;
    if (pending.length) localStorage.setItem("pins", JSON.stringify(pending));
    else localStorage.removeItem("pins");
  }

  since(a) {
    return this.changed[a.address]?.at ?? 0;
  }

  // Looking at a done agent makes it idle; it stays with Done until you leave
  // it rather than drop away under you. Any other change moves it at once.
  hold(list) {
    const cur = list.find((a) => a.focused);
    const same = cur && cur.address === this.held?.address;
    // Arriving, or any change but done turning idle, sets what it was.
    if (!same || cur.status !== "idle") this.held = cur ? { address: cur.address, rank: RANK[cur.status] ?? 0 } : null;
  }

  rank(a) {
    const sawDone = a.address === this.held?.address && this.held.rank === RANK.done && a.status === "idle";
    return sawDone ? RANK.done : RANK[a.status] ?? 0;
  }

  // ---- snooze ------------------------------------------------------------

  // The menu is its own copy of this mod (an overlay): it only writes the label.
  setSnooze(address, value) {
    const text = value ? `${SNOOZE}=${JSON.stringify(value)}` : `${SNOOZE}=`;
    hc(["label", address, text])
      .then((r) => {
        if (r.code !== 0) throw Error(r.stderr || `Could not ${value ? "snooze" : "wake"} ${address}`);
      })
      .catch((error) => {
        this.waking?.delete(address);
        notify({ title: "Shepherd", body: String(error.message ?? error), level: "error" });
      });
  }

  // Shown again at once; `waking` holds until core echoes the cleared label.
  wake(address) {
    this.waking.add(address);
    this.setSnooze(address, null);
  }

  // Snoozed agents come back when their time is up, or early when they need you
  // or finish: blocked or done, after they were something else.
  wakeDue(snoozed, now) {
    for (const [a, s] of snoozed) {
      if (a.status !== s.from) this.snoozeMoved.add(a.address);
      const news = (a.status === "blocked" || a.status === "done") && this.snoozeMoved.has(a.address);
      if ((now < s.until && !news) || this.waking.has(a.address)) continue;
      this.snoozeMoved.delete(a.address);
      this.wake(a.address);
    }
  }

  snoozeMenu(t) {
    const { address, status } = props().snoozeMenu;
    const now = Date.now();
    return v_flex()
      .w_full()
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .child(div().px(8).pt(4).pb(6).text_size(11).text_color(t.dim).child("Snooze until"))
      .children(snoozeChoices(now).map((c) => h_flex()
        .id(`snooze-${c.id}`)
        .h(31)
        .px(8)
        .gap(9)
        .rounded(7)
        .items_center()
        .text_color(t.foreground)
        .hover((el) => el.bg(t.hover))
        .on_click(() => {
          this.setSnooze(address, { until: c.until, from: status, at: now });
          closeOverlay(props().overlay);
        })
        .child(div().flex_1().child(c.label))
        .child(div().text_size(11).text_color(t.dim).child(until(c.until, now).replace("until ", "")))));
  }

  // ---- resume (Sleipnir) -------------------------------------------------

  // Terminals that kept a saved session but run no agent now: after a restart, their
  // shell is waiting. Grouped by machine; the resume command decides what's possible.
  resumeCandidates(all, listed) {
    const byMachine = new Map();
    for (const t of all) {
      if (t.state !== "live" || listed.has(t.address) || !t.labels?.[RESUME]) continue;
      const m = machineOf(t.address) ?? "";
      byMachine.set(m, [...(byMachine.get(m) ?? []), t.address]);
    }
    return byMachine;
  }

  pollResume(cx) {
    if (!window()) return; // `herdr-app check` renders without a window.
    const listed = new Set(agents().map((a) => a.address));
    const candidates = this.resumeCandidates(terminals(), listed);
    for (const m of this.resume.keys()) if (!candidates.has(m)) this.resume.delete(m);
    for (const m of candidates.keys()) {
      if ((this.resumeSkip.get(m) ?? 0) > Date.now() || this.resumeBusy.has(m)) continue;
      this.resumeBusy.add(m);
      cx.spawn(async (cx) => {
        try {
          const r = await exec("sleipnir-agent-resume", ["status"], { on: m || null });
          const out = JSON.parse(r.stdout || "{}");
          if (r.code !== 0 || out.error) throw Error(out.error || r.stderr || `exit ${r.code}`);
          const prefix = m ? `${m}/` : "";
          const items = [
            ...(out.resumed ?? []).map((i) => ({ ...i, reason: null })),
            ...(out.skipped ?? []).filter((i) => !RESUME_ELSEWHERE.has(i.reason)),
          ].map((i) => ({ ...i, address: prefix + i.terminal, machine: m || null }));
          this.resume.set(m, { at: Date.now(), items });
        } catch {
          // Not a Sleipnir machine (or the gate is off): ask again much later.
          this.resume.delete(m);
          this.resumeSkip.set(m, Date.now() + RESUME_RETRY_MS);
        } finally {
          this.resumeBusy.delete(m);
          cx.notify();
        }
      });
    }
  }

  runResume(cx, machine) {
    const m = machine ?? "";
    if (this.resumeBusy.has(m)) return;
    this.resumeBusy.add(m);
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("sleipnir-agent-resume", ["resume"], { on: machine });
        const out = JSON.parse(r.stdout || "{}");
        if (r.code !== 0 || out.error) throw Error(out.error || r.stderr || `exit ${r.code}`);
        const done = (out.resumed ?? []).length;
        const left = (out.skipped ?? []).filter((i) => !RESUME_ELSEWHERE.has(i.reason));
        notify({
          title: "Shepherd",
          body: out.busy ? "A resume is already running there." : `Resumed ${done} session${done === 1 ? "" : "s"}${left.length ? `; ${left.length} could not: ${left[0].reason}` : ""}.`,
          level: left.length ? "warning" : "success",
        });
      } catch (error) {
        notify({ title: "Shepherd", body: `Resume failed: ${String(error.message ?? error)}`, level: "error" });
      } finally {
        this.resumeBusy.delete(m);
        this.resumeSkip.delete(m);
        this.pollResume(cx);
        cx.notify();
      }
    });
  }

  resumeRow(t, item) {
    const ready = !item.reason;
    const busy = this.resumeBusy.has(item.machine ?? "");
    return h_flex()
      .id(`rs-${item.address}`)
      .mt(2)
      .px(8)
      .h(42)
      .flex_none()
      .rounded(8)
      .items_center()
      .gap(9)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { terminal: item.address }))
      .child(svg("mods/workspace-chrome/clock.svg").size(14).flex_none().text_color(t.dim))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(1)
          .child(div().min_w(0).truncate().text_color(t.foreground).child(item.where || item.cwd || item.address))
          .child(div().min_w(0).truncate().text_size(11).text_color(ready ? t.dim : t.blocked).child(`${item.agent} · ${item.reason ?? "ready to resume"}`)),
      )
      .when(ready, (el) => el.child(
        div()
          .id(`rs-go-${item.address}`)
          .flex_none()
          .px(6)
          .h(20)
          .flex()
          .items_center()
          .rounded(5)
          .border(1)
          .border_color(t.border)
          .text_size(11)
          .text_color(busy ? t.dim : t.foreground)
          .hover((s) => s.bg(t.hover))
          .tooltip("Resume the waiting sessions on this machine")
          .on_click((_e, cx) => {
            cx.stop_propagation();
            this.runResume(cx, item.machine);
          })
          .child(busy ? "Resuming…" : "Resume"),
      ));
  }

  // ---- rows --------------------------------------------------------------

  sortMenu(t) {
    const on = sortOf().id;
    return v_flex()
      .w_full()
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .child(div().px(8).pt(4).pb(6).text_size(11).text_color(t.dim).child("Sort agents"))
      .children(SORTS.map((s) => h_flex()
        .id(`sort-${s.id}`)
        .h(31)
        .px(8)
        .gap(9)
        .rounded(7)
        .items_center()
        .text_color(t.foreground)
        .hover((el) => el.bg(t.hover))
        .on_click(() => {
          setShared("agents.sort", s.id);
          closeOverlay(props().overlay);
        })
        .child(svg(`mods/workspace-chrome/${s.icon}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().child(s.label))
        .when(s.id === on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.foreground)))));
  }

  peek(addr) {
    run("terminal.peek", { terminal: addr });
  }

  // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
  tree(all, addr, lead = []) {
    const kids = all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        { t: k, lines: [...lead, last ? "└" : "├"] },
        ...this.tree(all, k.address, [...lead, last ? "" : "│"]),
      ];
    });
  }

  subRow(t, s, shown, compact) {
    const k = s.t;
    const st = kidStatus(k, this.listed);
    const pic = icon(k.program, 14, t.foreground);
    const on = k.address === shown;
    return h_flex()
      .id(`sub-${k.address}`)
      .mt(2)
      .pl(39)
      .pr(8)
      .rounded(8)
      .h(26)
      .flex_none()
      .gap(0)
      .items_center()
      .text_size(12.5)
      .when(on, (el) => el.bg(t.raised))
      .hover((s) => s.bg(t.hover))
      .on_click(() => this.peek(k.address))
      .children(s.lines.map(l => div().self_start().mt(-4).w(9).h(17).mr(4).flex_none()
        .when(Boolean(l), el => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", el => el.border_b(1.5).rounded_bl(6))))
      .when(Boolean(pic), el => el.child(div().mr(8).child(pic)))
      .child(div().flex_1().truncate().text_color(on ? t.foreground : t.muted).child(k.name || k.template || k.program?.name || k.address))
      .child(this.status(t, { status: st }, compact));
  }

  // compact: a ! for blocked where a header already says "Needs you".
  status(t, a, compact = false) {
    const color = t[a.status] ?? t.dim;
    if (a.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
    if (a.status === "blocked" && compact) return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (a.status === "blocked") return div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
    // Idle: a ring; done: a dot.
    if (a.status === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return div().size(7).mx(3).flex_none().rounded(4).bg(a.status === "done" ? color : t.dim + "00");
  }

  prPill(t, id, pr) {
    const color = pr.state === "approved" ? t.done : pr.state === "changes_requested" ? t.blocked : pr.state === "draft" ? t.dim : t.accent;
    return div()
      .id(id)
      .flex_none()
      .px(4)
      .h(15)
      .flex()
      .items_center()
      .rounded(4)
      .border(1)
      .border_color(color + "66")
      .text_size(10)
      .font_medium()
      .text_color(color)
      .cursor_pointer()
      .hover((s) => s.bg(color + "1f"))
      .tooltip(`${pr.kind === "mr" ? "Merge request" : "Pull request"} #${pr.n}${PR_STATE[pr.state] ? ` · ${PR_STATE[pr.state]}` : ""}`)
      .on_click((_e, cx) => {
        cx.stop_propagation();
        openURL(pr.url);
      })
      .child(`${pr.kind === "mr" ? "!" : "#"}${pr.n}`);
  }

  hoverButton(t, id, iconName, tip, action) {
    return div()
      .id(id)
      .flex_none()
      .p(2)
      .rounded(4)
      .text_color(t.dim)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip)
      .on_click((_e, cx) => {
        cx.stop_propagation();
        action();
        // The row moves away from under the pointer, and no hover-out comes.
        this.hovered = null;
        cx.notify();
      })
      .child(svg(`mods/workspace-chrome/${iconName}.svg`).size(13));
  }

  // Over the row's icon, while hovered: pins or unpins its terminal. Closing lives in
  // the row's right-click menu, so it is not one stray click away.
  pinButton(t, key, terminal, isPinned) {
    return div()
      .id(`pin-${key}`)
      .size(20)
      .flex_none()
      .flex()
      .items_center()
      .justify_center()
      .rounded(5)
      .text_color(isPinned ? t.foreground : t.dim)
      .cursor_pointer()
      .hover((s) => s.bg(t.input ?? t.border).text_color(t.foreground))
      .tooltip(isPinned ? "Unpin" : "Pin to the top")
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run("terminal.pin", { terminal, pinned: !isPinned });
        // The row moves away from under the pointer, and no hover-out comes.
        this.hovered = null;
        cx.notify();
      })
      .child(svg(`mods/workspace-chrome/${isPinned ? "pin-off" : "pin"}.svg`).size(13));
  }

  // Right-click on a row: Herdr's own tab menu for the row's tab, as the tabs bar opens it.
  tabMenu(ctx, tab) {
    return (_e, cx) => {
      cx.stop_propagation();
      if (!tab) return;
      openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: tab, space: ctx.spaceOfTab.get(tab) } } });
    };
  }

  // A plain terminal: as tall as an agent's row, its tab (and pane name) over what
  // runs in it and its folder. No status; on hover, pin over the icon on the left, as
  // an agent's row. Right-click for its tab's menu.
  terminalRow(t, p, ctx, at = "") {
    const key = `${at}pane-${p.pane}`;
    const terminal = ctx.terminalByAddress.get(p.terminal);
    const tabName = tabLabel(ctx.tabByID.get(p.tab), p.program);
    const paneName = oneLine(terminal?.labels?.[PANE_NAME]);
    const firstLine = paneName && paneName !== tabName ? `${tabName} · ${paneName}` : tabName;
    const running = p.program && !p.program.shell && p.program.name ? p.program.name : "";
    const second = [running, folder(p.cwd)].filter(Boolean).join(" · ") || clean(p.title);
    const isPinned = Boolean(terminal?.labels?.["herdr.pinned"]);
    const hovered = this.hovered === key;
    const pic = icon(p.program, 16, t.dim) ?? div().size(16).flex_none().flex().items_center().justify_center()
      .rounded(4).border(1.5).border_color(t.input).text_size(7.5).font_bold().text_color(t.dim).child(">_");
    return h_flex()
      .id(`tm-${at}${p.pane}`)
      .relative()
      .mt(2)
      .px(8)
      .h(42)
      .flex_none()
      .rounded(8)
      .items_center()
      .gap(9)
      .when(ctx.focusedPane === p.pane, (el) => el.bg(t.selected))
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_hover((on, cx) => {
        if (on) this.hovered = key;
        else if (this.hovered === key) this.hovered = null;
        cx.notify();
      })
      .on_click(() => run("pane.focus", { pane: p.pane }))
      .on_mouse_down("right", this.tabMenu(ctx, p.tab))
      .child(hovered && p.terminal ? div().size(16).flex_none() : pic)
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(1)
          .child(div().min_w(0).truncate().text_color(t.muted).child(firstLine))
          .child(div().min_w(0).truncate().text_size(11).text_color(t.dim).child(second || " ")),
      )
      .child(div().w(14).flex_none())
      .when(hovered && Boolean(p.terminal), (el) => el.child(
        div().absolute().left(6).top(0).bottom(0).w(20).flex().items_center()
          .child(this.pinButton(t, key, p.terminal, isPinned)),
      ));
  }

  // A header's 20px icon button (a space's or a machine's + and fold): its own hover,
  // and a press on it is not a press on the header (no drag, no switch).
  headerButton(t, id, tip, child, action) {
    return div()
      .id(id)
      .size(20)
      .flex_none()
      .flex()
      .items_center()
      .justify_center()
      .rounded(5)
      .text_color(t.dim)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tip)
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => {
        cx.stop_propagation();
        action(cx);
      })
      .child(child);
  }

  // Shepherd: a space's rows are its tabs, so they drag like the tabs bar's tabs. A row
  // (and its sub-agents) dropped on another tab's row in the same space moves its tab
  // there; a tab with several panes moves them all.
  tabDrag(t, w, tab, key, children) {
    const tabs = w.tabs ?? [];
    const from = this.tabPressed?.space === w.id ? tabs.findIndex((x) => x.id === this.tabPressed.tab) : -1;
    const here = tabs.findIndex((x) => x.id === tab);
    return v_flex()
      .relative()
      .id(`tab-drag-${key}`)
      .flex_none()
      .when(from >= 0 && this.tabPressed.tab === tab && this.tabOver !== null && this.tabOver !== tab, (el) => el.opacity(0.5))
      .when(from >= 0 && this.tabOver === tab && this.tabPressed.tab !== tab, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(from < here, (line) => line.bottom(0))
          .when(from > here, (line) => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.tabPressed = { space: w.id, tab };
        this.tabOver = tab;
      })
      .on_mouse_move((_e, cx) => {
        if (!this.tabPressed) return;
        const over = this.tabPressed.space === w.id ? tab : null;
        if (this.tabOver !== over) {
          this.tabOver = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const source = this.tabPressed;
        this.tabPressed = null;
        this.tabOver = null;
        if (source?.space === w.id && source.tab !== tab && here >= 0) run("tab.move", { id: source.tab, index: here + 1 });
        cx.notify();
      })
      .children(children);
  }

  // A space: avatar (a branch for a worktree under its checkout), name, git, then
  // + (switch there and open the shipped New menu) and the fold chevron. Folded, how many rows it hides.
  // Click to switch, right-click for its menu, drag to reorder.
  spaceHeader(t, { w, i, g, tree }, members) {
    const id = `sp-${w.id}`;
    const open = !this.folded.has(id);
    const top = members.reduce((m, it) => ((RANK[it.status] ?? 0) > (RANK[m] ?? 0) ? it.status : m), null);
    const button = (bid, tip, child, action) => this.headerButton(t, bid, tip, child, action);
    return h_flex()
      .relative()
      .id(id)
      .mt(6)
      .h(30)
      .px(8)
      .flex_none()
      .gap(8)
      .items_center()
      .rounded(8)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .when(this.pressed === i && this.over !== i, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === i && this.pressed !== i, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(this.pressed < i, (line) => line.bottom(0))
          .when(this.pressed > i, (line) => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = i;
        this.over = i;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces()[this.pressed];
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? i : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === i && from !== i) run("space.move", { id: spaces()[from].id, index: i + 1 });
        else if (from === i) run("space.select", { id: w.id });
        cx.notify();
      })
      // A popup is as tall as its items; height is only the most.
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } }))
      .child(tree
        ? h_flex().w(18).flex_none().justify_center().child(svg("mods/workspace-chrome/branch.svg").size(13).text_color(t.dim))
        : h_flex().size(18).flex_none().rounded(5).bg(avatarFill(t, w.id)).items_center().justify_center()
          .text_size(10.5).font_bold().text_color("#ffffff").child([...w.name][0]?.toUpperCase() ?? "?"))
      .child(div().flex_none().max_w(120).truncate().font_medium().text_color(w.active ? t.foreground : t.muted).child(w.name))
      .child(div().flex_1())
      .when(Boolean(g), (el) => el.child(gitTail(t, g, tree, w.name)))
      .when(!open && members.length > 0, (el) => el.child(div().flex_none().text_size(11).text_color(t[top] ?? t.dim).child(String(members.length))))
      .child(button(`sp-new-${w.id}`, "New terminal or agent here", svg("mods/workspace-chrome/plus.svg").size(13), () => {
        // The shipped New menu works on the active space: switch there first, then open
        // it the way the tab bar's + does.
        run("space.select", { id: w.id });
        openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 });
      }))
      .child(button(`sp-fold-${w.id}`, open ? "Fold" : "Unfold", chevron(open), (cx) => {
        open ? this.folded.add(id) : this.folded.delete(id);
        cx.notify();
      }));
  }

  // A machine's header, once one isn't this computer: + for a space there, the fold
  // chevron (the same buttons as a space's header), a rebuilt machine's Connect.
  // Drag it onto another machine's header to reorder; `shown` is the order on screen.
  machineHeader(t, m, shown) {
    const sp = this.sp;
    const repair = sp.reconnecting[m];
    const machine = sp.machines.find((k) => k.name === m) ?? repair?.machine;
    const connected = !m || machine?.state === "connected";
    const rebuilt = sp.rebuilt(machine) || !!repair;
    const folded = sp.foldedMachines.has(m);
    const dragging = this.machinePressed !== undefined;
    const from = shown.indexOf(this.machinePressed), here = shown.indexOf(m);
    return h_flex().relative().id(`machine-${m ?? "local"}`).mt(8).h(26).flex_none().px(8).gap(7).items_center().text_size(11).text_color(t.dim)
      .rounded(6)
      .when(dragging && this.machinePressed === m && this.machineOver !== m, (el) => el.opacity(0.5))
      .when(dragging && this.machineOver === m && this.machinePressed !== m, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(from < here, (line) => line.bottom(0))
          .when(from > here, (line) => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.machinePressed = m;
        this.machineOver = m;
      })
      .on_mouse_move((_e, cx) => {
        if (this.machinePressed !== undefined && this.machineOver !== m) {
          this.machineOver = m;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const source = this.machinePressed;
        this.machinePressed = undefined;
        this.machineOver = undefined;
        if (source !== undefined && source !== m) sp.moveMachine(source, m, shown);
        cx.notify();
      })
      .child(svg(`mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(13).flex_none())
      .child(div().flex_1().truncate().child(m ?? "This computer"))
      .when(!connected && !rebuilt, (el) => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
      .when(rebuilt, (el) => el.child(h_flex().flex_none().gap(3).items_center()
        .child(div().max_w(140).truncate().child(repair?.error || "rebuilt ·"))
        .child(div().id(`machine-connect-${m}`).text_color(repair?.error ? t.blocked : t.muted)
          .hover((s) => s.text_color(t.foreground))
          .tooltip(repair?.error || "This machine was rebuilt or replaced. Click to connect to the new one.")
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => { cx.stop_propagation(); sp.reconnect(machine, cx); })
          .child(repair?.busy ? "Connecting…" : "Connect"))))
      .child(div().size(6).rounded(3).flex_none().bg(connected ? t.ansi2 : t.dim))
      .when(connected, (el) => el.child(this.headerButton(t, `machine-add-${m ?? "local"}`, "New space there",
        svg("mods/workspace-chrome/plus.svg").size(13), () => run("space.new", { machine: m ?? "" }))))
      .child(this.headerButton(t, `machine-fold-${m ?? "local"}`, folded ? "Unfold" : "Fold", chevron(!folded), (cx) => {
        sp.toggleMachine(m);
        cx.notify();
      }));
  }

  render(cx) {
    const t = theme();
    if (props()?.sortMenu) return this.sortMenu(t);
    if (props()?.snoozeMenu) return this.snoozeMenu(t);
    const collapsed = narrow();
    noteWidth();
    // The built-in top-left button (workspace-chrome), or a drag of the edge, narrows the
    // sidebar to the rail: Shepherd turns that into hiding it. Once per second at most,
    // while the change lands.
    if (collapsed && !(this.hidingUntil > Date.now())) {
      this.hidingUntil = Date.now() + 1000;
      hideSidebar();
    }
    const sort = sortOf();
    let list = agents();
    this.listed = new Map(list.map((a) => [a.address, a.status]));
    const all = terminals();
    const allPanes = panes();
    const allSpaces = spaces();
    this.observeTabNameRequests(cx, this.collectTabNameRequests(all, allPanes, allSpaces));
    this.processSpaceNameRequests(cx, all, allSpaces);
    const terminalByAddress = new Map(all.map((terminal) => [terminal.address, terminal]));
    const paneByID = new Map(allPanes.map((pane) => [pane.pane, pane]));
    const tabByID = new Map(allSpaces.flatMap((space) => space.tabs ?? []).map((tab) => [tab.id, tab]));
    const spaceOfTab = new Map(allSpaces.flatMap((space) => (space.tabs ?? []).map((tab) => [tab.id, space.id])));
    const ctx = { terminalByAddress, tabByID, spaceOfTab, focusedPane: focused()?.pane ?? null };
    assignColors();
    this.migratePins(all);
    const shown = focused()?.agent;
    const now = Date.now();
    this.track(list, now);
    this.hold(list);

    // Snoozed agents leave the list for their own folded group at the end.
    const snoozes = new Map();
    for (const a of list) {
      const s = snoozeOf(terminalByAddress.get(a.address));
      if (s) snoozes.set(a.address, s);
    }
    this.wakeDue(list.filter((a) => snoozes.has(a.address)).map((a) => [a, snoozes.get(a.address)]), now);
    for (const k of this.snoozeMoved) if (!snoozes.has(k)) this.snoozeMoved.delete(k);
    for (const k of this.waking) if (!snoozes.has(k)) this.waking.delete(k);
    // The first look for sessions to resume; the timer keeps looking after that.
    if (!this.resumeLooked) {
      this.resumeLooked = true;
      this.pollResume(cx);
    }
    const isSnoozed = (a) => snoozes.has(a.address) && !this.waking.has(a.address);
    const snoozed = list.filter(isSnoozed).sort((x, y) => snoozes.get(x.address).until - snoozes.get(y.address).until);
    list = list.filter((a) => !isSnoozed(a));

    const byPriority = sort.id === "priority";
    const urgency = new Map(list.map((a) => [a.address, Math.max(this.rank(a), ...this.tree(all, a.address).map((s) => RANK[kidStatus(s.t, this.listed)] ?? 0))]));
    const rankOf = (a) => urgency.get(a.address);
    if (byPriority) list = [...list].sort((x, y) => rankOf(y) - rankOf(x) || this.since(y) - this.since(x) || y.seq - x.seq);
    const pinned = list.filter((a) => a.pinned);
    const rest = list.filter((a) => !a.pinned);
    list = [...pinned, ...rest];
    setAgentOrder([...list, ...snoozed].map((a) => a.address));

    // `at` keys a row by where it's drawn: a pinned one shows twice, in Pinned and in its space.
    const withKids = (a, i, at = "") => {
      const subs = collapsed ? [] : this.tree(all, a.address);
      const r = row(a, i, subs, at);
      if (this.folded.has(a.address)) return [r];
      return [r, ...subs.map((s) => this.subRow(t, s, shown, byPriority))];
    };

    // The fold chevron; folded, the count too, colored by the most urgent one.
    const fold = (a, subs) => {
      const sts = subs.map((s) => kidStatus(s.t, this.listed));
      const top = sts.reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null);
      const open = !this.folded.has(a.address);
      return div()
        .id(`fold-${a.address}`)
        .h(18)
        .px(3)
        .gap(3)
        .flex()
        .items_center()
        .rounded(4)
        .text_size(11)
        .text_color(open ? t.dim : (t[top] ?? t.dim))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          open ? this.folded.add(a.address) : this.folded.delete(a.address);
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none())
        .when(!open, (el) => el.child(String(subs.length)));
    };

    const row = (a, i, subs = [], at = "") => {
      const hk = at + a.address;
      const pic = icon(a.program, 16, t.foreground);
      if (collapsed) {
        return h_flex()
          .id(`ag-${a.address}`)
          .mt(2)
          .h(26)
          .px(8)
          .flex_none()
          .items_center()
          .gap(4)
          .hover((s) => s.bg(t.hover))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(div().flex_1().min_w(0).whitespace_nowrap().text_right().text_color(t.muted).child(String(i + 1)))
          .child(h_flex().w(14).flex_none().items_center().justify_center().child(this.status(t, a, true)));
      }
      const idle = a.status === "idle" && !a.focused;
      const isPinned = a.pinned;
      const snooze = isSnoozed(a) ? snoozes.get(a.address) : null;
      const terminal = terminalByAddress.get(a.address);
      const pane = paneByID.get(a.pane);
      const tab = tabByID.get(a.tab);
      // First line: the tab, then this terminal's shepherd.pane-name, if any. Second line:
      // the title the agent keeps up to date.
      const tabName = tab?.name || a.program?.name || "Terminal";
      const paneName = oneLine(terminal?.labels?.[PANE_NAME]);
      const firstLine = paneName && paneName !== tabName ? `${tabName} · ${paneName}` : tabName;
      const title = terminalTitle(pane, a);
      const pr = jsonLabel(terminal, SESSION)?.pr;
      const hovered = this.hovered === hk;
      return h_flex()
        .id(`ag-${hk}`)
        .relative()
        .mt(2)
        .px(8)
        .h(42)
        .flex_none()
        .rounded(8)
        .items_center()
        .gap(9)
        .when(a.focused, (el) => el.bg(t.selected))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_hover((on, cx) => {
          if (on) this.hovered = hk;
          else if (this.hovered === hk) this.hovered = null;
          cx.notify();
        })
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .on_mouse_down("right", this.tabMenu(ctx, a.tab))
        .when(Boolean(pic), el => el.child(div().id(`agent-fold-${hk}`).size(16).flex_none()
          .when(subs.length > 0, el => el.on_click((_e, cx) => {
            cx.stop_propagation();
            this.folded.has(a.address) ? this.folded.delete(a.address) : this.folded.add(a.address);
            cx.notify();
          })).when(!(hovered && a.address), el => el.child(pic))))
        .child(
          v_flex()
            .flex_1()
            .min_w(0)
            .gap(1)
            .child(div().min_w(0).truncate().text_color(idle || snooze ? t.muted : t.foreground).child(firstLine))
            .child(
              h_flex()
                .min_w(0)
                .gap(5)
                .items_center()
                .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child(snooze ? `${until(snooze.until, now)} · ${title}` : title))
                .when(typeof pr?.n === "number", (el) => el.child(this.prPill(t, `pr-${hk}`, pr))),
            ),
        )
        .when(subs.length > 0, el => el.child(fold(a, subs)))
        .when(hovered && !snooze, el => el
          .child(this.hoverButton(t, `snooze-${hk}`, "clock", "Snooze", () => openOverlay({
            mod: "workspace-agents", kind: "popup", width: 220, height: 150,
            props: { snoozeMenu: { address: a.address, status: a.status } },
          }))))
        .when(hovered && Boolean(snooze), el => el
          .child(this.hoverButton(t, `wake-${hk}`, "x", "Wake now", () => this.wake(a.address))))
        .when(hovered && Boolean(a.address), (el) => el.child(
          div().absolute().left(6).top(0).bottom(0).w(20).flex().items_center()
            .child(this.pinButton(t, `ag-${hk}`, a.address, isPinned)),
        ))
        .child(h_flex().h(20).flex_none().items_center()
          .child(this.status(t, a, byPriority && !isPinned && !snooze)));
    };

    // Rows are items: an agent ({ a, status }) or a plain terminal's pane ({ p }).
    const agentPane = new Set([...list, ...snoozed].map((a) => a.pane).filter(Boolean));
    const isPinnedPane = (p) => Boolean(terminalByAddress.get(p.terminal)?.labels?.["herdr.pinned"]);
    const termPanes = allPanes.filter((p) => p.terminal && !agentPane.has(p.pane) && tabByID.has(p.tab));
    const item = (a) => ({ a, status: a.status });
    const draw = (it, i) => (it.a ? withKids(it.a, i, it.at) : [this.terminalRow(t, it.p, ctx, it.at)]);
    const pinnedItems = [...pinned.map((a) => ({ ...item(a), at: "pin:" })), ...termPanes.filter(isPinnedPane).map((p) => ({ p, at: "pin:" }))];
    const groups = pinnedItems.length ? [{ id: "pinned", label: "Pinned", status: null, members: pinnedItems }] : [];
    const spaceRows = [];
    if (byPriority) {
      for (const a of rest) {
        const r = rankOf(a) || RANK.idle;
        const id = `sec-${r}`;
        if (groups.at(-1)?.id === id) groups.at(-1).members.push(item(a));
        else groups.push({ id, label: SECTION[r], status: SECTION_STATUS[r], members: [item(a)] });
      }
      const terms = termPanes.filter((p) => !isPinnedPane(p)).map((p) => ({ p }));
      if (terms.length) groups.push({ id: "terminals", label: "Terminals", status: null, members: terms });
    } else {
      // Every space in order, its tabs' panes in order, pinned ones too (they also sit
      // in Pinned); agents placed nowhere else follow.
      const byPane = new Map([...pinned, ...rest].map((a) => [a.pane, a]));
      const placed = new Set();
      const ordered = this.sp.ordered();
      const membersOf = (w) => (w.tabs ?? []).flatMap((tab) => allPanes.filter((p) => p.tab === tab.id).flatMap((p) => {
        const a = byPane.get(p.pane);
        if (a) { placed.add(a.address); return [item(a)]; }
        return termPanes.includes(p) ? [{ p }] : [];
      }));
      // A space: its header, then rows indented behind a rail in the space's avatar color.
      const drawSpace = (r) => {
        const members = membersOf(r.w);
        const open = !this.folded.has(`sp-${r.w.id}`) && members.length > 0;
        return [
          this.spaceHeader(t, r, members),
          ...(open ? [h_flex().flex_none().items_stretch().pl(12).gap(2)
            .child(div().w(2).flex_none().my(2).rounded(1).bg(avatarFill(t, r.w.id)).opacity(0.55))
            .child(v_flex().flex_1().min_w(0).children(members.map((it, i) => {
              const tab = it.a ? it.a.tab : it.p.tab;
              const key = it.a ? `ag-${it.a.address}` : `pane-${it.p.pane}`;
              return tab ? this.tabDrag(t, r.w, tab, key, draw(it, i)) : draw(it, i);
            }).flat()))] : []),
        ];
      };
      const remote = this.sp.remotes(ordered);
      const shownMachines = remote.length ? this.sp.orderMachines([null, ...remote]) : [null];
      let machineIndex = 0;
      for (const m of shownMachines) {
        const mine = ordered.filter((r) => (r.w.machine ?? null) === m);
        if (remote.length) {
          if (machineIndex > 0) spaceRows.push(div().h(1).mx(8).mt(2).flex_none().bg(t.border));
          spaceRows.push(this.machineHeader(t, m, shownMachines));
          machineIndex++;
          if (this.sp.foldedMachines.has(m)) { mine.forEach((r) => membersOf(r.w)); continue; }
        }
        if (!mine.length && this.sp.loading(m)) spaceRows.push(div().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(8).flex().items_center().text_size(12).text_color(t.dim).child("Loading…"));
        spaceRows.push(...mine.flatMap(drawSpace));
      }
      const others = rest.filter((a) => !placed.has(a.address)).map(item);
      if (others.length) groups.push({ id: "elsewhere", label: "Elsewhere", status: null, members: others, counted: true, after: true });
    }
    if (snoozed.length) groups.push({ id: "snoozed", label: "Snoozed", status: null, members: snoozed.map(item), counted: true, after: true });

    // Sessions waiting for Sleipnir's resume, first: they're why a pane shows a bare shell.
    const resumable = [...this.resume.values()].flatMap((r) => r.items);

    // A group's header; it folds the group. Folded, it says how many and the most urgent state.
    const header = (g) => {
      const open = !this.folded.has(g.id);
      const top = g.members.reduce((m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m), null);
      return h_flex()
        .id(g.id)
        .px(8)
        .pt(8)
        .h(30)
        .flex_none()
        .gap(6)
        .items_center()
        .text_size(11)
        .font_medium()
        .cursor_pointer()
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => {
          open ? this.folded.add(g.id) : this.folded.delete(g.id);
          cx.notify();
        })
        .child(div().truncate().text_color(t[g.status] ?? t.dim).child(g.label))
        .when(byPriority || g.counted || !open, (el) => el.child(div().text_color(t.dim).child(String(g.members.length))))
        .child(div().flex_1())
        .when(!open, (el) => el
          .when(!byPriority && top && top !== "idle", (el) => el.child(this.status(t, { status: top }, true)))
          .child(svg("mods/workspace-chrome/chevron-right.svg").size(11).flex_none().text_color(t.dim)));
    };
    const resumeGroup = { id: "resume", label: "Resume", status: null, members: resumable, counted: true };
    const rows = collapsed
      ? list.flatMap((a, i) => withKids(a, i))
      : [
        ...(resumable.length ? [header(resumeGroup), ...(this.folded.has("resume") ? [] : resumable.map((item) => this.resumeRow(t, item)))] : []),
        ...groups.filter((g) => !g.after).flatMap((g) => [header(g), ...(this.folded.has(g.id) ? [] : g.members.flatMap(draw))]),
        ...spaceRows,
        ...groups.filter((g) => g.after).flatMap((g) => [header(g), ...(this.folded.has(g.id) ? [] : g.members.flatMap(draw))]),
      ];

    // The list sits above the quota: the line between them is this list's bottom edge.
    return v_flex()
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .border_b(1)
      .border_color(t.border)
      .text_size(13)
      .when(rows.length === 0 && !collapsed, (el) =>
        el.child(div().px(12).text_size(12).text_color(t.dim).child(byPriority
          ? "No agents or terminals yet. Agents show up here when they report their status. Older versions and agents inside tmux may not."
          : "No spaces yet.")),
      )
      .child(v_flex().id("ag-list").flex_1().min_h(0).px(collapsed ? 0 : 8).pb(collapsed ? 0 : 14).overflow_y_scrollbar().mode("always")
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; this.over = null; this.machinePressed = undefined; this.machineOver = undefined; this.tabPressed = null; this.tabOver = null; cx.notify(); })
        .children(rows))
      .when(collapsed, (el) =>
        el.child(
          h_flex()
            .h(28)
            .items_center()
            .justify_center()
            .child(
              div()
                .id("collapse")
                .text_size(13)
                .text_color(t.dim)
                .hover((s) => s.text_color(t.foreground))
                .on_click(toggleSidebar)
                .child("»"),
            ),
        ),
      );
  }
}
