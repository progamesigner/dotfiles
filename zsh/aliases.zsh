#!/bin/zsh

# Disable auto correction
alias ack="nocorrect ack"
alias cd="nocorrect cd"
alias cp="nocorrect cp"
alias gcc="nocorrect gcc"
alias grep="nocorrect grep"
alias ln="nocorrect ln"
alias man="nocorrect man"
alias mkdir="nocorrect mkdir"
alias mv="nocorrect mv"
alias mysql="nocorrect mysql"
alias rm="nocorrect rm"
alias sudo="nocorrect sudo"

# Disable globbing
alias fc="noglob fc"
alias find="noglob find"
alias ftp="noglob ftp"
alias history="noglob history"
alias locate="noglob locate"
alias rsync="noglob rsync"
alias scp="noglob scp"
alias sftp="noglob sftp"

# Define general aliases
alias b="${(z)BROWSER}"
alias cp="${aliases[cp]:-cp} -i"
alias e="${(z)VISUAL:-${(z)EDITOR}}"
alias ln="${aliases[ln]:-ln} -i"
alias mkdir="${aliases[mkdir]:-mkdir} -p"
alias mv="${aliases[mv]:-mv} -i"
alias p=${(z)PAGER}
alias rm="${aliases[rm]:-rm} -i"
alias type="type -a"
alias sl="ls"
alias t="tail -f"
alias fd="find . -type d -name"
alias ff="find . -type f -name"
alias grep="grep --color=auto"
alias sgrep="grep -R -n -H -C 5 --exclude-dir={.bzr,.cvs,.git,.hg,.svn,CVS}"
alias relogin="exec ${SHELL} -l"
alias timer="echo \"Timer started. Stop with Ctrl-D.\" && date && time cat && date"
alias whois="whois -h whois-servers.net"
alias j="jump"

# List directory contents
alias l="ls -lFh"       # size, show type, human readable
alias la="ls -lAFh"     # long list, show almost all, show type, human readable
alias lr="ls -tRFh"     # sorted by date, recursive, show type, human readable
alias lt="ls -ltFh"     # long list, sorted by date, show type, human readable
alias ll="ls -l"        # long list
alias ldot="ls -ld .*"  # show dot files in current directory

# Mac everywhere :-)
if [[ "${OSTYPE}" == darwin* ]]; then
    alias o="open"
elif [[ "${OSTYPE}" == cygwin* ]]; then
    alias o="cygstart"
    alias pbcopy="tee >/dev/clipboard"
    alias pbpaste="cat /dev/clipboard"
else
    alias o="xdg-open"
    if (( $+commands[xclip] )); then
        alias pbcopy="xclip -selection clipboard -in"
        alias pbpaste="xclip -selection clipboard -out"
    elif (( $+commands[xsel] )); then
        alias pbcopy="xsel --clipboard --input"
        alias pbpaste="xsel --clipboard --output"
    fi
fi
alias pbc="pbcopy"
alias pbp="pbpaste"

# Unify commands on different platforms
if (( ! $+commands[hd] )); then
    alias hd="hexdump -C"
fi
if (( ! $+commands[md5sum] )); then
    alias md5sum="md5"
fi
if (( ! $+commands[sha1sum] )); then
    alias sha1sum="shasum"
fi

# Quickly access to sending request
for method in GET HEAD POST PUT DELETE TRACE OPTIONS; do
    alias "${method}"="lwp-request -m \"${method}\""
done
unset method

# File Download
if (( $+commands[curl] )); then
    alias get="curl --continue-at - --location --progress-bar --remote-name --remote-time"
elif (( $+commands[wget] )); then
    alias get="wget --continue --progress=bar --timestamping"
fi

# Prints the contents of the directory stack
alias d="dirs -v | head -10®"

# Changes the directory to the n previous one
alias 1="cd -"
alias 2="cd -2"
alias 3="cd -3"
alias 4="cd -4"
alias 5="cd -5"
alias 6="cd -6"
alias 7="cd -7"
alias 8="cd -8"
alias 9="cd -9"

# Quickly accesses
alias -g ...="../.."
alias -g ....="../../.."
alias -g .....="../../../.."
alias -g ......="../../../../.."

# Command line head / tail shortcuts
alias -g A="| awk"
alias -g C="| wc"
alias -g G="| grep"
alias -g H="| head"
alias -g L="| less"
alias -g M="| most"
alias -g P="2>&1| pygmentize -l pytb"
alias -g S="| sed"
alias -g T="| tail"
alias -g N="&>/dev/null"
alias -g CA="2>&1 | cat -A"
alias -g LL="2>&1 | less"
alias -g NE="2>/dev/null"
alias -g NUL=">/dev/null 2>&1"
alias -g XC="&> xclip -i -sel c"

# Show human friendly numbers
alias df="df -kh"
alias du="du -kh -d 2"

if (( $+commands[htop] )); then
    alias top="htop"
else
    if [[ "${OSTYPE}" == (darwin*|*bsd*) ]]; then
        alias topc="top -o cpu"
        alias topm="top -o vsize"
    else
        alias topc="top -o %CPU"
        alias topm="top -o %MEM"
    fi
fi

alias grep-rb-file="grep --include=\"*.rb\""
alias grep-py-file="grep --include=\"*.py\""
alias grep-php-file="grep --include=\"*.php\""

# Serves a directory via HTTP.
alias http-dump="sudo tcpdump -i ${1:-"en0"} -n -s 0 -w - | noglob grep -a -o -E \"Host\: .*|GET \/.*\""
alias http-sniffer="sudo ngrep -d ${1:-"en0"} -t \"^(GET|POST) \" \"tcp and port 80\""
alias http-server="python -m SimpleHTTPServer"

# Forward port 80 to 3000
alias port-forward="sudo ipfw add 1000 forward 127.0.0.1,3000 ip from any to any 80 in"

# Lists the ten most used commands
alias history-stat="history 0 | awk \"{print \$2}\" | sort | uniq -c | sort -n -r | head"

alias test-ssl="docker run -it --rm drwetter/testssl.sh:3.0"
