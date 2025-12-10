import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  data,
  useFetcher,
  useLoaderData,
  useRouteError,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  PIXOBE_PRODUCT_SETTINGS_FIELD_KEY,
  PIXOBE_PRODUCT_SETTINGS_METAOBJECT_HANDLE,
  PIXOBE_PRODUCT_SETTINGS_METAOBJECT_TYPE,
} from "../constants/settings";

type FontEntry = {
  id: string;
  name: string;
  url: string;
};

type FontSummary = {
  name: string;
  url: string;
};

type SavedSettings = {
  snapAngle: string;
  customizationPrice: string;
  fonts: FontSummary[];
  gallery: GallerySummary[];
  supportInformation?: string;
};

const createFontEntry = (): FontEntry => ({
  id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
  name: "",
  url: "",
});

type GalleryMediaItem = {
  id: string;
  alt: string;
  url: string;
};

type GalleryEntry = {
  id: string;
  name: string;
  images: GalleryMediaItem[];
};

type GallerySummary = {
  name: string;
  images: { url: string }[];
};

const createGalleryEntry = (): GalleryEntry => ({
  id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
  name: "",
  images: [],
});

const SETTINGS_METAOBJECT_FETCH_SIZE = 1;

type SettingsLoaderData = {
  savedSettings: SavedSettings | null;
  metaobjectId: string | null;
};

type SettingsActionResponse = {
  settings?: SavedSettings;
  metaobjectId?: string;
  error?: string;
};

const createGalleryMediaItemFromUrl = (url: string): GalleryMediaItem => ({
  id: globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
  alt: "",
  url,
});

const toFontEntries = (fonts?: FontSummary[]): FontEntry[] => {
  if (!fonts || fonts.length === 0) {
    return [createFontEntry()];
  }

  return fonts.map((font) => ({
    ...createFontEntry(),
    name: font.name ?? "",
    url: font.url ?? "",
  }));
};

const toGalleryEntries = (galleries?: GallerySummary[]): GalleryEntry[] => {
  if (!galleries || galleries.length === 0) {
    return [createGalleryEntry()];
  }

  return galleries.map((gallery) => ({
    ...createGalleryEntry(),
    name: gallery.name ?? "",
    images: Array.isArray(gallery.images)
      ? gallery.images.map((image) =>
        createGalleryMediaItemFromUrl(image.url ?? "")
      )
      : [],
  }));
};

const parseSavedSettingsField = (value?: string | null): SavedSettings | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as SavedSettings)
      : null;
  } catch (error) {
    console.warn("Unable to parse Pixobe app settings", error);
    return null;
  }
};

const buildSettingsMetaobjectFields = (settings: SavedSettings) => [
  {
    key: PIXOBE_PRODUCT_SETTINGS_FIELD_KEY,
    value: JSON.stringify(settings),
  },
];

const createSettingsMetaobject = async (
  admin: any,
  settings: SavedSettings,
) => {
  const response = await admin.graphql(
    `#graphql
      mutation CreatePixobeProductSettings($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        metaobject: {
          type: PIXOBE_PRODUCT_SETTINGS_METAOBJECT_TYPE,
          handle: PIXOBE_PRODUCT_SETTINGS_METAOBJECT_HANDLE,
          fields: buildSettingsMetaobjectFields(settings),
        },
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.metaobjectCreate?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((error: any) => error.message).join(", "));
  }

  const createdId = body.data?.metaobjectCreate?.metaobject?.id;
  if (!createdId) {
    throw new Error("Missing metaobject id in create response");
  }

  return createdId as string;
};

const updateSettingsMetaobject = async (
  admin: any,
  id: string,
  settings: SavedSettings,
) => {
  const response = await admin.graphql(
    `#graphql
      mutation UpdatePixobeProductSettings(
        $id: ID!
        $metaobject: MetaobjectUpdateInput!
      ) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        id,
        metaobject: {
          fields: buildSettingsMetaobjectFields(settings),
        },
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.metaobjectUpdate?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((error: any) => error.message).join(", "));
  }

  const updatedId = body.data?.metaobjectUpdate?.metaobject?.id;
  if (!updatedId) {
    throw new Error("Missing metaobject id in update response");
  }

  return updatedId as string;
};

const parseRequestPayload = async (
  request: Request,
): Promise<{ settings: SavedSettings | null; metaobjectId: string | null }> => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const settings =
      body?.settings && typeof body.settings === "object"
        ? (body.settings as SavedSettings)
        : null;
    const metaobjectId =
      typeof body?.metaobjectId === "string" && body.metaobjectId.trim() !== ""
        ? body.metaobjectId
        : null;
    return { settings, metaobjectId };
  }

  const formData = await request.formData();
  const rawSettings = formData.get("settings");
  const metaobjectIdValue = formData.get("metaobjectId");
  let parsedSettings: SavedSettings | null = null;

  if (typeof rawSettings === "string") {
    try {
      const parsed = JSON.parse(rawSettings);
      parsedSettings =
        typeof parsed === "object" && parsed !== null
          ? (parsed as SavedSettings)
          : null;
    } catch (error) {
      console.warn("Unable to parse settings payload", error);
    }
  }

  const metaobjectId =
    typeof metaobjectIdValue === "string" && metaobjectIdValue.trim() !== ""
      ? metaobjectIdValue
      : null;

  return { settings: parsedSettings, metaobjectId };
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<SettingsLoaderData> => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
      query PixobeProductSettings(
        $type: String!
        $first: Int!
      ) {
        metaobjects(first: $first, type: $type) {
          nodes {
            id
            fields {
              key
              value
            }
          }
        }
      }
    `,
    {
      variables: {
        type: PIXOBE_PRODUCT_SETTINGS_METAOBJECT_TYPE,
        first: SETTINGS_METAOBJECT_FETCH_SIZE,
      },
    },
  );
  const body = await response.json();
  const nodes = body.data?.metaobjects?.nodes ?? [];
  const metaobject = Array.isArray(nodes) ? nodes[0] ?? null : null;
  const fields = Array.isArray(metaobject?.fields) ? metaobject?.fields : [];
  const configField = fields.find(
    (field: any) => field.key === PIXOBE_PRODUCT_SETTINGS_FIELD_KEY,
  );

  const savedSettings = parseSavedSettingsField(configField?.value ?? null);

  return {
    savedSettings,
    metaobjectId:
      typeof metaobject?.id === "string" ? metaobject.id : null,
  };
};

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<any> => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const { settings, metaobjectId } = await parseRequestPayload(request);

    if (!settings) {
      return data(
        { error: "Missing settings payload" },
        { status: 400 },
      );
    }

    const newMetaobjectId = metaobjectId
      ? await updateSettingsMetaobject(admin, metaobjectId, settings)
      : await createSettingsMetaobject(admin, settings);

    return data({
      settings,
      metaobjectId: newMetaobjectId,
    });
  } catch (error: any) {
    console.error("Failed to persist Pixobe app settings", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
};

export default function SettingsRoute() {
  const loaderData = useLoaderData<typeof loader>();
  const {
    savedSettings: loaderSavedSettings,
    metaobjectId: loaderMetaobjectId,
  } = loaderData;
  const settingsFetcher = useFetcher<SettingsActionResponse>();
  const [snapAngle, setSnapAngle] = useState(
    () => loaderSavedSettings?.snapAngle ?? "45",
  );
  const [customizationPrice, setCustomizationPrice] = useState(
    () => loaderSavedSettings?.customizationPrice ?? "0.00",
  );
  const [supportInformation, setSupportInformation] = useState(
    () => loaderSavedSettings?.supportInformation ?? "",
  );
  const [fonts, setFonts] = useState<FontEntry[]>(() =>
    toFontEntries(loaderSavedSettings?.fonts),
  );
  const mediaFetcher = useFetcher<{ media: GalleryMediaItem[] }>();
  const mediaModalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null);
  const [galleries, setGalleries] = useState<GalleryEntry[]>(() =>
    toGalleryEntries(loaderSavedSettings?.gallery),
  );
  const [activeGalleryId, setActiveGalleryId] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<Map<string, GalleryMediaItem>>(
    new Map(),
  );
  const [searchTerm, setSearchTerm] = useState("");

  const buildSanitizedSettings = (): SavedSettings => {
    const sanitizedFonts: FontSummary[] = fonts.map((font) => ({
      name: font.name.trim(),
      url: font.url.trim(),
    }));

    const sanitizedGalleries: GallerySummary[] = galleries.map((gallery) => ({
      name: gallery.name.trim(),
      images: gallery.images.map((item) => ({ url: item.url })),
    }));

    return {
      snapAngle,
      customizationPrice,
      fonts: sanitizedFonts,
      gallery: sanitizedGalleries,
      supportInformation: supportInformation.trim(),
    };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sanitizedSettings = buildSanitizedSettings();
    const formData = new FormData();
    formData.append("settings", JSON.stringify(sanitizedSettings));
    if (settingsMetaobjectId) {
      formData.append("metaobjectId", settingsMetaobjectId);
    }
    settingsFetcher.submit(formData, {
      method: "post",
      action: "/app/settings",
    });
  };

  const [savedSettings, setSavedSettings] = useState<SavedSettings | null>(
    loaderSavedSettings,
  );
  const [settingsMetaobjectId, setSettingsMetaobjectId] = useState<string | null>(
    loaderMetaobjectId ?? null,
  );
  const [showSavedBanner, setShowSavedBanner] = useState(false);

  useEffect(() => {
    if (settingsFetcher.state === "submitting") {
      setShowSavedBanner(false);
    }
  }, [settingsFetcher.state]);

  useEffect(() => {
    const response = settingsFetcher.data;
    const nextSettings = response?.settings;
    if (!nextSettings) {
      return;
    }

    setSavedSettings(nextSettings);
    if (response.metaobjectId) {
      setSettingsMetaobjectId(response.metaobjectId);
    }
    setSnapAngle(nextSettings.snapAngle);
    setCustomizationPrice(nextSettings.customizationPrice);
    setFonts(() => toFontEntries(nextSettings.fonts));
    setGalleries(() => toGalleryEntries(nextSettings.gallery));
    setSupportInformation(nextSettings.supportInformation ?? "");
    setShowSavedBanner(true);
  }, [settingsFetcher.data]);

  const isSavingSettings = settingsFetcher.state === "submitting";
  const settingsErrorMessage = settingsFetcher.data?.error ?? null;
  const handleFontFieldChange = (
    id: string,
    field: keyof Omit<FontEntry, "id">,
    value: string,
  ) => {
    setFonts((previous) =>
      previous.map((font) =>
        font.id === id ? { ...font, [field]: value } : font,
      ),
    );
  };

  const addFont = () => {
    setFonts((previous) => [...previous, createFontEntry()]);
  };

  const removeFont = (id: string) => {
    setFonts((previous) => previous.filter((font) => font.id !== id));
  };

  const pendingSelectionIds = useMemo(
    () => new Set(pendingMedia.keys()),
    [pendingMedia],
  );

  const handleGalleryFieldChange = (
    id: string,
    field: keyof Omit<GalleryEntry, "id" | "media">,
    value: string,
  ) => {
    setGalleries((previous) =>
      previous.map((gallery) =>
        gallery.id === id ? { ...gallery, [field]: value } : gallery,
      ),
    );
  };

  const addGallery = () => {
    setGalleries((previous) => [...previous, createGalleryEntry()]);
  };

  const removeGallery = (id: string) => {
    setGalleries((previous) => previous.filter((gallery) => gallery.id !== id));
  };

  const openGalleryMediaModal = (galleryId: string) => {
    if (!mediaFetcher.data && mediaFetcher.state === "idle") {
      mediaFetcher.load("/api/media");
    }
    setActiveGalleryId(galleryId);
    setSearchTerm("");
    setPendingMedia(new Map());
    mediaModalRef.current?.showOverlay?.();
  };

  const closeGalleryMediaModal = () => {
    mediaModalRef.current?.hideOverlay?.();
    setPendingMedia(new Map());
    setActiveGalleryId(null);
  };

  const togglePendingMediaSelection = (item: GalleryMediaItem) => {
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

  const addSelectedMediaToGallery = () => {
    if (!activeGalleryId || pendingMedia.size === 0) {
      return;
    }
    const selectedItems = Array.from(pendingMedia.values());
    setGalleries((previous) =>
      previous.map((gallery) => {
        if (gallery.id !== activeGalleryId) {
          return gallery;
        }
        const uniqueNewMedia = selectedItems.filter(
          (item) => !gallery.images.some((existing) => existing.id === item.id),
        );
        return {
          ...gallery,
          media: [...gallery.images, ...uniqueNewMedia],
        };
      }),
    );
    closeGalleryMediaModal();
  };

  const removeMediaFromGallery = (galleryId: string, mediaId: string) => {
    setGalleries((previous) =>
      previous.map((gallery) =>
        gallery.id === galleryId
          ? { ...gallery, media: gallery.images.filter((item) => item.id !== mediaId) }
          : gallery,
      ),
    );
  };

  const handleMediaSearchInput = (value: string) => {
    setSearchTerm(value);
    const trimmed = value.trim();
    mediaFetcher.load(`/api/media${trimmed ? `?query=${encodeURIComponent(trimmed)}` : ""}`);
  };

  const isAddMediaDisabled = pendingMedia.size === 0 || !activeGalleryId;

  return (
    <s-page heading="Settings">
      <form onSubmit={handleSubmit}>
        <s-stack direction="block" gap="base">
          <s-section heading="General">
            <s-text-field
              label="Snap Angle"
              name="snapAngle"
              value={snapAngle}
              onInput={(event) => setSnapAngle(event.currentTarget.value)}
            />
            <s-text-field
              label="Customization price"
              name="customizationPrice"
              value={customizationPrice}
              onInput={(event) => setCustomizationPrice(event.currentTarget.value)}
            />
          </s-section>
          <s-section heading="Customer Support Information">
            <s-text-area
              placeholder="Paste HTML content or text to be displayed to User for contact support"
              name="supportInformation"
              rows={3}
              value={supportInformation}
              onInput={(event: any) => setSupportInformation(event.currentTarget.value)}
            />
          </s-section>
          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" alignItems="center" justifyContent="space-between">
                <s-text type="strong">Fonts</s-text>
                <s-button
                  type="button"
                  icon="plus"
                  variant="secondary"
                  onClick={addFont}
                >
                  Add font
                </s-button>
              </s-stack>
              {fonts.length === 0 ? (
                <s-text tone="info">
                  Add one or more fonts to offer in the customization experience.
                </s-text>
              ) : (
                fonts.map((font, index) => (
                  <s-box
                    key={font.id}
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack direction="block" gap="small">
                      <s-stack
                        direction="inline"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <s-text type="strong">{`Font ${index + 1}`}</s-text>
                        <s-button
                          type="button"
                          variant="tertiary"
                          tone="critical"
                          icon="delete"
                          accessibilityLabel={`Remove font ${index + 1}`}
                          onClick={() => removeFont(font.id)}
                        >
                          Remove
                        </s-button>
                      </s-stack>
                      <s-stack direction="block" gap="small">
                        <s-text-field
                          label="Name"
                          placeholder="e.g. Inter"
                          value={font.name}
                          onInput={(event) =>
                            handleFontFieldChange(
                              font.id,
                              "name",
                              event.currentTarget.value,
                            )
                          }
                        />
                        <s-text-field
                          label="URL (optional)"
                          placeholder="https://fonts.googleapis.com/..."
                          value={font.url}
                          onInput={(event) =>
                            handleFontFieldChange(
                              font.id,
                              "url",
                              event.currentTarget.value,
                            )
                          }
                        />
                      </s-stack>
                    </s-stack>
                  </s-box>
                ))
              )}
            </s-stack>
          </s-section>

          <s-section>
            <s-stack direction="block" gap="base">
              <s-stack
                direction="inline"
                alignItems="center"
                justifyContent="space-between"
              >
                <s-text type="strong">Galleries</s-text>
                <s-button
                  type="button"
                  icon="plus"
                  variant="secondary"
                  onClick={addGallery}
                >
                  Add gallery
                </s-button>
              </s-stack>
              {galleries.length === 0 ? (
                <s-text tone="info">
                  Group related media by creating a gallery.
                </s-text>
              ) : (
                galleries.map((gallery, index) => (
                  <s-box
                    key={gallery.id}
                    border="base"
                    borderRadius="base"
                    padding="base"
                  >
                    <s-stack direction="block" gap="small">
                      <s-stack
                        direction="inline"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <s-text type="strong">{`Gallery ${index + 1}`}</s-text>
                        <s-button
                          type="button"
                          variant="tertiary"
                          tone="critical"
                          icon="delete"
                          accessibilityLabel={`Remove gallery ${index + 1}`}
                          onClick={() => removeGallery(gallery.id)}
                        >
                          Remove
                        </s-button>
                      </s-stack>
                      <s-stack direction="block" gap="small">
                        <s-text-field
                          label="Name"
                          placeholder="e.g. Seasonal textures"
                          value={gallery.name}
                          onInput={(event) =>
                            handleGalleryFieldChange(
                              gallery.id,
                              "name",
                              event.currentTarget.value,
                            )
                          }
                        />
                        <s-stack
                          direction="inline"
                          alignItems="center"
                          justifyContent="space-between"
                        >
                          <s-text tone="neutral">
                            {gallery.images.length > 0
                              ? `${gallery.images.length} image${gallery.images.length > 1 ? "s" : ""
                              } added`
                              : "No images added yet."}
                          </s-text>
                          <s-button
                            type="button"
                            icon="plus"
                            variant="secondary"
                            onClick={() => openGalleryMediaModal(gallery.id)}
                          >
                            Add images
                          </s-button>
                        </s-stack>
                        {gallery.images.length > 0 ? (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fill, minmax(120px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            {gallery.images.map((media) => (
                              <div style={{ position: 'relative' }}>
                                <s-box
                                  key={media.id}
                                  border="base"
                                  borderRadius="base"
                                  padding="base"
                                >
                                  <s-stack direction="block" gap="small" alignItems="center">
                                    <s-thumbnail
                                      alt={media.alt || "Gallery image"}
                                      size="large-100"
                                      src={media.url}
                                    />
                                    <s-box >
                                      <s-text tone="neutral" >
                                        {media.alt || "Untitled image"}
                                      </s-text>
                                    </s-box>
                                  </s-stack>
                                  <div style={{ position: "absolute", right: "-10px", top: "-10px" }} >
                                    <s-clickable
                                      accessibilityLabel="Remove image"
                                      onClick={() =>
                                        removeMediaFromGallery(gallery.id, media.id)
                                      }
                                    >
                                      <s-icon type="x-circle" color="subdued" />
                                    </s-clickable>
                                  </div>
                                </s-box>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <s-text tone="neutral">Add images to display them here.</s-text>
                        )}
                      </s-stack>
                    </s-stack>
                  </s-box>
                ))
              )}
            </s-stack>
          </s-section>
          {settingsErrorMessage ? (
            <s-banner tone="critical">{settingsErrorMessage}</s-banner>
          ) : null}
          {showSavedBanner && savedSettings ? (
            <s-banner tone="success">
              Settings saved
            </s-banner>
          ) : null}
          <s-button
            type="submit"
            variant="primary"
            disabled={isSavingSettings}
          >
            {isSavingSettings ? "Saving defaults…" : "Save defaults"}
          </s-button>
        </s-stack>
      </form>

      <s-modal
        ref={mediaModalRef}
        id="gallery-media-modal"
        heading="Select images for gallery"
        size="large-100"
      >
        <s-stack gap="base">
          <s-text>Select from your shop's media library.</s-text>
          <s-search-field
            label="Search media"
            labelAccessibilityVisibility="exclusive"
            placeholder="Type to filter items"
            value={searchTerm}
            onInput={(event: any) =>
              handleMediaSearchInput(event?.target?.value ?? "")
            }
          />
          {mediaFetcher.state === "loading" && <s-spinner />}
          {mediaFetcher.data && mediaFetcher.data.media.length === 0 && (
            <s-text tone="warning">No media found.</s-text>
          )}
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
                    padding="base"
                    borderRadius="base"
                    borderColor={isSelected ? "strong" : "base"}
                    background={isSelected ? "strong" : "base"}
                    onClick={() => togglePendingMediaSelection(item)}
                  >
                    <s-stack direction="block" gap="small" alignItems="center">
                      <s-thumbnail
                        alt={item.alt || "Media thumbnail"}
                        size="large-100"
                        src={item.url}
                      />
                      <s-text tone="neutral">
                        {item.alt || "Untitled image"}
                      </s-text>
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
          commandFor="gallery-media-modal"
          disabled={isAddMediaDisabled}
          onClick={addSelectedMediaToGallery}
        >
          Add images
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
