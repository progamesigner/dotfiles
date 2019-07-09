#!/bin/bash

EXTENSION_LIST_FILE=$(dirname ${BASH_SOURCE[0]})/extensions.txt

for extension in $(cat $EXTENSION_LIST_FILE); do
    code --install-extension "$extension"
done

for extension in $(code --list-extensions | diff --new-line-format='%L' --old-line-format='' --unchanged-line-format='' $EXTENSION_LIST_FILE -); do
    code --uninstall-extension "$extension"
done
