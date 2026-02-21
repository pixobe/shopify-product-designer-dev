import { data, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { normalizeVariantId } from "app/utils/common-utils";
import { getCustomizedData } from "app/utils/customized-data";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);

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

    const payload = await getCustomizedData(
      admin,
      variantId,
      undefined,
      session?.shop,
    );
    if (!payload) {
      return data({ error: "Customized data not found" }, { status: 404 });
    }

    const config = payload?.config ?? {};
    const hasImageGenerateApiKey =
      typeof config.imageGenerateApiKey === "string" &&
      config.imageGenerateApiKey.length > 0;

    if (!hasImageGenerateApiKey) {
      return data(payload);
    }

    const { imageGenerateApiKey: _, ...restConfig } = config;
    return data({
      ...payload,
      config: {
        ...restConfig,
        aimodel: "gemini",
      },
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
