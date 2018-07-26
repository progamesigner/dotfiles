#! /bin/zsh

# http://www.unwiredcouch.com/2013/11/15/my-tmux-setup.html
# https://lincolnloop.com/blog/tmux-stay-focused/
# https://wiki.gentoo.org/wiki/Tmux
# https://wiki.archlinux.org/index.php/tmux

# Initializations
# ===============
if (( ! $+commands[tmux] )); then
    return 1
fi

if [[ ${ZSH_TMUX_AUTOSTART} && -z "${TMUX}" && -z "${EMACS}" && -z "${VIM}" ]]; then
    tmux start-server

    if ! tmux has-session 2> /dev/null; then
        tmux_session="#ZSHTMUX"
        tmux new-session -d -s "${tmux_session}"
        tmux set-option -t "${tmux_session}" destroy-unattached off &> /dev/null
        unset tmux_session
    fi

    if [[ "${TERM_PROGRAM}" = "iTerm.app" ]]; then
        exec tmux -CC attach-session
    else
        exec tmux attach-session
    fi
fi
