# Run the npm script to deploy

To deploy on prod , run

```bash
sh ./build.sh 1.80

sh ./deploy.sh prod
```

## Debug

```bash
docker compose -p shopify-custom --env-file .env.custom config
```

Prod

```bash
docker compose -p shopify-prod --env-file .env.prod config
```
