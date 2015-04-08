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

function get-gitignore () {
    curl -sL https://www.gitignore.io/api/$@
}

function git-amend () {
    git commit --amend -C HEAD
}

function git-big-object-report () {
    set -e
    IFS=$'\n'
    printf "%7s %7s %-7s %-20s\n" SIZE PACK SHA LOCATION
    for object in $(git verify-pack -v "$(git rev-parse --git-dir)"/objects/pack/pack-*.idx | grep -v chain | sort -k3nr | head); do
        local sha
        sha=$(print "${object}" | cut -f 1 -d " ")
        printf "%7d %7d %-7s %-20s\n" "$(($(print "${object}" | cut -f 5 -d " ") / 1024))" "$(($(print "${object}" | cut -f 6 -d " ") / 1024))" "$(print "${sha}" | cut -c1-7)" "$(git rev-list --all --objects | grep "${sha}" | cut -c42-)"
        unset sha
    done
    unset object

    print "All sizes in KB. PACK = size of compressed object in pack file."

    unset IFS
}

function git-conflicts () {
    git ls-files -u | awk "{print \$4}" | sort -u
}

function git-copy-branch-name () {
    local branch=$(git rev-parse --abbrev-ref HEAD)
    print ${branch}
    print ${branch} | tr -d "\n" | tr -d " " | pbcopy
    unset branch
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

function git-credit () {
    git commit --amend --author "$1 <$2>" -C HEAD
}

function git-current-branch () {
    ref=$(git symbolic-ref HEAD 2>/dev/null) || ref=$(git rev-parse --short HEAD 2>/dev/null) || return 0
    print "${ref#refs/heads/}"
}

function git-current-repository () {
    ref=$(git symbolic-ref HEAD 2>/dev/null) || ref=$(git rev-parse --short HEAD 2>/dev/null) || return 0
    print "$(git remote -v | cut -d":" -f 2)"
}

function git-cut-branch () {
    function die () {
        print "$(basename $0):" "$@" 1>&2
        return 1
    }

    function shortsha () {
        print "$1" | cut -c1-7
    }

    [ -z "$1" -o "$1" = "--help" ] && {
        print "Usage: git-cut-branch <name>"
        print "Create a new branch named <name> pointed at HEAD and reset the current branch"
        print "to the head of its tracking branch. This is useful when working on master and"
        print "you realize you should be on a topic branch."
        return 0
    }

    local branch="$1"

    local ref=$(git symbolic-ref -q HEAD)
    local sha=$(git rev-parse HEAD)
    [ -n "${ref}" ] || die "you're not on a branch"

    local current=$(print "${ref}" |sed "s@^refs/heads/@@")
    [ -n "${current}" ] || die "you're in a weird place; get on a local branch"

    local remote=$(git config --get "branch.${current}.remote" || true)
    local merge=$(git config --get "branch.${current}.merge" | sed "s@refs/heads/@@")

    local tracking
    if [ -n "${remote}" -a -n "${merge}" ]; then
        tracking="${remote}/${merge}"
    elif [ -n "${merge}" ]; then
        tracking="${merge}"
    else
        die "${current} is not tracking anything"
    fi

    if ! git diff-index --quiet --cached HEAD || ! git diff-files --quiet; then
        die "cannot cut branch with changes to index or working directory"
    fi

    git branch "${branch}"
    git reset -q --hard "${tracking}"
    git checkout -q "${branch}"
    git branch --set-upstream "${branch}" "${tracking}"
    git reset -q --hard "${sha}"
    print "[$(shortsha "${sha}")...$(shortsha $(git rev-parse ${tracking}))] ${current}"
    print "[0000000...$(shortsha $(git rev-parse HEAD))] ${branch}"

    unset branch ref sha current remote merge tracking
}

function git-delete-local-merged () {
    git branch -d $(git branch --merged | grep -v "^*" | grep -v "master" | tr -d "\n")
}

function git-find-object () {
    local sha="$1"
    shift

    [ "${sha}" = "--help" ] && {
        print "Usage: git-find-object <id> <repo>..."
        print "Write first <repo> that includes object <id>. Useful when trying to locate a"
        print "missing object in a list of repositories."
        print ""
        print "Ex: git-find-object deadbee /repos/*.git"
        return 0
    }

    for dir in "$@"; do
        (cd "${dir}" && git cat-file -e ${sha} 2>/dev/null) && {
            print "${dir}"
            unset dir sha
            return 0
        }
    done
    unset dir sha

    return 1
}

function git-find-branch-by-commit () {
    git branch -a --contains "$1";
}

function git-find-commit-by-tag () {
    git describe --always --contains "$1";
}

function git-find-by-code () {
    git log --pretty=format:'%C(yellow)%h %Cblue%ad %Creset%s%Cgreen [%cn] %Cred%d' --decorate --date=short -S"$1";
}

function git-find-by-commit () {
    git log --pretty=format:'%C(yellow)%h %Cblue%ad %Creset%s%Cgreen [%cn] %Cred%d' --decorate --date=short --grep="$1";
}

function git-grab () {
    [ $# -eq 0 ] && {
        print "usage: git-grab username [repository]"
        return 0
    }

    local username="$1"
    if [ -n "$2" ] ; then
        repository="$2"
    else
        repository=$(basename $(pwd))
    fi

    local command="git remote add ${username} git://github.com/${username}/${repository}.git"

    print ${command}
    ${command}
    command="git fetch ${username}"
    print ${command}
    ${command}

    unset username repository command
}

function git-incoming () {
    function die () {
        print "$(basename $0):" "$@" 1>&2
        return 1
    }

    local SHA=$(git config --get-color "color.branch.local")
    local ADD=$(git config --get-color "color.diff.new")
    local REM=$(git config --get-color "color.diff.old")
    local RESET=$(git config --get-color "" "reset")

    local diff=false
    if [ "$1" = "-d" -o "$1" = "--diff" ]; then
        diff=true
        shift
    fi

    if [ $# -eq 0 ]; then
        local ref=$(git symbolic-ref -q HEAD)
        test -n "${ref}" || die "you're not on a branch"

        local branch=$(print "${ref}" | sed "s@^refs/heads/@@")
        test -n "${branch}" || die "you're in a weird place; get on a local branch"

        local remote=$(git config --get "branch.${branch}.remote" || true)
        local merge=$(git config branch.${branch}.merge) || die "branch ${branch} isn't tracking a remote branch and no <upstream> given"

        set -- "${remote}/$(print "${merge}" |sed "s@^refs/heads/@@")"

        unset ref branch remote merge
    fi

    if ${diff}; then
        git diff HEAD..."$1"
    else
        git cherry -v HEAD "$@" | cut -c1-9 -c43- | sed -e "s/^\(.\) \(.......\)/\1 ${SHA}\2${RESET}/" | sed -e "s/^-/${REM}-${RESET}/" -e "s/^+/${ADD}+${RESET}/"
    fi

    unset SHA ADD REM RESET diff
}

function git-is-working-in-progress () {
    if $(git log -n 1 2>/dev/null | grep -q -c "\-\-wip\-\-"); then
        print "We are working in progress!"
    fi
}

function git-ls-object-refs () {
    local object="$1"

    set +e
    print "refs:"
    git show-ref | grep "${object}"
    print "\n"
    git log --all --pretty=oneline --decorate | grep "${object}" | sed "s|^\([0-9a-f]\{40\}\)|commit referenced from at least one ref: \1|"
    for ref in $(git for-each-ref --format="%(refname)"); do
        (git rev-list "${ref}" | grep "${object}") 2>&1 | sed "s|^[0-9a-f]\{40\}$|commit referenced from ${ref}|"
    done
    unset ref

    for p in $(git rev-list --all); do
        (git ls-tree -r "${p}" |grep "${object}") 2>&1 | sed "s|^|object referenced from tree of commit ${p}:\n|"
    done
    unset p

    print "\n"

    unset object
}

function git-nuke () {
    git branch -D "$1"
    git push origin :"$1"
}

function git-object-deflate () {
    exec perl -MCompress::Zlib -e "undef $/; print uncompress(<>)"
}

function git-outgoing () {
    function die () {
        print "$(basename $0):" "$@" 1>&2
        return 1
    }

    local SHA=$(git config --get-color "color.branch.local")
    local ADD=$(git config --get-color "color.diff.new")
    local REM=$(git config --get-color "color.diff.old")
    local RESET=$(git config --get-color "" "reset")


    local diff=false
    if [ "$1" = "-d" -o "$1" = "--diff" ]; then
        diff=true
        shift
    fi

    local ref=$(git symbolic-ref -q HEAD)
    test -n "${ref}" || die "you're not on a branch"

    local branch=$(print "${ref}" | sed 's@^refs/heads/@@')
    test -n "${branch}" || die "you're in a weird place; get on a local branch"

    if [ $# -eq 0 ]; then
        local remote=$(git config --get "branch.${branch}.remote" || true)
        local merge=$(git config branch.${branch}.merge) || die "branch ${branch} isn't tracking a remote branch and no <upstream> given"
        set -- "${remote}/$(print "${merge}" |sed "s@^refs/heads/@@")"
        unset remote merge
    fi

    if ${diff}; then
        git diff "$1"...HEAD
    else
        git cherry -v "$@" | cut -c1-9 -c43- | sed -e "s/^\(.\) \(.......\)/\1 ${SHA}\2${RESET}/" | sed -e "s/^-/${REM}-${RESET}/" -e "s/^+/${ADD}+${RESET}/"
    fi

    unset SHA ADD REM RESET diff ref branch
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

function git-prune-merged-branches () {
    function usage () {
        status=${1:-0}
        print "Usage: git prune-merged-branches [-fu] [-r <remote>] <merge-branch>"
        print "Delete all branches that are fully merged into <merge-branch>."
        print ""
        print "Options:"
        print "-f Really delete the branches. Without this, branches are shown but"
        print "not actually deleted."
        print "-r <remote> Name of remote to operate on. Operate locally when not specified."
        print "-u Fetch <remote> before determining merged branch status."
        print ""
        print "Examples:"
        print "List local branches already merged into master for inspection:"
        print "git prune-merged-branches master"
        print ""
        print "Delete local branches already merged into master:"
        print "git prune-merged-branches -f master"
        print ""
        print "List branches in origin remote already merged into origin/master:"
        print "git prune-merged-branches -u -r origin master"
        print ""
        print "Delete branches in origin remote already merged into origin/master:"
        print "git prune-merged-branches -f -r origin/master"
        return ${status}
    }

    [ $# -eq 0 -o "$1" = "--help" ] && usage

    local force=false
    local update=false
    local remote=
    while getopts hfur: name; do
        case ${name} in
        f)    force=true;;
        r)    remote="${OPTARG}";;
        u)    update=true;;
        ?)    usage 2;;
        esac
    done
    shift $((${OPTIND} - 1))

    local branch="$1"
    [ -n "${branch}" ] || usage 2

    local mode
    local branch_name
    local branches
    if [ -n "${remote}" ]; then
        ${update} && git fetch "${remote}" --prune
        mode=Remote
        branch_name="${remote}/${branch}"
        branches=$(git branch --no-color -a --merged "${remote}/${branch}" | grep "^..remotes/${remote}/" | grep -v "^..remotes/${remote}/${branch}$" | grep -v " -> " | sed "s|^\(..\)remotes/\"${remote}\"/|\1|")
    else
        mode=Local
        branch_name="${branch}"
        branches=$(git branch --no-color --merged "${branch}" | grep -v "^..${branch}$" | grep -v " -> ")
    fi

    [ -z "${branches}" ] && {
        print "no merged branches detected" 1>&2
        return 0
    }

    if ! ${force}; then
        print "${mode} branches fully merged into ${branch_name}:" 1>&2
        print "${branches}"
        print "Use \"$(basename "$0") -f\" if you're sure." 1>&2
        return 0
    fi

    # actually delete the branches via push if remote or via branch -D if local
    if [ -n "${remote}" ]
        then git push origin $(print "${branches}" | sed "s/^../:/")
        else git branch -D $(print "${branches}" | cut -c2-)
    fi

    unset force update remote branch mode branch_name branches
}

function git-pruneall () {
    local remotes="$@"

    test -z "${remotes}" &&
    remotes=$(git remote)

    for remote in ${remotes}; do
        print "pruning: ${remote}"
        git remote prune "${remote}" || true
    done
    unset remote

    unset remotes
}

function git-relations () {
    function strip_prefix () {
        print "$@" | sed "s@refs/heads/@@"
    }

    function current_branch () {
        git symbolic-ref -q HEAD | sed "s@refs/heads/@@"
    }

    function tracking_branch () {
        remote=$(git config --get branch.$(current_branch).remote)
        merge=$(git config --get branch.$(current_branch).merge)
        print "${remote}/$(strip_prefix ${merge})"
    }

    local ref="${1:-$(tracking_branch)}"

    git rev-list --left-right --abbrev-commit --abbrev ${ref}...HEAD | cut -c1 | sort | uniq -c | tr "\n" "," | sed "
      s/>/ahead/
      s/</behind/
      s/,$//g
      s/,/, /g
    "

    unset ref
}

function git-thanks () {
    git log "$1" | grep Author: | sed "s/Author: \(.*\) <.*/\1/" | sort | uniq -c | sort -rn | sed "s/ *\([0-9]\{1,\}\) \(.*\)/\2 (\1)/"
}

function git-track () {
    function die () {
        print "$(basename $0):" "$@" 1>&2
        return 1
    }

    local remote merge
    case "$1" in
    --help)
        print "Usage: git track"
        print "git track <branch>"
        print "Point the current local branch at <branch> for the purpose"
        print "of merge tracking, pull, and status features. With no <branch>,"
        print "write the currently tracked branch to standard output."
        print "If you have git's bash-completion support enabled, add this:"
        print "complete -o default -o nospace -F _git_checkout git-track"
        return 0
    ;;
    "")
        remote=
        merge=
    ;;
    */*)
        git rev-parse "$1" >/dev/null
        remote=$(print "$1" | sed "s@^\(.*\)/.*@\1@")
        merge=$(print "$1"  | sed "s@^.*/\(.*\)@\1@")
    ;;
    *)
        git rev-parse "$1" >/dev/null
        remote=
        merge="$1"
    ;;
    esac

    local ref=$(git symbolic-ref -q HEAD)
    test -n "${ref}" || die "you're not on a branch"

    local branch=$(print "${ref}" | sed "s@^refs/heads/@@")
    test -n "${branch}" || die "you're in a weird place; get on a local branch"

    test -z "${merge}" && {
        local remote=$(git config --get "branch.${branch}.remote" || true)
        local merge=$((git config --get "branch.${branch}.merge") | (sed "s@refs/heads/@@"))
        if test -n "${remote}" -a -n "${merge}"; then
            print "${branch} -> ${remote}/${merge}"
        elif test -n "${merge}"; then
            print "${branch} -> ${merge}"
        else
        print "${branch} is not tracking anything"
        fi
        return 0
    }

    test -n "${remote}" && git config "branch.${branch}.remote" "${remote}"
    git config "branch.${branch}.merge" "refs/heads/${merge}"

    unset remote merge ref branch
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

    if [ "${count}" -eq "1" ]; then
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

function github-merge-pull-request () {
    if [ $(printf "%s" "$1" | grep "^[0-9]\\+$" > /dev/null; printf $?) -eq 0 ]; then
        local branch=${2:-"master"}

        git fetch origin refs/pull/$1/head:pr/$1
        git checkout pr/$1
        git merge ${branch}

        git checkout ${branch}
        git merge --no-ff pr/$1
        git branch -D pr/$1

        git commit --amend -m \"$(git log -1 --pretty=%B)\n\nCloses #$1.\"
        unset branch
    fi
}

function github-open () {
    function die () {
        print "$(basename $0):" "$@" 1>&2
        return 1
    }

    local file="$1"
    local line="$2"

    test -z "${file}" -o "${file}" = "--help" && {
        print "Usage: github-open FILE [LINE]"
        print "Open GitHub file/blob page for FILE on LINE. FILE is the path to the"
        print "file on disk; it must exist and be tracked with the current HEAD"
        print "revision. LINE is the line number or line number range (e.g., 10-50)."
        print ""
        print "Open foo/bar.rb in browser:"
        print "$ github-open foo/bar.rb"
        print ""
        print "Open foo/bar in browser w/ lines 50-57 highlighted:"
        print "$ github-open foo/bar.rb 50-57"
        print ""
        print "Open current file in vim on line 20:"
        print ":!github-open % 20"
        return 1
    }

    local path="$(basename ${file})"
    cd $(dirname ${file})

    while test ! -d .git; do
        test "$(pwd)" = / && {
            print "error: git repository not found" 1>&2
            return 1
        }
        path="$(basename $(pwd))/${path}"
        cd ..
    done

    local ref=$(git symbolic-ref -q HEAD)
    test -n "${ref}" || die "you're not on a branch"

    local branch=$(print "${ref}" | sed "s@^refs/heads/@@")
    test -n "${branch}" || die "you're in a weird place; get on a local branch"

    local remote=$(git config --get "branch.${branch}.remote" || true)
    test -n "${remote}" || die "you're not tracking a remote branch"

    local merge=$((git config --get "branch.${branch}.merge") | (sed "s@refs/heads/@@"))
    test -n "${merge}" || die "you're not tracking a remote branch"

    local url=$(git config --get remote.${remote}.url)
    local repository=$(print "${url}" | sed "s/^.*:\(.*\)\.git/\1/")

    url="http://github.com/${repository}/blob/${branch}/${path}"
    test -n "${line}" && url="${url}#L${line}"
    open "${url}"

    unset file line path ref branch remote url repository
}

function github-pull-request () {
    if [ "$1" == "--help" -o "$1" == "-h" ]; then
        print "Usage: github-pull-request [<branch>]"
        print "Open the pull request page for <branch>, or the current branch if not"
        print "specified. Lands on the new pull request page when no PR exists yet."
        print "The branch must already be pushed"
        return 0
    fi

    local branch=${1:-"$(git symbolic-ref HEAD | sed "s@refs/heads/@@")"}

    if git rev-parse "refs/remotes/origin/${branch}" 1>/dev/null 2>&1; then
        url=$(github-url "../../pull/${branch}")
        open "${url}"
        unset url
    else
        print "error: branch '${branch}' does not exist on the origin remote." 1>&2
        print "       try again after pushing the branch"
    fi

    unset branch
}

function github-sync-upstream () {
    git fetch ${1:-"upstream"}
    git merge ${1:-"upstream"}/${2:-"master"}
}

function github-url () {
    local url

    local remotes="origin $(git remote)"
    for remote in ${remotes}; do
        git=$(git config remote.${remote}.url || true)
        case "${git}" in
        https://github.com/*)
            url="${git}"
            break
        ;;
        git@github.com:*)
            url=$(print "${git}" | sed "s|git@github.com:|https://github.com/|")
            break
        ;;
        git://github.com/*)
            url=$(print "${git}" | sed "s|git://github.com|https://github.com|")
            break
        ;;
        esac
        unset git
    done
    unset remote

    if [ -z "${url}" ]; then
        print "error: no github.com git remotes found" 1>&2
        return 1
    fi

    url=$(print "${url}" | sed "s|\.git$||")
    url=$(print "${url}" | sed "s|/{1,}$||")

    local path="$1"
    if [ -n "${path}" ]; then
        local gitdir=$(git rev-parse --git-dir)
        local workdir=$(cd "${gitdir}"/.. && pwd)
        path=$(print "${path}" | sed "s|^${workdir}/||")
        print "${url}/tree/master/${path}"
        unset gitdir workdir
    else
        print "${url}"
    fi

    unset url remotes path
}

# Aliases
# =======
alias git="noglob git"
alias git-reup="git-up"
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
alias git-show-oneline="git log --topo-order --pretty=format:\"* %C(green)%h%C(reset) %s%C(red)%d%C(reset)\""
alias git-show-graph="git log --topo-order --all --graph --pretty=format:\"%C(green)%h%C(reset) %s%C(red)%d%C(reset)\""
alias git-show-brief="git log --topo-order --pretty=format:\"%C(green)%h%C(reset) %s%n%C(blue)(%ar by %an)%C(red)%d%C(reset)%n\""
alias git-compare="git diff-index --quiet HEAD -- || clear; git --no-pager diff --patch-with-stat"
alias git-contributors="git shortlog --summary --numbered"
alias git-recent-branches="git for-each-ref --count=15 --sort=-committerdate refs/heads/ --format=\"%(refname:short)\""

if (( $+commands[hub] )); then
    alias git=$(which hub)
fi

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
