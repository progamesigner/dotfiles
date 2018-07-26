#! /bin/sh

ln -s ${DOTFILES}/vscode/user/keybindings.json ~/Library/Application\ Support/Code/User/keybindings.json
ln -s ${DOTFILES}/vscode/user/settings.json ~/Library/Application\ Support/Code/User/settings.json

source ${DOTFILES}/vscode/install-vscode-extensions.sh
