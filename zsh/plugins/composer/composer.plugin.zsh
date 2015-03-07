#! /bin/zsh

# Functions
# =========
function _composer_get_command_list () {
    $_comp_command1 --no-ansi | sed "1,/Available commands/d" | awk "/^[ \t]*[a-z]+/ { print \$1 }"
}

function _composer_get_required_list () {
    $_comp_command1 show -s --no-ansi | sed "1,/requires/d" | awk "NF > 0 && !/^requires \(dev\)/{ print \$1 }"
}

function _composer () {
    local curcontext="$curcontext" state line
    typeset -A opt_args
    _arguments \
        '1: :->command'\
        '*: :->args'

    case $state in
        command)
            compadd $(_composer_get_command_list)
        ;;
        *)
            compadd $(_composer_get_required_list)
        ;;
    esac
}

# Aliases
# =======
alias composer="noglob php ./composer.phar"
alias get-composer="curl -s https://getcomposer.org/installer | php"

# Auto completions
# ================
compdef _composer composer
compdef _composer composer.phar
