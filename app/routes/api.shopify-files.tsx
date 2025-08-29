import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getAllFiles } from "../utils/graphql/media-files";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const { admin } = await authenticate.admin(request);

        const response = await getAllFiles(admin);

        const result = await response.json();

        if (result.data?.files) {
            // Return first 10 files for logging
            const files = result.data.files.edges.map((edge: any) => edge.node);
            return ({
                success: true,
                files: files.slice(0, 10) // Limit to first 10 files
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