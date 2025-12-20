import { data, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getProductMedia,
  getVariantContext,
} from "app/utils/graphql/product-media";
import { normalizeVariantId } from "app/utils/common-utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return data(
      {
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const rawVariantId =
      url.searchParams.get("variantId") ?? url.searchParams.get("id");
    const variantId = normalizeVariantId(rawVariantId);

    if (!variantId) {
      return data({ error: "Variant ID is required" }, { status: 400 });
    }

    const variantContext = await getVariantContext(admin, variantId);
    if (!variantContext) {
      return data({ error: "Variant not found" }, { status: 404 });
    }

    const productMedia = await getProductMedia(admin, variantContext.productId);
    const matchedVariant = productMedia?.variants?.find(
      (variant: any) => variant.id === variantId,
    );

    return data({
      productName:
        variantContext.productName ?? productMedia?.productName ?? "",
      variantName: variantContext.variantName ?? matchedVariant?.name ?? "",
      variantId: variantContext.variantId ?? variantId,
      variantPrice: variantContext.variantPrice ?? null,
      media: matchedVariant?.media ?? [],
    });
  } catch (error: any) {
    console.error("Failed to load variant media", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
};

export const action = async () =>
  data({ error: "Method Not Allowed" }, { status: 405 });
