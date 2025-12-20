import { data, type ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  normalizeMetaobjectId,
  normalizeVariantId,
  removeMediaFromProductVariant,
} from "app/utils/graphql/product-media";

const parseRemovePayload = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      variantId: typeof body.variantId === "string" ? body.variantId : null,
      metaobjectId:
        typeof body.metaobjectId === "string" ? body.metaobjectId : null,
    };
  }

  const formData = await request.formData();
  const variantId = formData.get("variantId");
  const metaobjectId = formData.get("metaobjectId");

  return {
    variantId: typeof variantId === "string" ? variantId : null,
    metaobjectId: typeof metaobjectId === "string" ? metaobjectId : null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const { variantId: rawVariantId, metaobjectId: rawMetaobjectId } =
      await parseRemovePayload(request);

    const variantId = normalizeVariantId(rawVariantId);
    const metaobjectId = normalizeMetaobjectId(rawMetaobjectId);

    if (!variantId || !metaobjectId) {
      return data(
        { error: "Variant ID and metaobject ID are required" },
        { status: 400 },
      );
    }

    const metaobjectIds = await removeMediaFromProductVariant(
      admin,
      variantId,
      metaobjectId,
    );

    return data({ metaobjectIds });
  } catch (error: any) {
    console.error("Failed to remove variant media metaobject", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
};

export const loader = async () =>
  data({ error: "Method Not Allowed" }, { status: 405 });
