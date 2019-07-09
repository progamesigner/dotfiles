#!/bin/bash

head "Setting up Docker"

if [ -z "$NO_DOCKER" ]; then
    info "Install Docker (docker-cli)"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install docker
    else
        info "No supported platform found, skipped ..."
    fi

    info "Installed Docker"
fi
