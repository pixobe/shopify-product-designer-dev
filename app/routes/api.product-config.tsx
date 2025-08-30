import type { LoaderFunction } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import { getProductImageQuery } from "app/utils/graphql/product";

export const loader: LoaderFunction = async ({ request }) => {

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json({ message: "Shop ID missing", success: false }, { status: 400 });
  }

  const { storefront } = await unauthenticated.storefront(
    shop
  );

  const productId = url.searchParams.get("productId");

  if (!productId) {
    return Response.json({ message: "ProductID missing", success: false }, { status: 400 });
  }

  const productImageResponse = await getProductImageQuery(storefront, productId);
  const productImages = await productImageResponse.json();

  if (!productImages.data || !productImages.data.product) {
    return Response.json({ message: "Product Image not configured", success: false }, { status: 400 });
  }

  const product = productImages.data.product;

  const mediaItems: Array<any> = product.media.edges.map((edge: any) => ({
    src: edge.node.image.url,
    stroke: "",
  }));

  const meta = {
    name: product.title,
  }

  return Response.json({
    success: true,
    message: "Custom action completed",
    result: {
      config: {},
      media: mediaItems,
      meta: meta
    }
  });
};
