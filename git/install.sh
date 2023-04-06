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
    git config --global core.editor ${EDITOR:-"code --wait"}
    git config --global core.safecrlf warn

    if [ -n "$GIT_ATTRIBUTE_PATH" ]; then
        git config --global core.attributesFile "$GIT_ATTRIBUTE_PATH"
    else
        if [ -f /etc/gitattributes ]; then
            git config --global core.attributesFile /etc/gitattributes
        elif [ -f "$PWD/git/attributes" ]; then
            git config --global core.attributesFile "$PWD/git/attributes"
        fi
    fi

    if [ -n "$GIT_IGNORE_PATH" ]; then
        git config --global core.excludesFile "$GIT_IGNORE_PATH"
    else
        if [ -f /etc/gitignore ]; then
            git config --global core.excludesFile /etc/gitignore
        elif [ -f "$PWD/git/attributes" ]; then
            git config --global core.excludesFile "$PWD/git/ignore"
        fi
    fi

    git config --global commit.gpgsign true

    git config --global help.autoCorrect 0

    git config --global url."git@github.com:".insteadOf "https://github.com/"

    info "Configured Git"
fi
