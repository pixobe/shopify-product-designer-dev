import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getProductDetails } from "app/utils/graphql/product";

export const loader: LoaderFunction = async ({ request }) => {

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json({ message: "Shop ID missing", success: false }, { status: 400 });
  }

  const { storefront } = await authenticate.public.appProxy(request);

  const productId = url.searchParams.get("productId")!;
  const variantId = url.searchParams.get("variantId");
  const id = variantId ? variantId : productId;

  if (!id) {
    return Response.json({ message: "Product or Variant Id missing", success: false }, { status: 400 });
  }

  try {
    const product = await getProductDetails(storefront, productId, variantId);

    const meta = {
      productId,
      variantId,
      name: product.title,
    };

    const media = product.media;

    return Response.json({
      success: true,
      message: "Custom action completed",
      result: {
        config: {},
        media: media,
        meta: meta,
      },
    });
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    return Response.json(
      {
        message: "An unexpected error occurred.",
        success: false,
      },
      { status: 500 }
    );
  }
};
