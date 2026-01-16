#!/bin/bash
set -euo pipefail

# Usage:
#   ./scripts/deploy.sh <APP_ENV> <APP_VERSION>
#
# Examples:
#   ./scripts/deploy.sh prod 1.78
#   ./scripts/deploy.sh custom 1.78

APP_ENV="${1:-}"
APP_VERSION="${2:-}"

if [[ -z "${APP_ENV}" || -z "${APP_VERSION}" ]]; then
  echo "Usage: $0 <APP_ENV> <APP_VERSION>"
  echo "Example: $0 prod 1.78"
  exit 1
fi

ENV_FILE=".env.${APP_ENV}"
if [[ ! -f "$ENV_FILE" ]]; then
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
    sedi "s/^${key}=.*/${key}=${value}/" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# You want APP_ENV (prod/custom/anything) and APP_VERSION updated in the chosen env file
upsert_env_var "APP_VERSION" "${APP_VERSION}" "${ENV_FILE}"
upsert_env_var "APP_ENV" "${APP_ENV}" "${ENV_FILE}"

# Build image with explicit version tag
docker build -t "pixobe.com/shopify-product-designer-dev:${APP_VERSION}" .

# Start stack using selected env file + explicit APP_VERSION override for interpolation
APP_VERSION="${APP_VERSION}" docker compose \
  -p "${PROJECT_NAME}" \
  --env-file "${ENV_FILE}" \
  up -d --remove-orphans
