#!/bin/bash

head "Setting up Syncthing"

if [ -z "$NO_SYNCTHING" ]; then
    info "Install Syncthing"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install syncthing
    else
        info "No supported platform found, skipped ..."
    fi

    succ "Installed Syncthing"

    info "Start Syncthing"
    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew services start syncthing
    else
        info "No supported platform found, skipped ..."
    fi
    succ "Started Syncthing"

    link $PWD/syncthing/stignore $DOTTARGET/.stignore
fi
