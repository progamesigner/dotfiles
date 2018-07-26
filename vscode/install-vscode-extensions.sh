#! /bin/sh

cat $(dirname "$0")/extensions.txt | while read EXTENSION; do
    code --install-extension ${EXTENSION}
done

code --list-extensions | diff --new-line-format='%L' --old-line-format='' --unchanged-line-format='' extensions.txt - | while read EXTENSION; do
    code --uninstall-extension ${EXTENSION}
done
