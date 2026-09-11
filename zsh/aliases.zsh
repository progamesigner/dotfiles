#!/usr/bin/env zsh

alias ls="ls -G"
alias sl="ls"

if [ ! -x "$(command -v hd)" ]; then
    alias hd="hexdump -C"
fi

if [ ! -x "$(command -v htop)" ]; then
    alias top="htop"
fi

if [ ! -x "$(command -v md5sum)" ]; then
    alias md5sum="md5"
fi

if [ ! -x "$(command -v sha1sum)" ]; then
    alias sha1sum="shasum"
fi

dcx() {
    if (( $# == 0 )); then
        echo "Usage: dcx <agent> [args...]" >&2
        return 2
    fi

    local agent=$1
    shift

    local workspace=${PWD:A}
    local config=
    local container_id=
    local -a docker_tty=(-i)

    if [[ -f "$workspace/.devcontainer.json" ]]; then
        config="$workspace/.devcontainer.json"
    elif [[ -f "$workspace/.devcontainer/devcontainer.json" ]]; then
        config="$workspace/.devcontainer/devcontainer.json"
    else
        echo "dcx: no .devcontainer.json or .devcontainer/devcontainer.json in:" >&2
        echo "  $workspace" >&2
        return 1
    fi

    command -v docker >/dev/null || {
        echo "dcx: docker is not installed or not in PATH" >&2
        return 127
    }

    container_id=$(
        docker ps \
            --filter "label=devcontainer.local_folder=$workspace" \
            --format '{{.ID}}' |
            head -n 1
    )

    if [[ -z "$container_id" ]]; then
        command -v devcontainer >/dev/null || {
            echo "dcx: container is not running and devcontainer CLI is unavailable" >&2
            return 127
        }

        echo "dcx: starting devcontainer for $workspace..." >&2

        devcontainer up \
            --workspace-folder "$workspace" \
            --config "$config" ||
            return

        container_id=$(
            docker ps \
                --filter "label=devcontainer.local_folder=$workspace" \
                --format '{{.ID}}' |
                head -n 1
        )
    fi

    if [[ -z "$container_id" ]]; then
        echo "dcx: devcontainer started, but its container could not be found" >&2
        return 1
    fi

    [[ -t 0 && -t 1 ]] && docker_tty+=(-t)

    HERDR_AGENT="$agent" command docker exec "${docker_tty[@]}" \
        -e COLORTERM \
        -e HERDR_PANE_ID \
        -e HERDR_TAB_ID \
        -e HERDR_WORKSPACE_ID \
        -e TERM \
        -w "/workspaces/${workspace:t}" \
        "$container_id" \
        herdr-devcontainer moshi-devcontainer "$agent" "$@"
}

for agent in agy claude codex copilot opencode; do
    if [ ! -x "$(command -v $agent)" ]; then
        alias $agent="dcx $agent"
    fi
done
