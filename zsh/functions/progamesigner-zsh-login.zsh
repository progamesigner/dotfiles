#! /bin/zsh

function progamesigner-zsh-login () {
    local osname padding uptime l1 l2 l3 total used oifs

    function print-last-login () {
        if [[ "${OSTYPE}" == darwin* ]]; then
            local lastlog
            read lastlog <<< "$(syslog -F raw -k Facility com.apple.system.lastlog | grep "$USER" | tail -1 | awk "{print \$4}" | sed -e "s/]//g")"
            print "$(date -r "${lastlog}" +%c)"
            unset lastlog
        else
            local from w m d t y
            read from w m d t y <<< "$(last -wF $USER | head -1 | awk "{print \$3,\$4,\$5,\$6,\$7,\$8}")"
            print "$(date -r "${w} ${m} ${d} ${t} ${y}" +%c) from ${from}"
            unset from w m d t y
        fi
    }

    function print-weather-info () {
        local weather="$(curl -s --max-time 1 "http://rss.accuweather.com/rss/liveweather_rss.asp?metric=1&locCode=ASI|TW|TW018|TAIPEI" | sed -n "/Currently:/ s/.*: \(.*\): \([0-9]*\)\([CF]\).*/\2°\3, \1/p")"
        if [ -n "${weather}" ]; then
            print -R -e "${weather}"
        else
            print -R -e "\e[31mDISCONNECTED\e[0m"
        fi
        unset weather
    }

    function print-private-ip () {
        local ip="$(ifconfig | sed -En "s/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p" | head -1)"
        if [ -n "${ip}" ]; then
            print -R -e "${ip}"
        else
            print -R -e "\e[31mDISCONNECTED\e[0m"
        fi
        unset ip
    }

    function print-public-ip () {
        local ip="$(dig +short myip.opendns.com @resolver1.opendns.com || curl -4 -s --max-time 1 "http://icanhazip.com" || curl -4 -s --max-time 1 "http://api.ipify.org" || curl -4 -s --max-time 1 "http://ifconfig.me" | tail)"
        if [ -n "${ip}" ]; then
            print -R -e "${ip} \e[34m\u2601\e[0m"
        else
            print -R -e "\e[31mDISCONNECTED\e[0m"
        fi
        unset ip
    }

    osname="$(uname -s)"
    if [[ "${OSTYPE}" == darwin* ]]; then
        osname="Mac OS X"
    fi

    padding="$(align-center-indent 80)"

    oifs=${IFS}
    IFS="-"
    read l1 l2 l3 uptime <<< "$(uptime | sed "s/.*up \(.*\), [0-9]* user.*averages: \(.*\) \(.*\) \(.*\)/\2-\3-\4-\1/")"
    IFS=${oifs}

    read total used <<< "$(df -k / | tail -1 | awk "{ print \$2,\$3}")"

    if [[ ${COLUMNS} -ge 80 ]]; then
        print -R -e "${padding}\e[37m/* ------------------------------------------------------------------------ *\\ \e[0m
${padding}\e[37m|\e[0m \e[34m _ __  _ __ ___   __ _  __ _ _ __ ___   ___  ___(_) __ _ _ __   ___ _ __ \e[0m  \e[37m|\e[0m
${padding}\e[37m|\e[0m \e[34m| '_ \| '__/ _ \ / _\` |/ _\` | '_ \` _ \ / _ \/ __| |/ _\` | '_ \ / _ \ '__|\e[0m  \e[37m|\e[0m
${padding}\e[37m|\e[0m \e[34m| |_) | | | (_) | (_| | (_| | | | | | |  __/\__ \ | (_| | | | |  __/ |   \e[0m  \e[37m|\e[0m
${padding}\e[37m|\e[0m \e[34m| .__/|_|  \___/ \__, |\__,_|_| |_| |_|\___||___/_|\__, |_| |_|\___|_|   \e[0m  \e[37m|\e[0m
${padding}\e[37m|\e[0m \e[34m|_|              |___/                             |___/                 \e[0m  \e[37m|\e[0m
${padding}\e[37m\\* -------------------\e[0m \e[36m=[ P R O G A M E S I G N E R ]=\e[0m \e[37m-------------------- */\e[0m
${padding}$(align-center-padding 86 "\e[33mHi, $(whoami)! Last logined at $(print-last-login)\e[0m")

${padding}   \e[37m---------------------\e[0m \e[36m=[ I N F O R M A T I O N ]=\e[0m \e[37m----------------------\e[0m
${padding}            $(align-left-padding 55 "\e[35mOS\e[0m: \e[32m${osname} ($(uname -m))\e[0m")\e[35mDate\e[0m: \e[32m$(date +"%B %e, %Y %A")\e[0m
${padding}        $(align-left-padding 52 "\e[35mKernel\e[0m: \e[32m$(uname -r)\e[0m")    \e[35mWeather\e[0m: \e[32m$(print-weather-info)\e[0m
${padding}        \e[35mUptime\e[0m: \e[32m$(align-left-padding 24 "${uptime}")\e[0m\e[35mProcesses\e[0m: \e[32m$(ps U ${USER} -l | wc -l | tr -d " ")\e[0m / \e[32m$(ps aux -l | wc -l | tr -d " ")\e[0m
${padding}          \e[35mLoad\e[0m: \e[32m${l1}\e[0m / \e[32m${l2}\e[0m / \e[32m${l3}\e[0m      \e[35mPrivate IP\e[0m: \e[32m$(print-private-ip)\e[0m
${padding}          \e[35mDisk\e[0m: $(align-left-padding 57 "\e[32m$((${used} / 1024 / 1024))\e[0m / \e[32m$((${total} / 1024 / 1024))\e[0m \e[32mGB\e[0m")\e[35m\e[35mPublic IP\e[0m: \e[32m$(print-public-ip)\e[0m

${padding}   \e[37m---------------------------\e[0m \e[36m=[ R U L E S ]=\e[0m \e[37m----------------------------\e[0m
${padding}    \e[91mThis is a private system so you should not give out the access without
${padding}    my permission. Stay awareness of privacy or confident, keep the system
${padding}    clean, and make regular backups.
${padding}      \e[31m** DISABLE YOUR PROGRAMS FROM KEEPING SENSITIVE LOGS OR HISTORY **\e[0m"
    fi

    if [[ ${LINES} -gt 30 ]]; then
        local fortune="$(curl -s --max-time 1 "http://www.iheartquotes.com/api/v1/random?format=text&max_lines=3&max_characters=512&show_permalink=false&show_source=false")"
        print -r "$(curl -s -X POST -d "message=${fortune// /+}&format=text" "http://cowsay.morecode.org/say" | sed "\$d" | sed "s/^/${padding}                                /")"
        unset fortune
    fi

    unset -f print-last-login print-weather-info print-private-ip print-public-ip
    unset osname padding uptime l1 l2 l3 total used oifs
}
