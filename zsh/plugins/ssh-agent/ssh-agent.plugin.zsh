#! /bin/zsh

# Initializations
# ===============
local _plugin__ssh_env
local _plugin__forwarding

zstyle -b :omz:plugins:ssh-agent agent-forwarding _plugin__forwarding
if (( $+commands[scutil] )); then
    _plugin__ssh_env="${HOME}/.ssh/environment-$(scutil --get ComputerName)"
else
    _plugin__ssh_env="${HOME}/.ssh/environment-${HOST}"
fi

if [[ ${_plugin__forwarding} == "yes" && -n "$SSH_AUTH_SOCK" ]]; then
    [[ -L $SSH_AUTH_SOCK ]] || ln -sf "$SSH_AUTH_SOCK" "/tmp/ssh-agent-$USER-screen"
elif [ -f "${_plugin__ssh_env}" ]; then
    source ${_plugin__ssh_env} >/dev/null
    $(ps x | grep ${SSH_AGENT_PID} | grep ssh-agent >/dev/null || { _plugin__start_agent; })
else
    _plugin__start_agent;
fi

# Functions
# =========
function _plugin__start_agent () {
    local -a identities
    local lifetime
    zstyle -s :omz:plugins:ssh-agent lifetime lifetime

    $(/usr/bin/env ssh-agent ${lifetime:+-t} ${lifetime} | sed "s/^echo/#echo/" > ${_plugin__ssh_env})
    chmod 600 "${_plugin__ssh_env}"
    source "${_plugin__ssh_env}" >/dev/null

    zstyle -a :omz:plugins:ssh-agent identities identities
    print -R -e starting ssh-agent...

    $(/usr/bin/ssh-add "${HOME}/.ssh/${^identities}")
}

# Exports
# =======
unfunction _plugin__start_agent
unset _plugin__forwarding
unset _plugin__ssh_env
