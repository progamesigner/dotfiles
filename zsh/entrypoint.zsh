#!/usr/bin/env zsh

local zsh=$(dirname $0)

setopt PROMPT_SUBST         # Setup the prompt with pretty colors

source $zsh/aliases.zsh
source $zsh/functions.zsh

if [ -n $ZSH_CUSTOM ] && [ -f $ZSH_CUSTOM/entrypoint.zsh ]; then
    source $ZSH_CUSTOM/entrypoint.zsh
fi

PROMPT="%(?.%F{magenta}.%F{red})❯%f "
