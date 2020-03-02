#!/bin/zsh

function encode64 () {
    print "$1" | base64
}

function decode64 () {
    print "$1" | base64 --decode
}
