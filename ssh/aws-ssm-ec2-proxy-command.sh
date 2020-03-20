#!/usr/bin/env sh

set -eu

REGION_SEPARATOR='::'

INSTANCE_ID="$1"
SSH_USER="$2"
SSH_PORT="$3"
SSH_PUBLIC_KEY_PATH="$4"

if [[ "${INSTANCE_ID}" = *${REGION_SEPARATOR}* ]]; then
  export AWS_DEFAULT_REGION="${INSTANCE_ID##*${REGION_SEPARATOR}}"
  INSTANCE_ID="${INSTANCE_ID%%${REGION_SEPARATOR}*}"
fi

echo "Find instance ${INSTANCE_ID} availability zone ..." >/dev/tty
INSTANCE_AZ=$(
  aws ec2 describe-instances \
    --instance-id=${INSTANCE_ID} \
    --output=text \
    --query=Reservations[0].Instances[0].Placement.AvailabilityZone
)

echo "Upload public key ${SSH_PUBLIC_KEY_PATH} to instance ${INSTANCE_ID} temporarily ..." >/dev/tty
aws ec2-instance-connect send-ssh-public-key  \
  --availability-zone ${INSTANCE_AZ} \
  --instance-id=${INSTANCE_ID} \
  --instance-os-user=${SSH_USER} \
  --ssh-public-key=file://${SSH_PUBLIC_KEY_PATH}

echo "Start AWS SSM session to instance ${INSTANCE_ID} ..." >/dev/tty
aws ssm start-session \
  --document-name=AWS-StartSSHSession \
  --parameters=portNumber=${SSH_PORT} \
  --target=${INSTANCE_ID}
