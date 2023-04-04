#!/usr/bin/env sh

head "Setting up DevContainer"

info "Configuring Git"

cp "$PWD/git/attributes" ~/.gitattributes
cp "$PWD/git/ignore" ~/.gitignore

info "Configured Git"
