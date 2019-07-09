#!/bin/bash

head "Setting up Visual Studio Code"

if [ -z "$NO_VSCODE" ]; then
    if [ -x $(command -v code) ]; then
        link $PWD/vscode/keybindings.json "$DOTTARGET/Library/Application Support/Code/User/keybindings.json"

        link $PWD/vscode/settings.json "$DOTTARGET/Library/Application Support/Code/User/settings.json"

        info "Sync Visual Studio Code extensions"
        source $PWD/vscode/install-vscode-extensions.sh
        info "Synced Visual Studio Code extensions"
    else
        info "Visual Studio Code is not installed, skipped"
    fi
fi
