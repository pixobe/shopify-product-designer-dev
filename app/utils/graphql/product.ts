interface ExtractedData {
  title: string;
  media: { src: string }[];
}

function createShopifyGid(
  type: "Product" | "ProductVariant",
  id: string,
): string {
  return `gid://shopify/${type}/${id}`;
}

const VARIANT_IMAGE_QUERY = `#graphql
  query VariantImage($id: ID!) {
    productVariant(id: $id) {
      image {
        url
      }
    }
  }
`;

const PRODUCT_MEDIA_QUERY = `#graphql
  query ProductMedia($id: ID!) {
    product(id: $id) {
      media(first: 50) {
        edges {
          node {
            ... on MediaImage {
              image {
                url
              }
            }
          }
        }
      }
    }
  }
`;

export async function getImages(
  client: any,
  productId: string | null,
  variantId: string | null,
): Promise<string[]> {
  // Determine if the ID belongs to a Product or a ProductVariant

  if (variantId) {
    try {
      const response = await client.graphql(VARIANT_IMAGE_QUERY, {
        variables: { id: variantId },
      });

      const variantImage = response?.data?.productVariant?.image;
      if (variantImage) {
        return [variantImage.url];
      }
    } catch (error) {
      console.error("Failed to fetch variant image:", error);
    }
    return [];
  } else if (productId) {
    try {
      const response = await client.graphql(PRODUCT_MEDIA_QUERY, {
        variables: { id: productId },
      });

      const mediaEdges = response?.data?.product?.media?.edges;
      if (mediaEdges) {
        return mediaEdges
          .map((edge: any) => edge.node.image?.url)
          .filter(Boolean);
      }
    } catch (error) {
      console.error("Failed to fetch product media:", error);
    }
    return [];
  } else {
    console.warn(
      "Invalid ID provided. Must be a Shopify Product or Variant global ID.",
    );
    return [];
  }
}

const PRODUCT_VARIANT_DETAILS_QUERY = `#graphql
query GetProductOrVariantDetails($id: ID!) {
  node(id: $id) {
    ... on Product {
      id
      title
      media(first: 10) {
        edges {
          node {
            ... on MediaImage {
              image {
                url
              }
            }
          }
        }
      }
    }
    ... on ProductVariant {
      id
      title
      image {
        url
      }
      product {
        id
        title
      }
    }
  }
}

`;
/**
 * Fetches details for a product or a variant given its ID.
 * @param client The Shopify Admin GraphQL client.
 * @param productId The global ID of the product.
 * @param variantId The global ID of the variant, or null.
 * @returns A promise that resolves to the extracted data or an object with an error message.
 */
export async function getProductDetails(
  client: any,
  productId: string,
  variantId: string | null,
): Promise<ExtractedData> {
  const query = PRODUCT_VARIANT_DETAILS_QUERY;

  const id = variantId
    ? createShopifyGid("ProductVariant", variantId)
    : createShopifyGid("Product", productId);

  console.log("******************************", query, id);

  try {
    const response = await client.graphql(query, {
      variables: { id },
    });

    // Call the extraction helper
    const responseData = await response.json();
    console.log("Respnose data******************************", responseData);
    const extractedData = extractProductInfo(responseData);

    // Explicitly handle the null case returned by the helper
    if (extractedData === null) {
      throw new Error("G002:Failed to get product data.");
    }
    return extractedData;
  } catch (error) {
    throw error;
  }
}

/**
 * Extracts the product or variant title and image URLs from a GraphQL response.
 * @param response The GraphQL response object.
 * @returns An object containing the extracted title and image URLs, or null on failure.
 */
function extractProductInfo(response: any): ExtractedData | null {
  try {
    const node = response?.data?.node;

    if (!node) {
      console.warn("No data or node found in the response.");
      return null;
    }

    // Handle Product response
    if (node.media) {
      const media = (node.media.edges || []).flatMap((edge: any) => {
        const url = edge.node.image?.url;
        return url ? [{ src: url }] : [];
      });

      return {
        title: node.title,
        media,
      };
    }

    // Handle ProductVariant response
    if (node.product && node.image) {
      const media = node.image.url ? [{ src: node.image.url }] : [];

      return {
        title: node.product.title,
        media: media,
      };
    }

    console.warn("Unexpected data structure in the response.");
    return null;
  } catch (error) {
    console.error("Failed to extract data from GraphQL response:", error);
    return null;
  }
}

export async function searchProductsByName(
  client: any,
  searchQuery: string,
  first: number = 10,
) {
  return client.graphql(
    `#graphql
      query SearchProducts($query: String!, $first: Int!) {
        products(query: $query, first: $first) {
          edges {
            node {
              id
              title
              featuredMedia {
               id
               preview {
                 image {
                   url
                 }
               }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `,
    {
      variables: {
        query: `title:*${searchQuery}*`,
        first: first,
      },
    },
  );
}
