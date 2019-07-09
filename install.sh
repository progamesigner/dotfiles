#!/bin/bash

source functions.sh

# ============================================================================ #
# Help                                                                         #
# ============================================================================ #
if [[ $1 == "-h" || $1 == "--help" ]]; then cat <<HELP
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
DOTFILES=$(dirname ${BASH_SOURCE[0]})
DOTTARGET=${DOTTARGET:-$HOME}

if [ ! -d $DOTFILES ]; then
    fail "The working directory \"$DOTFILES\" does not exist."
fi

if [ ! -d $DOTTARGET ]; then
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

# ============================================================================ #
# [Setup] Platform                                                             #
# ============================================================================ #
if [[ "$(uname -s)" == *Darwin* ]]; then
    source $DOTFILES/macos/install.sh
else
    info "No supported platform found, skipped ..."
fi

# ============================================================================ #
# [Setup] GnuPG                                                                #
# ============================================================================ #
source $DOTFILES/gnupg/install.sh

# ============================================================================ #
# [Setup] Syncthing                                                            #
# ============================================================================ #
source $DOTFILES/syncthing/install.sh
