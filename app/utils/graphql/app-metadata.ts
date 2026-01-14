type MetafieldCacheEntry = {
  value: unknown;
  expiresAt: number;
};

const APP_METAFIELD_CACHE = new Map<string, MetafieldCacheEntry>();
const DEFAULT_METAFIELD_CACHE_TTL_MS = 5 * 60 * 1000;

const cacheKeyFor = (shop: string | undefined, key: string) =>
  shop ? `${shop}:${key}` : null;

const readMetafieldCache = (cacheKey: string | null) => {
  if (!cacheKey) return null;

  const cached = APP_METAFIELD_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (cached) {
    APP_METAFIELD_CACHE.delete(cacheKey);
  }

  return null;
};

const writeMetafieldCache = (
  cacheKey: string | null,
  value: unknown,
  ttlMs: number,
) => {
  if (!cacheKey) return;
  APP_METAFIELD_CACHE.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

export const clearAppMetafieldCache = (
  shop: string | undefined,
  key: string,
) => {
  const cacheKey = cacheKeyFor(shop, key);
  if (!cacheKey) return;
  APP_METAFIELD_CACHE.delete(cacheKey);
};

// Helper function to set app metafield data
export async function setAppMetafield(
  admin: any,
  metafieldKey: string,
  metafieldData: any,
  options?: { shop?: string },
) {
  try {
    // Get current app installation ID
    const appIdQuery = `
      query {
        currentAppInstallation {
          id
        }
      }
    `;

    const appIdResponse = await admin.graphql(appIdQuery);
    const appIdData = await appIdResponse.json();

    if (!appIdData.data?.currentAppInstallation?.id) {
      return {
        success: false,
        message: "Failed to retrieve app installation ID",
      };
    }

    const ownerId = appIdData.data.currentAppInstallation.id;

    // Create metafield with the provided data
    const metafieldMutation = `
      mutation CreateAppDataMetafield($metafieldsSetInput: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafieldsSetInput) {
          metafields {
            id
            namespace
            key
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      metafieldsSetInput: [
        {
          namespace: "app_config",
          key: metafieldKey,
          type: "json",
          value: JSON.stringify(metafieldData),
          ownerId: ownerId,
        },
      ],
    };

    const metafieldResponse = await admin.graphql(metafieldMutation, {
      variables,
    });
    const metafieldResult = await metafieldResponse.json();

    if (metafieldResult.data?.metafieldsSet?.userErrors?.length > 0) {
      return {
        success: false,
        message: metafieldResult.data.metafieldsSet.userErrors[0].message,
      };
    }

    return {
        success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "An unexpected error occurred",
    };
  } finally {
    clearAppMetafieldCache(options?.shop ?? (admin as any)?.session?.shop, metafieldKey);
  }
}

// Helper function to get app metafield data
export async function getAppMetafield(
  admin: any,
  meta_key?: string,
  options?: {
    shop?: string;
    ttlMs?: number;
    bypassCache?: boolean;
  },
): Promise<unknown | null> {
  if (!meta_key) {
    return null;
  }

  const shop = options?.shop ?? (admin as any)?.session?.shop;
  const cacheKey = options?.bypassCache
    ? null
    : cacheKeyFor(shop, meta_key);
  const ttlMs = options?.ttlMs ?? DEFAULT_METAFIELD_CACHE_TTL_MS;

  const cachedValue = readMetafieldCache(cacheKey);
  if (cachedValue !== null) {
    return cachedValue;
  }

  try {
    // Get current app installation with metafield
    const query = `
      query {
        currentAppInstallation {
          id
          metafield(namespace: "app_config", key: "${meta_key}") {
            value
          }
        }
      }
    `;

    const response = await admin.graphql(query);
    const data = await response.json();
    if (!data.data?.currentAppInstallation?.metafield?.value) {
      return null;
    }

    const metafieldValue = JSON.parse(
      data.data.currentAppInstallation.metafield.value,
    );

    if (shop) {
      writeMetafieldCache(cacheKey, metafieldValue, ttlMs);
    }

    return metafieldValue;
  } catch (error) {
    console.error("Error retrieving app metafield:", error);
    return null;
  }
}
