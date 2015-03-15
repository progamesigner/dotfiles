#! /bin/zsh

function todo () {
    touch ~/Desktop/"$*"
}

function headers () {
    curl -sv "$@" 2>&1 >/dev/null | grep -v "^\*" | grep -v "^}" | cut -c3-
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

function retval () {
    if [[ -z $1 ]];then
        print "."
    else
        print "$1"
    fi
}

function ps-by-user () {
    ps -U "${1:-$USER}" -o "pid,%cpu,%mem,command" "${(@)argv[2,-1]}"
}

function kill-by-name () {
    sudo kill -9 `ps ax | grep $1 | grep -v grep | awk "{print \$1}"`
}

function zsh-stats () {
    fc -l 1 | awk "{CMD[\$2]++;count++;}END { for (a in CMD)print CMD[a] \" \" CMD[a]/count*100 \"% \" a;}" | grep -v "./" | column -c3 -s " " -t | sort -nr | nl |  head -n20
}

function copy-ssh-key () {
    cat ~/.ssh/${1:-"id_rsa.pub"} | pbcopy && print "Copied to clipboard."
}

function search () {
    if [ -x /usr/bin/ack-grep ]; then
        ack-grep -i $1
    else
        ack -i $1
    fi
}

function find-and-execute () {
    find . -type f -iname "*${1:-}*" -exec "${2:-file}" "{}" \;
}

function find-rb-files () {
    find . -name "*.rb"
}

function find-py-files () {
    find . -name "*.py"
}

function find-php-files () {
    find . -name "*.php"
}

function align-right-padding () {
    local padding=$(($1 - $#2))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "${spacing}${2}"
}

function align-left-padding () {
    local padding=$(($1 - $#2))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "$2${spacing}"
}

function align-center-padding () {
    local padding=$((($1 - $#2) / 2))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "${spacing}$2${spacing}"
}

function align-center-indent () {
    local padding=$(((${COLUMNS} - $1) / 2))
    local spacing=""
    for _ in {0..${padding}}; do spacing="${spacing} "; done
    print "${spacing}"
}

function clean-python-cache () {
    ZSH_PYCLEAN_PLACES=${*:-"."}
    find ${ZSH_PYCLEAN_PLACES} -type f -name "*.py[co]" -delete
    find ${ZSH_PYCLEAN_PLACES} -type d -name "__pycache__" -delete
}

function remove-zero-files () {
    find "$(retval $1)" -type f -size 0 -exec rm -rf {} \;
}

function kill-zombie-processes() {
    ps -eal | awk "{ if (\$2 == "Z") {print \$4}}" | kill -9
}

function self-seigned-certificate () {
    openssl genrsa -des3 -out ${PWD}/${1}.orig.key 4096
    openssl rsa -in ${PWD}/${1}.orig.key -out ${PWD}/${1}.key
    openssl req -new -key ${PWD}/${1}.key -out ${PWD}/${1}.csr
    openssl x509 -req -days 365 -in ${PWD}/${1}.csr -signkey ${PWD}/${1}.key -out ${PWD}/${1}.crt
    rm ${1}.orig.key ${1}.csr
}

function ping-router () {
    gateway=$(netstat -rn | grep "default" | awk "{print \$2}");
    if [ $? != 0 ]; then
        print "No internet gateways found!"
    else
        ping ${gateway}
    fi
    unset gateway
}

function man.cx () {
    local BROWSER=${BROWSER:-$(
        for c in xdg-open open firefox; do
            command -v $c && break
        done
    )}

    local MANCX_URL="http://man.cx"

    # Write usage and bail out with no args or with --help.
    test $# -eq 0 -o $(expr "$*" : ".*--help") -ne 0 && {
        grep ^#/ < $0 | cut -c4-
        exit
    }

    # Bail out if we couldn't find a browser.
    test -z "${BROWSER}" && {
        print "$(basename $0): BROWSER not set and no opening program found" 2>&1
        exit 1
    }

    local section
    case "$1" in
    [0-9]*)
        section="($1)"
        shift
    ;;
    esac

    for page in "$@"; do
        ${BROWSER} "${MANCX_URL}/${page}${section}"
    done
    unset page

    unset BROWSER MANCX_URL section
}

function orig () {
    if [ $# = 0 ] ; then
        print "usage: orig FILE ..."
        print "copy FILE(s) to FILE.orig"
    else
    for f in "$@" ; do
        cp -p "${f}" "${f}.orig"
    done
    unset f
fi

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
