#!/bin/bash

EXTENSION_LIST_FILE=$(dirname ${BASH_SOURCE[0]})/extensions.txt

code --list-extensions >| $EXTENSION_LIST_FILE
