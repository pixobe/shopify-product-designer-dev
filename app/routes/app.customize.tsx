import { useRef, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

type MediaItem = {
  id: string;
  alt: string;
  url: string;
  width: number | null;
  height: number | null;
  mimeType?: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  return data({
    productId: url.searchParams.get("id") ?? "",
    productName: url.searchParams.get("title") ?? "",
  });
};

export default function CustomizePage() {
  const { productName } = useLoaderData<typeof loader>();
  const modalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const mediaFetcher = useFetcher<{ media: MediaItem[] }>();
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const openMediaModal = () => {
    if (!mediaFetcher.data && mediaFetcher.state === "idle") {
      mediaFetcher.load("/api/media");
    }
    modalRef.current?.showOverlay?.();
  };

  const closeMediaModal = () => {
    modalRef.current?.hideOverlay?.();
  };

  return (
    <s-page heading="Customize product">
      <s-section>
        <s-text>
          {productName ? `Customizing: ${productName}` : "No product selected"}
        </s-text>
      </s-section>

      <s-section heading="Media">
        <s-stack direction="inline" gap="base">
          <s-button onClick={openMediaModal}>Add Media</s-button>
          {selectedMediaIds.size > 0 && (
            <s-text tone="success">{`${selectedMediaIds.size} image${selectedMediaIds.size > 1 ? "s" : ""} selected`}</s-text>
          )}
        </s-stack>
      </s-section>

      <s-modal ref={modalRef} id="media-modal" heading="Select product images" size="large">
        <s-stack gap="base">
          <s-text>Select from existing media.</s-text>

          <s-search-field
            label="Search"
            labelAccessibilityVisibility="exclusive"
            placeholder="Search items"
            value={searchTerm}
            onInput={(event: any) => {
              const value = event?.target?.value ?? "";
              setSearchTerm(value);
              const trimmed = value.trim();
              mediaFetcher.load(`/api/media${trimmed ? `?query=${encodeURIComponent(trimmed)}` : ""}`);
            }}
          />

          {mediaFetcher.state === "loading" && <s-spinner />}

          {mediaFetcher.data && mediaFetcher.data.media.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: "12px",
              }}
            >
              {mediaFetcher.data.media.map((item) => {
                const isSelected = selectedMediaIds.has(item.id);
                return (
                  <s-button
                    key={item.id}
                    variant={isSelected ? "primary" : "secondary"}
                    onClick={() => {
                      setSelectedMediaIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) {
                          next.delete(item.id);
                        } else {
                          next.add(item.id);
                        }
                        // eslint-disable-next-line no-console
                        console.log("Selected media ids", Array.from(next));
                        return next;
                      });
                    }}
                  >
                    <s-stack gap="small" alignContent="center" alignItems="center">
                      <s-thumbnail
                        alt={item.alt || "Media thumbnail"}
                        size="large-100"
                        src={item.url}
                      />
                      <s-text tone="neutral">{item.alt || "Untitled image"}</s-text>
                    </s-stack>
                  </s-button>
                );
              })}
            </div>
          )}
        </s-stack>

        <s-button
          slot="secondary-actions"
          variant="secondary"
          command="--hide"
          commandFor="media-modal"
          onClick={closeMediaModal}
        >
          Add
        </s-button>
      </s-modal>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
