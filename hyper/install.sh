#! /bin/sh

if [ -n ${DOTFILE_FORCE_OVERRIDE} ]; then
    ln -s ${DOTFILES}/hyper/hyper.js ${DOTTARGET}/.hyper.js
else
    ln -f -s ${DOTFILES}/hyper/hyper.js ${DOTTARGET}/.hyper.js
fi
