import { useEffect, useMemo, useRef, useState } from "react";
import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data, useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getProductMedia } from "app/utils/graphql/product-media";

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
  name: string;
  url: string;
  grid?: GridConfig | null;
  showGrid?: boolean;
  etching?: boolean;
  metaobjectId?: string;
  variantId?: string | null;
};

type VariantSelection = {
  key: string;
  label: string;
  variantId: string | null;
};


const mediaEntriesMatch = (
  candidate: MediaItem,
  target: MediaItem,
) => {
  if (candidate.metaobjectId && target.metaobjectId) {
    return candidate.metaobjectId === target.metaobjectId;
  }

  if (
    candidate.variantId &&
    target.variantId &&
    candidate.variantId !== target.variantId
  ) {
    return false;
  }

  return candidate.id === target.id;
};

const isMediaForVariant = (item: MediaItem, variantId: string): boolean =>
  item.variantId === variantId;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const productId = url.searchParams.get("id") ?? "";

  if (productId) {
    const { admin } = await authenticate.admin(request);
    const productMediaList = await getProductMedia(admin, productId);
    return data({
      productId,
      productName: productMediaList?.productName ?? "",
      variants: Array.isArray(productMediaList?.variants)
        ? productMediaList.variants
        : [],
    });
  }


  return data({
    productId,
    productName: "",
    variants: [],
  });
};

export default function CustomizePage() {
  const loaderData = useLoaderData<any>();

  const {
    productId,
    productName,
    variants: loaderVariants = [],
  } = loaderData;
  const modalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const previewModalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const gridEditorRef = useRef<any>(null);
  const mediaFetcher = useFetcher<{ media: MediaItem[] }>();
  const metafieldFetcher = useFetcher<{ metaobjectIds?: string[]; error?: string }>();
  const removeFetcher = useFetcher<{ metaobjectIds?: string[]; error?: string }>();
  const [pendingMedia, setPendingMedia] = useState<Map<string, MediaItem>>(new Map());


  const normalizedVariants = useMemo(() => {
    return loaderVariants;
  }, [loaderVariants]);


  const normalizedLoaderMedia = useMemo(
    () => normalizedVariants.flatMap((variant: any) => variant.media),
    [normalizedVariants],
  );

  const variantOptions: VariantSelection[] = useMemo(
    () =>
      normalizedVariants.map((variant: any) => ({
        key: variant.id,
        label: variant.name,
        variantId: variant.id ?? null,
      })),
    [normalizedVariants],
  );

  const variantOptionsMap = useMemo(() => {
    const entries = new Map<string, VariantSelection>();
    variantOptions.forEach((variant) => {
      entries.set(variant.key, variant);
    });
    return entries;
  }, [variantOptions]);


  const defaultVariantKey = variantOptions[0]?.key ?? null;
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>(normalizedLoaderMedia);
  const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(
    defaultVariantKey,
  );
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGridEnabled, setShowGridEnabled] = useState(true);
  const [etchingEnabled, setEtchingEnabled] = useState(false);

  useEffect(() => {
    setSelectedMedia(normalizedLoaderMedia);
  }, [normalizedLoaderMedia]);

  useEffect(() => {
    if (!variantOptions.length) {
      setSelectedVariantKey(null);
      return;
    }

    setSelectedVariantKey((previous) => {
      if (previous && variantOptions.some((variant) => variant.key === previous)) {
        return previous;
      }
      return variantOptions[0]?.key ?? null;
    });
  }, [variantOptions]);

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
    const variantForItem =
      previewMedia.variantId ?? selectedVariantId ?? null;
    const updatedItem: MediaItem = {
      ...previewMedia,
      grid: gridConfig,
      showGrid: showGridEnabled,
      etching: etchingEnabled,
      variantId: variantForItem,
    };

    const nextSelection = selectedMedia.map((item) =>
      mediaEntriesMatch(item, updatedItem) ? updatedItem : item,
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

  const hasVariants = variantOptions.length > 0;
  const selectedVariant = selectedVariantKey
    ? variantOptionsMap.get(selectedVariantKey) ?? null
    : null;
  const selectedVariantId = selectedVariant?.variantId ?? null;

  const activeVariantMedia = useMemo(() => {
    if (!selectedVariantId) {
      return selectedMedia;
    }

    return selectedMedia.filter((item) =>
      isMediaForVariant(item, selectedVariantId),
    );
  }, [selectedMedia, selectedVariantId]);

  const selectedVariantLabel =
    variantOptions.length === 1
      ? productName
      : selectedVariant?.label ?? productName;


  const pendingSelectionIds = useMemo(
    () => new Set(pendingMedia.keys()),
    [pendingMedia],
  );

  const selectedCount = activeVariantMedia.length;
  const isSavingSelection =
    metafieldFetcher.state !== "idle" || removeFetcher.state !== "idle";

  const persistSelection = (items: MediaItem[]) => {
    if (!selectedVariantId) {
      return;
    }
    const formData = new FormData();
    formData.append("variantId", selectedVariantId);

    const normalizedItems = items
      .filter((item) => item.variantId === selectedVariantId)
      .map((item) => ({
        id: item.id,
        url: item.url,
        alt: item.alt,
        grid: item.grid
          ? { ...DEFAULT_GRID_CONFIG, ...item.grid }
          : { ...DEFAULT_GRID_CONFIG },
        showGrid:
          typeof item.showGrid === "boolean" ? item.showGrid : true,
        etching: typeof item.etching === "boolean" ? item.etching : false,
        metaobjectId: item.metaobjectId,
        variantId: selectedVariantId,
      }));

    formData.append("media", JSON.stringify(normalizedItems));
    metafieldFetcher.submit(formData, {
      method: "post",
      action: "/api/update-variant-media",
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
    if (!selectedVariantId) {
      return;
    }
    const newItems = Array.from(pendingMedia.values()).map((item) => ({
      ...item,
      alt: typeof item.alt === "string" ? item.alt : "",
      name: typeof item.name === "string" ? item.name : "",
      url: typeof item.url === "string" ? item.url : "",
      variantId: selectedVariantId,
    }));

    const isDuplicateForVariant = (candidate: MediaItem) =>
      selectedMedia.some(
        (item) =>
          isMediaForVariant(item, selectedVariantId) &&
          mediaEntriesMatch(item, candidate),
      );
    const dedupedItems = newItems.filter(
      (item) => !isDuplicateForVariant(item),
    );
    if (dedupedItems.length === 0) {
      setPendingMedia(new Map());
      closeMediaModal();
      return;
    }

    const merged = [...selectedMedia, ...dedupedItems];
    setSelectedMedia(merged);
    setPendingMedia(new Map());
    persistSelection(merged);
    closeMediaModal();
  };

  const removeMedia = (item: MediaItem) => {
    const updated = selectedMedia.filter(
      (entry) => !mediaEntriesMatch(entry, item),
    );
    setSelectedMedia(updated);

    const targetVariantId = item.variantId ?? selectedVariantId;
    if (targetVariantId && item.metaobjectId) {
      const formData = new FormData();
      formData.append("variantId", targetVariantId);
      formData.append("metaobjectId", item.metaobjectId);
      removeFetcher.submit(formData, {
        method: "post",
        action: "/api/remove-variant-media",
      });
    }
  };

  const errorMessage = metafieldFetcher.data?.error ?? removeFetcher.data?.error;
  const savedCount = metafieldFetcher.data?.metaobjectIds?.length ?? 0;
  const showSuccessMessage = !isSavingSelection && !errorMessage && savedCount > 0;

  const isAddDisabled =
    pendingMedia.size === 0 ||
    !productId ||
    isSavingSelection ||
    (hasVariants && !selectedVariantKey);

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
    <s-page heading={productName ? `${productName}` : "Product Search"}>
      {variantOptions.length > 1 && (
        <s-section heading="Variants">
          <s-stack gap="small">
            <s-text>Select a variant to upload and manage media for.</s-text>
            <div
              role="radiogroup"
              aria-label="Select product variant"
              style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}
            >
              {variantOptions.map((variant) => {
                const isActive = selectedVariantKey === variant.key;
                return (
                  <label
                    key={variant.key}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      border: isActive
                        ? "2px solid #008060"
                        : "1px solid #d2d5d8",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      backgroundColor: isActive ? "#f0faf5" : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name="variant-selector"
                      value={variant.key}
                      checked={isActive}
                      onChange={() => setSelectedVariantKey(variant.key)}
                      style={{ margin: 0 }}
                    />
                    <span>{variant.label}</span>
                  </label>
                );
              })}
            </div>
          </s-stack>
        </s-section>
      )}

      <s-section heading={`Media for ${selectedVariantLabel}`}>
        <s-stack direction="inline" gap="base">
          <s-button onClick={openMediaModal}>Add Media</s-button>
          {selectedCount > 0 && (
            <s-text tone="success">
              {`${selectedCount} image${selectedCount > 1 ? "s" : ""} selected${selectedVariantLabel ? ` for ${selectedVariantLabel}` : ""}`}
            </s-text>
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
            <s-text tone="success">Saved {savedCount} media entr{savedCount === 1 ? "y" : "ies"} to the variant.</s-text>
          </s-box>
        )}

        {activeVariantMedia.length > 0 ? (
          <s-stack gap="small-200" paddingBlockStart="base">
            <s-grid blockSize="auto"
              gridTemplateColumns="repeat(auto-fill, minmax(120px, 1fr))"
              gap="base"
            >
              {activeVariantMedia.map((item) => (
                <s-clickable
                  key={`${item.variantId ?? "unassigned"}-${item.id}`}
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
                      {item.alt || item.name}
                    </s-text>
                  </s-stack>
                </s-clickable>
              ))}
            </s-grid>
          </s-stack>
        ) : (
          <s-box paddingBlockStart="base">
            <s-text color="subdued">No media selected yet for this variant.</s-text>
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
              <p-product-grid ref={gridEditorRef} key={previewMedia.id} config={previewMedia}></p-product-grid>
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
