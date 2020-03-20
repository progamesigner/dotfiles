#!/bin/bash

head "Setting up SSH"

if [ -z "$NO_SSH" ]; then
    info "Make sure \"$PWD/ssh/config\" exists"
    touch $PWD/ssh/config

    link $PWD/ssh/config "$DOTTARGET/.ssh/config"

    link $PWD/ssh/aws-ssm-ec2-proxy-command.sh "$DOTTARGET/.ssh/aws-ssm-ec2-proxy-command.sh"
fi
