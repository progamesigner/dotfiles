#!/usr/bin/env zsh

local zsh=$(dirname $0)

setopt AUTO_CD              # Auto changes to a directory without typing cd
setopt AUTO_PUSHD           # Push the old directory onto the stack on cd
setopt PROMPT_SUBST         # Setup the prompt with pretty colors
setopt PUSHD_IGNORE_DUPS    # Do not store duplicates in the stack
setopt PUSHD_SILENT         # Do not print the directory stack after pushd or popd
setopt PUSHD_TO_HOME        # Push to home directory when no argument is given

source "$zsh/aliases.zsh"
source "$zsh/completions.zsh"
source "$zsh/functions.zsh"

if [ -n "$ZSH_CUSTOM" ]; then
    plugins=()

    if [ -f "$ZSH_CUSTOM/entrypoint.zsh" ]; then
        source "$ZSH_CUSTOM/entrypoint.zsh"
    fi

    for name in $plugins; do
        if [ -f "$ZSH_CUSTOM/plugins/$name/$name.plugin.zsh" ]; then
            source "$ZSH_CUSTOM/plugins/$name/$name.plugin.zsh"
        else
            echo "[ZSH] Plugin \"$name\" not found"
        fi
    done

    if [ -n "$ZSH_THEME" ]; then
        if [ -f "$ZSH_CUSTOM/$ZSH_THEME.zsh-theme" ]; then
            source "$ZSH_CUSTOM/$ZSH_THEME.zsh-theme"
        elif [ -f "$ZSH_CUSTOM/themes/$ZSH_THEME.zsh-theme" ]; then
            source "$ZSH_CUSTOM/themes/$ZSH_THEME.zsh-theme"
        else
            echo "[ZSH] Theme \"$ZSH_THEME\" not found"
        fi
    fi

    unset plugins
fi

PROMPT="%(?.%F{magenta}.%F{red})❯%f "
