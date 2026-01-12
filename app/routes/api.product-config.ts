import { data, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getProductMedia,
  getProductVariantMedia,
  getVariantContext,
} from "app/utils/graphql/product-media";
import { normalizeVariantId } from "app/utils/common-utils";
import { METADATA_FIELD_APP_SETTINGS } from "app/constants/settings";
import { getAppMetafield } from "app/utils/graphql/app-metadata";

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

    const [variantDetails, config] = await Promise.all([
      getProductVariantMedia(admin, variantId),
      getAppMetafield(admin, METADATA_FIELD_APP_SETTINGS),
    ]);

    const meta = { name: variantDetails.name, id: variantDetails.id };
    const media = variantDetails.media;

    if (!media) {
      return data({ error: "Product is not configured" }, { status: 400 });
    }

    return data({
      meta,
      config,
      media: media ?? [],
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
