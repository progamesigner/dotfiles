# Dotfiles

A minimal, portable (Linux & macOS), and optimized for [devcontainer](https://containers.dev/) dotfiles.

## Installation

```sh
git clone https://github.com/progamesigner/dotfiles ~/.dotfiles
export GIT_USER_NAME="<Your Git Name>"
export GIT_USER_EMAIL="<Your Git Email>"
~/.dotfiles/install.sh
```

## Usage

This dotfiles will configure platforms (macOS, Linux, and DevContainers), Git, GnuPG, SSH, and ZSH.

### Platforms

#### Linux

Nothing configured currently.

#### macOS

It will touch `$DOTTARGET/.hushlogin` file to skip login messages. This can be skipped with `NO_HUSH_LOGIN=1`.

#### DevContainers

It will copy `/etc/gitattributes` and `/etc/gitignore` in containers.

### Git

This will configure some defaults to Git. This can be skipped with `NO_GIT=1`.

### GnuPG

This will configure GPG to use `pinentry-mac` if it's available. Also install browser native messaging manifest for [mailvelope](https://mailvelope.com/). This can be skipped with `NO_GNUPG=1`.

### SSH

This will configure SSH to include some default files. Support `*.user.conf` files to customize. This can be skipped with `NO_SSH=1`.

### ZSH

This will configure ZSH to source some default files. It will load `$ZSH_PROFILE/*.zsh` files in starting-up. This can be skipped with `NO_ZSH=1`.

### Herdr App (Shepherd)

This will copy the Shepherd layout and its mods into `$DOTTARGET/.config/herdr-app`, and `shepherd-report` into `$DOTTARGET/.local/bin`. Files already there are backed up as `*.bak` and replaced. Mods removed from this repository are not removed from an existing install. This can be skipped with `NO_HERDR_APP=1`.

The **Shepherd** layout has the Workspace list, then Quota in the sidebar, and the tab bar opens Files, Changes and Graph on the right:

| Mod | What it does |
| --- | --- |
| `workspace-agents` | Workspace list: Agents and Spaces in one. Grouped by space, each space header shows its avatar, name and git, then **+** (new tab) and a fold chevron; folded, it shows how many agents and terminals it hides. Under it, every pane of its tabs: agents as before (tab name, `shepherd.pane-name`, title, pull request, snooze, pin), plain terminals as a simpler row of the same height (tab name, program and folder; pin). Hovering a row turns its status into a close button: it closes the tab when the row is the tab's only pane, otherwise the pane. Pinned rows sit in a Pinned section on top and also stay in their space. Priority sort lists agents by urgency, then a Terminals section. Also offers Sleipnir sessions to resume. |
| `shepherd-quota` | The focused agent's subscription quota (remaining 5h/7d). Click for every account. |
| `shepherd-pane` | Pane header (clone of Herdr's `pane`) with model, effort, prompt cache hit and pull request. |
| `shepherd-tabs` | Tab bar (clone of Herdr's `tabs`) with a Graph button. A dragged tab dims and an accent line marks where it will land. |
| `reviewer` | [vytasgavelis/herdr-reviewer](https://github.com/vytasgavelis/herdr-reviewer) at `424ca3e`, in place of Changes. MIT. |
| `git-graph` | [rabeeh-ta/herdr-git-graph](https://github.com/rabeeh-ta/herdr-git-graph) at `b70e795`, with its update check off (`CHECK = false`). MIT. |

Snooze an agent from its row (1 hour, tonight or tomorrow morning). It wakes when the time is up, or earlier when it needs you or finishes.

#### Status line

`shepherd-report` copies an agent's status line data onto its herdr-core terminal, so Herdr App sees it for every connected machine. Call it from the status line script after reading stdin:

```sh
command -v shepherd-report >/dev/null && { printf '%s' "$input" | shepherd-report >/dev/null 2>&1 & }
```

It needs `jq` and `hc`, does nothing outside herdr-core, and writes labels only when a value changes (or every 5 minutes for the quota).

When no label is fresh, `shepherd-quota` asks the machine holding the login. On that machine, `curl` calls the provider's own usage endpoint, so the token never leaves it. These endpoints are undocumented and may change: `api.anthropic.com/api/oauth/usage` for Claude (reads `~/.claude/.credentials.json`, or the macOS Keychain) and `chatgpt.com/backend-api/wham/usage` for Codex (reads `~/.codex/auth.json`). This needs `curl` and `jq` on that machine.

#### Labels

Shepherd keeps its state on herdr-core terminal labels, so every Herdr client sees the same:

| Label | Written by | Value |
| --- | --- | --- |
| `shepherd.tab-name` | An agent, on request: `hc label "$HC_TERMINAL_ID" 'shepherd.tab-name=Short task name'` | Renames the terminal's tab (up to 80 characters), then is cleared. `herdr.tab-name` is still accepted. |
| `shepherd.space-name` | An agent or a script, on a terminal started with `hc`: `hc run --label 'shepherd.space-name=swag-server' ...` | Puts the terminal in the space with that name on its machine, making the space when there is none, by setting `herdr.space`; then is cleared. Herdr hides `hc` terminals without `herdr.space`. |
| `shepherd.pane-name` | An agent or you: `hc label "$HC_TERMINAL_ID" 'shepherd.pane-name=api'` | Shown after the tab's name. `shepherd.pane-name=` removes it. |
| `shepherd.session` | `shepherd-report` | JSON: `model`, `effort`, `thinking`, `fast`, `ctx`, `cache` and `pr` (`n`, `url`, `state`, `kind`). |
| `shepherd.quota` | `shepherd-report` | JSON: `provider`, `account` (`id`, `email`, `org`), `five_hour` and `seven_day` (`used` %, `resets` epoch seconds) and `at`. |
| `shepherd.snooze` | `workspace-agents` | JSON: `until` (epoch ms), `from` (the status when snoozed) and `at`. |

Shepherd also reads `herdr.pinned` (Herdr's pins) and `agent-resume` (Sleipnir's saved sessions), and keeps the fallback quota in the app's shared `shepherd.quota` value.

## Example

In my real setup, I use [Syncthing](https://syncthing.net/) to sync this repository with some `.*` folders, including ignore file for Syncthing, private network SSH configurations, Docker, Kubernetes, and even customized ZSH (mostly [oh-my-zsh](https://ohmyz.sh/) and [zsh-users](https://github.com/zsh-users)) etc.
