#! /bin/zsh

# Options
# =======
setopt PROMPT_SUBST     # Setup the prompt with pretty colors

# Functions
# =========
function title {
    [[ "$EMACS" == *term* ]] && return

    # if $2 is unset use $1 as default
    # if it is set and empty, leave it as is
    : ${2=$1}

    # echo -e "\033];MY_NEW_TITLE\007"
    if [[ "$TERM" == screen* ]]; then
        print -Pn "\ek$1:q\e\\" #set screen hardstatus, usually truncated at 20 chars
    elif [[ "$TERM" == xterm* ]] || [[ "$TERM" == rxvt* ]] || [[ "$TERM" == ansi ]] || [[ "$TERM_PROGRAM" == "iTerm.app" ]]; then
        print -Pn "\e]2;$2:q\a" #set window name
        print -Pn "\e]1;$1:q\a" #set icon (=tab) name
  fi
}

function terminal_title_precmd {
    title "%15<..<%~%<<" "%n@%m: %~"
}

function terminal_title_preexec {
    emulate -L zsh

    # cmd name only, or if this is sudo or ssh, the next cmd
    local CMD=${1[(wr)^(*=*|sudo|ssh|rake|-*)]:gs/%/%%}
    local LINE="${2:gs/%/%%}"

    title "$CMD" "%100>...>$LINE%<<"
}

function terminal_title_cwd {
    # Notify Terminal.app of current directory using undocumented OSC sequence
    # found in OS X 10.9 and 10.10's /etc/bashrc
    if [[ $TERM_PROGRAM == Apple_Terminal ]] && [[ -z $INSIDE_EMACS ]]; then
        local PWD_URL="file://$HOSTNAME${PWD// /%20}"
        printf "\e]7;%s\a" "$PWD_URL"
    fi
}

# ls colors
# =========
autoload -U colors && colors
export LSCOLORS="exfxcxdxbxGxDxabagacad"
export LS_COLORS="di=34:ln=35:so=32:pi=33:ex=31:bd=36;01:cd=33;01:su=31;40;07:sg=36;40;07:tw=32;40;07:ow=33;40;07:"

# Find the option for using colors in ls, depending on the version: Linux or BSD
if [[ "$(uname -s)" == "NetBSD" ]]; then
    # On NetBSD, test if "gls" (GNU ls) is installed (this one supports colors);
    # otherwise, leave ls as is, because NetBSD's ls doesn't support -G
    gls --color -d . &>/dev/null 2>&1 && alias ls="gls --color=tty"
elif [[ "$(uname -s)" == "OpenBSD" ]]; then
    # On OpenBSD, test if "colorls" is installed (this one supports colors);
    # otherwise, leave ls as is, because OpenBSD's ls doesn't support -G
    colorls -G -d . &>/dev/null 2>&1 && alias ls="colorls -G"
else
    ls --color -d . &>/dev/null 2>&1 && alias ls="ls --color=tty" || alias ls="ls -G"
fi

# Terminal title
# ==============
precmd_functions+=(terminal_title_precmd)
preexec_functions+=(terminal_title_preexec)
precmd_functions+=(terminal_title_cwd)

# Termcap
# =======
export LESS_TERMCAP_mb=$(printf "\e[1;31m")     # Begins blinking
export LESS_TERMCAP_md=$(printf "\e[1;31m")     # Begins bold
export LESS_TERMCAP_me=$(printf "\e[0m")        # Ends mode
export LESS_TERMCAP_se=$(printf "\e[0m")        # Ends standout-mode
export LESS_TERMCAP_so=$(printf "\e[1;44;33m")  # Begins standout-mode
export LESS_TERMCAP_ue=$(printf "\e[0m")        # Ends underline
export LESS_TERMCAP_us=$(printf "\e[1;32m")     # Begins underline
