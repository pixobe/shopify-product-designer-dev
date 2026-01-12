const CUSTOMIZATION_PRODUCT_HANDLE = "pixobe-customization";
const CUSTOMIZATION_PRODUCT_TITLE = "Customization Price";
const CUSTOMIZATION_PRODUCT_TYPE = "Product Customization in Product Add ons";
const CUSTOMIZATION_PRODUCT_CATEGORY_ID = "gid://shopify/TaxonomyCategory/pa-4";
const CUSTOMIZATION_PRODUCT_DESCRIPTION = `
  Add-on product used by Pixobe Product Designer to collect customization charges when a customer customizes a product.
  Do not merchandise or publish this product. Keep the customization price in sync via Pixobe Product Designer settings.
`.trim();

const FIND_CUSTOMIZATION_PRODUCT_QUERY = `#graphql
  query FindCustomizationProduct($query: String!) {
    products(first: 1, query: $query) {
      nodes {
        id
        handle
        title
        variants(first: 1) {
          nodes {
            id
            price
            inventoryItem {
              requiresShipping
            }
          }
        }
      }
    }
  }
`;

const CREATE_CUSTOMIZATION_PRODUCT_MUTATION = `#graphql
  mutation CreateCustomizationProduct($product: ProductCreateInput!) {
    productCreate(product: $product) {
      product {
        id
        handle
        title
        variants(first: 1) {
          nodes {
            id
            price
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_CUSTOMIZATION_VARIANT_PRICE_MUTATION = `#graphql
  mutation UpdateCustomizationVariantPrice(
    $productId: ID!
    $variants: [ProductVariantsBulkInput!]!
  ) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants {
        id
        price
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_CUSTOMIZATION_PRODUCT_DETAILS_MUTATION = `#graphql
  mutation UpdateCustomizationProductDetails($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product {
        id
        handle
        title
        productType
        status
        descriptionHtml
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Normalize a price string/number to { amount, formatted }.
 */
export const normalizePrice = (
  value: unknown,
): { amount: number; formatted: string } => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : NaN;

  const amount = Number.isFinite(numericValue) ? Math.max(numericValue, 0) : 0;
  const formatted = amount.toFixed(2);

  return { amount, formatted };
};

const updateCustomizationVariantPrice = async (
  admin: any,
  productId: string,
  variantId: string,
  price: string,
) => {
  const response = await admin.graphql(
    UPDATE_CUSTOMIZATION_VARIANT_PRICE_MUTATION,
    {
      variables: {
        productId,
        variants: [
          {
            id: variantId,
            price,
            inventoryItem: {
              requiresShipping: false,
            },
          },
        ],
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.productVariantsBulkUpdate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }
};

const updateCustomizationProductDetails = async (
  admin: any,
  productId: string,
) => {
  const response = await admin.graphql(
    UPDATE_CUSTOMIZATION_PRODUCT_DETAILS_MUTATION,
    {
      variables: {
        product: {
          id: productId,
          productType: CUSTOMIZATION_PRODUCT_TYPE,
          category: CUSTOMIZATION_PRODUCT_CATEGORY_ID,
          descriptionHtml: CUSTOMIZATION_PRODUCT_DESCRIPTION,
          tags: ["pixobe"],
        },
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.productUpdate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }
};

export const ensureCustomizationProduct = async (admin: any, price: string) => {
  const lookupResponse = await admin.graphql(FIND_CUSTOMIZATION_PRODUCT_QUERY, {
    variables: {
      query: `handle:${CUSTOMIZATION_PRODUCT_HANDLE}`,
    },
  });
  const lookupBody = await lookupResponse.json();
  const existingProduct = lookupBody?.data?.products?.nodes?.[0] ?? null;
  const existingVariant = existingProduct?.variants?.nodes?.[0] ?? null;
  const requiresShipping = existingVariant?.inventoryItem?.requiresShipping;

  if (existingProduct?.id) {
    if (!existingVariant?.id) {
      throw new Error("Customization product exists but has no variants");
    }

    if (existingVariant.price !== price || requiresShipping !== false) {
      await updateCustomizationVariantPrice(
        admin,
        existingProduct.id,
        existingVariant.id,
        price,
      );
    }

    await updateCustomizationProductDetails(admin, existingProduct.id);
    return existingProduct.id as string;
  }

  const createResponse = await admin.graphql(
    CREATE_CUSTOMIZATION_PRODUCT_MUTATION,
    {
      variables: {
        product: {
          title: CUSTOMIZATION_PRODUCT_TITLE,
          handle: CUSTOMIZATION_PRODUCT_HANDLE,
          status: "ACTIVE",
          productType: CUSTOMIZATION_PRODUCT_TYPE,
          category: CUSTOMIZATION_PRODUCT_CATEGORY_ID,
          descriptionHtml: CUSTOMIZATION_PRODUCT_DESCRIPTION,
          tags: ["pixobe", "customization", "hidden"],
        },
      },
    },
  );

  const createBody = await createResponse.json();
  const creationErrors = createBody?.data?.productCreate?.userErrors ?? [];
  if (creationErrors.length) {
    throw new Error(creationErrors.map((e: any) => e.message).join(", "));
  }

  const productId = createBody?.data?.productCreate?.product?.id;
  const variantId =
    createBody?.data?.productCreate?.product?.variants?.nodes?.[0]?.id;

  if (!productId || !variantId) {
    throw new Error("Missing product or variant in creation response");
  }

  await updateCustomizationVariantPrice(admin, productId, variantId, price);
  await updateCustomizationProductDetails(admin, productId);
  return productId as string;
};
