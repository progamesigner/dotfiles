#!/usr/bin/env sh

head "Setting up GnuPG"

install_browser_manifest () {
    if [ -d "$(dirname "$1")" ]; then
        manifest_path="$1/gpgmejson.json"

        info "Installing browser manifest at \"$manifest_path\""

        cat <<-EOF > "$manifest_path"
{
    "name": "gpgmejson",
    "description": "JavaScript binding for GnuPG",
    "path": "$(which gpgme-json)",
    "type": "stdio",
    "allowed_extensions": [
        "jid1-AQqSMBYb0a8ADg@jetpack"
    ],
    "allowed_origins": [
        "chrome-extension://dgcbddhdhjppfdfjpciagmmibadmoapc/",
        "chrome-extension://kajibbejlbohfaggdiogboambcijhkke/"
    ]
}
EOF

        info "Installed browser manifest"
    fi
}

if [ -z "$NO_GNUPG" ]; then
    info "Configuring GnuPG"

    ensure "$DOTTARGET/.gnupg/gpg-agent.conf"
    touch "$DOTTARGET/.gnupg/gpg-agent.conf"
    ret=$(grep -q "^pinentry-program" "$DOTTARGET/.gnupg/gpg-agent.conf")
    if [ -n "$(which pinentry-mac)" ] && [ $? -ne 0 ]; then
        cat <<-EOF >> "$DOTTARGET/.gnupg/gpg-agent.conf"
pinentry-program $(which pinentry-mac)
EOF
    fi

    info "Configured GnuPG"

    if [ -n "$(which gpgme-json)" ]; then
        info "Configuring GPGME-JSON"

        install_browser_manifest "$HOME/.config/chromium/NativeMessagingHosts"
        install_browser_manifest "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
        install_browser_manifest "$HOME/.config/google-chrome-unstable/NativeMessagingHosts"
        install_browser_manifest "$HOME/.config/google-chrome/NativeMessagingHosts"
        install_browser_manifest "$HOME/.config/microsoft-edge/NativeMessagingHosts"
        install_browser_manifest "$HOME/.librewolf/native-messaging-hosts"
        install_browser_manifest "$HOME/.mozilla/native-messaging-hosts"
        install_browser_manifest "$HOME/.tor-browser/app/Browser/TorBrowser/Data/Browser/.mozilla/native-messaging-hosts"
        install_browser_manifest "$HOME/.waterfox/native-messaging-hosts"
        install_browser_manifest "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Microsoft Edge Beta/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Microsoft Edge Canary/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Microsoft Edge Dev/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/TorBrowser-Data/Browser/Mozilla/NativeMessagingHosts"
        install_browser_manifest "$HOME/Library/Application Support/Vivaldi/NativeMessagingHosts"

        info "Configured GPGME-JSON"
    fi
fi
