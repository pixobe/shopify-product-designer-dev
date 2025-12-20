import { data, type LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { PIXOBE_CART_CONFIG_PROPERTY_KEY } from "../constants/customization";
import { getAppMetafield } from "app/utils/graphql/app-metadata";
import { getProductVariantMedia } from "app/utils/graphql/product-media";
import { METADATA_FIELD_APP_SETTINGS } from "app/constants/settings";

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
        message: "The item is not customized",
      },
      404,
    );
  }

  // Now extract the attribute value
  const attribute = lineItemWithAttribute.customAttributes.find(
    (attr: any) => attr.key === PIXOBE_CART_CONFIG_PROPERTY_KEY,
  );

  const pixobeId = attribute?.value?.trim() ?? "";

  if (!pixobeId) {
    return data({ message: `_pixobeid attribute empty on ${order.id}` }, 404);
  }

  const variant = lineItemWithAttribute.variant ?? null;
  const variantId = variant?.id ?? null;

  const [variantDetails, config, customizedData] = await Promise.all([
    getProductVariantMedia(admin, variantId),
    getAppMetafield(admin, METADATA_FIELD_APP_SETTINGS),
    getAppMetafield(admin, pixobeId),
  ]);

  const meta = { name: variantDetails.name, id: variantDetails.id };
  const media = variantDetails.media;

  return data({
    media,
    meta,
    data: customizedData,
    config,
  });
};

export const action = async () =>
  jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
