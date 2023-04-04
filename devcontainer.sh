#!/usr/bin/env sh

head "Setting up DevContainer"

info "Configuring Git"

cp "$PWD/git/attributes" /etc/gitattributes
cp "$PWD/git/ignore" /etc/gitignore

info "Configured Git"
