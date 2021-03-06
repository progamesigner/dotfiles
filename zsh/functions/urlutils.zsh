#!/bin/zsh

if (( ! $+commands[${URLTOOLS_METHOD}] )); then
    URLTOOLS_METHOD="shell"
fi

if (( $+commands[node] )) && [[ "x${URLTOOLS_METHOD}" = "x"  || "x${URLTOOLS_METHOD}" = "xnode" ]]; then
    alias urlencode="node -e \"console.log(encodeURIComponent(process.argv[1]))\""
    alias urldecode="node -e \"console.log(decodeURIComponent(process.argv[1]))\""
elif (( $+commands[python] )) && [[ "x${URLTOOLS_METHOD}" = "x" || "x${URLTOOLS_METHOD}" = "xpython" ]]; then
    alias urlencode="python -c \"import sys, urllib as ul; print ul.quote_plus(sys.argv[1])\""
    alias urldecode="python -c \"import sys, urllib as ul; print ul.unquote_plus(sys.argv[1])\""
elif (( $+commands[xxd] )) && [[ "x${URLTOOLS_METHOD}" = "x" || "x${URLTOOLS_METHOD}" = "xshell" ]]; then
    function urlencode () {
        echo $@ | tr -d "\n" | xxd -plain | sed "s/\(..\)/%\1/g"
    }
    function urldecode () {
        printf $(echo -n $@ | sed "s/\\\\/\\\\\\\\/g;s/\\(%\)\\([0-9a-fA-F][0-9a-fA-F]\)/\\\\x\\2/g")"\n"
    }
elif (( $+commands[ruby] )) && [[ "x${URLTOOLS_METHOD}" = "x" || "x${URLTOOLS_METHOD}" = "xruby" ]]; then
    alias urlencode="ruby -r cgi -e \"puts CGI.escape(ARGV[0])\""
    alias urldecode="ruby -r cgi -e \"puts CGI.unescape(ARGV[0])\""
elif (( $+commands[php] )) && [[ "x${URLTOOLS_METHOD}" = "x" || "x${URLTOOLS_METHOD}" = "xphp" ]]; then
    alias urlencode="php -r \"echo rawurlencode(\\\$argv[1]); echo \\\"\\n\\\";\""
    alias urldecode="php -r \"echo rawurldecode(\\\$argv[1]); echo \\\"\\n\\\";\""
elif (( $+commands[perl] )) && [[ "x${URLTOOLS_METHOD}" = "x" || "x${URLTOOLS_METHOD}" = "xperl" ]]; then
    if perl -MURI::Encode -e 1&>/dev/null; then
        alias urlencode="perl -MURI::Encode -ep \"uri_encode($ARGV[0]);\""
        alias urldecode="perl -MURI::Encode -ep \"uri_decode($ARGV[0]);\""
    elif perl -MURI::Escape -e 1 &>/dev/null; then
        alias urlencode="perl -MURI::Escape -ep \"uri_escape($ARGV[0]);\""
        alias urldecode="perl -MURI::Escape -ep \"uri_unescape($ARGV[0]);\""
    else
        alias urlencode="perl -e \"\\\$new=\\\$ARGV[0]; \\\$new =~ s/([^A-Za-z0-9])/sprintf(\\\"%%%02X\\\", ord(\\\$1))/seg; print \\\"\\\$new\n\\\";\""
        alias urldecode="perl -e \"\\\$new=\\\$ARGV[0]; \\\$new =~ s/\%([A-Fa-f0-9]{2})/pack(\\\"C\\\", hex(\\\$1))/seg; print \\\"\\\$new\n\\\";\""
    fi
fi

unset URLTOOLS_METHOD
