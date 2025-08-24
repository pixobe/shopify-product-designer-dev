import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    try {
        const formData = await request.formData();
        const productId = formData.get("productId") as string;
        const productHandle = formData.get("productHandle") as string;
        const variantId = formData.get("variantId") as string;
        const quantity = formData.get("quantity") as string;

        console.log("Custom action triggered:", {
            productId,
            productHandle,
            variantId,
            quantity
        });

        // Add your custom logic here
        // For example:
        // - Send data to external service
        // - Create a metafield
        // - Send notification
        // - Update inventory
        // - Create a draft order

        // Example: Create a metafield for the product
        // const metafield = await admin.graphql(`
        //   mutation metafieldCreate($input: MetafieldInput!) {
        //     metafieldCreate(input: $input) {
        //       metafield {
        //         id
        //         key
        //         value
        //       }
        //       userErrors {
        //         field
        //         message
        //       }
        //     }
        //   }
        // `, {
        //   variables: {
        //     input: {
        //       ownerId: productId,
        //       namespace: "custom",
        //       key: "button_action",
        //       value: JSON.stringify({
        //         action: "custom_button_clicked",
        //         timestamp: new Date().toISOString(),
        //         quantity: quantity
        //       }),
        //       type: "json"
        //     }
        //   }
        // });

        return Response.json({
            success: true,
            message: "Custom action completed",
            data: { productHandle, quantity }
        });

    } catch (error) {
        console.error("Error in custom action:", error);
        return json({
            success: false,
            error: "Failed to process custom action"
        }, { status: 500 });
    }
};

// Handle GET requests for testing
export const loader = async ({ request }: ActionFunctionArgs) => {
    const { admin } = await authenticate.admin(request);

    const url = new URL(request.url);
    const productHandle = url.searchParams.get("product");

    return json({
        message: "Custom action endpoint ready",
        product: productHandle,
        timestamp: new Date().toISOString()
    });
};

