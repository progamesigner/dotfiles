#!/bin/bash

head "Setting up Git"

if [ -z "$NO_GIT" ]; then
    user "What is your name for git"
    read -e GIT_USER_NAME

    user "What is your email for git"
    read -e GIT_USER_EMAIL

    if [ -n "$GIT_USER_NAME" ]; then
        git config --global user.name "$GIT_USER_NAME"
    fi

    if [ -n "$GIT_USER_EMAIL" ]; then
        git config --global user.email "$GIT_USER_EMAIL"
    fi

    git config --global core.attributesfile "~/.gitattributes"
    git config --global core.autocrlf input
    git config --global core.editor ${EDITOR:-"code --wait"}
    git config --global core.excludesfile "~/.gitignore"
    git config --global core.safecrlf warn
    git config --global core.trustctime false
    git config --global branch.autosetupmerge true
    git config --global commit.gpgsign true
    git config --global diff.renames copies
    git config --global push.default nothing
    git config --global help.autocorrect 0
    git config --global url."git@github.com:".insteadOf "https://github.com/"

    link $PWD/git/gitignore "$DOTTARGET/.gitignore"
    link $PWD/git/gitattributes "$DOTTARGET/.gitattributes"
fi
