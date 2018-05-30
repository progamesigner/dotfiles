#! /bin/sh

user "What is your name for git"
read -e GIT_USER_NAME
user "What is your email for git"
read -e GIT_USER_EMAIL

if [[ -n ${GIT_USER_NAME} ]]; then
    git config --global user.name "${GIT_USER_NAME}"
fi
if [[ -n ${GIT_USER_EMAIL} ]]; then
    git config --global user.email "${GIT_USER_EMAIL}"
fi

git config --global apply.whitespace "nowarn"

git config --global branch.autosetupmerge "true"

git config --global color.ui "auto"
git config --global color.diff "auto"
git config --global color.branch "auto"
git config --global color.status "auto"

git config --global core.excludesfile "~/.gitignore"
git config --global core.attributesfile "~/.gitattributes"
git config --global core.editor ${EDITOR:-"vim"}
git config --global core.autocrlf "input"
git config --global core.safecrlf "warn"
git config --global core.whitespace "space-before-tab,-indent-with-non-tab,trailing-space"
git config --global core.trustctime "false"
git config --global core.precomposeunicode "false"

git config --global color.branch.current "yellow reverse"
git config --global color.branch.local "yellow"
git config --global color.branch.remote "green"
git config --global color.branch.plain "red"
git config --global color.diff.meta "yellow"
git config --global color.diff.frag "magenta"
git config --global color.diff.old "red"
git config --global color.diff.new "green"
git config --global color.status.added "yellow"
git config --global color.status.changed "green"
git config --global color.status.untracked "blue"

git config --global commit.gpgsign true

git config --global diff.renames "copies"

git config --global merge.enabled "true"

git config --global rerere.log "true"

git config --global help.autocorrect "50"

git config --global push.default "simple"

git config --global url."git@github.com:".insteadOf "https://github.com/"

git config --global user.useconfigonly true

info "Linking ${DOTTARGET}/.gitignore ..."
if [ -f "${DOTTARGET}/.gitignore" ] || [ -h "${DOTTARGET}/.gitignore" ]; then
    info "\e[00;33mFound ${DOTTARGET}/.gitignore file.\e[0m \e[0;32mReserving ...\e[0m"
else
    ln -s ${DOTFILES}/git/gitignore ${DOTTARGET}/.gitignore
fi

info "Linking ${DOTTARGET}/.gitattributes ..."
if [ -f "${DOTTARGET}/.gitattributes" ] || [ -h "${DOTTARGET}/.gitattributes" ]; then
    info "\e[00;33mFound ${DOTTARGET}/.gitattributes file.\e[0m \e[0;32mReserving ...\e[0m"
else
    ln -s ${DOTFILES}/git/gitattributes ${DOTTARGET}/.gitattributes
fi
