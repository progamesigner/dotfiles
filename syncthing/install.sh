#! /bin/sh

if [ -n ${DOTFILE_FORCE_OVERRIDE} ]; then
    ln -s ${DOTFILES}/syncthing/stignore ~/.stignore
else
    ln -f -s ${DOTFILES}/syncthing/stignore ~/.stignore
fi
