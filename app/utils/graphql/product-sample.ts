import { data } from "react-router";

const productIdPrefix = "gid://shopify/Product/";

const toNumericId = (id: string | undefined | null) => {
  if (!id) return null;
  return id.startsWith(productIdPrefix) ? id.slice(productIdPrefix.length) : id;
};

/**
 *
 * @returns
 */
export async function getOneProduct(admin: any) {
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

    return productId;
  } catch (error: any) {
    console.error("Failed to load product", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
}
