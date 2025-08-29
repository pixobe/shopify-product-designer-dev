import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { GetShopMedia } from "../utils/graphql/media-files";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const { admin } = await authenticate.admin(request);
        const response = await GetShopMedia(admin);
        const result = await response.json();
        if (result.data?.files) {
            const files = result.data.files.edges.map((edge: any) => edge.node);
            return ({
                success: true,
                files: files
            });
        }
        return ({
            success: false,
            error: "No files found",
            files: []
        });
    } catch (error) {
        console.error("Error fetching Shopify files:", error);
        return ({
            success: false,
            error: "Failed to fetch files",
            files: []
        });
    }
};