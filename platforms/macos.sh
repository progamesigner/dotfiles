#!/usr/bin/env sh

head "Setting up macOS"

ret=$(xcode-select --install)
if [ $? -ne 0 ]; then
    info "XCode command line tools are already installed"
fi

if [ -z "$NO_HOMEBREW" ] && [ ! -x "$(command -v brew)" ]; then
    info "Install Homebrew"

    bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ $? -ne 0 ]; then
        fail "Homebrew installation failed"
    fi

    info "Installed Homebrew"

    brew install git gnupg gpgme jq openssh pinentry-mac zsh
else
    info "Homebrew is already installed"
fi

if [ -z "$NO_HUSH_LOGIN" ]; then
    info "Touch $DOTTARGET/.hushlogin"

    touch "$DOTTARGET/.hushlogin"

    info "Touched $DOTTARGET/.hushlogin"
fi