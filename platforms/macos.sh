#!/usr/bin/env sh

head "Setting up macOS"

if [ -z "$NO_HUSH_LOGIN" ]; then
    info "Touch $DOTTARGET/.hushlogin"

    touch "$DOTTARGET/.hushlogin"

    info "Touched $DOTTARGET/.hushlogin"
fi
