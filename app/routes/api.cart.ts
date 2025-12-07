import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";

import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { storefront } = await authenticate.public.appProxy(request);

  if (!storefront) {
    return data({ error: "Unable to call storefront apis" }, { status: 400 });
  }

  // Get variant/product ID from query params
  const url = new URL(request.url);
  const variantId = url.searchParams.get("variantId");
  const productId = url.searchParams.get("productId");

  // Parse request body
  const body = await request.json();
  console.log("Request body:", body);

  // Validate variant ID
  if (!variantId) {
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
              merchandiseId: variantId,
            },
          ],
          attributes: body.attributes || {
            key: "cart_attribute",
            value: "This is a cart attribute",
          },
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
