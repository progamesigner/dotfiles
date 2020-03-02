#!/bin/zsh

function search () {
    grep -rnw $1 -e $2
}

function search-gem-code () {
    grep -rnw $1 -e $2 | grep -v '_spec' | grep -v '#'
}

function ack-search () {
    if [ -x /usr/bin/ack-grep ]; then
        ack-grep -i $1
    else
        ack -i $1
    fi
}
