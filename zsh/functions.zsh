#!/usr/bin/env zsh

function $ () {
    print "Quit pasting in commands from the Internet, you lazy bum."
    "$@"
}

function fuck () {
    last=$(fc -nl -1)
    print "sudo ${last}"
    sudo zsh -c ${last}
    unset last
}
