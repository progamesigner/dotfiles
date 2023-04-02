#!/usr/bin/env sh

head "Setting up for Linux"

if [ -z "$NO_HOMEBREW" ] && [ ! -x "$(command -v brew)" ]; then
    info "Install Homebrew"

    bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ $? -ne 0 ]; then
        fail "Homebrew installation failed"
    fi

    info "Installed Homebrew"

    if [ ! -x "$(command -v zsh)" ]; then
        info "Install ZSH"
        brew install zsh
        info "Installed ZSH"
    fi
else
    info "Homebrew is already installed"
fi
