import { type LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { PIXOBE_PRODUCT_SETTINGS_METAOBJECT_TYPE } from "../constants/settings";
import {
  PIXOBE_MEDIA_METAFIELD_KEY,
  PIXOBE_MEDIA_METAFIELD_NAMESPACE,
} from "../constants/customization";

const DESIGN_SETTINGS_FETCH_SIZE = 1;
const METAOBJECT_REFERENCE_FETCH_SIZE = 50;
const PRODUCT_ID_PREFIX = "gid://shopify/Product/";
const VARIANT_ID_PREFIX = "gid://shopify/ProductVariant/";

const looksLikeProductId = (value: string) =>
  value.startsWith(PRODUCT_ID_PREFIX) || /^[0-9]+$/.test(value);

const normalizeProductId = (value: string) =>
  value.startsWith(PRODUCT_ID_PREFIX) ? value : `${PRODUCT_ID_PREFIX}${value}`;

const looksLikeVariantId = (value: string) =>
  value.startsWith(VARIANT_ID_PREFIX) || /^[0-9]+$/.test(value);

const normalizeVariantId = (value: string) =>
  value.startsWith(VARIANT_ID_PREFIX) ? value : `${VARIANT_ID_PREFIX}${value}`;

const normalizeVariantIdLoose = (
  value: string | number | null | undefined,
): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeVariantId(String(Math.trunc(value)));
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (looksLikeVariantId(trimmed)) {
    return normalizeVariantId(trimmed);
  }

  return trimmed;
};

const variantComparisonKey = (
  value: string | number | null | undefined,
): string | null => {
  const normalized = normalizeVariantIdLoose(value);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith(VARIANT_ID_PREFIX)) {
    return normalized.slice(VARIANT_ID_PREFIX.length);
  }

  return normalized;
};

const parseMetaobjectFields = (
  fields: unknown,
): Array<{ key: string; value: string | null }> => {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields
    .map((field) => {
      if (!field || typeof field !== "object") {
        return null;
      }

      const key = typeof (field as any).key === "string" ? field.key : "";
      if (!key) {
        return null;
      }

      const rawValue = (field as any).value;
      return {
        key,
        value:
          typeof rawValue === "string"
            ? rawValue
            : rawValue === undefined
              ? null
              : String(rawValue),
      };
    })
    .filter((field): field is { key: string; value: string | null } =>
      Boolean(field),
    );
};

const parseReferenceNodes = (
  nodes: unknown,
): Array<{
  __typename: string | null;
  id: string | null;
  fields: Array<{ key: string; value: string | null }>;
}> => {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .filter((node): node is Record<string, unknown> =>
      Boolean(node && typeof node === "object"),
    )
    .map((node) => ({
      __typename: typeof node.__typename === "string" ? node.__typename : null,
      id: typeof node.id === "string" ? node.id : null,
      fields: parseMetaobjectFields(node.fields),
    }));
};

const fetchSettingsMetaobject = async (admin: any) => {
  const response = await admin.graphql(
    `#graphql
      query DesignSettingsMetaobject(
        $type: String!
        $first: Int!
      ) {
        metaobjects(first: $first, type: $type) {
          nodes {
            id
            handle
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
        first: DESIGN_SETTINGS_FETCH_SIZE,
      },
    },
  );

  const body = await response.json();
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    console.error(
      "Unable to load Pixobe design settings metaobject",
      body.errors,
    );
  }

  const nodes = body.data?.metaobjects?.nodes ?? [];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  const metaobject = nodes[0];
  const fields = parseMetaobjectFields(metaobject?.fields);

  const configField = fields?.find(
    (field: { key: string; value: any }) => field.key === "config",
  );

  if (!configField) {
    console.warn("Pixobe design settings metaobject missing config field");
    return {};
  }

  const configValue = configField.value || "";

  try {
    return configValue ? JSON.parse(configValue) : {};
  } catch (error) {
    console.error("Unable to parse Pixobe design config", error);
    return {};
  }
};

const fetchProductMetafield = async (
  admin: any,
  productId: string,
  variantId?: string | null,
) => {
  console.log("Variant ID :::", variantId, "productD:::", productId);
  const response = await admin.graphql(
    `#graphql
      query DesignConfigProduct(
        $id: ID!
        $namespace: String!
        $key: String!
        $first: Int!
      ) {
        product(id: $id) {
          id
          title
          metafield(namespace: $namespace, key: $key) {
            id
            namespace
            key
            type
            value
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
        first: METAOBJECT_REFERENCE_FETCH_SIZE,
      },
    },
  );

  const body = await response.json();
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    console.error("Unable to load Pixobe product metafield", body.errors);
  }

  const product = body.data?.product;
  if (!product || typeof product.id !== "string") {
    return null;
  }

  const metafield = product.metafield;
  const metafields =
    metafield && typeof metafield === "object"
      ? [
          {
            id: typeof metafield.id === "string" ? metafield.id : null,
            ownerId: product.id,
            namespace:
              typeof metafield.namespace === "string"
                ? metafield.namespace
                : PIXOBE_MEDIA_METAFIELD_NAMESPACE,
            key:
              typeof metafield.key === "string"
                ? metafield.key
                : PIXOBE_MEDIA_METAFIELD_KEY,
            type: typeof metafield.type === "string" ? metafield.type : null,
            value:
              typeof metafield.value === "string"
                ? metafield.value
                : metafield.value === null
                  ? null
                  : String(metafield.value),
            references: parseReferenceNodes(metafield.references?.nodes),
          },
        ]
      : [];

  const pixobeMetaField = metafields.find(
    (meta) => meta.key === PIXOBE_MEDIA_METAFIELD_KEY,
  );

  if (!pixobeMetaField) {
    console.warn("Pixobe media configuration metafield missing for product");
    return [];
  }

  const references = pixobeMetaField.references;

  if (!references || references.length === 0) {
    console.warn("No Pixobe media references found for product");
    return [];
  }

  const parsedFields = references
    .map((reference) => {
      const configField = reference.fields.find(
        (field) => field.key === "config",
      );
      const value = configField?.value;

      if (!value) {
        return null;
      }

      try {
        return JSON.parse(value);
      } catch (error) {
        console.error("Unable to parse Pixobe media config", error);
        return null;
      }
    })
    .filter(Boolean);

  const normalizedEntries = parsedFields.map((entry: any) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }

    const normalizedVariantId = normalizeVariantIdLoose(
      (entry as any).variantId ?? null,
    );

    const rawVariantId = (entry as any).variantId;
    const comparableVariantId =
      typeof rawVariantId === "number"
        ? String(Math.trunc(rawVariantId))
        : rawVariantId;

    if (!normalizedVariantId && !comparableVariantId) {
      return entry;
    }

    if (normalizedVariantId && normalizedVariantId === comparableVariantId) {
      return entry;
    }

    return {
      ...entry,
      variantId: normalizedVariantId ?? undefined,
    };
  });

  if (!variantId) {
    return normalizedEntries;
  }

  const targetVariantKey = variantComparisonKey(variantId);
  if (!targetVariantKey) {
    return normalizedEntries;
  }

  return normalizedEntries.filter((entry: any) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const entryKey = variantComparisonKey((entry as any).variantId ?? null);
    return entryKey === targetVariantKey;
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json(
      { message: "Shop ID missing", success: false },
      { status: 400 },
    );
  }

  const { admin } = await authenticate.public.appProxy(request);

  const rawProductId = url.searchParams.get("productId")?.trim();
  const productId =
    rawProductId && looksLikeProductId(rawProductId)
      ? normalizeProductId(rawProductId)
      : null;

  const rawVariantId = url.searchParams.get("variantId")?.trim();
  const variantId =
    rawVariantId && looksLikeVariantId(rawVariantId)
      ? normalizeVariantId(rawVariantId)
      : null;

  const config = await fetchSettingsMetaobject(admin);
  const media = productId
    ? await fetchProductMetafield(admin, productId, variantId)
    : [];

  return {
    config: config ?? {},
    media: media ?? [],
  };
};
