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
