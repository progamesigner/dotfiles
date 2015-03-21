#! /bin/sh

info "Linking ${DOTTARGET}/.tmux.conf ..."
if [ -f "${DOTTARGET}/.tmux.conf" ] || [ -h "${DOTTARGET}/.tmux.conf" ]; then
    info "\e[00;33mFound ${DOTTARGET}/.tmux.conf file.\e[0m \e[0;32mReserving ...\e[0m"
else
    ln -s ${DOTFILES}/tmux/tmux.conf ${DOTTARGET}/.tmux.conf
fi
