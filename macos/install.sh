#!/bin/bash

head "Setting up for macOS"

ret=$(xcode-select --install)
if [ $? -ne 0 ]; then
    info "XCode command line tools are already installed"
fi

if [ -z "$NO_HOMEBREW" ] && [ ! -x $(command -v brew) ]; then
    info "Install Homebrew"

    ret=$(ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)")
    if [ $? -ne 0 ]; then
        fail "Homebrew installation failed"
    fi

    succ "Installed Homebrew"

    info "Install tools (jq)"
    brew install jq
    succ "Installed tools (jq)"
else
    info "Homebrew is already installed"
fi

if [ -z "$NO_HUSH_LOGIN" ]; then
    info "Touch $DOTTARGET/.hushlogin"

    touch $DOTTARGET/.hushlogin

    succ "Touched $DOTTARGET/.hushlogin"
fi
