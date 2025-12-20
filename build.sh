#/bin/bash

docker build -t pixobe.com/shopify-product-designer-dev:$1 .
APP_VERSION=$1
sed -i.bak "s/^APP_VERSION=.*/APP_VERSION=$APP_VERSION/" .env && rm -f .env.bak