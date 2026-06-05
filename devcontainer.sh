#!/usr/bin/env sh

head "Setting up DevContainer"

cat >> $HOME/.bashrc <<-'EOF'
PS1='\[\033[1;34m\]\w\[\033[0m\] `\
    ec=$?; \
    export BRANCH=$(git --no-optional-locks symbolic-ref --short HEAD 2>/dev/null || git --no-optional-locks rev-parse --short HEAD 2>/dev/null); \
    if [ "${BRANCH}" != "" ]; then \
        if [ "$(git config --get devcontainers-theme.show-dirty 2>/dev/null)" = 1 ] && \
            git --no-optional-locks ls-files --error-unmatch -m --directory --no-empty-directory -o --exclude-standard ":/*" > /dev/null 2>&1; then \
                BRANCH_COLOR="\[\033[1;35m\]"; \
        else \
                BRANCH_COLOR="\[\033[1;33m\]"; \
        fi; \
        echo -n "\[\033[1;36m\](${BRANCH_COLOR}${BRANCH}\[\033[1;36m\]) "; \
    fi; \
    if [ $ec = 0 ]; then \
        echo -n "\[\033[1;32m\]"; \
    else \
        echo -n "\[\033[1;31m\]"; \
    fi; \
`$\[\033[0m\] '
EOF

cat >> $HOME/.bashrc <<-EOF
[[ "\$TERM_PROGRAM" == "vscode" ]] && . "\$(code --locate-shell-integration-path bash)"

git config --global core.attributesFile ${DOTROOT:-$PWD}/git/attributes
git config --global core.excludesFile ${DOTROOT:-$PWD}/git/ignore
EOF

cat >> $HOME/.zshrc <<-'EOF'
setopt PROMPT_SUBST

__git_prompt() {
    BRANCH=$(git --no-optional-locks symbolic-ref --short HEAD 2>/dev/null || git --no-optional-locks rev-parse --short HEAD 2>/dev/null)
    [ -z "$BRANCH" ] && return
    if [ "$(git config --get devcontainers-theme.show-dirty 2>/dev/null)" = 1 ] && git --no-optional-locks ls-files --error-unmatch -m --directory --no-empty-directory -o --exclude-standard ":/*" > /dev/null 2>&1; then
        BRANCH_COLOR="%F{magenta}"
    else
        BRANCH_COLOR="%F{yellow}"
    fi
    print -n "%B%F{cyan}(${BRANCH_COLOR}${BRANCH}%F{cyan})%b "
}
PROMPT='%B%F{blue}%~%f%b $(__git_prompt)%B%F{%(?.green.red)}\$%f%b '
EOF

cat >> $HOME/.zshrc <<-EOF
[[ "\$TERM_PROGRAM" == "vscode" ]] && . "\$(code --locate-shell-integration-path zsh)"

git config --global core.attributesFile ${DOTROOT:-$PWD}/git/attributes
git config --global core.excludesFile ${DOTROOT:-$PWD}/git/ignore
EOF
