import { useEffect, useMemo, useRef, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
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

const VARIANT_ID_PREFIX = "gid://shopify/ProductVariant/";
const NUMERIC_ID_REGEX = /^[0-9]+$/;

const normalizeVariantIdValue = (
  value: string | number | null | undefined,
): string | null => {
  let candidate: string | null = null;

  if (typeof value === "number" && Number.isFinite(value)) {
    candidate = String(Math.trunc(value));
  } else if (typeof value === "string") {
    candidate = value;
  }

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(VARIANT_ID_PREFIX)) {
    return trimmed;
  }

  if (NUMERIC_ID_REGEX.test(trimmed)) {
    return `${VARIANT_ID_PREFIX}${trimmed}`;
  }

  return trimmed;
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
  variantKey?: string;
};

type MetaobjectField = {
  key: string;
  value?: string | null;
};

type VariantGroup = {
  name: string;
  media?: MediaItem[] | null;
};

type VariantSelection = {
  key: string;
  label: string;
  variantId: string | null;
};

const assignFallbackVariantToMedia = (
  items: MediaItem[] | undefined,
  fallbackVariantId: string | null,
): MediaItem[] => {
  const safeItems = Array.isArray(items) ? items : [];
  const normalizedFallbackId = normalizeVariantIdValue(fallbackVariantId);

  return safeItems.map((item) => {
    const normalizedVariantId = normalizeVariantIdValue(item.variantId);
    const resolvedVariantId =
      normalizedVariantId ?? normalizedFallbackId ?? null;

    if (resolvedVariantId && resolvedVariantId === item.variantId) {
      return item;
    }

    if (resolvedVariantId) {
      return {
        ...item,
        variantId: resolvedVariantId,
      };
    }

    if (item.variantId) {
      return {
        ...item,
        variantId: undefined,
      };
    }

    return item;
  });
};

const resolveVariantId = (
  media: MediaItem,
  fallbackVariantId: string | null,
): string | null =>
  normalizeVariantIdValue(media.variantId ?? fallbackVariantId ?? null);

const resolveVariantKey = (media: MediaItem): string | null =>
  typeof media.variantKey === "string" && media.variantKey
    ? media.variantKey
    : null;

const mediaEntriesMatch = (
  candidate: MediaItem,
  target: MediaItem,
) => {
  if (candidate.metaobjectId && target.metaobjectId) {
    return candidate.metaobjectId === target.metaobjectId;
  }

  const candidateVariantId = normalizeVariantIdValue(candidate.variantId ?? null);
  const targetVariantId = normalizeVariantIdValue(target.variantId ?? null);

  if (candidateVariantId || targetVariantId) {
    return candidate.id === target.id && candidateVariantId === targetVariantId;
  }

  const candidateVariantKey = resolveVariantKey(candidate);
  const targetVariantKey = resolveVariantKey(target);

  if (candidateVariantKey || targetVariantKey) {
    return candidate.id === target.id && candidateVariantKey === targetVariantKey;
  }

  return candidate.id === target.id;
};

const isMediaForVariant = (
  item: MediaItem,
  variant: VariantSelection | null,
): boolean => {
  if (!variant) {
    return true;
  }

  if (variant.variantId) {
    return normalizeVariantIdValue(item.variantId ?? null) === variant.variantId;
  }

  return item.variantKey === variant.key;
};


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
  const [pendingMedia, setPendingMedia] = useState<Map<string, MediaItem>>(new Map());
  const normalizedVariants = useMemo(() => {
    const safeVariants: VariantGroup[] = Array.isArray(loaderVariants)
      ? loaderVariants
      : [];

    return safeVariants.map((variant, index) => {
      const label =
        typeof variant?.name === "string" && variant.name.trim()
          ? variant.name.trim()
          : `Variant ${index + 1}`;
      const media = Array.isArray(variant?.media) ? variant.media : [];
      const normalizedVariantId = normalizeVariantIdValue(
        media.find((item) => item.variantId)?.variantId ?? null,
      );
      const key = normalizedVariantId ?? `${label}-${index}`;
      const normalizedMedia = assignFallbackVariantToMedia(
        media.map((item) => ({
          ...item,
          alt: typeof item.alt === "string" ? item.alt : "",
          name: typeof item.name === "string" ? item.name : "",
          url: typeof item.url === "string" ? item.url : "",
          variantKey: key,
        })),
        normalizedVariantId,
      );

      return {
        key,
        label,
        variantId: normalizedVariantId,
        media: normalizedMedia,
      };
    });
  }, [loaderVariants]);
  const normalizedLoaderMedia = useMemo(
    () => normalizedVariants.flatMap((variant) => variant.media),
    [normalizedVariants],
  );
  const variantOptions: VariantSelection[] = useMemo(
    () =>
      normalizedVariants.map((variant) => ({
        key: variant.key,
        label: variant.label,
        variantId: variant.variantId ?? null,
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
  const variantKeyToIdMap = useMemo(() => {
    const entries = new Map<string, string | null>();
    variantOptions.forEach((variant) => {
      entries.set(variant.key, variant.variantId ?? null);
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
    const variantForItem = resolveVariantId(previewMedia, resolvedVariantId);
    const updatedItem: MediaItem = {
      ...previewMedia,
      grid: gridConfig,
      showGrid: showGridEnabled,
      etching: etchingEnabled,
      variantId: variantForItem,
      variantKey: previewMedia.variantKey ?? resolvedVariantKey ?? undefined,
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
  const activeVariantMedia = useMemo(() => {
    if (!selectedVariant) {
      return selectedMedia;
    }

    return selectedMedia.filter((item) => isMediaForVariant(item, selectedVariant));
  }, [selectedMedia, selectedVariant]);
  const selectedVariantLabel = selectedVariant?.label ?? null;
  const resolvedVariantId = selectedVariant?.variantId ?? null;
  const resolvedVariantKey = selectedVariant?.key ?? null;

  const pendingSelectionIds = useMemo(
    () => new Set(pendingMedia.keys()),
    [pendingMedia],
  );

  const selectedCount = activeVariantMedia.length;
  const isSavingSelection = metafieldFetcher.state !== "idle";

  const persistSelection = (items: MediaItem[]) => {
    if (!productId) return;
    const formData = new FormData();
    formData.append("productId", productId);
    const normalizedItems = items.map((item) => {
      const variantIdFromKey =
        typeof item.variantKey === "string"
          ? variantKeyToIdMap.get(item.variantKey) ?? null
          : null;
      const normalizedVariantId =
        normalizeVariantIdValue(item.variantId) ??
        normalizeVariantIdValue(variantIdFromKey) ??
        null;

      return {
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
        variantId: normalizedVariantId,
      };
    });
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
    const targetVariantId = resolvedVariantId;
    const targetVariantKey = resolvedVariantKey;
    const newItems = Array.from(pendingMedia.values()).map((item) => ({
      ...item,
      alt: typeof item.alt === "string" ? item.alt : "",
      name: typeof item.name === "string" ? item.name : "",
      url: typeof item.url === "string" ? item.url : "",
      variantId: targetVariantId ?? item.variantId,
      variantKey: targetVariantKey ?? item.variantKey,
    }));

    const existingIds = new Set(
      selectedMedia
        .filter((item) => isMediaForVariant(item, selectedVariant))
        .map((item) => item.id),
    );
    const dedupedItems = newItems.filter((item) => !existingIds.has(item.id));
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
    persistSelection(updated);
  };

  const errorMessage = metafieldFetcher.data?.error;
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
      <s-section heading="Variants">
        {variantOptions.length > 0 ? (
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
        ) : (
          <s-text color="subdued">No variants available for this product.</s-text>
        )}
      </s-section>

      <s-section heading={selectedVariantLabel ? `Media for ${selectedVariantLabel}` : "Media"}>
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
            <s-text tone="success">Saved {savedCount} media entr{savedCount === 1 ? "y" : "ies"} to the product.</s-text>
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
