# #! /bin/zsh

# # Initializations
# # ===============
# RUBIES=()
# for dir in "$PREFIX/opt/rubies" "$HOME/.rubies"; do
# 	[[ -d "$dir" && -n "$(ls -A "$dir")" ]] && RUBIES+=("$dir"/*)
# done
# unset dir

# # Functions
# # =========
# function chruby_reset () {
#     [[ -z "$RUBY_ROOT" ]] && return

#     PATH=":$PATH:"; PATH="${PATH//:$RUBY_ROOT\/bin:/:}"
#     [[ -n "$GEM_ROOT" ]] && PATH="${PATH//:$GEM_ROOT\/bin:/:}"

#     if (( $UID != 0 )); then
#         [[ -n "$GEM_HOME" ]] && PATH="${PATH//:$GEM_HOME\/bin:/:}"

#         GEM_PATH=":$GEM_PATH:"
#         [[ -n "$GEM_HOME" ]] && GEM_PATH="${GEM_PATH//:$GEM_HOME:/:}"
#         [[ -n "$GEM_ROOT" ]] && GEM_PATH="${GEM_PATH//:$GEM_ROOT:/:}"
#         GEM_PATH="${GEM_PATH#:}"; GEM_PATH="${GEM_PATH%:}"

#         unset GEM_HOME
#         [[ -z "$GEM_PATH" ]] && unset GEM_PATH
#     fi

#     PATH="${PATH#:}"; PATH="${PATH%:}"
#     unset RUBY_ROOT RUBY_ENGINE RUBY_VERSION RUBYOPT GEM_ROOT
#     hash -r
# }

# function chruby_use () {
#     if [[ ! -x "$1/bin/ruby" ]]; then
#         echo "chruby: $1/bin/ruby not executable" >&2
#         return 1
#     fi

#     [[ -n "$RUBY_ROOT" ]] && chruby_reset

#     export RUBY_ROOT="$1"
#     export RUBYOPT="$2"
#     export PATH="$RUBY_ROOT/bin:$PATH"

#     eval "$(RUBYGEMS_GEMDEPS="" "$RUBY_ROOT/bin/ruby" - <<EOF
# puts "export RUBY_ENGINE=#{Object.const_defined?(:RUBY_ENGINE) ? RUBY_ENGINE : 'ruby'};"
# puts "export RUBY_VERSION=#{RUBY_VERSION};"
# begin; require 'rubygems'; puts "export GEM_ROOT=#{Gem.default_dir.inspect};"; rescue LoadError; end
# EOF
#     )"
#     export PATH="${GEM_ROOT:+$GEM_ROOT/bin:}$PATH"

#     if (( UID != 0 )); then
#         export GEM_HOME="$HOME/.gem/$RUBY_ENGINE/$RUBY_VERSION"
#         export GEM_PATH="$GEM_HOME${GEM_ROOT:+:$GEM_ROOT}${GEM_PATH:+:$GEM_PATH}"
#         export PATH="$GEM_HOME/bin:$PATH"
#     fi

#     hash -r
# }

# function chruby () {
#     case "$1" in
#         -h|--help)
#             echo "usage: chruby [RUBY|VERSION|system] [RUBYOPT...]"
#             ;;
#         "")
#             local dir ruby
#             for dir in "${RUBIES[@]}"; do
#                 dir="${dir%%/}"; ruby="${dir##*/}"
#                 if [[ "$dir" == "$RUBY_ROOT" ]]; then
#                     echo " * ${ruby} ${RUBYOPT}"
#                 else
#                     echo "   ${ruby}"
#                 fi

#             done
#             ;;
#         system) chruby_reset ;;
#         *)
#             local dir ruby match
#             for dir in "${RUBIES[@]}"; do
#                 dir="${dir%%/}"; ruby="${dir##*/}"
#                 case "$ruby" in
#                     "$1")	match="$dir" && break ;;
#                     *"$1"*)	match="$dir" ;;
#                 esac
#             done

#             if [[ -z "$match" ]]; then
#                 echo "chruby: unknown Ruby: $1" >&2
#                 return 1
#             fi

#             shift
#             chruby_use "$match" "$*"
#             ;;
#     esac
# }

# function _chruby () {
#     compadd $(chruby | tr -d "* ")
# }

# function _does_rake_task_list_need_generating () {
#     if [ ! -f ".rake-tasks" ]; then return 0;
#     else
#         if [[ "${OSTYPE}" = darwin* ]]; then
#             accurate=$(stat -f%m .rake-tasks)
#             changed=$(stat -f%m Rakefile)
#         else
#             accurate=$(stat -c%Y .rake-tasks)
#             changed=$(stat -c%Y Rakefile)
#         fi
#         return $(expr ${accurate} ">=" ${changed})
#     fi
# }

# function _rails () {
#     if [ -e "bin/rails" ]; then
#         bin/rails $@
#     elif [ -e "script/rails" ]; then
#         ruby script/rails $@
#     elif [ -e "script/server" ]; then
#         ruby script/$@
#     else
#         command rails $@
#     fi
# }

# function _rake () {
#     if [ -f Rakefile ]; then
#         if _does_rake_task_list_need_generating; then
#             print "\nGenerating .rake-tasks ..." >/dev/stderr
#             _rake_generate
#         fi
#         compadd $(cat .rake-tasks)
#     fi
# }

# function _rake_generate () {
#     rake --silent --tasks | cut -d " " -f 2 >! ".rake-tasks"
# }

# function _rake_refresh () {
#     if [ -f ".rake-tasks" ]; then
#         rm ".rake-tasks"
#     fi
#     print "\nGenerating .rake-tasks ..." >/dev/stderr
#     _rake_generate
#     cat ".rake-tasks"
# }

# function chruby-set () {
#     chruby $*
#     echo "$(chruby | grep \* |tr -d "* ")" >! .ruby-version
# }

# function precmd () {
#     local dir="${PWD}/" version

#     until [[ -z "${dir}" ]]; do
#         dir="${dir%/*}"

#         if { read -r version <"${dir}/.ruby-version"; } 2>/dev/null || [[ -n "${version}" ]]; then
#             if [[ "${version}" == "${RUBY_AUTO_VERSION}" ]]; then return
#             else
#                 RUBY_AUTO_VERSION="${version}"
#                 chruby "${version}"
#                 return $?
#             fi
#         fi
#     done

#     if [[ -n "${RUBY_AUTO_VERSION}" ]]; then
#         chruby_reset
#         unset RUBY_AUTO_VERSION
#     fi
# }

# function rails-remote-console () {
#     ssh $1 "(cd $2 && ruby script/console production)"
# }

# function ruby-list-definitions () {
#     [ -z "$1" -o "$1" = "--help" ] && {
#         print "Usage: ruby-list-definitions <file>..."
#         print "List class, module, and method definitions in Ruby <file>."
#         return 0
#     }

#     for file in "$@"; do
#         print -n "${file}:"
#         grep -e "^[ ]*\(class\|module\|def\|alias\|alias_method\) " "${file}" | sed "s/^/ /"
#     done
#     unset file
# }

# function ruby-server () {
#     config="/tmp/$(basename $0)-$$.ru"
#     trap "rm -f ${config}" 0

#     cat <<-RUBY > ${config}
# class Rewriter < Struct.new(:app)
#     def call(env)
#         if env['PATH_INFO'] =~ /\/$/
#             env['PATH_INFO'] += 'index.html'
#         elsif env['PATH_INFO'] !~ /\.\w+$/
#             env['PATH_INFO'] += '.html'
#         end
#         app.call(env)
#     end
# end

# use Rack::CommonLogger
# use Rewriter
# use Rack::Static, :root => "$(pwd)", :urls => ["/"]

# run lambda { |env| [404,{},"<h1>Not Found</h1>"] }
# RUBY

#     thin --rackup "${config}" "$@" start
#     unset $config
# }

# # Aliases
# # =======
# alias rake="noglob rake"
# alias bundle="noglob bundle"
# alias refresh-rake-tasks="_rake_refresh"
# alias find-rb-files="find . -name \"*.rb\" | xargs grep -n"

# # Auto completions
# # ================
# compdef _rake rake
# compdef _rails rails
# compdef _chruby chruby
