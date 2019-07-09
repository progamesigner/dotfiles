#!/bin/bash

head "Setting up Syncthing"

if [ -z "$NO_SYNCTHING" ]; then
    info "Install Syncthing"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install syncthing
    else
        info "No supported platform found, skipped ..."
    fi

    info "Installed Syncthing"

    info "Start Syncthing"
    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew services start syncthing
    else
        info "No supported platform found, skipped ..."
    fi
    info "Started Syncthing"

    link $DOTFILES/syncthing/stignore $HOME/.stignore
fi
