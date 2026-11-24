import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window, shared, setShared, layout, settings, nextCommand, checking } from "herdr";

// Chat mode (shepherd-chat): shared(CHATS)[tab] is the terminal a tab shows as a chat; the
// layout's `conversation` stack then shows `chat-page` instead of the tab (`main`).
const CHATS = "shepherd.chat";
const isClaude = (p) => Boolean(p?.terminal) && (p.app === "claude-code" || p.program?.key === "claude");

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class Tabs extends View {
  init(_props, cx) {
    this.pressed = null;
    this.over = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
    if (checking()) return;
    // `shepherd-tabs.chat` (keys.json): the shown tab between Chat and Terminal.
    cx.spawn(async (cx) => {
      for (;;) {
        if ((await nextCommand()) === "chat") this.toggleChat();
        cx.notify();
      }
    });
  }

  // The shown tab's Claude Code terminal: the one its chat shows, else the focused pane, else its first.
  chatTarget() {
    const space = spaces().find((p) => p.active);
    const tab = space?.tabs?.find((c) => c.active)?.id;
    if (!tab) return null;
    const mine = panes().filter((p) => p.tab === tab && isClaude(p));
    const chats = shared(CHATS) ?? {};
    const pane = mine.find((p) => p.terminal === chats[tab]) ?? mine.find((p) => p.focused) ?? mine[0];
    return pane ? { tab, pane, chat: chats[tab] === pane.terminal } : null;
  }

  setChat(tab, terminal) {
    const chats = { ...(shared(CHATS) ?? {}) };
    if (terminal) chats[tab] = terminal;
    else delete chats[tab];
    // Tabs that are gone, or whose terminal is gone, drop out.
    const live = new Set(panes().map((p) => `${p.tab} ${p.terminal}`));
    for (const [k, v] of Object.entries(chats)) if (!live.has(`${k} ${v}`)) delete chats[k];
    setShared(CHATS, chats);
  }

  toggleChat(to) {
    const target = this.chatTarget();
    if (!target) return;
    const chat = to === undefined ? !target.chat : to === "chat";
    if (chat === target.chat) return;
    this.setChat(target.tab, chat ? target.pane.terminal : null);
    if (!chat) run("pane.focus", { pane: target.pane.pane });
  }

  // The stack shows the chat while the shown tab has one; a select waits a moment to land.
  syncChat(root) {
    const stack = find(root, "conversation");
    if (!stack) return;
    const target = this.chatTarget();
    const want = target?.chat ? "chat-page" : "main";
    if (stack.active === want) { this.chatPending = null; return; }
    if (this.chatPending?.want === want && Date.now() < this.chatPending.until) return;
    this.chatPending = { want, until: Date.now() + 1000 };
    run("layout.select", { stack: "conversation", child: want });
  }

  // Chat: the shown tab's Claude Code terminal as a chat; pressed again, its terminal.
  chatButton(t, target) {
    return h_flex().id("chat-toggle").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
      .text_size(12).bg(target.chat ? t.selected : t.chrome).text_color(target.chat ? t.foreground : t.muted)
      .hover((s) => s.bg(t.hover)).on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .tooltip(target.chat ? "Back to the terminal (⌘⇧C)" : "Read and answer this agent as a chat (⌘⇧C)")
      .on_click(() => this.toggleChat())
      .child(svg("mods/shepherd-tabs/chat.svg").size(14)).child("Chat");
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render() {
    const t = theme();
    const space = spaces().find(p => p.active);
    const shown = space?.tabs ?? [];
    const stop = (_e, cx) => cx.stop_propagation();
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const program = panes().find(p => p.tab === c.id && p.program?.agent)?.program ?? panes().find(p => p.tab === c.id)?.program;
      const name = /^tb\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      return h_flex().id(`tab-${c.id}`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(12.8)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .relative().hover(s => s.bg(t.hover))
        // Shepherd: while a tab is dragged it dims, and an accent line marks the
        // edge it will land on (the same cue the shipped Spaces list uses).
        .when(this.pressed === i && this.over !== null && this.over !== i, el => el.opacity(0.5))
        .when(this.pressed !== null && this.pressed !== i && this.over === i, el => el.child(
          div().absolute().top(3).bottom(3).w(2).rounded(1).bg(t.accent)
            .when(this.pressed < i, line => line.right(-3))
            .when(this.pressed > i, line => line.left(-3))))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; this.over = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_move((_e, cx) => {
          if (this.pressed !== null && this.over !== i) { this.over = i; cx.notify(); }
        })
        .on_mouse_up("left", (_e, cx) => {
          const from = this.pressed; this.pressed = null; this.over = null;
          if (from !== null && from !== i) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else run("tab.select", { id: c.id });
          cx.notify();
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "shepherd-menu", kind: "popup", width: 220, height: 290, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().max_w(170).truncate().child(c.zoomed ? `${name} Z` : name))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked" || c.status === "done", el => el.child(div().size(6).rounded(3).bg(t[c.status])))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).text_color(t.dim).on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/pane/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 10;
    // Shepherd: a hidden sidebar (workspace-agents) comes back from here, at the width it had.
    const showSidebar = () => {
      setShared("sidebar.collapsed", false);
      run("layout.resize", { id: "sidebar", px: shared("sidebar.width") ?? 268 });
      run("layout.show", { id: "sidebar" });
    };
    const panel = find(root, "panel"), body = find(root, "panel-body");
    // Shepherd: Graph (the git-graph mod) joins the panels.
    const enabled = [...(shared("workspace.panels") ?? ["files", "changes"]), "graph"];
    this.syncPanel(space, panel, body, enabled);
    this.syncChat(root);
    const chatTarget = this.chatTarget();
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(icon).size(14)).child(label);
    };
    return h_flex().id("tabs-bar").size_full().min_w(0).px(10).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", (_e, cx) => { this.pressed = null; this.over = null; cx.notify(); })
      // Leaving the bar mid-drag cancels it, so the marker never outlives the pointer.
      .on_hover((hovered, cx) => { if (!hovered && this.pressed !== null) { this.pressed = null; this.over = null; cx.notify(); } })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .when(Boolean(sidebar?.hidden), el => el.child(button("sidebar-show", svg("mods/shepherd-tabs/sidebar.svg").size(15), showSidebar).tooltip("Show sidebar")))
      .child(h_flex().id("tab-scroll").flex_1().min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children(shown.map(item)))
      .child(button("tab-new", "+", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })))
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/files/file.svg")))
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))
      .child(panelButton("graph", "Graph", "mods/git-graph/icons/graph.svg"))
      .when(Boolean(chatTarget), (el) => el.child(div().w(1).h(16).mx(3).flex_none().bg(t.border)).child(this.chatButton(t, chatTarget)))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/tabs/win-min.svg").size(16) : "−", () => run("window.minimize")))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")))
        .child(button("close-window", w.platform === "windows" ? svg("mods/tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close"))));
  }
}
