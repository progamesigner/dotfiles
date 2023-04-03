#!/usr/bin/env sh

head "Setting up Linux"

if [ -z "$NO_HOMEBREW" ] && [ ! -x "$(command -v brew)" ]; then
    info "Install Homebrew"

    bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ $? -ne 0 ]; then
        fail "Homebrew installation failed"
    fi

    info "Installed Homebrew"

    brew install git gnupg jq openssh zsh
else
    info "Homebrew is already installed"
fi
