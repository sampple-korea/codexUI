#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$ANDROID_DIR")"
ASSETS_DIR="$ANDROID_DIR/app/src/main/assets"
WEB_DIR="$ASSETS_DIR/web"
BUNDLE_DIR="$ASSETS_DIR/server-bundle"

cd "$PROJECT_ROOT"

if [ ! -d "dist" ] || [ ! -d "dist-cli" ]; then
  if [ ! -d "node_modules" ]; then
    npm install --ignore-scripts
  fi
  npm run build
fi

rm -rf "$WEB_DIR" "$BUNDLE_DIR"
mkdir -p "$WEB_DIR" "$BUNDLE_DIR/dist" "$BUNDLE_DIR/dist-cli"

cp -R "$PROJECT_ROOT/dist/." "$WEB_DIR/"
cp -R "$PROJECT_ROOT/dist/." "$BUNDLE_DIR/dist/"
cp -R "$PROJECT_ROOT/dist-cli/." "$BUNDLE_DIR/dist-cli/"
cp "$PROJECT_ROOT/package.json" "$BUNDLE_DIR/package.json"

if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
  cp "$PROJECT_ROOT/package-lock.json" "$BUNDLE_DIR/package-lock.json"
fi

printf 'commit=%s\nbuilt_at=%s\n' \
  "$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$BUNDLE_DIR/bundled-at.txt"

echo "Bundled frontend into $WEB_DIR"
echo "Bundled CLI server into $BUNDLE_DIR"
