// Context menus, cloned from the shipped `menu` mod (0.1.12). Opened as a popup with
// props { tab: "pane" | "tab" | "space" | "global", target }; the layout's
// `terminal_menu` opens it for a terminal's right-click too.
// ↑/↓ move, Enter runs, Esc closes. An item is [label, command, args];
// a command "worktree" opens the worktree dialog instead.
//
// Shepherd additions:
//   - pane and tab menus copy what an agent needs to find a terminal: its address, its pane
//     ID (for herdr-app commands), the herdr-core labels of its tab and space, its folder,
//     or all of that as one block with the commands to read, message and show it.
//   - target.withTab (the sidebar's pane rows) adds the pane's tab: Rename tab, Close tab.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, openOverlay, theme, keys, terminals, spaces, panes, agents, exec, notify } from "herdr";

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// A space's checkout: "main" (a repo's own), "linked" (a worktree), or null.
async function checkout(folder, on) {
  const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: folder, on });
  const common = await exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: folder, on });
  if (top.code !== 0 || common.code !== 0) return null;
  return common.stdout.trim() === `${top.stdout.trim()}/.git` ? "main" : "linked";
}

const machineOf = (address) => (address?.includes("/") ? address.slice(0, address.indexOf("/")) : null);

// The app's ids carry "<machine>/" for other machines; herdr-core labels don't.
const localId = (id) => (id?.includes("/") ? id.slice(id.indexOf("/") + 1) : id);

function tabInfo(tabId) {
  for (const s of spaces()) {
    const tab = (s.tabs ?? []).find((c) => c.id === tabId);
    if (tab) return { tab, space: s };
  }
  return { tab: null, space: null };
}

const tabName = (tab, index) => (tab && !/^tb[0-9a-f]+$/.test(tab.name) ? tab.name : tab ? `Tab ${index + 1}` : "Tab");

// One terminal, as an agent on any machine can find it again.
function terminalFacts(address, host) {
  const term = terminals().find((t) => t.address === address);
  const pane = panes().find((p) => p.terminal === address);
  const agent = agents().find((a) => a.address === address);
  const { tab, space } = tabInfo(pane?.tab ?? agent?.tab);
  const machine = machineOf(address) ?? space?.machine ?? null;
  const index = space ? space.tabs.findIndex((c) => c.id === tab?.id) : 0;
  return {
    address,
    machine: machine ?? (host ? `${host} (the computer running Herdr)` : "the computer running Herdr"),
    program: agent?.program?.name ?? pane?.program?.name ?? term?.program?.name ?? null,
    status: agent?.status ?? null,
    name: term?.labels?.["shepherd.pane-name"] || pane?.name || null,
    tabName: tabName(tab, index),
    tabLabel: term?.labels?.["herdr.tab"] ?? localId(tab?.id) ?? null,
    spaceName: space?.name ?? null,
    spaceLabel: term?.labels?.["herdr.space"] ?? localId(space?.id) ?? null,
    folder: pane?.cwd ?? term?.foreground?.cwd ?? term?.cwd ?? null,
    pane: pane?.pane ?? null,
  };
}

function agentBlock(f) {
  return [
    `Herdr terminal ${f.address}${f.name ? ` (${f.name})` : ""}`,
    f.program && `- program: ${f.program}${f.status ? ` (${f.status})` : ""}`,
    `- machine: ${f.machine}`,
    `- tab: ${f.tabName}${f.tabLabel ? ` (herdr.tab=${f.tabLabel})` : ""}`,
    f.spaceName && `- space: ${f.spaceName}${f.spaceLabel ? ` (herdr.space=${f.spaceLabel})` : ""}`,
    f.folder && `- folder: ${f.folder}`,
    f.pane && `- pane: ${f.pane}`,
    `- read it: hc read ${f.address} --lines 100`,
    `- message it: hc send ${f.address} "<message>"`,
    f.pane && `- show it in Herdr (on the computer running Herdr): herdr-app do pane.focus --pane ${f.pane}`,
  ].filter(Boolean).join("\n");
}

// The copy items for a set of terminals (one pane, or every pane of a tab).
function copyItems(addresses, host) {
  const facts = addresses.map((a) => terminalFacts(a, host));
  if (facts.length === 0) return [];
  const f = facts[0];
  const list = [["Copy for agent", "copy", { text: facts.map(agentBlock).join("\n\n") }]];
  list.push([facts.length === 1 ? "Copy terminal address" : "Copy terminal addresses", "copy", { text: facts.map((x) => x.address).join("\n") }]);
  const paneIds = facts.map((x) => x.pane).filter(Boolean);
  if (paneIds.length) list.push([paneIds.length === 1 ? "Copy pane ID" : "Copy pane IDs", "copy", { text: paneIds.join("\n") }]);
  if (f.tabLabel) list.push(["Copy tab ID", "copy", { text: f.tabLabel }]);
  if (f.folder) list.push(["Copy folder", "copy", { text: f.folder }]);
  return list;
}

function items(p, git, host) {
  p = p ?? {};
  const tg = p.target ?? {};
  switch (p.tab) {
    case "pane": {
      // A kept sub-agent can go back under its parent, still running.
      const all = terminals();
      const term = all.find((t) => t.address === tg.terminal);
      const parent = term?.parent && all.find((t) => t.address === term.parent);
      // Once they go to the program, Shift+right-click still opens this menu.
      const toProgram = term?.labels?.["herdr.right-click"] === "program";
      // A terminal shown outside a tab (a layout terminal block, a window) has
      // no pane to split, zoom or close: its pane is the block's id.
      const pane = panes().find((x) => x.pane === tg.pane);
      const inTab = Boolean(pane);
      const tabId = tg.tab ?? pane?.tab;
      return [
        ...(inTab
          ? [
              ["Rename", "pane.rename", { pane: tg.pane }],
              ["Split right", "pane.split", { direction: "right", pane: tg.pane }],
              ["Split down", "pane.split", { direction: "down", pane: tg.pane }],
              [pane.zoomed ? "Unzoom" : "Zoom", "pane.zoom", { pane: tg.pane }],
            ]
          : []),
        ...(term
          ? [
              toProgram
                ? ["Use Herdr right-click menu", "terminal.right_click", { terminal: term.address, to: "menu" }]
                : ["Send right-clicks to pane", "terminal.right_click", { terminal: term.address, to: "program" }],
            ]
          : []),
        ...(parent ? [[`Send back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }]] : []),
        ...(tg.withTab && tabId ? [["Rename tab", "tab.rename", { id: tabId }]] : []),
        ...copyItems(term ? [term.address] : [], host),
        ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }]] : []),
        ...(tg.withTab && tabId ? [["Close tab", "tab.close", { id: tabId }]] : []),
      ];
    }
    case "tab": {
      const addresses = panes().filter((x) => x.tab === tg.id && x.terminal).map((x) => x.terminal);
      return [
        ["Rename", "tab.rename", { id: tg.id }],
        ["New tab", "tab.new", { space: tg.space }],
        ...copyItems(addresses, host),
        ["Close", "tab.close", { id: tg.id }],
      ];
    }
    case "space":
      return [
        ["Rename", "space.rename", { id: tg.id }],
        ...(git ? [["New worktree", "worktree", { space: tg.id, action: "new" }], ["Open worktree", "worktree", { space: tg.id, action: "open" }]] : []),
        ...(git === "linked" ? [["Remove worktree", "worktree", { space: tg.id, action: "remove" }]] : []),
        ["Close", "space.close", { id: tg.id }],
      ];
    default:
      return [
        ["New space", "space.new", {}],
        ["Keybinds", "app.help", {}],
        ["Theme: graphite", "app.theme", { name: "graphite" }],
        ["Theme: ink", "app.theme", { name: "ink" }],
        ["Theme: moss", "app.theme", { name: "moss" }],
        ["Theme: atom one dark", "app.theme", { name: "atom-one-dark" }],
      ];
  }
}

function menuIcon(command, args) {
  if (command === "copy") return "mods/shepherd-menu/copy.svg";
  const name = command.endsWith(".close") ? "x" : command.endsWith(".rename") ? "square-pen" : command.endsWith(".new") ? "plus" : command === "worktree" ? "git-branch" : command === "app.help" ? "terminal" : command === "app.theme" ? "settings" : command === "pane.split" ? (args?.direction === "down" ? "panel-bottom" : "panel-right") : command === "pane.zoom" ? "square" : "terminal";
  return `mods/workspace-chrome/${name}.svg`;
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  if (name === "copy") return "";
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? k.keys : "";
}

// A line goes above the first copy item and above the first close item.
function separated(list, i) {
  if (i === 0) return false;
  const [, command] = list[i], [, before] = list[i - 1];
  if (command === "copy") return before !== "copy";
  if (command.endsWith(".close")) return !before.endsWith(".close");
  return command === "app.help" || (command === "app.theme" && before !== "app.theme");
}

// The computer running Herdr, for terminals on it (their addresses have no machine).
let host = null;

export default class Menu extends View {
  init(_props, cx) {
    this.at = 0;
    this.git = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    const p = props();
    const space = p?.tab === "space" && spaces().find((s) => s.id === p.target?.id);
    const folder = space && place(space);
    if (folder)
      cx.spawn(async (cx) => {
        this.git = await checkout(folder, space.machine).catch(() => null);
        cx.notify();
      });
    if (host === null && (p?.tab === "pane" || p?.tab === "tab"))
      cx.spawn(async (cx) => {
        const r = await exec("hostname", ["-s"]).catch(() => null);
        host = r?.stdout?.trim() || "";
        cx.notify();
      });
  }

  choose(i, cx) {
    const it = items(props(), this.git, host)[i];
    if (!it) return;
    closeOverlay(props()?.overlay);
    if (it[1] === "copy") {
      cx.write_to_clipboard(it[2].text);
      const first = it[2].text.split("\n")[0];
      notify({ title: "Copied", body: it[2].text.includes("\n") ? `${first} …` : first, level: "success" });
    } else if (it[1] === "worktree") openOverlay({ mod: "worktree", kind: "dialog", ...(it[2].action === "open" ? { width: 560, height: 480 } : { width: 440, height: 260 }), props: it[2] });
    else run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const list = items(props(), this.git, host);
    return v_flex()
      .id("menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map((it, i) =>
          v_flex()
            .when(separated(list, i), (el) => el.child(div().mx(7).my(4).h(1).bg(t.border)))
            .child(h_flex()
            .id(`mi-${i}`)
            .h(31)
            .px(8)
            .gap(9)
            .rounded(7)
            .items_center()
            .justify_between()
            .text_color(t.foreground)
            .when(i === this.at, (el) => el.bg(t.selected))
            .hover((s) => s.bg(t.hover))
            .on_click((_e, cx) => this.choose(i, cx))
            .child(svg(menuIcon(it[1], it[2])).size(14).flex_none().text_color(t.muted))
            .child(div().flex_1().child(it[0]))
            .child(div().text_size(11).text_color(t.dim).child(shortcut(it[1], it[2])))),
        ),
      );
  }
}
