import type { LoaderFunction } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";

export const loader: LoaderFunction = async ({ request }) => {

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    throw new Response("Missing shop parameter", { status: 400 });
  }

  const { storefront } = await unauthenticated.storefront(
    shop
  );

  const productId = url.searchParams.get("productId");

  console.log("productId", productId);


  const response = await storefront.graphql(
    `#graphql
query ProductImageQuery($productId: ID!) {
  product(id: $productId) {
    id
    title
    media(first: 5) { # You can adjust 'first' to get more media items
      edges {
        node {
          ... on MediaImage { # Filter for MediaImage type
            image {
              url
            }
          }
        }
      }
    }
  }
}
    `,
    {
      variables: { productId: `gid://shopify/Product/${productId}` }
    }
  );

  const product = await response.json();

  return Response.json({
    success: true,
    message: "Custom action completed",
    result: product
  });
};
