#! /bin/zsh

# Functions
# =========
function _c () {
    _files -W ${ZSH_WORKSPACE_PATH:-"~/Workspace"} -/;
}

function c () {
    cd ${ZSH_WORKSPACE_PATH:-"~/Workspace"}/$1
}

# Auto completions
# ================
compdef _c c
