import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    try {
        const configData = await request.json();

        // First get the shop ID
        const shopResponse = await admin.graphql(`
            query getCurrentShop {
                shop {
                    id
                }
            }
        `);

        const shopData = await shopResponse.json();
        const shopId = shopData.data.shop.id;

        // Create/update the metafield with configuration data
        const metafieldResponse = await admin.graphql(`
            mutation saveConfiguration($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                    metafields {
                        id
                        namespace
                        key
                        value
                    }
                    userErrors {
                        field
                        message
                        code
                    }
                }
            }
        `, {
            variables: {
                metafields: [
                    {
                        ownerId: shopId,
                        namespace: "$app",
                        key: "pixobe-app-config",
                        type: "json",
                        value: JSON.stringify(configData)
                    }
                ]
            }
        });

        const metafieldData = await metafieldResponse.json();

        if (metafieldData.data?.metafieldsSet?.userErrors?.length > 0) {
            console.error("Metafield creation errors:", metafieldData.data.metafieldsSet.userErrors);
            return json({
                success: false,
                error: "Failed to save configuration",
                details: metafieldData.data.metafieldsSet.userErrors
            }, { status: 500 });
        }

        return json({
            success: true,
            message: "Configuration saved successfully",
            metafield: metafieldData.data?.metafieldsSet?.metafields?.[0]
        });

    } catch (error) {
        console.error("Error saving configuration:", error);
        return json({
            success: false,
            error: "Failed to save configuration"
        }, { status: 500 });
    }
};

// Handle GET requests to retrieve configuration
export const loader = async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    try {
        // Get the shop with the configuration metafield
        const shopResponse = await admin.graphql(`
            query getConfiguration {
                shop {
                    id
                    metafield(namespace: "$app", key: "pixobe-app-config") {
                        id
                        value
                        jsonValue
                    }
                }
            }
        `);

        const shopData = await shopResponse.json();
        const metafield = shopData.data?.shop?.metafield;

        if (metafield) {
            // Parse the configuration data
            const configData = metafield.jsonValue || JSON.parse(metafield.value);

            return json({
                success: true,
                configuration: configData,
                metafieldId: metafield.id
            });
        } else {
            // No configuration found, return empty config
            return json({
                success: true,
                configuration: {
                    fonts: [],
                    galleries: []
                },
                metafieldId: null
            });
        }

    } catch (error) {
        console.error("Error loading configuration:", error);
        return json({
            success: false,
            error: "Failed to load configuration"
        }, { status: 500 });
    }
};