import { useEffect, useMemo, useRef, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  PIXOBE_MEDIA_METAFIELD_KEY,
  PIXOBE_MEDIA_METAFIELD_NAMESPACE,
} from "../constants/customization";
import { preview } from "vite";

const METAOBJECT_REFERENCES_PAGE_SIZE = 50;

const DEFAULT_GRID_CONFIG = {
  rLeft: 0.5,
  rTop: 0.5,
  scaleX: 0.5,
  scaleY: 0.5,
  stroke: "#ff0000",
};

type GridConfig = typeof DEFAULT_GRID_CONFIG;

type MediaItem = {
  id: string;
  alt: string;
  url: string;
  grid?: GridConfig | null;
  showGrid?: boolean;
  etching?: boolean;
  metaobjectId?: string;
};

type MetaobjectField = {
  key: string;
  value?: string | null;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const parseMediaConfig = (
  rawValue?: string | null,
): Partial<MediaItem> & { mimeType?: string } => {
  if (!rawValue) {
    return {};
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.warn("Unable to parse product media config", error);
    return {};
  }
};

const parseGridField = (rawValue?: string | null): GridConfig | null => {
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === "object") {
      return {
        ...DEFAULT_GRID_CONFIG,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn("Unable to parse grid config", error);
  }

  return null;
};

const parseBooleanField = (rawValue?: string | null): boolean | null => {
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return null;
  }

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  try {
    const parsed = JSON.parse(rawValue);
    return typeof parsed === "boolean" ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const toMediaItem = (metaobject: any): MediaItem | null => {
  if (!metaobject) {
    return null;
  }

  const fields: MetaobjectField[] = Array.isArray(metaobject.fields)
    ? metaobject.fields
    : [];

  const srcField = fields.find((field) => field.key === "src");
  const configField = fields.find((field) => field.key === "config");
  const urlField = fields.find((field) => field.key === "url");
  const gridField = fields.find((field) => field.key === "grid");
  const showGridField = fields.find((field) => field.key === "showGrid");
  const etchingField = fields.find((field) => field.key === "etching");
  const rawId = srcField?.value ?? metaobject.id;

  if (!rawId) {
    return null;
  }

  const config = parseMediaConfig(configField?.value ?? null);
  const urlFromField =
    typeof urlField?.value === "string" && urlField.value
      ? urlField.value
      : null;
  const url = urlFromField || (typeof config.url === "string" ? config.url : "");

  if (!url) {
    return null;
  }

  const alt = typeof config.alt === "string" ? config.alt : "";
  const grid =
    parseGridField(gridField?.value ?? null) ||
    (config.grid && typeof config.grid === "object"
      ? {
        ...DEFAULT_GRID_CONFIG,
        ...config.grid,
      }
      : null);
  const showGrid =
    parseBooleanField(showGridField?.value ?? null) ??
    (typeof config.showGrid === "boolean" ? config.showGrid : undefined);
  const etching =
    parseBooleanField(etchingField?.value ?? null) ??
    (typeof config.etching === "boolean" ? config.etching : undefined);

  return {
    id: typeof rawId === "string" ? rawId : String(rawId),
    alt,
    url,
    grid,
    showGrid,
    etching,
    metaobjectId:
      typeof metaobject.id === "string" ? metaobject.id : undefined,
  };
};

const extractMediaFromReferences = (nodes?: any[] | null): MediaItem[] =>
  (Array.isArray(nodes) ? nodes : [])
    .map((node) =>
      node?.__typename === "Metaobject" ? toMediaItem(node) : null,
    )
    .filter((item): item is MediaItem => Boolean(item));

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get("id") ?? "";
  const fallbackProductName = url.searchParams.get("title") ?? "";
  let productName = fallbackProductName;
  let selectedMedia: MediaItem[] = [];

  if (productId) {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
        query ProductCustomization(
          $id: ID!
          $namespace: String!
          $key: String!
          $first: Int!
        ) {
          product(id: $id) {
            id
            title
            metafield(namespace: $namespace, key: $key) {
              references(first: $first) {
                nodes {
                  __typename
                  ... on Metaobject {
                    id
                    fields {
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        }
      `,
      {
        variables: {
          id: productId,
          namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
          key: PIXOBE_MEDIA_METAFIELD_KEY,
          first: METAOBJECT_REFERENCES_PAGE_SIZE,
        },
      },
    );

    const json: any = await response.json();

    if (json.errors?.length) {
      console.error("Failed to load product customization data", json.errors);
    }

    const product = json.data?.product;
    if (product?.title) {
      productName = product.title;
    }

    const referenceNodes = product?.metafield?.references?.nodes ?? [];
    selectedMedia = extractMediaFromReferences(referenceNodes);
  }

  return data({
    productId,
    productName,
    selectedMedia,
  });
};

export default function CustomizePage() {
  const loaderData = useLoaderData<typeof loader>();
  const { productId, productName, selectedMedia: loaderSelectedMedia } = loaderData;
  const modalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const previewModalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const gridEditorRef = useRef<any>(null);
  const mediaFetcher = useFetcher<{ media: MediaItem[] }>();
  const metafieldFetcher = useFetcher<{ metaobjectIds?: string[]; error?: string }>();
  const [pendingMedia, setPendingMedia] = useState<Map<string, MediaItem>>(new Map());
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>(() => loaderSelectedMedia ?? []);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGridEnabled, setShowGridEnabled] = useState(true);
  const [etchingEnabled, setEtchingEnabled] = useState(false);

  useEffect(() => {
    setSelectedMedia(loaderSelectedMedia ?? []);
  }, [loaderSelectedMedia]);

  const openMediaModal = () => {
    if (!mediaFetcher.data && mediaFetcher.state === "idle") {
      mediaFetcher.load("/api/media");
    }
    modalRef.current?.showOverlay?.();
  };

  const closeMediaModal = () => {
    modalRef.current?.hideOverlay?.();
  };

  const openPreviewModal = (item: MediaItem) => {
    setPreviewMedia(item);
    previewModalRef.current?.showOverlay?.();
  };

  const saveConfigChanges = async () => {
    previewModalRef.current?.hideOverlay?.();

    if (!previewMedia) {
      return;
    }
    const gridConfig = await gridEditorRef.current.getConfig();
    const updatedItem: MediaItem = {
      ...previewMedia,
      grid: gridConfig,
      showGrid: showGridEnabled,
      etching: etchingEnabled,
    };

    const nextSelection = selectedMedia.map((item) =>
      item.id === previewMedia.id ? updatedItem : item,
    );

    setSelectedMedia(nextSelection);
    persistSelection(nextSelection);
    setPreviewMedia(null);
  };

  useEffect(() => {
    if (previewMedia) {
      // Load per-media configuration when opening the preview.
      setShowGridEnabled(
        typeof previewMedia.showGrid === "boolean" ? previewMedia.showGrid : true,
      );
      setEtchingEnabled(Boolean(previewMedia.etching));
    } else {
      setShowGridEnabled(true);
      setEtchingEnabled(false);
    }
  }, [previewMedia]);



  const pendingSelectionIds = useMemo(
    () => new Set(pendingMedia.keys()),
    [pendingMedia],
  );

  const selectedCount = selectedMedia.length;
  const isSavingSelection = metafieldFetcher.state !== "idle";

  const persistSelection = (items: MediaItem[]) => {
    if (!productId) return;
    const formData = new FormData();
    formData.append("productId", productId);
    const normalizedItems = items.map((item) => ({
      id: item.id,
      url: item.url,
      alt: item.alt,
      grid: item.grid
        ? { ...DEFAULT_GRID_CONFIG, ...item.grid }
        : { ...DEFAULT_GRID_CONFIG },
      showGrid:
        typeof item.showGrid === "boolean" ? item.showGrid : true,
      etching: typeof item.etching === "boolean" ? item.etching : false,
    }));
    formData.append("media", JSON.stringify(normalizedItems));
    metafieldFetcher.submit(formData, {
      method: "post",
      action: "/api/products/meta",
    });
  };

  const togglePendingSelection = (item: MediaItem) => {
    setPendingMedia((previous) => {
      const next = new Map(previous);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item);
      }
      return next;
    });
  };

  const saveSelectedMediaToConfig = () => {
    const newItems = Array.from(pendingMedia.values());

    // Merge without duplicates
    const merged = [
      ...selectedMedia,
      ...newItems.filter(
        (item) => !selectedMedia.some((existing) => existing.id === item.id)
      ),
    ];
    setSelectedMedia(merged);
    setPendingMedia(new Map());
    persistSelection(merged);
    closeMediaModal();
  };

  const removeMedia = (item: any) => {
    // Filter out the removed item
    const updated = selectedMedia.filter((m) => m.id !== item.id);
    // Update UI state
    setSelectedMedia(updated);
    // Re-sync metafield with updated list
    persistSelection(updated);
  }

  const errorMessage = metafieldFetcher.data?.error;
  const savedCount = metafieldFetcher.data?.metaobjectIds?.length ?? 0;
  const showSuccessMessage = !isSavingSelection && !errorMessage && savedCount > 0;

  const isAddDisabled = pendingMedia.size === 0 || !productId || isSavingSelection;

  const handleStrokeChange = (event: any) => {
    const nextValue =
      (typeof event?.detail?.color === "string" && event.detail.color) ||
      (typeof event?.target?.value === "string" && event.target.value)

    setPreviewMedia((previous: any) => {
      // If there is no previous media, nothing to update
      if (!previous) return previous;
      return {
        ...previous,
        grid: {
          ...(previous.grid || {}),
          stroke: nextValue,
        },
      };
    });

  };

  const extractBooleanValue = (event: any, fallback: boolean) => {
    if (typeof event?.detail?.checked === "boolean") {
      return event.detail.checked;
    }
    if (typeof event?.target?.checked === "boolean") {
      return event.target.checked;
    }
    if (typeof event?.detail?.value === "boolean") {
      return event.detail.value;
    }
    return !fallback;
  };

  const handleShowGridToggle = (event: any) => {
    setShowGridEnabled((previous) => extractBooleanValue(event, previous));
  };

  const handleEtchingToggle = (event: any) => {
    setEtchingEnabled((previous) => extractBooleanValue(event, previous));
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
          {selectedCount > 0 && (
            <s-text tone="success">{`${selectedCount} image${selectedCount > 1 ? "s" : ""} selected`}</s-text>
          )}
        </s-stack>

        {isSavingSelection && (
          <s-box paddingBlockStart="base">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-text tone="auto">Saving media selection…</s-text>
              <s-spinner accessibilityLabel="Loading" size="base" />
            </s-stack>
          </s-box>
        )}

        {errorMessage && (
          <s-box paddingBlockStart="base">
            <s-text tone="critical">Failed to save media selection: {errorMessage}</s-text>
          </s-box>
        )}

        {showSuccessMessage && (
          <s-box paddingBlockStart="base">
            <s-text tone="success">Saved {savedCount} media entr{savedCount === 1 ? "y" : "ies"} to the product.</s-text>
          </s-box>
        )}

        {selectedMedia.length > 0 ? (
          <s-stack gap="small-200" paddingBlockStart="base">
            <s-grid blockSize="auto"
              gridTemplateColumns="repeat(auto-fill, minmax(120px, 1fr))"
              gap="base"
            >
              {selectedMedia.map((item) => (
                <s-clickable
                  key={item.id}
                  border="base"
                  borderRadius="base"
                  padding="small"
                  onClick={() => openPreviewModal(item)}
                >
                  <s-stack gap="small" alignItems="center">
                    <div style={{ position: "absolute", right: "-10px", top: "-10px" }} >
                      <s-clickable
                        onClick={(event: any) => {
                          event.stopPropagation();
                          removeMedia(item);
                        }}
                      >
                        <s-icon type="x-circle" color="subdued" />
                      </s-clickable>
                    </div>
                    <s-thumbnail
                      alt={item.alt || "Selected media"}
                      size="large-100"
                      src={item.url}
                    />
                    <s-text tone="neutral">
                      {item.alt || "Untitled image"}
                    </s-text>
                  </s-stack>
                </s-clickable>
              ))}
            </s-grid>
          </s-stack>
        ) : (
          <s-box paddingBlockStart="base">
            <s-text color="subdued">No media selected yet.</s-text>
          </s-box>
        )}
      </s-section>

      <s-modal ref={modalRef} id="media-modal" heading="Select product images" size="large-100">
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
                const isSelected = pendingSelectionIds.has(item.id);
                return (
                  <s-clickable
                    key={item.id}
                    border="base"
                    borderColor={isSelected ? "strong" : "base"}
                    padding="base"
                    background={isSelected ? "strong" : "base"}
                    borderRadius="base"
                    onClick={() => togglePendingSelection(item)}
                  >
                    <s-stack gap="small" alignContent="center" alignItems="center">
                      <s-thumbnail
                        alt={item.alt || "Media thumbnail"}
                        size="large-100"
                        src={item.url}
                      />
                      <s-text tone="neutral">{item.alt || "Untitled image"}</s-text>
                    </s-stack>
                  </s-clickable>
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
          disabled={isAddDisabled}
          onClick={saveSelectedMediaToConfig}
        >
          Add
        </s-button>
      </s-modal>

      <s-modal
        ref={previewModalRef}
        id="media-preview-modal"
        heading={previewMedia?.alt || "Media preview"}
        size="large-100"
      >
        {previewMedia ? (
          <s-grid
            gridTemplateColumns="1fr 250px"
            gap="small"
            padding="none"
          >
            <s-grid blockSize="380px" background="strong" padding="none" alignItems="center">
              <p-grid ref={gridEditorRef} key={previewMedia.id} config={previewMedia}></p-grid>
            </s-grid>
            <s-grid background="strong" padding="base" alignContent="start" gap="base">
              <s-switch
                label="Show Grid"
                checked={showGridEnabled}
                onChange={handleShowGridToggle}
                onInput={handleShowGridToggle}
              />
              <s-switch
                label="Etching effect"
                checked={etchingEnabled}
                onChange={handleEtchingToggle}
                onInput={handleEtchingToggle}
              />
              <s-box overflow="hidden">
                <s-text type="strong">Grid Color: </s-text>
                <s-color-picker
                  value={previewMedia.grid?.stroke} onInput={handleStrokeChange} onChange={handleStrokeChange} />
              </s-box>
            </s-grid>
          </s-grid>
        ) : (
          <s-text>No media selected for preview.</s-text>
        )}
        <s-button
          slot="secondary-actions"
          variant="secondary"
          command="--hide"
          commandFor="media-preview-modal"
          onClick={saveConfigChanges}
        >
          Save
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
