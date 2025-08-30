/**
 * Fetches all available files from Shopify's file storage
 * @param {any} client - The Shopify client to use for making the GraphQL request
 * @param {number} first - Number of files to fetch (default: 250)
 * @returns {Promise<any>} - The response from the GraphQL query
 */
export async function GetShopMedia(client: any, first: number = 250) {
  return client.graphql(
    `#graphql
    query GetAllImages($first: Int!) {
      files(first: $first, query: "media_type:image",sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            alt
            ... on MediaImage {
              mimeType
              image {
                url
                width
                height
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }`,
    {
      variables: {
        first,
      },
    },
  );
}

/**
 * Searches for media files by name/alt text in Shopify's file storage
 * @param {any} client - The Shopify client to use for making the GraphQL request
 * @param {string} searchQuery - The search term to filter files by
 * @param {number} first - Number of files to fetch (default: 250)
 * @returns {Promise<any>} - The response from the GraphQL query
 */
export async function SearchShopMediaByName(
  client: any,
  searchQuery: string,
  first: number = 250,
) {
  // Build search query - Shopify handles partial matching internally
  const query = `media_type:image AND (filename:${searchQuery} OR alt:${searchQuery})`;

  return client.graphql(
    `#graphql
     query SearchImages($query: String!, $first: Int!) {
        files(first: $first, query: $query) {
          edges {
            node {
              id
              alt
              ... on MediaImage {
                mimeType
                image {
                  url
                  width
                  height
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `,
    {
      variables: {
        query,
        first,
      },
    },
  );
}

/**
 * Performs a flexible search for media files with various search criteria
 * @param {any} client - The Shopify client to use for making the GraphQL request
 * @param {string} searchTerm - The search term to filter files by
 * @param {Object} options - Search options
 * @param {number} options.first - Number of files to fetch (default: 250)
 * @param {boolean} options.exactMatch - Whether to perform exact match (default: false)
 * @returns {Promise<any>} - The response from the GraphQL query
 */
export async function SearchMediaFiles(
  client: any,
  searchTerm: string,
  options: { first?: number; exactMatch?: boolean } = {},
) {
  const { first = 250, exactMatch = false } = options;

  // Build search query - Shopify handles partial matching internally
  // exactMatch option can be used if needed, but generally not required
  const query = exactMatch
    ? `media_type:image AND (filename:"${searchTerm}" OR alt:"${searchTerm}")`
    : `media_type:image AND (filename:${searchTerm} OR alt:${searchTerm})`;

  return client.graphql(
    `#graphql
     query SearchMediaFiles($query: String!, $first: Int!) {
        files(first: $first, query: $query) {
          edges {
            node {
              id
              alt
              ... on MediaImage {
                mimeType
                image {
                  url
                  width
                  height
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `,
    {
      variables: {
        query,
        first,
      },
    },
  );
}
