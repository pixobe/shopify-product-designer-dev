import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { searchProductsByName } from "../utils/graphql/product";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const { admin } = await authenticate.admin(request);

        // Get search query and limit from URL parameters
        const url = new URL(request.url);
        const searchQuery = url.searchParams.get("q");
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 10;

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

        const response = await searchProductsByName(admin, searchQuery.trim(), limit);
        const result = await response.json();

        if (result.data?.products) {
            const products = result.data.products.edges.map((edge: any) => ({
                id: edge.node.id,
                title: edge.node.title,
                featuredImage: edge.node.featuredMedia?.preview?.image?.url || null
            }));

            return {
                success: true,
                result: products,
                searchQuery: searchQuery,
                hasMore: result.data.products.pageInfo.hasNextPage,
                total: products.length
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
        console.error("Error searching products:", error);
        return {
            success: false,
            error: "Failed to search products",
            result: [],
            searchQuery: null,
            hasMore: false,
            total: 0
        };
    }
};