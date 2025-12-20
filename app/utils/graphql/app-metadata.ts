// Helper function to set app metafield data
export async function setAppMetafield(
  admin: any,
  metafieldKey: string,
  metafieldData: any,
) {
  try {
    // Get current app installation ID
    const appIdQuery = `
      query {
        currentAppInstallation {
          id
        }
      }
    `;

    const appIdResponse = await admin.graphql(appIdQuery);
    const appIdData = await appIdResponse.json();

    if (!appIdData.data?.currentAppInstallation?.id) {
      return {
        success: false,
        message: "Failed to retrieve app installation ID",
      };
    }

    const ownerId = appIdData.data.currentAppInstallation.id;

    // Create metafield with the provided data
    const metafieldMutation = `
      mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafieldsSetInput) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      metafieldsSetInput: [
        {
          namespace: "app_config",
          key: metafieldKey,
          type: "json",
          value: JSON.stringify(metafieldData),
          ownerId: ownerId,
        },
      ],
    };

    const metafieldResponse = await admin.graphql(metafieldMutation, {
      variables,
    });
    const metafieldResult = await metafieldResponse.json();

    if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
      return {
        success: false,
        message: metafieldResult.data.metafieldsSet.userErrors[0].message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "An unexpected error occurred",
    };
  }
}

// Helper function to get app metafield data
export async function getAppMetafield(admin: any, meta_key: string) {
  try {
    // Get current app installation with metafield
    const query = `
      query {
        currentAppInstallation {
          id
          metafield(namespace: "app_config", key: "${meta_key}") {
            value
          }
        }
      }
    `;

    const response = await admin.graphql(query);
    const data = await response.json();
    if (!data.data?.currentAppInstallation?.metafield?.value) {
      return null;
    }

    const metafieldValue = JSON.parse(
      data.data.currentAppInstallation.metafield.value,
    );

    return metafieldValue;
  } catch (error) {
    console.error("Error retrieving app metafield:", error);
    return null;
  }
}
