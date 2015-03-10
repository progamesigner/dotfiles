#! /bin/zsh

# General
# =======
bindkey -e                          # Use emacs binding
autoload -U edit-command-line       # Enable edit command line (allow command line editing in an external editor)
WORDCHARS="*?_-.[]~&;!#\$%^(){}<>"  # Treat these characters as part of a word

zle -N edit-command-line

function zle-keymap-select zle-line-init zle-line-finish {
    if (( ${+terminfo[smkx]} )); then
        printf "%s" ${terminfo[smkx]}
    fi
    if (( ${+terminfo[rmkx]} )); then
        printf "%s" ${terminfo[rmkx]}
    fi

    zle reset-prompt
    zle -R
}

# Functions
# =========
# Insert "sudo " at the beginning of the line
function prepend-sudo () {
    if [[ "${BUFFER}" != su(do|)\ * ]]; then
        BUFFER="sudo ${BUFFER}"
        (( CURSOR += 5 ))
    fi
    if $(_zsh_highlight >/dev/null); then _zsh_highlight; fi
}
zle -N prepend-sudo

# Expand .... to ../..
function expand-dot-to-parent-directory-path {
    if [[ $LBUFFER = *.. ]]; then
        LBUFFER+="/.."
    else
        LBUFFER+="."
    fi
    if $(_zsh_highlight >/dev/null); then _zsh_highlight; fi
}
zle -N expand-dot-to-parent-directory-path

# Get version control system status
function get-vcs-status () {
    print
    zle accept-line
    if [ -d .git ]; then
        git status --short
    elif [ -d .hg ]; then
        hg summary
    elif [ -d .svn ]; then
        svn status
    else
        ls
    fi
    zle accept-line
}
zle -N get-vcs-status

function insert-last-command-output () {
    LBUFFER+="$(eval $history[$((HISTCMD-1))])"
}
zle -N insert-last-command-output

function zsh-ctrl-z () {
    if [[ ${#BUFFER} -eq 0 ]]; then
        fg
        zle redisplay
    else
        zle push-input
        zle clear-screen
    fi
}
zle -N zsh-ctrl-z

# Bindings
# ========
bindkey " " magic-space                             # [SPACE] do history expansion
bindkey "^[^[" prepend-sudo                         # [ESC-ESC] prepend sudo
bindkey "^[[1~" beginning-of-line                   # [HOME] to the beginning of line
bindkey "^[[H" beginning-of-line
bindkey "^[[4~" end-of-line                         # [END] to the end of line
bindkey "^[[F" end-of-line
bindkey "^[[2~" overwrite-mode                      # [INSERT] toggle overwrite mode
bindkey "^[[3~" delete-char                         # [DELETE] delete a character
bindkey "^[3;5~" delete-char
bindkey "^?" backward-delete-char                   # [BACKSPACE] backward delete
bindkey "^[[A" up-line-or-search                    # [PAGEUP] up line or history
bindkey "^[[B" down-line-or-search                  # [PAGEDOWN] down line or history
bindkey "^[[5~" up-line-or-history                  # [PAGEUP] up line or history
bindkey "^[[6~" down-line-or-history                # [PAGEDOWN] down line or history
bindkey "^[[C" forward-char                         # [RIGHT] move backward one character
bindkey "^[[D" backward-char                        # [LEFt] move forward one character
bindkey "^[[1;5C" forward-word                      # [CTRL+RIGHT] move forward one word
bindkey "^[[1;5D" backward-word                     # [CTRL+LEFT] move backward one word
bindkey "^L" clear-screen                           # [CTRL+L] clear screen
bindkey "^X^E" edit-command-line                    # [CTRL+X-CTRL+E] edit command line
bindkey "^[[Z" reverse-menu-complete                # [Shift+Tab] move through the completion menu backwards
bindkey "^R" history-incremental-search-backward    # [Ctrl+R] search backward incrementally for a specified string. The string may begin with ^ to anchor the search to the beginning of the line
bindkey "^[K" history-beginning-search-backward     # [ESC+K] begin search history backward
bindkey "^[k" history-beginning-search-backward
bindkey "^[J" history-beginning-search-forward      # [ESC+J] begin search history forward
bindkey "^[j" history-beginning-search-forward
bindkey "^Z" zsh-ctrl-z                             # [CTRL+Z] redo

bindkey "^U" backward-kill-line                     # [CTRL+U] delete a line from cursor
bindkey "^K" kill-whole-line                        # [CTRL+K] delete a line

bindkey "^[X" insert-last-command-output            # [ESC-X] insert last command result

bindkey "^E" expand-cmd-path                        # [CTRL+E] expand command name to full path
bindkey "^[Q" push-line-or-edit                     # [ESC-Q] use a more flexible push-line
bindkey "^[q" push-line-or-edit
bindkey "^[M" copy-prev-shell-word                  # [ESC-M] duplicate the previous word
bindkey "^[m" copy-prev-shell-word

bindkey "^[[5~" history-search-backward             # [PAGEUP]
bindkey "^[[6~" history-search-forward              # [PAGEDOWN]
bindkey "^[[A" history-search-backward              # [UP]
bindkey "^[[B" history-search-forward               # [DOWN]
bindkey "^[[A" history-substring-search-up          # [UP]
bindkey "^[[B" history-substring-search-down        # [DOWN]

bindkey "^ " get-vcs-status                         # [CTRL+META+SPACE] get VCS status
bindkey "." expand-dot-to-parent-directory-path     # [.] expand the path
bindkey "^I" expand-or-complete                     # [CTRL+I] auto complete

bindkey -s "^[L" "^Qls^M"                           # [ESC+L] run ls
bindkey -s "^[-" "^Qcd -^M"                         # [ESC+-] quickly go back
bindkey -s "^[1" "^A"                               # [ESC-1] to the beginning of line
bindkey -s "^[2" "^A^[F"                            # [ESC-2] to the second word
bindkey -s "^[3" "^A^[F^[F"                         # [ESC-3] to the third word
bindkey -s "^[4" "^A^[F^[F^[F"                      # [ESC-4] to the forth word
bindkey -s "^[5" "^A^[F^[F^[F^[F"                   # [ESC-5] to the fifth word
bindkey -s "^[6" "^A^[F^[F^[F^[F^[F"                # [ESC-6] to the sixth word
bindkey -s "^[7" "^A^[F^[F^[F^[F^[F^[F"             # [ESC-7] to the seventh word
bindkey -s "^[8" "^A^[F^[F^[F^[F^[F^[F^[F"          # [ESC-8] to the eighth word
bindkey -s "^[9" "^A^[F^[F^[F^[F^[F^[F^[F^[F"       # [ESC-9] to the ninth word

bindkey -M menuselect "^O" accept-and-infer-next-history
bindkey -M isearch "." self-insert 2>/dev/null     # Do not expand .... to ../.. during incremental search

# Term-specific Keys
# ==================
case $TERM in
    rxvt*|urxvt*)
        bindkey "^?"        backward-delete-char
        bindkey "^[[1~"     beginning-of-line
        bindkey "^[[4~"     end-of-line
        bindkey "^[[5~"     up-line-or-history
        bindkey "^[[3~"     delete-char
        bindkey "^[[6~"     down-line-or-history
        bindkey "^[[7~"     beginning-of-line
        bindkey "^[[8~"     end-of-line
        bindkey "^[[A"      up-line-or-search
        bindkey "^[[D"      backward-char
        bindkey "^[[B"      down-line-or-search
        bindkey "^[[C"      forward-char
        bindkey "^[[2~"     overwrite-mode
        bindkey "^[[1;5C"   forward-word
        bindkey "^[[1;5D"   backward-word
        ;;
    *) ;;
esac
