import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";

const productIdPrefix = "gid://shopify/Product/";

const looksLikeProductId = (value: string) =>
  value.startsWith(productIdPrefix) || /^[0-9]+$/.test(value);

const normalizeProductId = (value: string) =>
  value.startsWith(productIdPrefix) ? value : `${productIdPrefix}${value}`;

const escapeQueryTerm = (term: string) => term.replace(/(["\\])/g, "\\$1");

const buildSearchQuery = (term: string) => {
  const escaped = escapeQueryTerm(term.trim());
  const wildcard = `*${escaped}*`;

  // Use a broad search across multiple fields so partial matches surface.
  return `title:${wildcard} OR handle:${wildcard}`;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("query");

  // If no search query, return a small set of products to keep the response lean.
  if (!query) {
    const response = await admin.graphql(
      `#graphql
        query productsList($first: Int!) {
          products(first: $first) {
            nodes {
              id
              title
              handle
              status
            }
          }
        }
      `,
      { variables: { first: 50 } },
    );

    const data = await response.json();
    return { products: data.data?.products?.nodes ?? [] };
  }

  // Exact match by ID (either raw numeric ID or full GID).
  if (looksLikeProductId(query)) {
    const response = await admin.graphql(
      `#graphql
        query productById($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            status
          }
        }
      `,
      { variables: { id: normalizeProductId(query) } },
    );

    const data = await response.json();
    const product = data.data?.product;
    return { products: product ? [product] : [] };
  }

  // Partial match across title/handle using Shopify's search query syntax.
  const response = await admin.graphql(
    `#graphql
      query productsByTitle($first: Int!, $query: String!) {
        products(first: $first, query: $query) {
          nodes {
            id
            title
            handle
            status
          }
        }
      }
    `,
    {
      variables: {
        first: 50,
        query: buildSearchQuery(query),
      },
    },
  );

  const data = await response.json();
  return { products: data.data?.products?.nodes ?? [] };
};
