#!/usr/bin/env sh

head "Setting up GnuPG"

if [ -z "$NO_GNUPG" ]; then
    info "Configuring GnuPG"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        ensure "$DOTTARGET/.gnupg/gpg-agent.conf"
        touch "$DOTTARGET/.gnupg/gpg-agent.conf"
        ret=$(grep -q "^pinentry-program" "$DOTTARGET/.gnupg/gpg-agent.conf")
        if [ $? -ne 0 ]; then
            cat <<-EOF >> "$DOTTARGET/.gnupg/gpg-agent.conf"
pinentry-program $(which pinentry-mac)
EOF
        fi
    fi

    info "Configured GnuPG"
fi
