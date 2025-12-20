import { data, type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { addMediaToProductVariant } from "app/utils/graphql/product-media";

type VariantMediaPayload = {
  id: string;
  alt?: string;
  name?: string;
  url?: string;
  grid?: Record<string, unknown> | null;
  showGrid?: boolean;
  etching?: boolean;
  metaobjectId?: string;
  variantId?: string | null;
};

const parseVariantMediaPayload = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      media: (body.media as VariantMediaPayload[]) ?? [],
      variantId: typeof body.variantId === "string" ? body.variantId : null,
    };
  }

  const formData = await request.formData();
  const mediaRaw = formData.get("media");
  const variantIdRaw = formData.get("variantId");

  return {
    media:
      typeof mediaRaw === "string"
        ? (JSON.parse(mediaRaw) as VariantMediaPayload[])
        : [],
    variantId: typeof variantIdRaw === "string" ? variantIdRaw : null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const { media, variantId } = await parseVariantMediaPayload(request);

    if (!Array.isArray(media)) {
      return data({ error: "Media selection should be array" }, { status: 400 });
    }

    const resolvedVariantId =
      variantId ?? media.find((item) => item.variantId)?.variantId ?? null;

    if (!resolvedVariantId) {
      return data({ error: "Variant ID is required" }, { status: 400 });
    }

    const normalizedMedia = media.map((item) => ({
      ...item,
      variantId: resolvedVariantId,
    }));

    let metaobjectIds: string[] = [];
    for (const item of normalizedMedia) {
      metaobjectIds = await addMediaToProductVariant(
        admin,
        resolvedVariantId,
        item,
      );
    }

    return data({ metaobjectIds });
  } catch (error: any) {
    console.error("Failed to persist variant media metafield", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
};

export const loader = async () =>
  data({ error: "Method Not Allowed" }, { status: 405 });
