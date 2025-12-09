import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";

import { authenticate } from "../shopify.server";

const VARIANT_ID_PREFIX = "gid://shopify/ProductVariant/";
const NUMERIC_ID_REGEX = /^[0-9]+$/;

const normalizeVariantIdValue = (
  value: string | number | null | undefined,
): string | null => {
  let candidate: string | null = null;

  if (typeof value === "number" && Number.isFinite(value)) {
    candidate = String(Math.trunc(value));
  } else if (typeof value === "string") {
    candidate = value;
  }

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
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

export const action = async ({ request }: ActionFunctionArgs) => {
  const { storefront } = await authenticate.public.appProxy(request);

  if (!storefront) {
    return data({ error: "Unable to call storefront apis" }, { status: 400 });
  }

  const url = new URL(request.url);

  // Parse request body before validating variant/product IDs so we can fall back to payload values.
  const body = (await request.json()) as {
    variantId?: string;
    productId?: string;
    quantity?: number;
    attributes?: Record<string, string>;
  };
  console.log("Request body:", body);

  const variantId = url.searchParams.get("variantId") ?? body.variantId;
  const productId = url.searchParams.get("productId") ?? body.productId;

  const normalizedVariantId = normalizeVariantIdValue(variantId);

  // Validate variant ID
  if (!normalizedVariantId) {
    return data(
      { error: "variantId query parameter is required" },
      { status: 400 },
    );
  }

  const response = await storefront.graphql(
    `#graphql
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          createdAt
          updatedAt
          lines(first: 10) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                  }
                }
              }
            }
          }
          attributes {
            key
            value
          }
          cost {
            totalAmount {
              amount
              currencyCode
            }
            subtotalAmount {
              amount
              currencyCode
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `,
    {
      variables: {
        input: {
          lines: [
            {
              quantity: body.quantity || 1,
              merchandiseId: normalizedVariantId,
            },
          ],
          // FIX: attributes should be an array, not an object
          attributes: body.attributes
            ? Object.entries(body.attributes).map(([key, value]) => ({
                key,
                value,
              }))
            : [
                {
                  key: "cart_attribute",
                  value: "This is a cart attribute",
                },
              ],
        },
      },
    },
  );

  const jsonResponse = await response.json();
  const userErrors = jsonResponse.data?.cartCreate?.userErrors ?? [];

  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map((error: { message: string }) => error.message).join(", "),
    );
  }

  // Return successful cart creation
  return data({
    success: true,
    cart: jsonResponse.data.cartCreate.cart,
  });
};
