#! /bin/zsh

function ps-by-user () {
    ps -U "${1:-$USER}" -o "pid,%cpu,%mem,command" "${(@)argv[2,-1]}"
}

function kill-by-name () {
    sudo kill -9 `ps ax | grep $1 | grep -v grep | awk "{print \$1}"`
}

function zsh-stats () {
    fc -l 1 | awk "{CMD[\$2]++;count++;}END { for (a in CMD)print CMD[a] \" \" CMD[a]/count*100 \"% \" a;}" | grep -v "./" | column -c3 -s " " -t | sort -nr | nl |  head -n20
}

function find-and-execute () {
    find . -type f -iname "*${1:-}*" -exec "${2:-file}" "{}" \;
}

function align-right-padding () {
    local padding=$((${1} - ${#2}))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "${spacing}${2}"
}

function align-left-padding () {
    local padding=$((${1} - ${#2}))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "${2}${spacing}"
}

function align-center-padding () {
    local padding=$(((${1} - ${#2}) / 2))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "${spacing}${2}${spacing}"
}

function align-center-indent () {
    local padding=$(((${COLUMNS} - ${1}) / 2))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "${spacing}"
}
