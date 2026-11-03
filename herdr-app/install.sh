#!/usr/bin/env sh

head "Setting up Herdr App"

if [ -z "$NO_HERDR_APP" ]; then
    info "Configuring Herdr App"

    for file in $(cd "${DOTROOT:-$PWD}/herdr-app" && find layouts mods -type f); do
        ensure "$DOTTARGET/.config/herdr-app/$file"
        cp "${DOTROOT:-$PWD}/herdr-app/$file" "$DOTTARGET/.config/herdr-app/$file"
    done

    for file in $(cd "${DOTROOT:-$PWD}/herdr-app/bin" && find . -type f); do
        ensure "$DOTTARGET/.local/bin/$file"
        cp "${DOTROOT:-$PWD}/herdr-app/bin/$file" "$DOTTARGET/.local/bin/$file"
        chmod +x "$DOTTARGET/.local/bin/$file"
    done

    info "Configured Herdr App"
fi
