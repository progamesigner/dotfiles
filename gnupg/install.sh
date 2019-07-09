#!/bin/sh

head "Setting up GnuPG"

if [ -z "$NO_GNUPG" ]; then
    info "Install GnuPG"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install gpg gpgme pinentry-mac
    else
        info "No supported platform found, skipped ..."
    fi

    info "Installed GnuPG"
fi
