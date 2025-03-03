#!/usr/bin/env sh

head "Setting up ZSH"

if [ -z "$NO_ZSH" ]; then
    info "Configuring ZSH"

    ensure "$DOTTARGET/.zshrc"
    cat <<-EOF > "$DOTTARGET/.zshrc"
source ${DOTROOT:-$PWD}/zsh/entrypoint.zsh
EOF

    if [ -n "$(which zsh)" ] && [ "$SHELL" != "$(which zsh)" ]; then
        info "Changing default shell to zsh ..."
        sudo sh -c "echo $(which zsh) >> /etc/shells"
        sudo chsh -s $(which zsh) $USER
    fi

    info "Configured ZSH"
fi
