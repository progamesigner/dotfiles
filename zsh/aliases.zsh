#!/usr/bin/env zsh

alias ls="ls -G"
alias sl="ls"

if [ ! -x "$(command -v hd)" ]; then
    alias hd="hexdump -C"
fi

if [ ! -x "$(command -v htop)" ]; then
    alias top="htop"
fi

if [ ! -x "$(command -v md5sum)" ]; then
    alias md5sum="md5"
fi

if [ ! -x "$(command -v sha1sum)" ]; then
    alias sha1sum="shasum"
fi
