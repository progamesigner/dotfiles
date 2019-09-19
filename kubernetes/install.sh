#!/bin/bash

head "Setting up Kubernetes"

if [ -z "$NO_KUBERNETES" ]; then
    info "Install Kubernetes (kubectl)"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install kubernetes-cli
    else
        info "No supported platform found, skipped ..."
    fi

    succ "Installed Kubernetes"

    info "Make sure \"$PWD/kubernetes/config\" exists"
    touch $PWD/kubernetes/config

    link $PWD/kubernetes/config "$DOTTARGET/.kube/config"
fi
