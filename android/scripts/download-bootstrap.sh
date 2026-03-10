#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
ARCH="${1:-aarch64}"
BOOTSTRAP_VERSION="bootstrap-2026.02.12-r1+apt.android-7"
BOOTSTRAP_URL="https://github.com/termux/termux-packages/releases/download/${BOOTSTRAP_VERSION}/bootstrap-${ARCH}.zip"
MIRROR_URL="https://sourceforge.net/projects/termux-packages.mirror/files/${BOOTSTRAP_VERSION}/bootstrap-${ARCH}.zip/download"
DEST="$ASSETS_DIR/bootstrap-${ARCH}.zip"

mkdir -p "$ASSETS_DIR"

if [ -f "$DEST" ]; then
  echo "Bootstrap already present: $DEST"
  exit 0
fi

if curl -fSL --retry 3 --retry-delay 2 -o "$DEST" "$BOOTSTRAP_URL"; then
  echo "Downloaded bootstrap from GitHub releases."
elif curl -fSL --retry 3 --retry-delay 2 -o "$DEST" "$MIRROR_URL"; then
  echo "Downloaded bootstrap from mirror."
else
  rm -f "$DEST"
  echo "Failed to download bootstrap archive for ${ARCH}." >&2
  exit 1
fi

echo "Bootstrap saved to $DEST"
