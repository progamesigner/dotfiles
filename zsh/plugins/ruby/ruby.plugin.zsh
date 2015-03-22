#! /bin/zsh

# Initializations
# ===============
if (( $+commands[chruby-exec] )); then
    source "${commands[chruby-exec]:h:h}/share/chruby/chruby.sh"
    unset RUBY_AUTO_VERSION
fi

# Functions
# =========
function _chruby () {
    compadd $(chruby | tr -d "* ")
}

function _does_rake_task_list_need_generating () {
    if [ ! -f ".rake-tasks" ]; then return 0;
    else
        if [[ "${OSTYPE}" = darwin* ]]; then
            accurate=$(stat -f%m .rake-tasks)
            changed=$(stat -f%m Rakefile)
        else
            accurate=$(stat -c%Y .rake-tasks)
            changed=$(stat -c%Y Rakefile)
        fi
        return $(expr ${accurate} ">=" ${changed})
    fi
}

function _rails () {
    if [ -e "bin/rails" ]; then
        bin/rails $@
    elif [ -e "script/rails" ]; then
        ruby script/rails $@
    elif [ -e "script/server" ]; then
        ruby script/$@
    else
        command rails $@
    fi
}

function _rake () {
    if [ -f Rakefile ]; then
        if _does_rake_task_list_need_generating; then
            print "\nGenerating .rake-tasks ..." >/dev/stderr
            _rake_generate
        fi
        compadd $(cat .rake-tasks)
    fi
}

function _rake_generate () {
    rake --silent --tasks | cut -d " " -f 2 > ".rake-tasks"
}

function _rake_refresh () {
    if [ -f ".rake-tasks" ]; then
        rm ".rake-tasks"
    fi
    print "\nGenerating .rake-tasks ..." >/dev/stderr
    _rake_generate
    cat ".rake-tasks"
}

function chruby-set () {
    chruby $*
    echo "$(chruby | grep \* |tr -d "* ")" >! .ruby-version
}

function precmd () {
    local dir="${PWD}/" version

    until [[ -z "${dir}" ]]; do
        dir="${dir%/*}"

        if { read -r version <"${dir}/.ruby-version"; } 2>/dev/null || [[ -n "${version}" ]]; then
            if [[ "${version}" == "${RUBY_AUTO_VERSION}" ]]; then return
            else
                RUBY_AUTO_VERSION="${version}"
                chruby "${version}"
                return $?
            fi
        fi
    done

    if [[ -n "${RUBY_AUTO_VERSION}" ]]; then
        chruby_reset
        unset RUBY_AUTO_VERSION
    fi
}

function rails-remote-console () {
    ssh $1 "(cd $2 && ruby script/console production)"
}

function ruby-list-definitions () {
    [ -z "$1" -o "$1" = "--help" ] && {
        print "Usage: ruby-list-definitions <file>..."
        print "List class, module, and method definitions in Ruby <file>."
        return 0
    }

    for file in "$@"; do
        print -n "${file}:"
        grep -e "^[ ]*\(class\|module\|def\|alias\|alias_method\) " "${file}" | sed "s/^/ /"
    done
    unset file
}

function ruby-server () {
    config="/tmp/$(basename $0)-$$.ru"
    trap "rm -f ${config}" 0

    cat <<-RUBY > ${config}
class Rewriter < Struct.new(:app)
    def call(env)
        if env['PATH_INFO'] =~ /\/$/
            env['PATH_INFO'] += 'index.html'
        elsif env['PATH_INFO'] !~ /\.\w+$/
            env['PATH_INFO'] += '.html'
        end
        app.call(env)
    end
end

use Rack::CommonLogger
use Rewriter
use Rack::Static, :root => "$(pwd)", :urls => ["/"]

run lambda { |env| [404,{},"<h1>Not Found</h1>"] }
RUBY

    thin --rackup "${config}" "$@" start
    unset $config
}

# Aliases
# =======
alias rake="noglob rake"
alias bundle="noglob bundle"
alias refresh-rake-tasks="_rake_refresh"
alias find-rb-files="find . -name \"*.rb\" | xargs grep -n"

# Auto completions
# ================
compdef _rake rake
compdef _rails rails
compdef _chruby chruby
