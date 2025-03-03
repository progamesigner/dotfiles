#!/usr/bin/env zsh

local ZSH=$(dirname $0)

export ZSH_CACHE_DIR="${ZSH_CACHE_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/zsh}"
export ZSH_CUSTOM_DIR="${ZSH_CUSTOM_DIR:-${ZSH_CUSTOM:-$ZSH/custom}}"
export ZSH_PLUGIN_DIR="${ZSH_PLUGIN_DIR:-$ZSH}"

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

source "$ZSH/aliases.zsh"
source "$ZSH/completions.zsh"
source "$ZSH/functions.zsh"

PROMPT='%{$fg_bold[green]%}%(5~|%-1~/…/%3~|%4~)%{$reset_color%} `\
    export BRANCH=$(git --no-optional-locks symbolic-ref --short HEAD 2>/dev/null || git --no-optional-locks rev-parse --short HEAD 2>/dev/null); \
    if [ "${BRANCH}" != "" ]; then \
        echo -n "%{$fg_bold[cyan]%}(%{$fg_bold[magenta]%}${BRANCH}"; \
        if [ "$(git config --get devcontainers-theme.show-dirty 2>/dev/null)" = 1 ] && \
            git --no-optional-locks ls-files --error-unmatch -m --directory --no-empty-directory -o --exclude-standard ":/*" > /dev/null 2>&1; then \
                echo -n " %{$fg_bold[yellow]%}✗"; \
        fi; \
        echo -n "%{$fg_bold[cyan]%})%{$reset_color%} "; \
    fi; \
`%(?.%{$fg_bold[blue]%}.%{$fg_bold[red]%})$%{$reset_color%} '

mkdir -p "$ZSH_CACHE_DIR/completions"

fpath=("$ZSH_CACHE_DIR/completions" $fpath)

if [ -n "$ZSH_PROFILE" ]; then
    for file in "$ZSH_PROFILE"/*.zsh; do
        source "$file"
    done
    unset file
fi

if [ -n "$ZSH_PLUGINS" ]; then
    for name in $ZSH_PLUGINS; do
        if [ -f "$ZSH_CUSTOM_DIR/plugins/$name/$name.zsh" ] || [ -f "$ZSH_CUSTOM_DIR/plugins/$name/$name.plugin.zsh" ] || [ -f "$ZSH_CUSTOM_DIR/plugins/$name/_$name" ]; then
            fpath=("$ZSH_CUSTOM_DIR/plugins/$name" $fpath)
        elif [ -f "$ZSH_PLUGIN_DIR/plugins/$name/$name.zsh" ] || [ -f "$ZSH_PLUGIN_DIR/plugins/$name/$name.plugin.zsh" ] || [ -f "$ZSH_PLUGIN_DIR/plugins/$name/_$name" ]; then
            fpath=("$ZSH_PLUGIN_DIR/plugins/$name" $fpath)
        elif [ -f "$ZSH_CUSTOM_DIR/$name/$name.zsh" ] || [ -f "$ZSH_CUSTOM_DIR/plugins/$name/$name.plugin.zsh" ] || [ -f "$ZSH_CUSTOM_DIR/plugins/$name/_$name" ]; then
            fpath=("$ZSH_CUSTOM_DIR/$name" $fpath)
        elif [ -f "$ZSH_PLUGIN_DIR/$name/$name.zsh" ] || [ -f "$ZSH_PLUGIN_DIR/$name/$name.plugin.zsh" ] || [ -f "$ZSH_PLUGIN_DIR/$name/_$name" ]; then
            fpath=("$ZSH_PLUGIN_DIR/$name" $fpath)
        else
            echo "[ZSH] Plugin (completion) \"$name\" not found"
        fi
    done

    for name in $ZSH_PLUGINS; do
        if [ -f "$ZSH_CUSTOM_DIR/plugins/$name/$name.plugin.zsh" ]; then
            source "$ZSH_CUSTOM_DIR/plugins/$name/$name.plugin.zsh"
        elif [ -f "$ZSH_CUSTOM_DIR/$name/$name.zsh" ]; then
            source "$ZSH_CUSTOM_DIR/$name/$name.zsh"
        elif [ -f "$ZSH_PLUGIN_DIR/plugins/$name/$name.plugin.zsh" ]; then
            source "$ZSH_PLUGIN_DIR/plugins/$name/$name.plugin.zsh"
        elif [ -f "$ZSH_PLUGIN_DIR/$name/$name.zsh" ]; then
            source "$ZSH_PLUGIN_DIR/$name/$name.zsh"
        elif [ -f "$ZSH_CUSTOM_DIR/$name/_$name" ] || [ -f "$ZSH_CUSTOM_DIR/plugins/$name/_$name" ] || [ -f "$ZSH_PLUGIN_DIR/$name/_$name" ] || [ -f "$ZSH_PLUGIN_DIR/plugins/$name/_$name" ]; then
            # only completion, skipped ...
        else
            echo "[ZSH] Plugin \"$name\" not found"
        fi
    done

    unset name
fi

if [ -n "$ZSH_THEME" ]; then
    if [ -f "$ZSH_PLUGIN_DIR/$ZSH_THEME.zsh-theme" ]; then
        source "$ZSH_PLUGIN_DIR/$ZSH_THEME.zsh-theme"
    elif [ -f "$ZSH_PLUGIN_DIR/themes/$ZSH_THEME.zsh-theme" ]; then
        source "$ZSH_PLUGIN_DIR/themes/$ZSH_THEME.zsh-theme"
    else
        echo "[ZSH] Theme \"$ZSH_THEME\" not found"
    fi
fi

if [ "$TERM_PROGRAM" = "vscode" ] && [ ! -x "$(command -v vscode)" ]; then
    source "$(code --locate-shell-integration-path zsh)"
fi
