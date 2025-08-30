import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { SearchShopMediaByName } from "../utils/graphql/media-files";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const { admin } = await authenticate.admin(request);

        // Get search query and limit from URL parameters
        const url = new URL(request.url);
        const searchQuery = url.searchParams.get("q");
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 250;

        if (!searchQuery || searchQuery.trim() === "") {
            return {
                success: false,
                error: "Search query is required",
                result: [],
                searchQuery: null,
                hasMore: false,
                total: 0
            };
        }

        const response = await SearchShopMediaByName(admin, searchQuery.trim(), limit);
        const result = await response.json();

        if (result.data?.files) {
            const files = result.data.files.edges.map((edge: any) => edge.node);
            return {
                success: true,
                result: files,
                searchQuery: searchQuery,
                hasMore: result.data.files.pageInfo.hasNextPage,
                total: files.length
            };
        }

        return {
            success: true,
            result: [],
            searchQuery: searchQuery,
            hasMore: false,
            total: 0
        };
    } catch (error) {
        console.error("Error searching Shopify files:", error);
        return {
            success: false,
            error: "Failed to search files",
            result: [],
            searchQuery: null,
            hasMore: false,
            total: 0
        };
    }
};