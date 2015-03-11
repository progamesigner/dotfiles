#! /bin/sh

# Show help if user required
if [[ $1 == "-h" || $1 == "--help" ]]; then cat <<HELP
Usage: $(basename "$0")
See the README for documentation.
https://github.com/progamesigner/dotfiles
Copyright (c) 2015 Yang Sheng Han <progamesigner@outlook.co>
Licensed under the MIT license.
http://progamesigner.com/about/license/
HELP
    exit
fi

# Some used functions
head() {
    printf "\n\e[1m$@ ...\e[0m\n"
}

info() {
    printf "\r [\e[00;34mINFO\e[0m] ➜ $@\n"
}

succ() {
    printf "\r\e[2K [ \e[00;32mOK\e[0m ] ✔ $@\n"
}

user() {
    printf "\r [\e[00;33mWAIT\e[0m] ★ $@: "
}

fail() {
    printf "\r\e[2K [\e[00;31mFAIL\e[0m] ✖ $@\n"
    exit;
}

# Bootstrap needed things
cd $(dirname $0)
DOTFILES=$(pwd)
if [ -n ${DOTTARGET} ]; then
    DOTTARGET=${HOME}
fi

# Check the requirement in general
if [[ ! -d ${DOTFILES} ]]; then
    fail "The working directory \"${DOTFILES}\" does not exist."
fi

# Start to setup
printf "\e[33m
 /* ------------------------------------------------------------------------ *\\
 |  _ __  _ __ ___   __ _  __ _ _ __ ___   ___  ___(_) __ _ _ __   ___ _ __   |
 | | '_ \| '__/ _ \ / _\` |/ _\` | '_ \` _ \ / _ \/ __| |/ _\` | '_ \ / _ \ '__|  |
 | | |_) | | | (_) | (_| | (_| | | | | | |  __/\__ \ | (_| | | | |  __/ |     |
 | | .__/|_|  \___/ \__, |\__,_|_| |_| |_|\___||___/_|\__, |_| |_|\___|_|     |
 | |_|              |___/                             |___/                   |
 \* ------------------- =[ P R O G A M E S I G N E R ]= -------------------- */
\e[0m"
source ${DOTFILES}/zsh/install.sh
