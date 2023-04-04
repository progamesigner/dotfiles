#!/usr/bin/env sh

head "Setting up DevContainer"

info "Configuring Git"

git config --global core.attributesFile "$PWD/git/attributes"
git config --global core.excludesFile "$PWD/git/ignore"

info "Configured Git"
