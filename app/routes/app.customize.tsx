import { useEffect, useMemo, useRef, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  PIXOBE_MEDIA_METAFIELD_KEY,
  PIXOBE_MEDIA_METAFIELD_NAMESPACE,
} from "../constants/customization";

const METAOBJECT_REFERENCES_PAGE_SIZE = 50;
const PRODUCT_VARIANTS_PAGE_SIZE = 100;

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
};

type MetaobjectField = {
  key: string;
  value?: string | null;
};

type VariantOption = {
  name: string;
  value: string;
};

type ProductVariant = {
  id: string;
  title: string;
  selectedOptions: VariantOption[];
};

const formatVariantLabel = (variant: ProductVariant): string => {
  const optionLabels = variant.selectedOptions
    .filter(
      (option) =>
        option.value && option.name && option.name.toLowerCase() !== "title",
    )
    .map((option) => option.value.trim())
    .filter(Boolean);

  if (optionLabels.length > 0) {
    return optionLabels.join(" / ");
  }

  return variant.title || "Variant";
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

const mediaEntriesMatch = (
  candidate: MediaItem,
  target: MediaItem,
  fallbackVariantId: string | null,
) => {
  if (candidate.metaobjectId && target.metaobjectId) {
    return candidate.metaobjectId === target.metaobjectId;
  }

  return (
    candidate.id === target.id &&
    resolveVariantId(candidate, fallbackVariantId) ===
    resolveVariantId(target, fallbackVariantId)
  );
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
  const name = typeof config.name === "string" ? config.name : "";
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
  const normalizedVariantId = normalizeVariantIdValue(
    typeof config.variantId === "string" ? config.variantId : null,
  );

  return {
    id: typeof rawId === "string" ? rawId : String(rawId),
    alt,
    name,
    url,
    grid,
    showGrid,
    etching,
    metaobjectId:
      typeof metaobject.id === "string" ? metaobject.id : undefined,
    variantId: normalizedVariantId ?? undefined,
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
  let variants: ProductVariant[] = [];

  if (productId) {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
        query ProductCustomization(
          $id: ID!
          $namespace: String!
          $key: String!
          $first: Int!
          $variantFirst: Int!
        ) {
          product(id: $id) {
            id
            title
            variants(first: $variantFirst) {
              nodes {
                id
                title
                selectedOptions {
                  name
                  value
                }
              }
            }
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
          variantFirst: PRODUCT_VARIANTS_PAGE_SIZE,
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

    const variantNodes =
      product?.variants?.nodes ??
      (Array.isArray(product?.variants?.edges)
        ? product.variants.edges
          .map((edge: any) => edge?.node)
          .filter(Boolean)
        : []);

    variants = variantNodes
      .map((variant: any) => {
        if (!variant || typeof variant.id !== "string") {
          return null;
        }

        const normalizedVariantId = normalizeVariantIdValue(variant.id);
        if (!normalizedVariantId) {
          return null;
        }

        const selectedOptions: VariantOption[] = Array.isArray(
          variant.selectedOptions,
        )
          ? variant.selectedOptions
            .map((option: any) => {
              if (
                option &&
                typeof option.name === "string" &&
                typeof option.value === "string"
              ) {
                return { name: option.name, value: option.value };
              }
              return null;
            })
            .filter(
              (
                option,
              ): option is VariantOption => Boolean(option && option.value),
            )
          : [];

        return {
          id: normalizedVariantId,
          title: typeof variant.title === "string" ? variant.title : "",
          selectedOptions,
        } as ProductVariant;
      })
      .filter((variant): variant is ProductVariant => Boolean(variant));

    const referenceNodes = product?.metafield?.references?.nodes ?? [];
    selectedMedia = extractMediaFromReferences(referenceNodes);
  }

  return data({
    productId,
    productName,
    selectedMedia,
    variants,
  });
};

export default function CustomizePage() {
  const loaderData = useLoaderData<typeof loader>();
  const {
    productId,
    productName,
    selectedMedia: loaderSelectedMedia,
    variants: loaderVariants = [],
  } = loaderData;
  const modalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const previewModalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const gridEditorRef = useRef<any>(null);
  const mediaFetcher = useFetcher<{ media: MediaItem[] }>();
  const metafieldFetcher = useFetcher<{ metaobjectIds?: string[]; error?: string }>();
  const [pendingMedia, setPendingMedia] = useState<Map<string, MediaItem>>(new Map());
  const defaultVariantId = normalizeVariantIdValue(loaderVariants[0]?.id ?? null);
  const normalizedLoaderMedia = useMemo(
    () => assignFallbackVariantToMedia(loaderSelectedMedia, defaultVariantId),
    [loaderSelectedMedia, defaultVariantId],
  );
  const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>(normalizedLoaderMedia);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    defaultVariantId,
  );
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showGridEnabled, setShowGridEnabled] = useState(true);
  const [etchingEnabled, setEtchingEnabled] = useState(false);

  useEffect(() => {
    setSelectedMedia(normalizedLoaderMedia);
  }, [normalizedLoaderMedia]);

  useEffect(() => {
    if (!loaderVariants.length) {
      setSelectedVariantId(null);
      return;
    }

    setSelectedVariantId((previous) => {
      if (previous && loaderVariants.some((variant) => variant.id === previous)) {
        return previous;
      }
      return loaderVariants[0]?.id ?? null;
    });
  }, [loaderVariants]);

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
    const variantForItem = resolveVariantId(
      previewMedia,
      resolvedVariantId,
    );
    const updatedItem: MediaItem = {
      ...previewMedia,
      grid: gridConfig,
      showGrid: showGridEnabled,
      etching: etchingEnabled,
      variantId: variantForItem,
    };

    const nextSelection = selectedMedia.map((item) =>
      mediaEntriesMatch(item, updatedItem, variantForItem)
        ? updatedItem
        : item,
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

  const hasVariants = loaderVariants.length > 0;
  const variantOptions = useMemo(
    () =>
      loaderVariants.map((variant) => ({
        id: variant.id,
        label: formatVariantLabel(variant),
      })),
    [loaderVariants],
  );
  const variantLabelMap = useMemo(() => {
    const entries = new Map<string, string>();
    variantOptions.forEach((variant) => {
      entries.set(variant.id, variant.label);
    });
    return entries;
  }, [variantOptions]);
  const activeVariantMedia = useMemo(() => {
    if (!selectedVariantId) {
      return selectedMedia;
    }

    return selectedMedia.filter((item) => {
      const itemVariantId = item.variantId ?? null;
      return itemVariantId === selectedVariantId;
    });
  }, [selectedMedia, selectedVariantId]);
  const selectedVariantLabel = selectedVariantId
    ? variantLabelMap.get(selectedVariantId) ?? null
    : null;
  const resolvedVariantId = normalizeVariantIdValue(
    selectedVariantId ?? defaultVariantId ?? null,
  );

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
      metaobjectId: item.metaobjectId,
      variantId: normalizeVariantIdValue(item.variantId) ?? null,
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
    const targetVariantId = resolvedVariantId;
    const newItems = Array.from(pendingMedia.values()).map((item) => ({
      ...item,
      variantId: targetVariantId,
    }));

    const existingIds = new Set(
      selectedMedia
        .filter(
          (item) => resolveVariantId(item, targetVariantId) === targetVariantId,
        )
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
      (entry) => !mediaEntriesMatch(entry, item, resolvedVariantId),
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
    (hasVariants && !selectedVariantId);

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
                const isActive = selectedVariantId === variant.id;
                return (
                  <label
                    key={variant.id}
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
                      value={variant.id}
                      checked={isActive}
                      onChange={() => setSelectedVariantId(variant.id)}
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
