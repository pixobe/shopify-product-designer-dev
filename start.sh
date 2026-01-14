#!/usr/bin/env bash
set -euo pipefail

read -rp "Environment to start (stage/prod) [prod]: " ENV_CHOICE
ENV_CHOICE=${ENV_CHOICE:-prod}

case "$ENV_CHOICE" in
  stage)
    ENV_FILE=".env.stage"
    ;;
  prod)
    ENV_FILE=".env"
    ;;
  *)
    echo "Invalid choice: $ENV_CHOICE (use 'stage' or 'prod')." >&2
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Environment file '$ENV_FILE' not found." >&2
  exit 1
fi

echo "Starting Docker Compose with $ENV_FILE..."
docker compose --env-file "$ENV_FILE" up -d
