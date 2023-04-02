#!/usr/bin/env sh

head "Setting up Docker"

if [ -z "$NO_DOCKER" ]; then
    touch "$PWD/docker/config/config.json"
fi
