#!/usr/bin/env sh

head "Setting up DevContainer"

info "Configuring Git"

cat >> $HOME/.bashrc <<-EOF
git config --global core.attributesFile "$PWD/git/attributes"
git config --global core.excludesFile "$PWD/git/ignore"
EOF

cat >> $HOME/.zshrc <<-EOF
git config --global core.attributesFile "$PWD/git/attributes"
git config --global core.excludesFile "$PWD/git/ignore"
EOF

info "Configured Git"
