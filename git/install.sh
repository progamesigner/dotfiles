#!/usr/bin/env sh

head "Setting up Git"

if [ -z "$NO_GIT" ]; then
    info "Configuring Git"

    if [ -n "$GIT_USER_NAME" ]; then
        git config --global user.name "$GIT_USER_NAME"
    fi

    if [ -n "$GIT_USER_EMAIL" ]; then
        git config --global user.email "$GIT_USER_EMAIL"
    fi

    git config --global core.autocrlf input
    git config --global core.safecrlf warn
    git config --global core.trustctime false
    git config --global core.attributesFile "$PWD/git/attributes"
    git config --global core.excludesFile "$PWD/git/ignore"

    git config --global commit.gpgsign true

    git config --global help.autoCorrect 0

    info "Configured Git"
fi
