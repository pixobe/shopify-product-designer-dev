/**
 * 
 * Query Files by Name

 * 
 * 
 * query {
  # Search by filename
  filesByName: files(first: 10, query: "filename:logo.png") {
    edges {
      node {
        ... on MediaImage {
          id
          alt
          image {
            url
          }
        }
        ... on GenericFile {
          id
          url
        }
      }
    }
  }
}
 */

/**
 * Query Files by Alt Text
 * 
 * query {
  # Search by alt text (only works for MediaImage and Video)
  filesByAlt: files(first: 10, query: "alt:hero banner") {
    edges {
      node {
        ... on MediaImage {
          id
          alt
          image {
            url
          }
        }
        ... on Video {
          id
          alt
          sources {
            url
          }
        }
      }
    }
  }
}
 */
