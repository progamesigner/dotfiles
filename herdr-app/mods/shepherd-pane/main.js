// A pane's header, cloned from the shipped `pane` mod (0.1.12):
//   { "tab": "active", "pane": { "header": { "content": { "mod": "shepherd-pane" } } } }
// Shows the program's icon, the agent's name or the terminal's title, then what
// `shepherd-report` put on the terminal's `shepherd.session` label (model, effort,
// prompt cache hit, pull request), the folder and the agent's status; buttons split,
// zoom and close this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, terminals, props, run, theme, home, exec, window } from "herdr";

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

function label(terminal, key) {
  const raw = terminal?.labels?.[key];
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Opens a link on this computer, where the window is.
function openURL(url) {
  if (typeof url !== "string" || !/^https:\/\//.test(url)) return;
  const platform = window()?.platform;
  const [command, args] = platform === "macos" ? ["open", [url]] : platform === "windows" ? ["explorer.exe", [url]] : ["xdg-open", [url]];
  exec(command, args).catch(() => {});
}

const PR_STATE = { approved: "Approved", changes_requested: "Changes requested", pending: "Waiting for review", draft: "Draft" };

function prPill(t, id, pr) {
  const color = pr.state === "approved" ? t.done : pr.state === "changes_requested" ? t.blocked : pr.state === "draft" ? t.dim : t.accent;
  return div()
    .id(id)
    .flex_none()
    .px(5)
    .h(17)
    .flex()
    .items_center()
    .rounded(5)
    .border(1)
    .border_color(color + "66")
    .text_size(10.5)
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

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    // Only an agent's own report counts: a shell left behind keeps its labels.
    const session = p.program?.agent ? label(terminals().find((x) => x.address === p.terminal), "shepherd.session") : null;
    const facts = [
      session?.model,
      session?.effort && `${session.fast ? "⚡ " : ""}${cap(session.effort)}`,
      typeof session?.cache === "number" && `cache ${session.cache}%`,
    ].filter(Boolean);
    const pr = typeof session?.pr?.n === "number" ? session.pr : null;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(1)
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .when(facts.length > 0, (el) => el.child(div().flex_none().truncate().max_w(280).text_size(11.5).text_color(t.muted).child(facts.join(" · "))))
      .when(Boolean(pr), (el) => el.child(prPill(t, `ph-pr-${pane}`, pr)))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}
