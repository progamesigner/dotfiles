#!/usr/bin/env sh

ensure () {
    mkdir -p $(dirname "$1")

    if [ -f "$1" ]; then
        cp "$1" "$1.bak"

        info "Backed up \"$1\" because file already existed"
    fi
}

head () {
    printf "\n\e[1m$@ ...\e[0m\n"
}

info () {
    printf "\r [\e[00;34mINFO\e[0m] ➜ $@\n"
}

fail () {
    printf "\r\e[2K [\e[00;31mFAIL\e[0m] ✖ $@\n"
    exit 1
}

# ============================================================================ #
# Help                                                                         #
# ============================================================================ #
if [ "$1" = -h ] || [ "$1" = --help ]; then cat <<HELP
Usage: $(basename "$0")
See the README for documentation.
https://github.com/progamesigner/dotfiles
Copyright (c) Yang Sheng Han <progamesigner@outlook.com>
Licensed under the MIT license.
https://github.com/progamesigner/dotfiles/blob/master/LICENSE
HELP
    exit 0
fi

# ============================================================================ #
# Variables                                                                    #
# ============================================================================ #
cd $(realpath $(dirname $0))

DOTTARGET=${DOTTARGET:-$HOME}

if [ ! -d "$DOTTARGET" ]; then
    fail "The target directory \"$DOTTARGET\" does not exist."
fi

# ============================================================================ #
# Setup                                                                        #
# ============================================================================ #
printf "\e[33m
 /* ------------------------------------------------------------------------ *\\
 |  _ __  _ __ ___   __ _  __ _ _ __ ___   ___  ___(_) __ _ _ __   ___ _ __   |
 | | '_ \| '__/ _ \ / _\` |/ _\` | '_ \` _ \ / _ \/ __| |/ _\` | '_ \ / _ \ '__|  |
 | | |_) | | | (_) | (_| | (_| | | | | | |  __/\__ \ | (_| | | | |  __/ |     |
 | | .__/|_|  \___/ \__, |\__,_|_| |_| |_|\___||___/_|\__, |_| |_|\___|_|     |
 | |_|              |___/                             |___/                   |
 \* ------------------- =[ P R O G A M E S I G N E R ]= -------------------- */
\e[0m"

if [ -n "$REMOTE_CONTAINERS" ] || [ -n "$CODESPACES" ]; then
    . "$PWD/devcontainer.sh"
    exit 0
elif [ $(uname -s) = Darwin ]; then
    . "$PWD/macos.sh"
elif [ $(uname -s) = Linux ]; then
    . "$PWD/linux.sh"
else
    fail "No supported platform found, exited ..."
fi

# ============================================================================ #
# [Setup] Git                                                                  #
# ============================================================================ #
. "$PWD/git/install.sh"

# ============================================================================ #
# [Setup] GnuPG                                                                #
# ============================================================================ #
. "$PWD/gnupg/install.sh"

# ============================================================================ #
# [Setup] SSH                                                                  #
# ============================================================================ #
. "$PWD/ssh/install.sh"

# ============================================================================ #
# [Setup] ZSH                                                                  #
# ============================================================================ #
. "$PWD/zsh/install.sh"
