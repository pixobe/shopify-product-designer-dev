import {
  METAOBJECT_REFERENCES_PAGE_SIZE,
  PIXOBE_MEDIA_METAOBJECT_TYPE,
  PIXOBE_MEDIA_METAFIELD_NAMESPACE,
  PRODUCT_VARIANTS_PAGE_SIZE,
} from "app/constants/customization";

const HANDLE_PREFIX = "pixobe-media";
const PIXOBE_VARIANT_MEDIA_METAFIELD_KEY = "pixobe_media_items";
const VARIANT_ID_PREFIX = "gid://shopify/ProductVariant/";
const METAOBJECT_ID_PREFIX = "gid://shopify/Metaobject/";
const NUMERIC_ID_REGEX = /^[0-9]+$/;

export const normalizeVariantId = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
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

export const normalizeMetaobjectId = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(METAOBJECT_ID_PREFIX)) {
    return trimmed;
  }

  if (NUMERIC_ID_REGEX.test(trimmed)) {
    return `${METAOBJECT_ID_PREFIX}${trimmed}`;
  }

  return trimmed;
};

type VariantContext = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  variantPrice: number | null;
};

const GET_VARIANT_CONTEXT_GRAPHQL = `#graphql
  query VariantContext($id: ID!) {
    productVariant(id: $id) {
      id
      title
      price
      product {
        id
        title
      }
    }
  }
`;

const GET_PRODUCT_MEDIA_META_OBJ_GRAPHQL = `#graphql
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
          }
        }
  `;

const VARIANT_METADATAOBJECT_QUERY = `#graphql
query GetVariantMetafield($variantId: ID!,$namespace: String!,$key: String!,$first: Int!) {
  productVariant(id: $variantId) {
    id
    title
    displayName
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
}`;

type VariantMedia = {
  id?: string;
  url?: string;
  alt?: string;
  grid?: unknown;
  showGrid?: boolean;
  etching?: boolean;
  metaobjectId?: string;
  variantId: string;
};

type MappedVariant = {
  name: string;
  id: string;
  media: VariantMedia[];
};

type MappedProduct = {
  productName: string;
  variants: MappedVariant[];
};

type MediaPayload = {
  id: string;
  alt?: string;
  name?: string;
  url?: string;
  grid?: Record<string, unknown> | null;
  showGrid?: boolean;
  etching?: boolean;
  metaobjectId?: string;
  variantId?: string | null;
};

const parsePriceAmount = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (value && typeof value === "object") {
    const amount = (value as { amount?: unknown }).amount;
    if (typeof amount === "number" && Number.isFinite(amount)) {
      return amount;
    }
    if (typeof amount === "string") {
      const parsed = Number.parseFloat(amount);
      return Number.isNaN(parsed) ? null : parsed;
    }
  }

  return null;
};

function safeJsonParse<T>(raw: unknown): T | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function mapProductVariantsToMedia(response: any): MappedProduct {
  const product = response?.data?.product;
  const productName: string = product?.title ?? "";

  const variants: any[] = product?.variants?.nodes ?? [];

  const mappedVariants: MappedVariant[] = variants.map((v) => {
    const name =
      v?.title ?? v?.selectedOptions?.[0]?.value ?? v?.id ?? "Unknown variant";

    const id = v.id;
    const metaNodes: any[] = v?.metafield?.references?.nodes ?? [];
    const media: VariantMedia[] = [];

    for (const node of metaNodes) {
      const fields: any[] = node?.fields ?? [];
      const configField = fields.find((f) => f?.key === "config");
      const cfg = safeJsonParse<VariantMedia>(configField?.value);
      if (!cfg) continue;

      media.push({
        ...cfg,
        metaobjectId: cfg.metaobjectId ?? node?.id,
        variantId: cfg.variantId ?? id,
      });
    }

    return {
      name,
      id,
      media,
    };
  });

  return { productName, variants: mappedVariants };
}

export function mapProductVariantMediaItems(response: any): {
  name: string;
  id: string;
  media: Array<any>;
} {
  const variant = response.data.productVariant;
  const nodes = variant.metafield?.references?.nodes || [];

  const media = nodes
    .map((node: any) => {
      const configField = node.fields?.find(
        (field: any) => field.key === "config",
      );
      if (configField?.value) {
        const config = JSON.parse(configField.value);
        return {
          id: config.id,
          url: config.url,
          alt: config.alt,
          grid: config.grid,
          showGrid: config.showGrid,
          etching: config.etching,
          variantId: config.variantId,
        };
      }
      return null;
    })
    .filter(Boolean);

  return {
    name: variant.displayName,
    id: variant.id,
    media,
  };
}

export async function getVariantContext(
  admin: any,
  variantId: string,
): Promise<VariantContext | null> {
  const response = await admin.graphql(GET_VARIANT_CONTEXT_GRAPHQL, {
    variables: { id: variantId },
  });
  const body = await response.json();
  const variant = body.data?.productVariant;

  if (!variant) {
    return null;
  }

  const product = variant.product;
  if (!product?.id) {
    return null;
  }

  return {
    productId: product.id,
    productName: product.title ?? "",
    variantId: variant.id ?? variantId,
    variantName: variant.title ?? "",
    variantPrice: parsePriceAmount(variant.price),
  };
}

/**
 *
 * @param admin
 * @param variantId not GID
 * @returns
 */
export async function getProductMedia(
  admin: any,
  variantId: string,
): Promise<any> {
  const variables = {
    id: variantId,
    namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
    key: PIXOBE_VARIANT_MEDIA_METAFIELD_KEY,
    first: METAOBJECT_REFERENCES_PAGE_SIZE,
    variantFirst: PRODUCT_VARIANTS_PAGE_SIZE,
  };
  const response = await admin.graphql(GET_PRODUCT_MEDIA_META_OBJ_GRAPHQL, {
    variables,
  });
  const mediaData = await response.json();
  return mapProductVariantsToMedia(mediaData);
}

/**
 *
 * @param admin
 * @param variantId not GID
 * @returns
 */
export async function getProductVariantMedia(
  admin: any,
  variant: string,
): Promise<any> {
  const variantId = `${VARIANT_ID_PREFIX}${variant}`;
  const variables = {
    variantId,
    namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
    key: PIXOBE_VARIANT_MEDIA_METAFIELD_KEY,
    first: METAOBJECT_REFERENCES_PAGE_SIZE,
  };
  const response = await admin.graphql(VARIANT_METADATAOBJECT_QUERY, {
    variables,
  });
  const mediaData = await response.json();
  return mapProductVariantMediaItems(mediaData);
}

const sanitizeHandleSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

const extractGidSegment = (gid?: string | null) => {
  if (!gid) return null;
  const parts = gid.split("/");
  return parts[parts.length - 1] || gid;
};

const buildMetaobjectHandle = (media: MediaPayload) => {
  const baseId =
    typeof media.id === "string"
      ? (extractGidSegment(media.id) ?? "media")
      : "media";
  const variantSegment =
    typeof media.variantId === "string" && media.variantId
      ? extractGidSegment(media.variantId) || "default"
      : "default";

  const normalized = sanitizeHandleSegment(`${baseId}-${variantSegment}`);
  const suffix = normalized || Math.random().toString(36).slice(2, 10);
  return `${HANDLE_PREFIX}-${suffix}`.slice(0, 255);
};

const GET_VARIANT_MEDIA_METAOBJECT_IDS = `#graphql
  query VariantMediaMetafield(
    $id: ID!
    $namespace: String!
    $key: String!
    $first: Int!
  ) {
    productVariant(id: $id) {
      metafield(namespace: $namespace, key: $key) {
        value
        references(first: $first) {
          nodes {
            __typename
            ... on Metaobject {
              id
            }
          }
        }
      }
    }
  }
`;

const fetchVariantMediaMetaobjectIds = async (
  admin: any,
  variantId: string,
): Promise<string[]> => {
  const response = await admin.graphql(GET_VARIANT_MEDIA_METAOBJECT_IDS, {
    variables: {
      id: variantId,
      namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
      key: PIXOBE_VARIANT_MEDIA_METAFIELD_KEY,
      first: METAOBJECT_REFERENCES_PAGE_SIZE,
    },
  });

  const body = await response.json();
  const metafield = body.data?.productVariant?.metafield;
  if (!metafield) return [];

  const parsedValue = safeJsonParse<string[]>(metafield.value);
  if (Array.isArray(parsedValue)) {
    return parsedValue.filter((id): id is string => typeof id === "string");
  }

  const nodes = metafield.references?.nodes ?? [];
  return nodes
    .map((node: any) => node?.id)
    .filter((id: any): id is string => typeof id === "string");
};

const createMetaobject = async (admin: any, media: MediaPayload) => {
  const response = await admin.graphql(
    `#graphql
      mutation CreatePixobeMediaEntry($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        metaobject: {
          type: PIXOBE_MEDIA_METAOBJECT_TYPE,
          handle: buildMetaobjectHandle(media),
          fields: [{ key: "config", value: JSON.stringify(media) }],
        },
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.metaobjectCreate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }

  const id = body.data?.metaobjectCreate?.metaobject?.id;
  if (!id) {
    throw new Error("Missing metaobject id in response");
  }
  return id as string;
};

const updateMetaobject = async (
  admin: any,
  id: string,
  media: MediaPayload,
) => {
  const response = await admin.graphql(
    `#graphql
      mutation UpdatePixobeMediaEntry(
        $id: ID!
        $metaobject: MetaobjectUpdateInput!
      ) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        id,
        metaobject: {
          handle: buildMetaobjectHandle(media),
          fields: [{ key: "config", value: JSON.stringify(media) }],
        },
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.metaobjectUpdate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }

  const updatedId = body.data?.metaobjectUpdate?.metaobject?.id;
  if (!updatedId) {
    throw new Error("Missing metaobject id in update response");
  }
  return updatedId as string;
};

const deleteMetaobject = async (admin: any, metaobjectId: string) => {
  const response = await admin.graphql(
    `#graphql
      mutation DeleteMetaobject($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        id: metaobjectId,
      },
    },
  );

  const body = await response.json();
  const userErrors = body.data?.metaobjectDelete?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map((error: { message: string }) => error.message).join(", "),
    );
  }
};

async function createProductMediaMetaField(
  admin: any,
  variantId: string,
  metaobjectIds: string[],
) {
  const response = await admin.graphql(
    `#graphql
      mutation SetPixobeMediaMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: variantId,
            namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
            key: PIXOBE_VARIANT_MEDIA_METAFIELD_KEY,
            type: "list.metaobject_reference",
            value: JSON.stringify(metaobjectIds),
          },
        ],
      },
    },
  );

  const jsonResponse = await response.json();
  const userErrors = jsonResponse.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map((error: { message: string }) => error.message).join(", "),
    );
  }
}

/**
 *
 * @param admin
 * @returns
 */
export async function addMediaToProductVariant(
  admin: any,
  variantId: string,
  config: MediaPayload,
): Promise<string[]> {
  const payload: MediaPayload = {
    ...config,
    variantId,
  };

  const trimmedMetaobjectId =
    typeof config.metaobjectId === "string" ? config.metaobjectId.trim() : "";

  const metaobjectId = trimmedMetaobjectId
    ? await updateMetaobject(admin, trimmedMetaobjectId, payload)
    : await createMetaobject(admin, payload);

  const existingIds = await fetchVariantMediaMetaobjectIds(admin, variantId);
  const nextIds = Array.from(
    new Set([...existingIds, metaobjectId].filter(Boolean)),
  );

  await createProductMediaMetaField(admin, variantId, nextIds);

  return nextIds;
}

export async function removeMediaFromProductVariant(
  admin: any,
  variantId: string,
  metaobjectId: string,
): Promise<string[]> {
  const existingIds = await fetchVariantMediaMetaobjectIds(admin, variantId);
  const nextIds = existingIds.filter((id) => id !== metaobjectId);

  if (nextIds.length !== existingIds.length) {
    await createProductMediaMetaField(admin, variantId, nextIds);
  }

  await deleteMetaobject(admin, metaobjectId);

  return nextIds;
}
