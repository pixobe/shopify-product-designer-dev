import { data } from "react-router";

const orderIdPrefix = "gid://shopify/Order/";

const toNumericId = (id: string | undefined | null) => {
  if (!id) return null;
  return id.startsWith(orderIdPrefix) ? id.slice(orderIdPrefix.length) : id;
};

/**
 * Fetches the most recently processed order and returns its numeric ID.
 */
export async function getSampleOrderId(admin: any) {
  try {
    const response = await admin.graphql(
      `#graphql
        query SampleOrderId {
          orders(first: 1, sortKey: PROCESSED_AT, reverse: true) {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
    );

    const body = await response.json();
    const orderId = toNumericId(body.data?.orders?.edges?.[0]?.node?.id);

    if (!orderId) {
      return data({ error: "No orders available" }, { status: 404 });
    }

    return orderId;
  } catch (error: any) {
    console.error("Failed to load order", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
}
