/**
 * Fetches all available files from Shopify's file storage
 * @param {any} client - The Shopify client to use for making the GraphQL request
 * @returns {Promise<any>} - The response from the GraphQL query
 */
export async function getAllFiles(client: any) {
  return client.graphql(
    `#graphql
      query GetAllFiles {
        files(first: 100) {
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
              ... on Video {
                duration
                originalSource {
                  url
                  width
                  height
                  format
                  mimeType
                }
              }
              ... on GenericFile {
                url
                mimeType
                originalFileSize
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
