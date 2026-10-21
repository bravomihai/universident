#!/usr/bin/env bash
# GitHub runner only. Production application secrets stay on the VPS.
set -Eeuo pipefail

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
for name in VPS_HOST VPS_PORT VPS_USER VPS_PATH VPS_SSH_PRIVATE_KEY VPS_SSH_KNOWN_HOSTS VPS_HEALTH_URL DEPLOY_SHA DEPLOY_MODE; do
  [[ -n ${!name:-} ]] || fail "Missing configuration: $name"
done
[[ $VPS_HOST =~ ^[a-zA-Z0-9.:_-]+$ && $VPS_HOST != -* ]] || fail 'Invalid VPS_HOST'
[[ $VPS_USER =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] || fail 'Invalid VPS_USER'
[[ $VPS_PORT =~ ^[0-9]{1,5}$ ]] || fail 'Invalid VPS_PORT'
(( 10#$VPS_PORT >= 1 && 10#$VPS_PORT <= 65535 )) || fail 'Invalid VPS_PORT'
[[ $VPS_PATH =~ ^/[a-zA-Z0-9_./-]+$ && $VPS_PATH != / ]] || fail 'VPS_PATH must be an absolute checkout path without spaces'
[[ $DEPLOY_SHA =~ ^[0-9a-f]{40}$ ]] || fail 'Invalid commit SHA'
[[ $DEPLOY_MODE == verify || $DEPLOY_MODE == deploy ]] || fail 'Invalid deployment mode'
[[ $VPS_HEALTH_URL =~ ^https://[^/@[:space:]]+/api/health$ ]] || fail 'VPS_HEALTH_URL must be the public HTTPS /api/health endpoint'

ssh_dir=$(mktemp -d)
trap 'rm -rf -- "$ssh_dir"' EXIT
chmod 700 "$ssh_dir"
printf '%s\n' "$VPS_SSH_PRIVATE_KEY" > "$ssh_dir/key"
printf '%s\n' "$VPS_SSH_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/key" "$ssh_dir/known_hosts"
# Validate the key without printing it or asking for a passphrase.
ssh-keygen -y -P '' -f "$ssh_dir/key" > /dev/null
unset VPS_SSH_PRIVATE_KEY VPS_SSH_KNOWN_HOSTS

ssh_options=(
  -F /dev/null
  -i "$ssh_dir/key"
  -p "$VPS_PORT"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$ssh_dir/known_hosts"
  -o GlobalKnownHostsFile=/dev/null
  -o ConnectTimeout=15
  -o ConnectionAttempts=2
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
  -o ForwardAgent=no
  -o ClearAllForwardings=yes
)
# Arguments are validated above and shell-quoted for the remote login shell.
printf -v remote_command 'timeout --signal=TERM --kill-after=30s 35m bash -s -- %q %q %q' \
  "$VPS_PATH" "$DEPLOY_SHA" "$DEPLOY_MODE"
timeout --signal=TERM --kill-after=30s 37m \
  ssh "${ssh_options[@]}" "$VPS_USER@$VPS_HOST" "$remote_command" < scripts/deploy-vps.sh | tee "$ssh_dir/output"
# An SSH exit code alone cannot prove that a streamed script reached its end.
grep -Fxq "UNIVERSIDENT_VPS_COMPLETE $DEPLOY_MODE $DEPLOY_SHA" "$ssh_dir/output" \
  || fail 'Remote script did not confirm completion; public health alone cannot verify a deployment'

printf 'Checking public HTTPS health endpoint.\n'
http_status=$(curl --fail --silent --show-error --proto '=https' \
  --connect-timeout 10 --max-time 20 --retry 5 --retry-delay 5 --retry-max-time 150 \
  --output /dev/null --write-out '%{http_code}' "$VPS_HEALTH_URL")
[[ $http_status == 200 ]] || fail 'Public health endpoint did not return HTTP 200'
printf 'VPS %s succeeded for %s.\n' "$DEPLOY_MODE" "$DEPLOY_SHA"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf 'VPS **%s** succeeded for commit **%s**. App, worker and public HTTPS health checks passed.\n' \
    "$DEPLOY_MODE" "$DEPLOY_SHA" >> "$GITHUB_STEP_SUMMARY"
fi
