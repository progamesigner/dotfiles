#!/bin/zsh

# Initializations
# ===============
if [[ -z ${MARKPATH} ]]; then
    export MARKPATH="${HOME}/.marks"
fi

# Functions
# =========
function _mark_expansion () {
    setopt extendedglob
    autoload -U modify-current-argument
    modify-current-argument "\$(readlink \"\${MARKPATH}/\${ARG}\")"
}
zle -N _mark_expansion

function _completemarks () {
    if [[ $(ls "${MARKPATH}" | wc -l) -gt 1 ]]; then
        reply=($(ls ${MARKPATH}/**/*(-) | grep : | sed -E "s/(.*)\/([_a-zA-Z0-9\.\-]*):$/\2/g"))
    else
        if readlink -e "${MARKPATH}"/* &>/dev/null; then
            reply=($(ls "${MARKPATH}"))
        fi
    fi
}

function jump () {
    cd -P "${MARKPATH}/$1" 2>/dev/null || print "No such mark: $1"
}

function mark () {
    if (( $# == 0 )); then
        MARK=$(basename "${PWD}")
    else
        MARK="$1"
    fi
    if read -q \?"Mark ${PWD} as ${MARK}? (y/n) "; then
        mkdir -p "${MARKPATH}"; ln -s "${PWD}" "${MARKPATH}/${MARK}"
    fi
}

function unmark () {
    rm -i "${MARKPATH}/$1"
}

function marks () {
    for link in ${MARKPATH}/*(@); do
        print -R -e -n "\e[36m${link:t}\e[0m -> \e[34m$(readlink ${link})\e[0m\n"
    done
}

# Auto completions
# ================
compctl -K _completemarks jump
compctl -K _completemarks unmark

# Bindings
# ========
bindkey "^G" _mark_expansion                        # [CTRL+G] expand marks
