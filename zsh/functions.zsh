#!/bin/zsh

function $ () {
    print "Quit pasting in commands from the Internet, you lazy bum."
    "$@"
}

function set-prompt-tag () {
    export ZSH_THEME_PROMPT_SPACE_TAG="$1"
}

function reload-z-shell () {
    local cache=${ZSH_CACHE_DIR}
    autoload -U compinit zrecompile
    compinit -d "${cache}/.zcompdump-${HOST}"

    for f in "${cache}/.zcompdump-${HOST}"; do
        zrecompile -p ${f} && $(command rm -f ${f}.zwc.old)
    done
    unset f

    source ~/.zshrc
}

function align-right-padding () {
    local padding=$(($1 - $#2))
    local spacing=""
    for i in {0..${padding}}; do spacing="${spacing} "; done
    unset i
    print "${spacing}${2}"
}

function align-left-padding () {
    local padding=$(($1 - $#2))
    local spacing=""
    for i in {0..${padding}}; do spacing="${spacing} "; done
    unset i
    print "$2${spacing}"
}

function align-center-padding () {
    local padding=$((($1 - $#2) / 2))
    local spacing=""
    for i in {0..${padding}}; do spacing="${spacing} "; done
    unset i
    print "${spacing}$2${spacing}"
}

function align-center-indent () {
    local padding=$(((${COLUMNS} - $1) / 2))
    local spacing=""
    for i in {0..${padding}}; do spacing="${spacing} "; done
    unset i
    print "${spacing}"
}

function fuck () {
    last=$(fc -nl -1)
    print "sudo ${last}"
    sudo zsh -c ${last}
    unset last
}

if [ -z "\${which tree}" ]; then
    function tree () {
        find $@ -print | sed -e "s;[^/]*/;|____;g;s;____|; |;g"
    }
fi
