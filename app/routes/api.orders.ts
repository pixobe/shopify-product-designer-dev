import { data, type LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { PIXOBE_CART_CONFIG_PROPERTY_KEY } from "../constants/customization";
import {
  loadPixobeDesignSettings,
  loadPixobeProductMedia,
} from "../utils/design-config";

const ORDER_ID_PREFIX = "gid://shopify/Order/";

const looksLikeOrderId = (value: string) =>
  value.startsWith(ORDER_ID_PREFIX) || /^\d+$/.test(value);

const normalizeOrderId = (value: string) =>
  value.startsWith(ORDER_ID_PREFIX) ? value : `${ORDER_ID_PREFIX}${value}`;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const ORDER_QUERY = `#graphql
query OrderCustomization($id: ID!) {
  order(id: $id) {
    id
    name
    lineItems(first: 50) {
      nodes {
        variant {
          id
          product {
            id
          }
        }
        customAttributes {
          key
          value
        }
      }
    }
  }
}
`;

const FILE_QUERY = `#graphql
query GenericFileCustomization($id: ID!) {
  node(id: $id) {
    ... on GenericFile {
      id
      url
      mimeType
      fileStatus
    }
  }
}
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const rawOrderId = (url.searchParams.get("orderId") ?? "").trim();

  if (!rawOrderId) {
    return jsonResponse({ ok: false, error: "Missing orderId parameter" }, 400);
  }

  if (!looksLikeOrderId(rawOrderId)) {
    return jsonResponse(
      {
        ok: false,
        error:
          "orderId must be a numeric legacy ID or a full gid://shopify/Order/<id>",
      },
      400,
    );
  }

  const orderId = normalizeOrderId(rawOrderId);

  const orderResponse = await admin.graphql(ORDER_QUERY, {
    variables: { id: orderId },
  });
  const orderResult = await orderResponse.json();

  if (!orderResult) {
    return data(
      {
        message: "Shopify returned errors while loading the order",
      },
      400,
    );
  }

  const order = orderResult.data?.order;

  if (!order) {
    return data({ message: "Order not found" }, 404);
  }

  const lineItemWithAttribute = (order.lineItems?.nodes ?? []).find(
    (item: any) =>
      (item.customAttributes ?? []).some(
        (attr: any) => attr?.key === PIXOBE_CART_CONFIG_PROPERTY_KEY,
      ),
  );

  if (!lineItemWithAttribute) {
    return data(
      {
        message: `_pixobeid attribute not set on any line item for ${order.id}`,
      },
      404,
    );
  }

  // Now extract the attribute value
  const attribute = lineItemWithAttribute.customAttributes.find(
    (attr: any) => attr.key === PIXOBE_CART_CONFIG_PROPERTY_KEY,
  );

  const fileId = attribute?.value?.trim() ?? "";

  if (!fileId) {
    return data({ message: `_pixobeid attribute empty on ${order.id}` }, 404);
  }

  const variant = lineItemWithAttribute.variant ?? null;
  const productId = variant?.product?.id ?? null;
  const variantId = variant?.id ?? null;

  const fileResponse = await admin.graphql(FILE_QUERY, {
    variables: { id: fileId },
  });
  const fileResult = await fileResponse.json();

  if (!fileResult) {
    return data(
      { message: "Shopify returned errors while fetching the file" },
      502,
    );
  }

  const genericFile = fileResult.data?.node;
  if (!genericFile?.url) {
    return jsonResponse(
      { ok: false, error: "Linked GenericFile not found" },
      404,
    );
  }

  let fileText: string;
  try {
    const networkResponse = await fetch(genericFile.url);
    if (!networkResponse.ok) {
      return jsonResponse(
        { ok: false, error: "Unable to download the customization file" },
        502,
      );
    }

    fileText = await networkResponse.text();
  } catch (error: any) {
    return jsonResponse(
      {
        ok: false,
        error: "Failed to download the customization file",
        details: error?.message,
      },
      502,
    );
  }

  let fileData: unknown;
  try {
    fileData = JSON.parse(fileText);
  } catch (error: any) {
    return jsonResponse(
      {
        ok: false,
        error: "Customization file is not valid JSON",
        details: error?.message,
      },
      502,
    );
  }

  const configPromise = loadPixobeDesignSettings(admin);
  const mediaPromise = loadPixobeProductMedia(admin, productId, variantId);
  const [config, media] = await Promise.all([configPromise, mediaPromise]);

  return jsonResponse({
    fileData,
    config,
    media,
  });
};

export const action = async () =>
  jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
