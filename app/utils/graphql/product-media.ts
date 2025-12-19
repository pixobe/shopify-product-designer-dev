import {
  METAOBJECT_REFERENCES_PAGE_SIZE,
  PIXOBE_MEDIA_METAOBJECT_TYPE,
  PIXOBE_MEDIA_METAFIELD_KEY,
  PIXOBE_MEDIA_METAFIELD_NAMESPACE,
  PRODUCT_VARIANTS_PAGE_SIZE,
} from "app/constants/customization";
import {
  DESIGN_SETTINGS_FETCH_SIZE,
  PIXOBE_PRODUCT_SETTINGS_METAOBJECT_TYPE,
} from "app/constants/settings";

const HANDLE_PREFIX = "pixobe-media";

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
  `;

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
  const metaNodes: any[] = product?.metafield?.references?.nodes ?? [];

  // Build variantId -> media[] lookup from metaobject config JSON
  const mediaByVariantId = new Map<string, VariantMedia[]>();

  for (const node of metaNodes) {
    const fields: any[] = node?.fields ?? [];
    const configField = fields.find((f) => f?.key === "config");
    const cfg = safeJsonParse<VariantMedia>(configField?.value);

    const variantId = cfg?.variantId;
    if (!variantId) continue;

    const arr = mediaByVariantId.get(variantId) ?? [];
    arr.push({
      ...cfg,
      metaobjectId: cfg.metaobjectId ?? node?.id, // fallback if not in JSON
      variantId,
    });
    mediaByVariantId.set(variantId, arr);
  }

  const mappedVariants: MappedVariant[] = variants.map((v) => {
    const name =
      v?.title ?? v?.selectedOptions?.[0]?.value ?? v?.id ?? "Unknown variant";

    const id = v.id;
    return {
      name,
      id,
      media: mediaByVariantId.get(v?.id) ?? [],
    };
  });

  return { productName, variants: mappedVariants };
}

/**
 *
 * @param admin
 * @returns
 */
export async function getProductMedia(
  admin: any,
  productId: string,
): Promise<any> {
  const variables = {
    id: productId,
    namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
    key: PIXOBE_MEDIA_METAFIELD_KEY,
    first: METAOBJECT_REFERENCES_PAGE_SIZE,
    variantFirst: PRODUCT_VARIANTS_PAGE_SIZE,
  };
  const response = await admin.graphql(GET_PRODUCT_MEDIA_META_OBJ_GRAPHQL, {
    variables,
  });
  const mediaData = await response.json();
  return mapProductVariantsToMedia(mediaData);
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

async function createProductMediaMetaField(
  admin: any,
  productId: string,
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
            ownerId: productId,
            namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
            key: PIXOBE_MEDIA_METAFIELD_KEY,
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
export async function addProductMedia(
  admin: any,
  productId: string,
  media: MediaPayload[],
): Promise<string[]> {
  const items = Array.isArray(media) ? media : [];
  const metaobjectIds: string[] = [];

  for (const item of items) {
    const metaobjectId = item.metaobjectId
      ? await updateMetaobject(admin, item.metaobjectId, item)
      : await createMetaobject(admin, item);
    metaobjectIds.push(metaobjectId);
  }

  await createProductMediaMetaField(admin, productId, metaobjectIds);

  return metaobjectIds;
}
