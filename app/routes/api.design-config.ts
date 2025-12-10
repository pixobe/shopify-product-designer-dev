import { type LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import {
  loadPixobeDesignSettings,
  loadPixobeProductMedia,
} from "../utils/design-config";

const PRODUCT_ID_PREFIX = "gid://shopify/Product/";
const VARIANT_ID_PREFIX = "gid://shopify/ProductVariant/";

const looksLikeProductId = (value: string) =>
  value.startsWith(PRODUCT_ID_PREFIX) || /^[0-9]+$/.test(value);

const normalizeProductId = (value: string) =>
  value.startsWith(PRODUCT_ID_PREFIX) ? value : `${PRODUCT_ID_PREFIX}${value}`;

const looksLikeVariantId = (value: string) =>
  value.startsWith(VARIANT_ID_PREFIX) || /^[0-9]+$/.test(value);

const normalizeVariantId = (value: string) =>
  value.startsWith(VARIANT_ID_PREFIX) ? value : `${VARIANT_ID_PREFIX}${value}`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json(
      { message: "Shop ID missing", success: false },
      { status: 400 },
    );
  }

  const { admin } = await authenticate.public.appProxy(request);

  const rawProductId = url.searchParams.get("productId")?.trim();
  const productId =
    rawProductId && looksLikeProductId(rawProductId)
      ? normalizeProductId(rawProductId)
      : null;

  const rawVariantId = url.searchParams.get("variantId")?.trim();
  const variantId =
    rawVariantId && looksLikeVariantId(rawVariantId)
      ? normalizeVariantId(rawVariantId)
      : null;

  const config = await loadPixobeDesignSettings(admin);
  const media = await loadPixobeProductMedia(admin, productId, variantId);

  return {
    config,
    media,
  };
};
