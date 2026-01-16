#!/bin/bash
ENV=$1 # 'prod' or 'custom'

echo "Deploying to environment: $ENV"

# Pass ENV_TYPE to the docker compose command
ENV_TYPE=$ENV APP_VERSION=latest docker compose -p shopify-$ENV \
  --env-file .env.$ENV \
  up -d \
  --remove-orphans \
  --force-recreate