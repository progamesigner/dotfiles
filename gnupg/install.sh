#!/bin/bash

head "Setting up GnuPG"

if [ -z "$NO_GNUPG" ]; then
    info "Install GnuPG"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install gpg gpgme pinentry-mac

        info "Make sure \"$DOTTARGET/.gnupg\" exists"
        mkdir -p "$DOTTARGET/.gnupg"

        touch "$DOTTARGET/.gnupg/gpg.conf"
        ret=$(grep -q "^use-agent" "$DOTTARGET/.gnupg/gpg.conf")
        if [ $? -ne 0 ]; then
            echo "use-agent" >> $DOTTARGET/.gnupg/gpg.conf
        fi

        touch "$DOTTARGET/.gnupg/gpg-agent.conf"
        ret=$(grep -q "^pinentry-program" "$DOTTARGET/.gnupg/gpg-agent.conf")
        if [ $? -ne 0 ]; then
            echo "pinentry-program /usr/local/bin/pinentry-mac" >> $DOTTARGET/.gnupg/gpg-agent.conf
        fi
    else
        info "No supported platform found, skipped ..."
    fi

    info "Installed GnuPG"
fi
