#!/usr/bin/env sh
# Runs Playwright in the official image matching the installed @playwright/test version.
set -eu
version=$(node -p "require('@playwright/test/package.json').version")
exec docker run --rm --ipc=host -u "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 \
	-v "$PWD":/work -w /work "mcr.microsoft.com/playwright:v${version}-noble" npx playwright test "$@"
