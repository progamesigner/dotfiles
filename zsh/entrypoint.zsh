#!/usr/bin/env zsh

local zsh=$(dirname $0)

setopt PROMPT_SUBST         # Setup the prompt with pretty colors

source $zsh/aliases.zsh
source $zsh/functions.zsh

PROMPT="%(?.%F{magenta}.%F{red})❯%f "
