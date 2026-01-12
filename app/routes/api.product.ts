import { data, type LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";

const productIdPrefix = "gid://shopify/Product/";

const toNumericId = (id: string | undefined | null) => {
  if (!id) return null;
  return id.startsWith(productIdPrefix) ? id.slice(productIdPrefix.length) : id;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
        query FirstProductId {
          products(first: 1) {
            nodes {
              id
            }
          }
        }
      `,
    );

    const body = await response.json();
    const productId = toNumericId(body.data?.products?.nodes?.[0]?.id);

    if (!productId) {
      return data({ error: "No products available" }, { status: 404 });
    }

    return data({ productId });
  } catch (error: any) {
    console.error("Failed to load product", error);
    return data({ error: error?.message ?? "Unexpected error" }, { status: 500 });
  }
};

export const action = async () =>
  data({ error: "Method Not Allowed" }, { status: 405 });
