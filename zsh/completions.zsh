#!/usr/bin/env zsh

zstyle ':completion:*' matcher-list 'm:{[:lower:][:upper:]-_}={[:upper:][:lower:]_-}' 'r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' special-dirs true
zstyle ':completion:*' list-colors ''
zstyle ':completion:*:cd:*' tag-order local-directories directory-stack path-directories

autoload -U +X bashcompinit && bashcompinit
