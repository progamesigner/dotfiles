# Dotfiles

A minimal, portable (Linux & macOS), and optimized for [devcontainer](https://containers.dev/) dotfiles.

## Install

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
