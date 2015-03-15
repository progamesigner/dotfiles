#! /bin/zsh

if [[ "${OSTYPE}" = darwin* ]] ; then
    function battery_is_plugged () {
        [[ $(ioreg -rc AppleSmartBattery | grep -c "^.*\"ExternalConnected\"\ =\ Yes") -eq 1 ]]
    }

    function battery_is_charging () {
        [[ $(ioreg -rc AppleSmartBattery | grep "^.*\"IsCharging\"\ =\ " | sed -e "s/^.*\"IsCharging\"\ =\ //") == "Yes" ]]
    }

    function battery_current_percentage () {
        local smart_battery_status="$(ioreg -rc AppleSmartBattery)"
        typeset -F maxcapacity=$(print ${smart_battery_status} | grep "^.*\"MaxCapacity\"\ =\ " | sed -e "s/^.*\"MaxCapacity\"\ =\ //")
        typeset -F currentcapacity=$(print ${smart_battery_status} | grep "^.*\"CurrentCapacity\"\ =\ " | sed -e "s/^.*CurrentCapacity\"\ =\ //")
        typeset -i percentage=$(((currentcapacity/maxcapacity) * 100))
        print -n ${percentage}
        unset percentage
    }

    function battery_remaining_percentage () {
        if battery_is_plugged; then
            print -n "External Power"
        else
            battery_current_percentage
        fi
    }

    function battery_remaining_time () {
        local smart_battery_status="$(ioreg -rc "AppleSmartBattery")"
        if [[ $(print -n ${smart_battery_status} | grep -c "^.*\"ExternalConnected\"\ =\ No") -eq 1 ]] ; then
            timeremaining=$(print -n ${smart_battery_status} | grep "^.*\"AvgTimeToEmpty\"\ =\ " | sed -e "s/^.*\"AvgTimeToEmpty\"\ =\ //")
            if [ ${timeremaining} -gt 720 ] ; then
                print -n "::"
            else
                print -n "~$((timeremaining / 60)):$((timeremaining % 60))"
            fi
        else
            print -n "\u221E" # ∞
        fi
    }
elif [[ $(uname) == "Linux"  ]] ; then
    function battery_is_plugged () {
        [[ $(acpi 2&>/dev/null | grep -c "^Battery.*Discharging") -gt 0 ]]
    }

    function battery_is_charging () {
        ! [[ $(acpi 2&>/dev/null | grep -c "^Battery.*Discharging") -gt 0 ]]
    }

    function battery_current_percentage () {
        if (( $+commands[acpi] )) ; then
            print -n "$(acpi | cut -f2 -d "," | tr -cd "[:digit:]")"
        fi
    }

    function battery_remaining_percentage () {
        if [[ ! $(battery_is_charging) ]]; then
            battery_current_percentage
        else
            print -n "External Power"
        fi
    }

    function battery_remaining_time () {
        if [[ $(acpi 2&>/dev/null | grep -c "^Battery.*Discharging") -gt 0 ]] ; then
            print -n $(acpi | cut -f3 -d ",")
        fi
    }
else
    function battery_is_plugged () {}
    function battery_is_charging () {}
    function battery_current_percentage () {}
    function battery_remaining_percentage () {}
    function battery_remaining_time () {}
fi
