# Run the npm script to deploy

To deploy on prod , run

```bash
 docker compose -p shopify-stage --env-file .env.stage up -d --remove-orphans
```
