#!/usr/bin/env zsh

autoload -U +X compinit && compinit

zmodload -i zsh/complist

zstyle ':completion:*:*:*:*:*' menu select

zstyle ':completion:*' matcher-list 'm:{[:lower:][:upper:]-_}={[:upper:][:lower:]_-}' 'r:|=*' 'l:|=* r:|=*'
zstyle ':completion:*' special-dirs true
zstyle ':completion:*' list-colors ''
zstyle ':completion:*:cd:*' tag-order local-directories directory-stack path-directories

zstyle ':completion:*' use-cache yes
if [ -n "$ZSH_CACHE_DIR" ]; then
    zstyle ':completion:*' cache-path $ZSH_CACHE_DIR
fi

zstyle -e ':completion:*:(ssh|scp|sftp|rsh|rsync):hosts' hosts 'reply=(${=${${(f)"$(cat {/etc/ssh_,~/.ssh/known_}hosts(|2)(N) /dev/null)"}%%[# ]*}//,/ })'

autoload -U +X bashcompinit && bashcompinit
