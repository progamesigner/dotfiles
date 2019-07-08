#!/bin/sh

head "Setting up for Mac OS X"

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
else
    info "Homebrew is already installed"
fi

if [ -z "$NO_HUSH_LOGIN" ]; then
    info "Touch ~/.hushlogin"

    touch ~/.hushlogin

    succ "Touched ~/.hushlogin"
fi
