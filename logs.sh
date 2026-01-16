#!/bin/bash
# Use the first argument ($1) for project name and env file
docker compose -p shopify-$1 --env-file .env.$1 logs -f