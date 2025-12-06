import { useMemo, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  data,
  useFetcher,
  useLoaderData,
  useNavigate,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

type Product = {
  id: string;
  title: string;
  handle: string;
  status: string;
};

const formatStatus = (status: string) =>
  status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());

type ProductsPayload = { products: Product[] };

export const loader = async (_args: LoaderFunctionArgs) => {
  const payload = { products: [] };
  return data(payload);
};

export default function ProductsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ProductsPayload>();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const products = useMemo(
    () => fetcher.data?.products ?? loaderData.products ?? [],
    [fetcher.data?.products, loaderData.products],
  );

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
    <s-page heading="Products">
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
                  <th style={cellHeader}>Title</th>
                  <th style={cellHeader}>Status</th>
                  <th style={cellHeader}>Handle</th>
                  <th style={cellHeader}>ID</th>
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
                    <td style={cellBody}>{product.title}</td>
                    <td style={cellBody}>{formatStatus(product.status)}</td>
                    <td style={cellBody}>{product.handle}</td>
                    <td style={cellBody}>{product.id}</td>
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
