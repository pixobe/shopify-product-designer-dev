# Run the npm script to deploy

To deploy on prod , run

```bash
APP_VERSION=1.79 docker compose -p shopify-prod --env-file .env.prod up -d --remove-orphans
APP_VERSION=1.79 docker compose -p shopify-custom --env-file .env.custom up -d --remove-orphans"

```
