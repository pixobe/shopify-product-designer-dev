#!/bin/bash
set -euo pipefail

# Usage:
#   APP_VERSION=1.78 ./scripts/deploy.sh <APP_ENV>
#
# Examples:
#   APP_VERSION=1.78 ./scripts/deploy.sh prod
#   APP_VERSION=1.78 ./scripts/deploy.sh custom
#
# Notes:
# - Reads APP_VERSION from command-line env var (not positional args).
# - Updates APP_VERSION and APP_ENV inside the selected env file (.env.<APP_ENV>).
# - Builds the image and starts (or updates) the compose stack.

APP_ENV="${1:-}"
APP_VERSION="${APP_VERSION:-}"

if [[ -z "${APP_ENV}" ]]; then
  echo "Usage: APP_VERSION=<version> $0 <APP_ENV>"
  echo "Example: APP_VERSION=1.78 $0 prod"
  exit 1
fi

if [[ -z "${APP_VERSION}" ]]; then
  echo "Missing APP_VERSION. Pass it like:"
  echo "  APP_VERSION=1.78 $0 ${APP_ENV}"
  exit 1
fi

ENV_FILE=".env.${APP_ENV}"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

PROJECT_NAME="shopify-${APP_ENV}"

# Cross-platform in-place sed (GNU sed vs BSD/macOS sed)
sedi() {
  if sed --version >/dev/null 2>&1; then
    # GNU sed
    sed -i.bak "$@"
  else
    # BSD/macOS sed
    sed -i .bak "$@"
  fi
}

# Update (or insert) KEY=VALUE in env file
upsert_env_var() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -qE "^${key}=" "$file"; then
    # Replace existing
    sedi "s/^${key}=.*/${key}=${value}/" "$file"
  else
    # Append new
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# Keep the env file in sync with the deployment inputs
upsert_env_var "APP_VERSION" "${APP_VERSION}" "${ENV_FILE}"
upsert_env_var "APP_ENV" "${APP_ENV}" "${ENV_FILE}"

# Build image with explicit version tag
docker build -t "pixobe.com/shopify-product-designer:${APP_VERSION}" .

# Build (compose) and start the stack using selected env file
# Explicit APP_VERSION is still provided to ensure interpolation works even if compose reads env differently.
APP_VERSION="${APP_VERSION}" docker compose \
  -p "${PROJECT_NAME}" \
  --env-file "${ENV_FILE}" \
  up -d --build --remove-orphans
