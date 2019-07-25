#!/bin/bash

head "Setting up GnuPG"

if [ -z "$NO_GNUPG" ]; then
    info "Install GnuPG"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        brew install gpg gpgme pinentry-mac

        info "Make sure \"$DOTTARGET/.gnupg\" exists"
        mkdir -p "$DOTTARGET/.gnupg"

        touch "$DOTTARGET/.gnupg/gpg.conf"
        ret=$(grep -q "^use-agent" "$DOTTARGET/.gnupg/gpg.conf")
        if [ $? -ne 0 ]; then
            echo "use-agent" >> $DOTTARGET/.gnupg/gpg.conf
        fi

        touch "$DOTTARGET/.gnupg/gpg-agent.conf"
        ret=$(grep -q "^pinentry-program" "$DOTTARGET/.gnupg/gpg-agent.conf")
        if [ $? -ne 0 ]; then
            echo "pinentry-program /usr/local/bin/pinentry-mac" >> $DOTTARGET/.gnupg/gpg-agent.conf
        fi
    else
        info "No supported platform found, skipped ..."
    fi

    info "Installed GnuPG"

    if [[ "$(uname -s)" == *Darwin* ]]; then
        if [ -d "$DOTTARGET/Library/Application Support/Mozilla" ]; then
            info "Install GPGME-JSON for Firefox"

            mkdir -p "$DOTTARGET/Library/Application Support/Mozilla/NativeMessagingHosts"

            echo '#!/bin/sh

exec env -i PATH=/usr/local/bin gpgme-json $@
' >| /usr/local/bin/gpgme-json.sh

            echo '{
    "name": "gpgmejson",
    "description": "JavaScript binding for GnuPG",
    "path": "/usr/local/bin/gpgme-json.sh",
    "type": "stdio",
    "allowed_extensions": [
        "jid1-AQqSMBYb0a8ADg@jetpack"
    ]
}' >| "$DOTTARGET/Library/Application Support/Mozilla/NativeMessagingHosts/gpgmejson.json"

            chmod +x /usr/local/bin/gpgme-json.sh

            info "Installed GPGME-JSON for Firefox"
        fi
    elif [[ "$(uname -s)" == *Linux* ]]; then
        if [ -d "$DOTTARGET/.mozilla" ]; then
            info "Install GPGME-JSON for Firefox"

            mkdir -p "$DOTTARGET/.mozilla/native-messaging-hosts"

            echo '#!/bin/sh

exec env -i PATH=/usr/local/bin gpgme-json $@
' >| /usr/local/bin/gpgme-json.sh

            echo '{
    "name": "gpgmejson",
    "description": "JavaScript binding for GnuPG",
    "path": "/usr/local/bin/gpgme-json.sh",
    "type": "stdio",
    "allowed_extensions": [
        "jid1-AQqSMBYb0a8ADg@jetpack"
    ]
}' >| "$DOTTARGET/.mozilla/native-messaging-hosts/gpgmejson.json"

            chmod +x /usr/local/bin/gpgme-json.sh

            info "Installed GPGME-JSON for Firefox"
        fi
    fi
fi
