#!/bin/bash
set -euo pipefail

ENVIRONMENT="${1:-prod}"              # prod | stage
APP_VERSION="${2:-}"                  # optional override

ENV_FILE=".env.${ENVIRONMENT}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

# Optionally override APP_VERSION in the env file for this run (no file edits needed)
if [[ -n "${APP_VERSION}" ]]; then
  docker build -t "pixobe.com/shopify-product-designer-dev:${APP_VERSION}" .
  docker compose --env-file "$ENV_FILE" up -d \
    --no-deps \
    --remove-orphans
else
  docker compose --env-file "$ENV_FILE" up -d --remove-orphans
fi
