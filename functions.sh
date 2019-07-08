#!/bin/sh

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
