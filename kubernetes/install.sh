#!/usr/bin/env sh

head "Setting up Kubernetes"

if [ -z "$NO_KUBERNETES" ]; then
    touch "$PWD/kubernetes/config"
fi
