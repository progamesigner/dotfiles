#!/bin/sh

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

    if [[ "$(uname -s)" == *Darwin* ]] || [[ "$(uname -s)" == *Linux* ]]; then
        info "Link \"$DOTFILES/syncthing/stignore\" to \"$(echo $HOME/.stignore)\""

        if [ -f $HOME/.stignore ]; then
            info "Backed up \"$(echo $HOME/.stignore)\" because file already existed"

            mv $HOME/.stignore $HOME/.stignore.bak
        fi

        ln -s $DOTFILES/syncthing/stignore $HOME/.stignore

        info "Linked \"$(echo $HOME/.stignore)\""
    fi
fi
