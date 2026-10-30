#!/bin/sh
# Deploys the committed HEAD to the owner's pilot server: uploads the source (git archive, so only committed files and
# nothing private), then runs obur-ctl's build and deploy (deploy backs up first). The SSH aliases come from the
# deploying machine's ~/.ssh/config; override them with OBUR_UPLOAD_HOST and OBUR_CTL_HOST.
# Usage: ./deploy/pilot.sh
set -eu
cd "$(dirname "$0")/.."
upload=${OBUR_UPLOAD_HOST:-obur-lab}
ctl=${OBUR_CTL_HOST:-obur-host}
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
	echo "Uncommitted changes: commit first, only HEAD is deployed." >&2
	exit 1
fi
echo "Deploying $(git rev-parse --short HEAD)"
git archive --format=tar HEAD |
	ssh "$upload" 'rm -rf /work/deploy/source && mkdir -p /work/deploy/source && tar -x -C /work/deploy/source'
log=$(mktemp)
trap 'rm -f "$log"' EXIT
if ! ssh "$ctl" build >"$log" 2>&1; then
	tail -n 40 "$log" >&2
	echo "Build failed; nothing was deployed." >&2
	exit 1
fi
ssh "$ctl" deploy
