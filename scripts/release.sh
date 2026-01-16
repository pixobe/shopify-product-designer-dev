#/bin/bash
docker compose -p shopify-prod --env-file .env.$1 up -d --remove-orphans
