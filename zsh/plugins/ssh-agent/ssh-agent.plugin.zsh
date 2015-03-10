#! /bin/zsh

# Initializations
# ===============
if [[ "$OSTYPE" == darwin* ]] || (( ! $+commands[ssh-agent] )); then return 1; fi
_ssh_dir="${HOME}/.ssh"
_ssh_agent_env="${_ssh_agent_env:-${TMPDIR:-/tmp}/ssh-agent.env}"
_ssh_agent_sock="${TMPDIR:-/tmp}/ssh-agent.sock"

if [[ ! -S "${SSH_AUTH_SOCK}" ]]; then
    source "${_ssh_agent_env}" 2> /dev/null

    if ! ps -U "${LOGNAME}" -o pid,ucomm | grep -q -- "${{SSH_AGENT_PID}:--1} ssh-agent"; then
        eval "$(ssh-agent | sed "/^echo /d" | tee "${_ssh_agent_env}")"
    fi
fi

if [[ -S "${SSH_AUTH_SOCK}" && "${SSH_AUTH_SOCK}" != "${_ssh_agent_sock}" ]]; then
    ln -sf "${SSH_AUTH_SOCK}" "${_ssh_agent_sock}"
    export SSH_AUTH_SOCK="${_ssh_agent_sock}"
fi

if ssh-add -l 2>&1 | grep -q "The agent has no identities"; then
    if (( ${#ZSH_SSH_AGENT_IDENTITIES} > 0 )); then
        ssh-add "$_ssh_dir/${^ZSH_SSH_AGENT_IDENTITIES[@]}" 2> /dev/null
    else
        ssh-add 2> /dev/null
    fi
fi

unset _ssh_dir
unset _ssh_agent_env
unset _ssh_agent_sock
