#!/usr/bin/env sh

head "Setting up Ghostty"

if [ -z "$NO_GHOSTTY" ]; then
    info "Configuring Ghostty"

    ensure "$DOTTARGET/.config/ghostty/config.ghostty"
    cat <<-EOF > "$DOTTARGET/.config/ghostty/config.ghostty"
font-family = "蘭亭黑-繁 中黑"
font-family = MonoLisaCode
font-size = 20
font-thicken = true
link-previews = true
theme = Atom One Dark
EOF

    info "Configured Ghostty"
fi
