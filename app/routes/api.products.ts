import { data, type LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";

type ProductNode = {
  id?: string;
  title?: string;
  featuredImage?: {
    url?: string;
    altText?: string | null;
  } | null;
};

const PRODUCT_SEARCH_QUERY = `#graphql
  query ProductSearch($first: Int!, $query: String) {
    products(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        title
        featuredImage {
          url
          altText
        }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("query")?.trim() ?? "";

  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(PRODUCT_SEARCH_QUERY, {
      variables: {
        first: 25,
        query: rawQuery || null,
      },
    });

    const body = await response.json();

    const products = ((body.data?.products?.nodes ?? []) as ProductNode[])
      .filter((node) => typeof node?.id === "string" && typeof node?.title === "string")
      .map((node) => ({
        id: node.id as string,
        title: node.title as string,
        image: node.featuredImage?.url
          ? {
              url: node.featuredImage.url,
              altText: node.featuredImage.altText ?? null,
            }
          : null,
      }));

    return data({ products });
  } catch (error: any) {
    console.error("Failed to search products", error);

    return data(
      {
        products: [],
        error: error?.message ?? "Unable to search products right now.",
      },
      { status: 500 },
    );
  }
};

export const action = async () =>
  data({ error: "Method Not Allowed" }, { status: 405 });
