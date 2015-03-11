#! /bin/zsh

# Initializations
# ===============
if [[ "${OSTYPE}" != darwin* ]]; then return 1; fi

if [[ "${TERM_PROGRAM}" == "Apple_Terminal" ]] && [[ -z "${INSIDE_EMACS}" ]]; then
    function update_terminal_cwd () {
        local URL_PATH=""
        {
            local i ch hexch LANG=C
            for ((i = 1; i <= ${#PWD}; ++i)); do
                ch="${PWD[i]}"
                if [[ "${ch}" =~ [/._~A-Za-z0-9-] ]]; then
                    URL_PATH+="${ch}"
                else
                    hexch=$(printf "%02X" "'${ch}")
                    URL_PATH+="%${hexch}"
                fi
            done
        }

        local PWD_URL="file://${HOST}${URL_PATH}"
        printf "\e]7;%s\a" "${PWD_URL}"
    }

    autoload add-zsh-hook
    add-zsh-hook precmd update_terminal_cwd
    update_terminal_cwd
fi

# Functions
# =========
function osx-tab () {
    local command="cd \\\"${PWD}\\\"; clear; "
    (( $# > 0 )) && command="${command}; $*"

    the_app=$(osascript 2>/dev/null <<EOF
tell application "System Events"
    name of first item of (every process whose frontmost is true)
end tell
EOF)

    [[ "${the_app}" == "Terminal" ]] && {
        osascript 2>/dev/null <<EOF
tell application "System Events"
    tell process "Terminal" to keystroke "t" using command down
    tell application "Terminal" to do script "${command}" in front window
end tell
EOF
    }

    [[ "${the_app}" == "iTerm" ]] && {
        osascript 2>/dev/null <<EOF
tell application "iTerm"
    set current_terminal to current terminal
    tell current_terminal
        launch session "Default Session"
        set current_session to current session
        tell current_session
            write text "${command}"
            keystroke return
        end tell
    end tell
end tell
EOF
    }

    unset command
}

function osx-tab-vsplit () {
    local command="cd \\\"${PWD}\\\""
    (( $# > 0 )) && command="${command}; $*"

    the_app=$(osascript 2>/dev/null <<EOF
tell application "System Events"
    name of first item of (every process whose frontmost is true)
end tell
EOF)

    [[ "${the_app}" == "iTerm" ]] && {
        osascript 2>/dev/null <<EOF
tell application "iTerm" to activate

tell application "System Events"
    tell process "iTerm"
        tell menu item "Split Vertically With Current Profile" of menu "Shell" of menu bar item "Shell" of menu bar 1
            click
        end tell
    end tell
    keystroke "${command}; clear;"
    keystroke return
end tell
EOF
    }

    unset command
}

function osx-tab-split () {
    local command="cd \\\"${PWD}\\\""
    (( $# > 0 )) && command="${command}; $*"

    the_app=$(osascript 2>/dev/null <<EOF
tell application "System Events"
    name of first item of (every process whose frontmost is true)
end tell
EOF)

    [[ "${the_app}" == "iTerm" ]] && {
        osascript 2>/dev/null <<EOF
tell application "iTerm" to activate

tell application "System Events"
    tell process "iTerm"
        tell menu item "Split Horizontally With Current Profile" of menu "Shell" of menu bar item "Shell" of menu bar 1
            click
        end tell
    end tell
    keystroke "${command}; clear;"
    keystroke return
end tell
EOF
    }
}

function osx-finder-directory () {
    osascript 2>/dev/null <<EOF
tell application "Finder"
    return POSIX path of (target of first window as text)
end tell
EOF
}

function osx-finder-selection () {
    osascript 2>/dev/null <<EOF
tell application "Finder" to set the_selection to selection
if the_selection is not {}
    repeat with an_item in the_selection
        log POSIX path of (an_item as text)
    end repeat
end if
EOF
}

function osx-quick-look () {
    (( $# > 0 )) && qlmanage -p $* &>/dev/null &
}

function osx-man-preview () {
    local page
    if (( $# > 0 )); then
        for page in "$@"; do
            man -t "${page}" | open -f -a Preview
        done
    else
        man -t "$@" | open -f -a Preview
    fi
    unset page
}

function osx-man-dash () {
    if (( $# > 0 )); then
        open "dash://manpages:$1" 2>/dev/null
        if (( $? != 0 )); then
            print "$0: Dash is not installed" >&2
            break
        fi
    else
        open "dash://manpages:$@" 2>/dev/null
    fi
}

function osx-to-trash () {
    local trash_dir="${HOME}/.Trash"
    local temp_ifs="${IFS}"
    IFS=$'\n'
    for item in "$@"; do
        if [[ -e "${item}" ]]; then
        item_name="$(basename ${item})"
        if [[ -e "${trash_dir}/${item_name}" ]]; then
            mv -f "${item}" "${trash_dir}/${item_name} $(date "+%H-%M-%S")"
        else
            mv -f "${item}" "${trash_dir}/"
        fi
        fi
    done
    IFS=${temp_ifs}
    unset trash_dir temp_ifs
}

function osx-open-vncviewer () {
    open vnc://$@
}

function osx-ls-download-history () {
    local db
    for db in ~/Library/Preferences/com.apple.LaunchServices.QuarantineEventsV*; do
        if grep -q "LSQuarantineEvent" < <(sqlite3 "${db}" .tables); then
            sqlite3 "${db}" "SELECT LSQuarantineDataURLString FROM LSQuarantineEvent"
        fi
    done
}

function osx-rm-dir-metadata () {
    find "${@:-${PWD}}" \( -type f -name ".DS_Store" -o -type d -name "__MACOSX" \) -print0 | xargs -0 rm -rf
}

function osx-rm-download-history () {
    local db
    for db in ~/Library/Preferences/com.apple.LaunchServices.QuarantineEventsV*; do
        if grep -q "LSQuarantineEvent" < <(sqlite3 "${db}" .tables); then
            sqlite3 "${db}" "DELETE FROM LSQuarantineEvent; VACUUM"
        fi
    done
}

function osx-itunes () {
    local opt=$1
    shift
    case "${opt}" in
        launch|play|pause|stop|rewind|resume|quit)
            ;;
        mute)
            opt="set mute to true"
            ;;
        unmute)
            opt="set mute to false"
            ;;
        next|previous)
            opt="${opt} track"
            ;;
        vol)
            opt="set sound volume to $1" #$1 Due to the shift
            ;;
        shuf|shuff|shuffle)
            local state=$1

            if [[ -n "${state}" && ! "${state}" =~ "^(on|off|toggle)$" ]]; then
                print "Usage: itunes shuffle [on|off|toggle]. Invalid option."
                return 1
            fi

            case "${state}" in
                on|off)
                    osascript 1>/dev/null 2>&1 <<-EOF
tell application "System Events" to perform action "AXPress" of (menu item "${state}" of menu "Shuffle" of menu item "Shuffle" of menu "Controls" of menu bar item "Controls" of menu bar 1 of application process "iTunes" )
EOF
                    return 0
                    ;;
                toggle|*)
                    osascript 1>/dev/null 2>&1 <<-EOF
tell application "System Events" to perform action "AXPress" of (button 2 of process "iTunes"'s window "iTunes"'s scroll area 1)
EOF
                    return 0
                    ;;
            esac
            ;;
        ""|-h|--help)
            echo "Usage: itunes <option>"
            echo "option:"
            echo "\tlaunch|play|pause|stop|rewind|resume|quit"
            echo "\tmute|unmute\tcontrol volume set"
            echo "\tnext|previous\tplay next or previous track"
            echo "\tshuf|shuffle [on|off|toggle]\tSet shuffled playback. Default: toggle. Note: toggle doesn't support the MiniPlayer."
            echo "\tvol\tSet the volume, takes an argument from 0 to 100"
            echo "\thelp\tshow this message and exit"
            return 0
            ;;
        *)
            print "Unknown option: ${opt}"
            return 1
            ;;
    esac
    osascript -e "tell application \"iTunes\" to ${opt}"
}

# Aliases
# =======
alias afk="/System/Library/CoreServices/Menu\ Extras/User.menu/Contents/Resources/CGSession -suspend"
alias cdf="cd \"$(osx-finder-directory)\""        # Changes directory to the current Finder directory
alias pushdf="pushd \"$(osx-finder-directory)\""  # Pushes directory to the current Finder directory
alias openf="open \"$(PWD)\""
alias ios="open -n /Applications/Xcode.app/Contents/Applications/iOS\ Simulator.app"
alias osx-clean-up="sudo rm -rfv /Volumes/*/.Trashes; sudo rm -rfv ~/.Trash; sudo rm -rfv /private/var/log/asl/*.asl"

# Exports
# =======
if [[ "$(boot2docker status &>/dev/null)" = "running" ]]; then $(boot2docker shellinit); fi
