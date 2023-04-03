#!/usr/bin/env sh

head "Setting up GnuPG"

if [ -z "$NO_GNUPG" ]; then
    info "Configuring GnuPG"

    ensure "$DOTTARGET/.gnupg/gpg-agent.conf"
    touch "$DOTTARGET/.gnupg/gpg-agent.conf"
    ret=$(grep -q "^pinentry-program" "$DOTTARGET/.gnupg/gpg-agent.conf")
    if [ $? -ne 0 ] && [ -n "$(which pinentry-mac)" ]; then
        cat <<-EOF >> "$DOTTARGET/.gnupg/gpg-agent.conf"
pinentry-program $(which pinentry-mac)
EOF
    fi

    info "Configured GnuPG"
fi
