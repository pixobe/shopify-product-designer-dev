#/bin/bash

docker build -t pixobe.com/shopify-product-designer:$1 .
APP_VERSION=$1

#update prod
sed -i.bak "s/^APP_VERSION=.*/APP_VERSION=$APP_VERSION/" .env.prod

#update custom
sed -i.bak "s/^APP_VERSION=.*/APP_VERSION=$APP_VERSION/" .env.custom