#!/bin/bash

head "Setting up Hyper"

if [ -z "$NO_HYPER" ]; then
    if [ -x $(command -v hyper) ]; then
        link $PWD/hyper/hyper.js "$DOTTARGET/.hyper.js"
    else
        info "Hyper is not installed, skipped"
    fi
fi
