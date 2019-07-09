#!/bin/bash

head () {
    printf "\n\e[1m$@ ...\e[0m\n"
}

info () {
    printf "\r [\e[00;34mINFO\e[0m] ➜ $@\n"
}

succ () {
    printf "\r\e[2K [ \e[00;32mOK\e[0m ] ✔ $@\n"
}

user () {
    printf "\r [\e[00;33mWAIT\e[0m] ★ $@: "
}

fail () {
    printf "\r\e[2K [\e[00;31mFAIL\e[0m] ✖ $@\n"
    exit 1
}

link () {
    if [[ "$(uname -s)" == *Darwin* ]] || [[ "$(uname -s)" == *Linux* ]]; then
        info "Link \"$1\" to \"$2\""

        if [ -f "$2" ]; then
            info "Backed up \"$2\" because file already existed"

            mv "$2" "$2.bak"
        fi

        mkdir -p $(dirname "$2")

        ln -s "$1" "$2"

        succ "Linked \"$2\""
    fi
}
