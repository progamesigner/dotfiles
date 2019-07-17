#!/bin/bash

head "Setting up ZSH"

if [ -z "$NO_ZSH" ]; then
    info "Install ZSH"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install node zsh
    else
        info "No supported platform found, skipped ..."
    fi

    succ "Installed ZSH"

    copy $PWD/zsh/zshrc $DOTTARGET/.zshrc
    copy $PWD/zsh/zlogin $DOTTARGET/.zlogin
    copy $PWD/zsh/zlogout $DOTTARGET/.zlogout

    sed -i -e "s|^local zsh=.*$|local zsh=$PWD/zsh|" $DOTTARGET/.zshrc

    info "Make sure \"$PWD/zsh/caches\" exists"
    mkdir -p "$PWD/zsh/caches"
    touch $PWD/zsh/caches/.z

    if [ "$SHELL" != "$(which zsh)" ]; then
        info "Changing default shell to zsh ..."
        sudo sh -c "echo $(which zsh) >> /etc/shells"
        sudo -u $USER chsh -s $(which zsh)
    fi
fi
