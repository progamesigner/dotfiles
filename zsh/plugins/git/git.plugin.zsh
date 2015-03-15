#! /bin/zsh

# Functions
# =========
function _gitignoreio_get_command_list () {
    curl -sL https://www.gitignore.io/api/list | tr "," "\n"
}

function _gitignoreio () {
    compset -P "*,"
    compadd -S "" $(_gitignoreio_get_command_list)
}

function git-amend () {
    git commit --amend -C HEAD
}

function git-copy-branch-name () {
    local branch=$(git rev-parse --abbrev-ref HEAD)
    echo ${branch}
    echo ${branch} | tr -d "\n" | tr -d " " | pbcopy
    unset branch
}

function git-credit () {
    git commit --amend --author "$1 <$2>" -C HEAD
}

function git-delete-local-merged () {
    git branch -d $(git branch --merged | grep -v "^*" | grep -v "master" | tr -d "\n")
}

function git-nuke () {
    git branch -D "$1"
    git push origin :"$1"
}

function git-promote () {
    local branch=$(git symbolic-ref -q HEAD | sed -e "s|^refs/heads/||")

    local remote=$(git branch -r | grep "origin/${branch}")
    [ -z "${remote}" ] && ( git push origin "${branch}" )

    local origin=$(git config --get "branch.${branch}.remote")
    [ -z "${origin}" ] && ( git config --add "branch.${branch}.remote" origin )

    local merge=$(git config --get "branch.${branch}.merge")
    [ -z "${merge}" ] && ( git config --add "branch.${branch}.merge" "refs/heads/${branch}" )
    unset branch remote origin merge
}

function git-track () {
    local branch=$(git rev-parse --abbrev-ref HEAD)
    git branch ${branch} --set-upstream-to origin/${branch}
    unset branch
}

function git-undo () {
    git reset --soft HEAD^
}

function git-unpushed () {
    branch=$(git rev-parse --abbrev-ref HEAD)
    git diff origin/${branch}..HEAD
    unset branch
}

function git-unpushed-stat () {
    local branch=$(git rev-parse --abbrev-ref HEAD)
    local count=$(git rev-list --count HEAD origin/${branch}...HEAD)

    if [ "$count" -eq "1" ]; then
        s=""
    else
        s="s"
    fi

    git diff --stat origin/${branch}..HEAD

    print " ${count} commit${s} total"
    unset branch count
}

function git-up () {
    local args="$@"

    test "$(basename $0)" = "git-reup" && args="--rebase ${args}"

    git pull ${args}

    test "$(basename $0)" = "git-reup" && {
        print "Diff:"
        git --no-pager diff --color --stat HEAD@{1}.. |
        sed "s/^/ /"
    }

    print "Log:"
    git log --color --pretty=oneline --abbrev-commit HEAD@{1}.. |
    sed "s/^/ /"

    unset args
}

function git-current-branch () {
    ref=$(git symbolic-ref HEAD 2>/dev/null) || \
    ref=$(git rev-parse --short HEAD 2>/dev/null) || return
    print "${ref#refs/heads/}"
}

function git-current-repository () {
    ref=$(git symbolic-ref HEAD 2>/dev/null) || \
    ref=$(git rev-parse --short HEAD 2>/dev/null) || return
    print "$(git remote -v | cut -d":" -f 2)"
}

function git-is-working-in-progress () {
    if $(git log -n 1 2>/dev/null | grep -q -c "\-\-wip\-\-"); then
        print "We are working in progress!"
    fi
}

function get-gitignore () {
    curl -sL https://www.gitignore.io/api/$@
}

function git-clean-sync () {
    local branch=$(git symbolic-ref --short HEAD)
    local remote=$(git remote | grep upstream || print "origin")
    git remote prune "${remote}"
    git fetch "${remote}"
    git merge "${remote}/${branch}"
    if ! [ "${remote}" = "origin" ]; then git push origin "${branch}"; fi
    git branch -u "${remote}"/"${branch}"
    print "$(git branch --merged | grep -v "^\*" | grep -v "master" | tr -d "\n")" | xargs git branch -d
}

# Aliases
# =======
alias git="noglob hub"
alias git-home="cd \$(git rev-parse --show-toplevel || print \".\")"
alias git-wip="git add -A; git ls-files --deleted -z | xargs -r0 git rm; git commit -m \"--wip--\""
alias git-unwip="git log -n 1 | grep -q -c \"\-\-wip\-\-\" && git reset HEAD~1"
alias git-ignore="git update-index --assume-unchanged"
alias git-recognize="git update-index --no-assume-unchanged"
alias git-ignored="git ls-files -v | grep \"^[[:lower:]]\""
alias git-publish="git push origin \$(git-current-branch)"
alias git-sync="git pull origin \$(git-current-branch) && git push origin \$(git-current-branch)"
alias git-show-log="git log --topo-order --pretty=format:\"%C(bold)Commit:%C(reset) %C(green)%H%C(red)%d%n%C(bold)Author:%C(reset) %C(cyan)%an <%ae>%n%C(bold)Date:%C(reset) %C(blue)%ai (%ar)%C(reset)%n%w(76,4,6)%B%n\""
alias git-show-log-changes="git log --topo-order --stat --pretty=format:\"%C(bold)Commit:%C(reset) %C(green)%H%C(red)%d%n%C(bold)Author:%C(reset) %C(cyan)%an <%ae>%n%C(bold)Date:%C(reset) %C(blue)%ai (%ar)%C(reset)%n%w(76,4,6)%+B\""
alias git-show-log-details="git log --topo-order --stat --patch --full-diff --pretty=format:\"%C(bold)Commit:%C(reset) %C(green)%H%C(red)%d%n%C(bold)Author:%C(reset) %C(cyan)%an <%ae>%n%C(bold)Date:%C(reset) %C(blue)%ai (%ar)%C(reset)%n%w(76,4,6)%+B\""
alias git-show-oneline="git log --topo-order --pretty=format:\"%C(green)%h%C(reset) %s%C(red)%d%C(reset)\""
alias git-show-graph="git log --topo-order --all --graph --pretty=format:\"%C(green)%h%C(reset) %s%C(red)%d%C(reset)\""
alias git-show-brief="git log --topo-order --pretty=format:\"%C(green)%h%C(reset) %s%n%C(blue)(%ar by %an)%C(red)%d%C(reset)%n\""

# Auto completions
# ================
compdef git-home=git
compdef git-wip=git
compdef git-unwip=git
compdef git-ignore=git
compdef git-recognize=git
compdef git-ignored=git
compdef git-publish=git
compdef git-sync=git
compdef git-clean-sync=git
compdef _gitignoreio get-gitignore
