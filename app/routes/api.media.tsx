import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { GetShopMedia, SearchShopMediaByName } from "../utils/graphql/media-files";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const { admin } = await authenticate.admin(request);

        // Get search query and limit from URL parameters
        const url = new URL(request.url);
        const searchQuery = url.searchParams.get("q");
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 250; // Default to 250 images

        // Use search function if query is provided, otherwise get all files
        const response = searchQuery
            ? await SearchShopMediaByName(admin, searchQuery, limit)
            : await GetShopMedia(admin, limit);

        const result = await response.json();

        if (result.data?.files) {
            const files = result.data.files.edges.map((edge: any) => edge.node);
            return ({
                success: true,
                result: files,
                searchQuery: searchQuery || null,
                hasMore: result.data.files.pageInfo.hasNextPage,
                total: files.length
            });
        }
        return ({
            success: false,
            error: "No files found",
            result: [],
            searchQuery: searchQuery || null,
            hasMore: false,
            total: 0
        });
    } catch (error) {
        console.error("Error fetching Shopify files:", error);
        return ({
            success: false,
            error: "Failed to fetch files",
            result: [],
            searchQuery: null,
            hasMore: false,
            total: 0
        });
    }
};