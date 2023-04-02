#!/usr/bin/env sh

head "Setting up SSH"

if [ -z "$NO_SSH" ]; then
    info "Configuring SSH"

    cat <<-EOF > "$DOTTARGET/.ssh/config"
Include $PWD/ssh/*.user.conf
Include $PWD/ssh/*.default.conf
Include $PWD/ssh/default.conf
EOF

    succ "Configured SSH"
fi
