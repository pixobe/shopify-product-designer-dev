import { data, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getProductMedia } from "app/utils/graphql/product-media";

const VARIANT_ID_PREFIX = "gid://shopify/ProductVariant/";
const NUMERIC_ID_REGEX = /^[0-9]+$/;

const normalizeVariantId = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(VARIANT_ID_PREFIX)) {
    return trimmed;
  }

  if (NUMERIC_ID_REGEX.test(trimmed)) {
    return `${VARIANT_ID_PREFIX}${trimmed}`;
  }

  return trimmed;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return data(
      {
        message: "Unauthorized",
      },
      401,
    );
  }
  const url = new URL(request.url);

  const rawProductId =
    url.searchParams.get("productId") ?? url.searchParams.get("product") ?? "";

  if (!rawProductId) {
    return data({ message: "Product ID is required" }, 400);
  }

  const productId = `gid://shopify/Product/${rawProductId}`;

  const rawVariantId =
    url.searchParams.get("variantId") ?? url.searchParams.get("variant") ?? "";

  const variantId = `gid://shopify/ProductVariant/${rawVariantId}`;

  try {
    const productMediaMetaObjectResponse = await getProductMedia(
      admin,
      productId,
    );

    const variant = productMediaMetaObjectResponse.variants?.find(
      (v: any) => v.id === variantId,
    );

    return data(variant);
  } catch (error: any) {
    console.error(error.errors);
    return data(
      { media: [], error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
};

export const action = async () =>
  data({ error: "Method Not Allowed" }, { status: 405 });
