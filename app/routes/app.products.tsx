import { useEffect, useMemo, useRef, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  data,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getOneProduct } from "app/utils/graphql/product-sample";

type Product = {
  id: string;
  title: string;
  image?: { url: string; altText?: string | null } | null;
};

type ProductsPayload = { products: Product[]; error?: string };
type LoaderData = { products: Product[]; adminProductHref: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop?.replace(".myshopify.com", "") ?? null;
  const productId = await getOneProduct(admin);

  const adminProductHref = shopDomain
    ? `https://admin.shopify.com/store/${shopDomain}/products/${productId}`
    : `https://admin.shopify.com/store/${shopDomain}/products`;

  const payload: LoaderData = { products: [], adminProductHref };
  return data(payload);
};

export default function ProductsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ProductsPayload>();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const autoLoadedProductRef = useRef<string | null>(null);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const productParam = params.get("productId")?.trim() ?? "";

    if (!productParam) {
      autoLoadedProductRef.current = null;
      return;
    }

    if (autoLoadedProductRef.current === productParam) {
      return;
    }

    setQuery(productParam);
    const searchParams = new URLSearchParams();
    searchParams.set("query", productParam);
    fetcher.load(`/api/products?${searchParams.toString()}`);
    autoLoadedProductRef.current = productParam;
  }, [location.search]);

  const products = useMemo(
    () => fetcher.data?.products ?? loaderData.products ?? [],
    [fetcher.data?.products, loaderData.products],
  );
  const searchError = fetcher.data?.error ?? null;

  const isLoading = fetcher.state === "loading";

  const handleRowClick = (product: Product) => {
    const params = new URLSearchParams({
      id: product.id,
      title: product.title,
    });
    navigate(`/app/customize?${params.toString()}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, product: Product) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleRowClick(product);
    }
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("query", trimmed);
    fetcher.load(`/api/products${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <s-page heading="Products" inlineSize="base">
      <s-section slot="aside" heading="💡 Pro Tip">
        <s-stack gap="base">
          <s-stack gap="small">
            <s-paragraph>
              Add <strong>Product Details Block</strong> on the product page for quicker access to Product Configuration screen.
            </s-paragraph>
            <s-paragraph color="subdued">
              Scroll down to bottom to find Block section.
            </s-paragraph>
          </s-stack>
          <s-box borderRadius="base" overflow="hidden" blockSize="100%">
            <s-link href={'/product-details-block.webp'} target="_blank">
              <s-image
                src="/product-details-block.webp"
                alt="Customize checkout illustration"
                inlineSize="auto"
                aspectRatio="1/1"
                objectFit="cover"
              />
            </s-link>
          </s-box>
          <s-button href={loaderData.adminProductHref}>
            <s-grid gridTemplateColumns="24px 1fr"><s-icon type="apps"></s-icon>Product Block</s-grid>
          </s-button>
        </s-stack>
      </s-section>


      <s-section>
        <form onSubmit={handleSearch}>
          <s-stack direction="inline" gap="base">
            <s-search-field
              label="Search"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search by product name or ID"
              value={query}
              onInput={(event: any) => {
                const value = event?.target?.value ?? "";
                setQuery(value);
                const trimmed = value.trim();
                const params = new URLSearchParams();
                if (trimmed) params.set("query", trimmed);
                fetcher.load(`/api/products${params.toString() ? `?${params.toString()}` : ""}`);
              }}
            />
          </s-stack>
          {searchError ? (
            <p role="alert" style={{ color: "#b42318", marginTop: 8 }}>
              {searchError}
            </p>
          ) : null}
        </form>

      </s-section>

      <s-section heading="Results">
        {products.length === 0 ? (
          <s-text>
            {isLoading ? "Searching..." : "No products found yet."}
          </s-text>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={cellHeader}>Image</th>
                  <th style={cellHeader}>Title</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => handleRowClick(product)}
                    onKeyDown={(event) => handleKeyDown(event, product)}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ ...cellBody, width: "72px" }}>
                      {product.image?.url ? (
                        <img
                          src={product.image.url}
                          alt={product.image.altText || product.title}
                          style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }}
                          loading="lazy"
                        />
                      ) : (
                        <s-text color="subdued">No image</s-text>
                      )}
                    </td>
                    <td style={cellBody}>{product.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}

const cellHeader: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
};

const cellBody: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "14px",
};

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
