#!/usr/bin/env bash
set -euo pipefail

read -rp "Environment to start (custom/prod) [prod]: " ENV_CHOICE
ENV_CHOICE=${ENV_CHOICE:-prod}

case "$ENV_CHOICE" in
  custom)
    ENV_FILE=".env.custom"
    ENVIRONMENT="custom"
    ;;
  prod)
    ENV_FILE=".env.prod"
    ENVIRONMENT="prod"
    ;;
  *)
    echo "Invalid choice: $ENV_CHOICE (use 'custom' or 'prod')." >&2
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file '$ENV_FILE' not found." >&2
  exit 1
fi

echo "Starting Docker Compose with $ENV_FILE (environment: $ENVIRONMENT)..."
ENVIRONMENT="$ENVIRONMENT" COMPOSE_PROJECT_NAME="product-designer-$ENVIRONMENT" docker compose --env-file "$ENV_FILE" up -d
