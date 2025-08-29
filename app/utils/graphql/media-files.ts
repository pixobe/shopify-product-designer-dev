/**
 * Fetches all available files from Shopify's file storage
 * @param {any} client - The Shopify client to use for making the GraphQL request
 * @returns {Promise<any>} - The response from the GraphQL query
 */
export async function GetShopMedia(client: any) {
  return client.graphql(
    `#graphql
      query GetAllImages {
        files(first: 100, query: "media_content_type:IMAGE") {
          edges {
            node {
              id
              alt
              createdAt
              updatedAt
              fileStatus
              ... on MediaImage {
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
  );
}
