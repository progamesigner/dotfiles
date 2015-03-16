#! /bin/zsh

ZSH_THEME_PROMPT_STATEMENT_COMMAND="»"
ZSH_THEME_PROMPT_STATEMENT_CONTINUE="→"
ZSH_THEME_PROMPT_SPACE_TAG=""

ZSH_THEME_RETVAL_SUCCESS_INDICATOR="%{%F{2}%}\u2714%{%f%}"      # ✔
ZSH_THEME_RETVAL_FAILURE_INDICATOR="%{%F{1}%}\u2718%{%f%}"      # ✘
ZSH_THEME_SHORTEN_PATH_SYMBOL=" \u22EF "                        # ⋯
ZSH_THEME_DIRECTORY_READONLY_INDICATOR="%{%F{1}%}\u27C1%{%f%}"  # ⟁

ZSH_THEME_PROMPT_LEFT_SEPARATOR="%{%F{0}%}\u276F%{%f%}"         # ❯
ZSH_THEME_PROMPT_RIGHT_SEPARATOR="%{%F{0}%}\u276E%{%f%}"        # ❮

ZSH_THEME_PHP_PROMPT_OPEN="\u2039%{%F{4}%}"                     # ‹
ZSH_THEME_PHP_PROMPT_CLOSE="%{%f%}\u203A"                       # ›
ZSH_THEME_NODE_PROMPT_OPEN="\u2039%{%F{2}%}"                    # ‹
ZSH_THEME_NODE_PROMPT_CLOSE="%{%f%}\u203A"                      # ›
ZSH_THEME_RUBY_PROMPT_OPEN="\u2039%{%F{1}%}"                    # ‹
ZSH_THEME_RUBY_PROMPT_CLOSE="%{%f%}\u203A"                      # ›
ZSH_THEME_PYTHON_PROMPT_OPEN="\u2039%{%F{3}%}"                  # ‹
ZSH_THEME_PYTHON_PROMPT_CLOSE="%{%f%}\u203A"                    # ›
ZSH_THEME_PROMPT_JOB_INDICATOR="%{%F{6}%}\u2699%{%}"            # ⚙

ZSH_THEME_GIT_PROMPT_ADDED="%{%F{2}%}\u271A%{%f%}"              # ✚
ZSH_THEME_GIT_PROMPT_MODIFIED="%{%F{5}%}\u2731%{%f%}"           # ✱
ZSH_THEME_GIT_PROMPT_DELETED="%{%F{1}%}\u2716%{%f%}"            # ✖
ZSH_THEME_GIT_PROMPT_RENAMED="%{%F{3}%}\u2794%{%f%}"            # ➔
ZSH_THEME_GIT_PROMPT_UNMERGED="%{%F{3}%}\u00A7%{%f%}"           # §
ZSH_THEME_GIT_PROMPT_UNTRACKED="%{%F{1}%}\u272D%{%f%}"          # ✭
ZSH_THEME_GIT_PROMPT_BRANCH="%{%F{2}%}\u16B6%{%f%}"             # ᚶ
ZSH_THEME_GIT_PROMPT_DETACHED="%{%F{1}%}\u16AC%{%f%}"           # ᚬ
ZSH_THEME_GIT_PROMPT_BARE="%{%F{4}%}\u2234%{%f%}"               # ∴
ZSH_THEME_GIT_PROMPT_STASHED="%{%F{3}%}\u2691%{%f%}"            # ⚑
ZSH_THEME_GIT_PROMPT_AHEAD="%{%F{5}%}\u2B06%{%f%}"              # ⬆
ZSH_THEME_GIT_PROMPT_BEHIND="%{%F{4}%}\u2B07%{%f%}"             # ⬇
ZSH_THEME_GIT_PROMPT_DIVERGED="%{%F{1}%}\u2B0D%{%f%}"           # ⬍

ZSH_THEME_HG_PROMPT_UNKNOWN="%{%F{1}%}\u2713%{%f%}"             # ✓
ZSH_THEME_HG_PROMPT_MODIFIED="%{%F{3}%}\u2717%{%f%}"            # ✗
ZSH_THEME_HG_PROMPT_CLEAN="%{%F{2}%}\u27A4%{%f%}"               # ➤

ZSH_THEME_GIT_PROMPT_INDICATOR="%{%F{2}%}\u00B1%{%f%}"          # ±
ZSH_THEME_VCHS_PROMPT_INDICATOR="%{%F{5}%}\u007C%{%f%}"         # |
ZSH_THEME_BZR_PROMPT_INDICATOR="%{%F{3}%}\u26AF%{%f%}"          # ⚯
ZSH_THEME_HG_PROMPT_INDICATOR="%{%F{4}%}\u263F%{%f%}"           # ☿
ZSH_THEME_SVN_PROMPT_INDICATOR="%{%F{1}%}\u2021%{%f%}"          # ‡
ZSH_THEME_FOSSIL_PROMPT_INDICATOR="%{%F{6}%}\u2318%{%f%}"       # ⌘

ZSH_THEME_BATTERY_DISCHARGING_SYMBOL="\u2301"                   # ⌁
ZSH_THEME_BATTERY_PLUGGED_SYMBOL="\u23DA"                       # ⏚

# Functions
# =========
function git_prompt_info () {
    local branch mode step total upstream information
    local repository inside bare worktree reference

    read repository inside bare worktree reference <<< "$(command git rev-parse --git-dir --is-inside-git-dir --is-bare-repository --is-inside-work-tree --short HEAD 2>/dev/null | tr "\n" " ")"

    if [ -z ${repository} ]; then return; fi

    upstream="$(command git rev-list --count --left-right "@{upstream}"...HEAD 2>/dev/null | awk "{print \$1,\$2}" 2>/dev/null)"
    information="$(command git status --porcelain --ignore-submodules=dirty 2>/dev/null)"

    if [ -d "${repository}/rebase-merge" ]; then
        read branch 2>/dev/null <"${repository}/rebase-merge/head-name"
        read step 2>/dev/null <"${repository}/rebase-merge/msgnum"
        read total 2>/dev/null <"${repository}/rebase-merge/end"
        if [ -f "${repository}/rebase-merge/interactive" ]; then
            mode=" >RI>"
        else
            mode=" >RM>"
        fi
    else
        if [[ -f "${repository}/BISECT_LOG" ]]; then
            mode=" <B>"
        elif [[ -f "${repository}/MERGE_HEAD" ]]; then
            mode=" >M<"
        elif [[ -f "${repository}/REVERT_HEAD" ]]; then
            mode=" >R<"
        elif [[ -f "${repository}/CHERRY_PICK_HEAD" ]]; then
            mode=" >C<"
        elif [[ -e "${repository}/rebase" || -d "${repository}/rebase-apply" || -e "${repository}/rebase-merge" || -e "${repository}/../.dotest" ]]; then
            read step 2>/dev/null <"${repository}/rebase-apply/next"
            read total 2>/dev/null <"${repository}/rebase-apply/last"
            if [ -f "${repository}/rebase-apply/rebasing" ]; then
                read branch 2>/dev/null <"${repository}/rebase-apply/head-name"
                mode=" >R>"
            elif [ -f "${repository}/rebase-apply/applying" ]; then
                mode=" >A>"
            else
                mode=" >A/R>"
            fi
        fi

        if [[ -z ${branch} ]]; then
            branch="$(git symbolic-ref HEAD 2>/dev/null)"
            if [[ $? -eq 0 ]]; then
                print -n "${ZSH_THEME_GIT_PROMPT_BRANCH}"
            else
                print -n "${ZSH_THEME_GIT_PROMPT_DETACHED}"
                branch="$(command git describe --contains --all HEAD 2>/dev/null || print "${reference}...")"
            fi
        fi
    fi

    if [ -n "${step}" ] && [ -n "${total}" ]; then
        mode="${mode}${step}/${total}"
    fi

    if [[ -z "${information}" ]]; then
        print -n "%{%F{2}%}"
    else
        print -n "%{%F{1}%}"
    fi
    print -n "%24<...<${branch#refs/heads/}%<<%{%f%}${mode} "

    if [ "true" = "${inside}" ]; then
        if [ "true" = "${bare}" ]; then
            print -n "${ZSH_THEME_GIT_PROMPT_BARE}"
        fi
    elif [ "true" = "${worktree}" ]; then
        if $(print "${information}" | command grep -E "^\?\? " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_UNTRACKED} "
        fi

        if $(print "${information}" | grep "^A " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_ADDED} "
        elif $(print "${information}" | grep "^M " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_ADDED} "
        fi

        if $(print "${information}" | grep "^ M " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_MODIFIED} "
        elif $(print "${information}" | grep "^AM " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_MODIFIED} "
        elif $(print "${information}" | grep "^ T " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_MODIFIED} "
        fi

        if $(print "${information}" | grep "^R " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_RENAMED} "
        fi

        if $(print "${information}" | grep "^ D " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_DELETED} "
        elif $(print "${information}" | grep "^D " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_DELETED} "
        elif $(print "${information}" | grep "^AD " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_DELETED} "
        fi

        if $(command git rev-parse --verify refs/stash &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_STASHED} "
        fi

        if $(print "${information}" | grep "^UU " &>/dev/null); then
            print -n "${ZSH_THEME_GIT_PROMPT_UNMERGED} "
        fi

        case "${upstream}" in
               "") ;;
            "0 0") ;;
            "0 "*) print -n "${ZSH_THEME_GIT_PROMPT_AHEAD} ${upstream#0 } " ;;
            *" 0") print -n "${ZSH_THEME_GIT_PROMPT_BEHIND} ${upstream% 0} " ;;
                *) print -n "${ZSH_THEME_GIT_PROMPT_DIVERGED}${upstream#* }/${upstream% *} " ;;
        esac
    fi
}

function hg_prompt_info () {
    if $(hg id >/dev/null 2>&1); then
        if $(hg prompt >/dev/null 2>&1); then
            print $(hg prompt "{rev}@{branch}")
            if [[ $(hg prompt "{status|unknown}") = "?" ]]; then
                print " ${ZSH_THEME_HG_PROMPT_UNKNOWN}"
            elif [[ -n $(hg prompt "{status|modified}") ]]; then
                print " ${ZSH_THEME_HG_PROMPT_MODIFIED}"
            else
                print " ${ZSH_THEME_HG_PROMPT_CLEAN}"
            fi
        else
            print "$(hg id -n 2>/dev/null | sed "s/[^-0-9]//g")@$(hg id -b 2>/dev/null)"
            if $(hg st | grep -q "^\?"); then
                print " ${ZSH_THEME_HG_PROMPT_UNKNOWN}"
            elif $(hg st | grep -q "^(M|A)"); then
                print " ${ZSH_THEME_HG_PROMPT_MODIFIED}"
            else
                print " ${ZSH_THEME_HG_PROMPT_CLEAN}"
            fi
        fi
    fi
}

function chruby_prompt_info () {
    if (( $+commands[chruby-exec] )); then
        local ruby
        ruby="$(chruby | grep \* | tr -d "* ")"
        if [[ -n ${ruby} ]]; then
            print "${ZSH_THEME_RUBY_PROMPT_OPEN}${ruby}${ZSH_THEME_RUBY_PROMPT_CLOSE}"
            export RUBYGEMS_GEMDEPS=-
        fi
        unset ruby
    fi
}

function rbenv_prompt_info () {
    return 1
}

function rvm_prompt_info () {
    return 1
}

function ruby_prompt_info () {
    print $(chruby_prompt_info || rbenv_prompt_info || rvm_prompt_info)
}

function php_prompt_info () {
    local dir="${PWD}/"

    until [[ -z "${dir}" ]]; do
        dir="${dir%/*}"

        if [ -e "${dir}/composer.json" ]; then
            print -R -n "${ZSH_THEME_PHP_PROMPT_OPEN}$(php -r "echo phpversion();")${ZSH_THEME_PHP_PROMPT_CLOSE}"
        fi
    done

    unset dir
}

function virtualenv_prompt_info () {
    local virtualenv_path="${VIRTUAL_ENV}"
    if [[ -n ${VIRTUAL_ENV} && -z ${VIRTUAL_ENV_DISABLE_PROMPT} ]]; then
        print "${ZSH_THEME_PYTHON_PROMPT_OPEN}$(basename ${VIRTUAL_ENV})${ZSH_THEME_PYTHON_PROMPT_CLOSE}"
    fi
}

function python_prompt_info () {
    print $(virtualenv_prompt_info)
}

function node_prompt_info () {
    return 1
}

# Prompt segments
# ===============
function prompt_tag_segment () {
    if [[ -n ${ZSH_THEME_PROMPT_SPACE_TAG} ]]; then
        print "${ZSH_THEME_PROMPT_SPACE_TAG} ${ZSH_THEME_PROMPT_LEFT_SEPARATOR} "
    fi
}

function prompt_hostname_segment () {
    if [[ -n "${SSH_CLIENT}" ]]; then
        print "%{%F{4}%}%n%{%F{1}%}@%{%F{2}%}%m%{%f%}"
    else
        print "%{%F{4}%}Local%{%f%}"
    fi
}

function prompt_directory_segment () {
    local directory="$(print -P %~)"
    local maxlength=$(( ${COLUMNS} / 2.5 ))

    if (( ${#directory} > ${maxlength} )); then
        local ds=""
        local current="$(print -P %-1~)/${ZSH_THEME_SHORTEN_PATH_SYMBOL}/"
        for (( c=1 ; ; ++c )); do
            local p="$(print -P %${c}~)"
            if (( (${#current} + ${#p}) < ${maxlength} )); then
                ds=${p}
            else
                break
            fi
        done
        directory="${current}${ds}"
    fi

    if [[ -w "${PWD}" ]]; then
        print " ${ZSH_THEME_PROMPT_LEFT_SEPARATOR} %{%F{3}%}${directory}%{%f%}"
    else
        print " ${ZSH_THEME_PROMPT_LEFT_SEPARATOR} %{%F{1}%}${directory}%{%f%} ${ZSH_TMEME_DIRECTORY_READONLY_INDICATOR}"
    fi
}

function prompt_git_segment () {
    local git
    git="$(git_prompt_info)"
    if [[ -n ${git} ]]; then
        print "${git}${ZSH_THEME_PROMPT_RIGHT_SEPARATOR} "
    fi
}

function prompt_hg_segment () {
    local hg
    hg="$(hg_prompt_info)"
    if [[ -n ${hg} ]]; then
        print "${hg}${ZSH_THEME_PROMPT_RIGHT_SEPARATOR} "
    fi
}

function prompt_datetime_segment () {
    (( minutes = $(date +%M) + 15 ))
    (( hour = $(date +%I) + minutes / 60 ))
    (( minutes %= 60 ))
    (( hour %= 12 ))

    case ${hour} in
         0) clock="\U0001F55B"; [ ${minutes} -ge 30 ] && clock="\U0001F567";;
         1) clock="\U0001F550"; [ ${minutes} -ge 30 ] && clock="\U0001F55C";;
         2) clock="\U0001F551"; [ ${minutes} -ge 30 ] && clock="\U0001F55D";;
         3) clock="\U0001F552"; [ ${minutes} -ge 30 ] && clock="\U0001F55E";;
         4) clock="\U0001F553"; [ ${minutes} -ge 30 ] && clock="\U0001F55F";;
         5) clock="\U0001F554"; [ ${minutes} -ge 30 ] && clock="\U0001F560";;
         6) clock="\U0001F555"; [ ${minutes} -ge 30 ] && clock="\U0001F561";;
         7) clock="\U0001F556"; [ ${minutes} -ge 30 ] && clock="\U0001F562";;
         8) clock="\U0001F557"; [ ${minutes} -ge 30 ] && clock="\U0001F563";;
         9) clock="\U0001F558"; [ ${minutes} -ge 30 ] && clock="\U0001F564";;
        10) clock="\U0001F559"; [ ${minutes} -ge 30 ] && clock="\U0001F565";;
        11) clock="\U0001F55A"; [ ${minutes} -ge 30 ] && clock="\U0001F566";;
         *) clock="\u231B";;
    esac

    print "${clock} %F{4}$(date +"%H:%M:%S")%{%f%} ${ZSH_THEME_PROMPT_RIGHT_SEPARATOR} "
}

function prompt_battery_segment () {
    local percentage=$(battery_current_percentage)

    if battery_is_plugged; then
        if [[ percentage -eq 100 ]]; then
            print "%{%F{2}%}${ZSH_THEME_BATTERY_PLUGGED_SYMBOL}%{%f%} "
        elif [[ percentage -ge 70 ]]; then
            print "%{%F{2}%}${ZSH_THEME_BATTERY_PLUGGED_SYMBOL}%{%f%} "
        else
            print "%{%F{3}%}${ZSH_THEME_BATTERY_PLUGGED_SYMBOL}%{%f%} "
        fi
    else
        if [[ percentage -ge 70 ]]; then
            print -R -e -n "%{%F{2}%}${ZSH_THEME_BATTERY_DISCHARGING_SYMBOL}%{%f%}"
        elif [[ percentage -ge 50 ]]; then
            print -R -e -n "%{%F{3}%}${ZSH_THEME_BATTERY_DISCHARGING_SYMBOL}%{%f%}"
        else
            print -R -e -n "%{%F{1}%}${ZSH_THEME_BATTERY_DISCHARGING_SYMBOL}%{%f%}"
        fi

        if (( percentage <= 0 )); then
            print "${percentage}%%"
        elif (( percentage <= 10 )); then
            print "%{%F{1}%}${percentage}%%%{%f%}"
        elif (( percentage <= 30 )); then
            print "%{%F{5}%}${percentage}%%%{%f%}"
        elif (( percentage <= 60 )); then
            print "%{%B%F{1}%}${percentage}%%%{%b%f%}"
        elif (( percentage <= 75 )); then
            print "%{%F{3}%}${percentage}%%%{%f%}"
        elif (( percentage < 100 )); then
            print "%{%F{2}%}${percentage}%%%{%f%}"
        else
            print "${percentage}%%"
        fi
    fi
}

function prompt_status_segment () {
    if $(git rev-parse --is-inside-work-tree 2>/dev/null); then
        if [[ -n "${VCSH_DIRECTORY}" ]]; then
            print "${ZSH_THEME_VCHS_PROMPT_INDICATOR}"
        elif [[ -d "$(git rev-parse --git-dir 2>/dev/null)/svn" ]]; then
            print "${ZSH_THEME_GIT_PROMPT_INDICATOR}${ZSH_THEME_SVN_PROMPT_INDICATOR}"
        else
            print "${ZSH_THEME_GIT_PROMPT_INDICATOR}"
        fi
    elif $(hg root 2>/dev/null); then
        print "${ZSH_THEME_HG_PROMPT_INDICATOR}"
    elif $(svn info 2>/dev/null); then
        print "${ZSH_THEME_SVN_PROMPT_INDICATOR}"
    elif $(fossil status 2>/dev/null); then
        print "${ZSH_THEME_FOSSIL_PROMPT_INDICATOR}"
    elif $(bzr nick 2>/dev/null); then
        print "${ZSH_THEME_BZR_PROMPT_INDICATOR}"
    else
        print "%(!.#.\$)"
    fi
}

function build_primary_prompt () {
    local termwidth

    local zero="%([BSUbfksu]|([FB])|{)*}"
    local spacing=""

    local tag="$(prompt_tag_segment)"
    local hostname="$(prompt_hostname_segment)"
    local directory="$(prompt_directory_segment)"

    local git="$(prompt_git_segment)"
    local hg="$(prompt_hg_segment)"
    local datetime="$(prompt_datetime_segment)"
    local battery="$(prompt_battery_segment)"

    let "termwidth="${COLUMNS}" - "${#${(S%%)tag//$~zero/}}" - "${#${(S%%)hostname//$~zero/}}" - "${#${(S%%)directory//$~zero/}}" - "${#${(S%%)hg//$~zero/}}" - "${#${(S%%)git//$~zero/}}" - "${#${(S%%)datetime//$~zero/}}" - "${#${(S%%)battery//$~zero/}}
    for _ in {1..${termwidth}}; do spacing="${spacing} "; done
    unset _

    print "\n%{%K{10}%}${tag}${hostname}${directory}${spacing}${hg}${git}${datetime}${battery}%{%k%}"
}

function build_secondary_prompt () {
    print "%(?.${ZSH_THEME_RETVAL_SUCCESS_INDICATOR}.${ZSH_THEME_RETVAL_FAILURE_INDICATOR}) %(!.%{%F{3}%}.%{%F{4}%})$(prompt_status_segment)%{%f%} ${ZSH_THEME_PROMPT_STATEMENT_COMMAND} %E"
}

function build_context_prompt () {
    print -R -e -n "$(node_prompt_info)$(python_prompt_info)$(php_prompt_info)$(ruby_prompt_info)"
    print -R -e -n "%(j.. %{%F{6}%}%j%{%f%} ${ZSH_THEME_PROMPT_JOB_INDICATOR})"
}

PROMPT="\$(build_primary_prompt)\$(build_secondary_prompt)"
RPROMPT="\$(build_context_prompt)"
SPROMPT="zsh: correct %{%F{1}%}%R%{%f%} to %{%F{3}%}%r%{%f%} [nyae]? "
PROMPT2="%_\${ZSH_THEME_PROMPT_STATEMENT_CONTINUE}"
