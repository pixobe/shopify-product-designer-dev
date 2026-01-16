#!/bin/bash

# $1 is the environment (e.g., 'custom' or 'prod')
echo "Deploying to environment: $1"

docker compose -p shopify-$1 \
  --env-file .env.$1 \
  up -d \
  --remove-orphans \
  --force-recreate