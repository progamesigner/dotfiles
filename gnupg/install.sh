#!/usr/bin/env sh

head "Setting up GnuPG"

install_browser_manifest () {
    if [ -d "$(dirname "$2")" ]; then
        manifest_path="$2/gpgmejson.json"

        info "Installing browser manifest at \"$manifest_path\""

        if [ "$1" = "chromium" ]; then
            cat <<-EOF > "$manifest_path"
{
    "name": "gpgmejson",
    "description": "JavaScript binding for GnuPG",
    "path": "$(which gpgme-json)",
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://dgcbddhdhjppfdfjpciagmmibadmoapc/",
        "chrome-extension://kajibbejlbohfaggdiogboambcijhkke/"
    ]
}
EOF
        elif [ "$1" = "gecko" ]; then
            cat <<-EOF > "$manifest_path"
{
    "name": "gpgmejson",
    "description": "JavaScript binding for GnuPG",
    "path": "$(which gpgme-json)",
    "type": "stdio",
    "allowed_extensions": [
        "jid1-AQqSMBYb0a8ADg@jetpack"
    ]
}
EOF
        fi

        info "Installed browser manifest"
    fi
}

if [ -z "$NO_GNUPG" ]; then
    info "Configuring GnuPG"

    ensure "$DOTTARGET/.gnupg/gpg-agent.conf"
    touch "$DOTTARGET/.gnupg/gpg-agent.conf"
    ret=$(grep -q "^pinentry-program" "$DOTTARGET/.gnupg/gpg-agent.conf")
    if [ $? -ne 0 ] && [ -n "$(which pinentry-mac)" ]; then
        cat <<-EOF >> "$DOTTARGET/.gnupg/gpg-agent.conf"
pinentry-program $(which pinentry-mac)
EOF
    fi

    info "Configured GnuPG"

    if [ -n "$(which gpgme-json)" ]; then
        info "Configuring GPGME-JSON"

        # for chromium-based browsers on Linux
        install_browser_manifest chromium "$HOME/.config/chromium/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/.config/google-chrome-unstable/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/.config/google-chrome/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/.config/microsoft-edge/NativeMessagingHosts"

        # for gecko-based browsers on Linux
        install_browser_manifest gecko "$HOME/.librewolf/native-messaging-hosts"
        install_browser_manifest gecko "$HOME/.mozilla/native-messaging-hosts"
        install_browser_manifest gecko "$HOME/.tor-browser/app/Browser/TorBrowser/Data/Browser/.mozilla/native-messaging-hosts"
        install_browser_manifest gecko "$HOME/.waterfox/native-messaging-hosts"

        # for chromium-based browsers on macOS
        install_browser_manifest chromium "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Microsoft Edge Beta/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Microsoft Edge Canary/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Microsoft Edge Dev/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
        install_browser_manifest chromium "$HOME/Library/Application Support/Vivaldi/NativeMessagingHosts"

        # for gecko-based browsers on macOS
        install_browser_manifest gecko "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
        install_browser_manifest gecko "$HOME/Library/Application Support/TorBrowser-Data/Browser/Mozilla/NativeMessagingHosts"

        info "Configured GPGME-JSON"
    fi
fi
