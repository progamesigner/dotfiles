#!/usr/bin/env sh

head "Setting up DevContainer"

info "Configuring Git"

git config --system core.attributesFile "$PWD/git/attributes"
git config --system core.excludesFile "$PWD/git/ignore"

info "Configured Git"
