#!/usr/bin/env zsh

local zsh=$(dirname $0)

autoload -U +X colors && colors

setopt ALWAYS_TO_END        # Always place the cursor to the end of the word completed
setopt AUTO_CD              # Auto changes to a directory without typing cd
setopt AUTO_MENU            # Show completion menu on successive tab press
setopt AUTO_PUSHD           # Push the old directory onto the stack on cd
setopt COMPLETE_IN_WORD     # Fill in the word at the point of the cursor
setopt PROMPT_SUBST         # Setup the prompt with pretty colors
setopt PUSHD_IGNORE_DUPS    # Do not store duplicates in the stack
setopt PUSHD_SILENT         # Do not print the directory stack after pushd or popd
setopt PUSHD_TO_HOME        # Push to home directory when no argument is given

source "$zsh/aliases.zsh"
source "$zsh/completions.zsh"
source "$zsh/functions.zsh"

if [ -n "$ZSH_PROFILE" ]; then
    for file in "$ZSH_PROFILE"/*.zsh; do
        source "$file"
    done
    unset file
fi

PROMPT="%(?.%F{magenta}.%F{red})❯%f "
