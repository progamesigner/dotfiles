#!/usr/bin/env sh

head "Setting up Herdr"

if [ -z "$NO_HERDR" ]; then
    info "Configuring Herdr"

    ensure "$DOTTARGET/.config/herdr/config.toml"
    cat <<-EOF > "$DOTTARGET/.config/herdr/config.toml"
onboarding = true

[theme]
name = "terminal"
auto_switch = false

[ui]
confirm_close = true
show_agent_labels_on_pane_borders = true
window_title = "{workspace}: {tab}"
agent_panel_sort = "spaces"
status_indicators = "dots"

[ui.sidebar.agents]
rows = [["state_icon", "workspace"], ["tab", "pane"]]

[ui.sidebar.spaces]
rows = [["state_icon", "workspace"], ["branch", "git_status"]]

[ui.toast]
delivery = "herdr"

[ui.sound]
enabled = false

[experimental]
kitty_graphics = true
pane_history = true
switch_ascii_input_source_in_prefix = true
EOF

    info "Configured Herdr"
fi
