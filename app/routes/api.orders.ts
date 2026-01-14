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

type CustomizedLineItem = {
  item: any;
  pixobeId: string;
  variantId: string;
};

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
        id
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
  const { admin, session } = await authenticate.admin(request);

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

  const lineItemsWithAttribute = (order.lineItems?.nodes ?? []).filter(
    (item: any) =>
      (item.customAttributes ?? []).some(
        (attr: any) => attr?.key === PIXOBE_CART_CONFIG_PROPERTY_KEY,
      ),
  );

  if (!lineItemsWithAttribute.length) {
    return data(
      {
        message: "The item is not customized",
      },
      404,
    );
  }

  const customizedLineItems = lineItemsWithAttribute
    .map((item: any) => {
      const attribute = (item.customAttributes ?? []).find(
        (attr: any) => attr?.key === PIXOBE_CART_CONFIG_PROPERTY_KEY,
      );
      const pixobeId = attribute?.value?.trim() ?? "";
      const variantId = item.variant?.id ?? null;

      if (!pixobeId || !variantId) {
        return null;
      }

      return { item, pixobeId, variantId };
    })
    .filter(Boolean) as CustomizedLineItem[];

  if (!customizedLineItems.length) {
    return data(
      { message: `_pixobeid attribute empty on ${order.id}` },
      404,
    );
  }

  const config = await getAppMetafield(
    admin,
    METADATA_FIELD_APP_SETTINGS,
    { shop: session.shop },
  );

  const items = await Promise.all(
    customizedLineItems.map(async ({ item, pixobeId, variantId }) => {
      const [variantDetails, customizedData] = await Promise.all([
        getProductVariantMedia(admin, variantId),
        getAppMetafield(admin, pixobeId),
      ]);

      const meta = variantDetails
        ? { name: variantDetails.name, id: variantDetails.id }
        : null;

      return {
        lineItemId: item?.id ?? null,
        variantId,
        pixobeId,
        meta,
        media: variantDetails?.media ?? [],
        data: customizedData,
      };
    }),
  );

  return data({
    order: {
      id: order.id,
      name: order.name ?? null,
    },
    items,
    config,
  });
};

export const action = async () =>
  jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
