// The Shepherd sidebar's top bar: Herdr's workspace-chrome brand (logo and name, search,
// sidebar toggle) with the workspace list's sort between search and the toggle. The
// toggle hides the sidebar outright; the tabs bar (shepherd-tabs) brings it back.

import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, openOverlay, window, shared, setShared, layout } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// As workspace-agents' hideSidebar: keep the full width for the tabs bar to restore.
function hideSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (width >= 160) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", true);
  run("layout.hide", { id: "sidebar" });
}

// The same list and shared key as workspace-agents.
const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
const sortOf = () => SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[1];

export default class Brand extends View {
  button(id, tip, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).tooltip(tip).child(label);
  }

  render() {
    const t = theme();
    const sort = sortOf();
    return h_flex().size_full().bg(t.chrome).pl(14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen, el => el.pl(76))
      .child(h_flex().flex_1().gap(8).items_center().child(image("frame/welcome/herdr.png").size(20).rounded(5)).child(div().font_semibold().text_color(t.foreground).child("Herdr")))
      .child(this.button("search", "Jump to a tab, space or agent", svg("mods/workspace-chrome/search.svg").size(15), () => run("mod.open", { name: "picker" })))
      .child(this.button("sort", `Sort: ${sort.label}`, svg(`mods/workspace-chrome/${sort.icon}.svg`).size(15),
        () => openOverlay({ mod: "workspace-agents", kind: "popup", width: 200, height: 140, props: { sortMenu: true } })))
      .child(this.button("sidebar-toggle", "Hide sidebar", svg("mods/workspace-chrome/sidebar.svg").size(15), hideSidebar));
  }
}
