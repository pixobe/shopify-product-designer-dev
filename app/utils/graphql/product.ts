export async function getProductImageQuery(client: any, productId: string) {
  return client.graphql(
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
      variables: { productId: `gid://shopify/Product/${productId}` },
    },
  );
}

export async function getProductDetails(client: any, productId: string) {
  return client.graphql(
    `#graphql
      query GetProductById($id: ID!) {
      node(id: $id) {
        ... on Product {
          id
          title,
        }
      }
    }
    `,
    {
      variables: { id: `gid://shopify/Product/${productId}` },
    },
  );
}
