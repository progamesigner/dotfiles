#!/usr/bin/env sh

head "Setting up SSH"

if [ -z "$NO_SSH" ]; then
    info "Configuring SSH"

    ensure "$DOTTARGET/.ssh/config"
    cat <<-EOF > "$DOTTARGET/.ssh/config"
Include ~/.ssh/*.conf

Include "$PWD/ssh/*.user.conf"
Include "$PWD/ssh/*.default.conf"
Include "$PWD/ssh/default.conf"
EOF

    info "Configured SSH"
fi
