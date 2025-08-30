import { useEffect, useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  TextField,
  Icon,
  ResourceList,
  ResourceItem,
  Thumbnail,
  EmptyState,
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

interface Product {
  id: string;
  title: string;
  featuredImage: string | null;
}

interface ProductSearchResponse {
  success: boolean;
  result: Product[];
  searchQuery: string | null;
  hasMore: boolean;
  total: number;
  error?: string;
}

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const productSearchFetcher = useFetcher<ProductSearchResponse>();
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);

  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  const performProductSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Use the product search fetcher to call our API endpoint
    productSearchFetcher.load(`/api/product/search?q=${encodeURIComponent(query)}&limit=20`);
  }, [productSearchFetcher]);

  // Update search results when fetcher data changes
  useEffect(() => {
    if (productSearchFetcher.data) {
      if (productSearchFetcher.data.success) {
        setSearchResults(productSearchFetcher.data.result);
        if (productSearchFetcher.data.total === 0) {
          shopify.toast.show('No products found matching your search');
        }
      } else {
        setSearchResults([]);
        shopify.toast.show(productSearchFetcher.data.error || 'Search failed', { isError: true });
      }
    }
  }, [productSearchFetcher.data, shopify]);

  // Handle search with debounce
  const handleProductSearchChange = useCallback((value: string) => {
    setProductSearchTerm(value);

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const newTimeout = setTimeout(() => {
      performProductSearch(value);
    }, 500);

    setSearchTimeout(newTimeout);
  }, [searchTimeout, performProductSearch]);



  const handleProductSelect = (productId: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleEnableCustomization = () => {
    if (selectedProducts.length === 0) {
      shopify.toast.show('Please select at least one product', { isError: true });
      return;
    }
    shopify.toast.show(`Customization enabled for ${selectedProducts.length} product(s)`);
    // Here you would implement the actual customization enabling logic
  };


  const emptyStateMarkup =
    !searchResults.length && !searchResults.length ? (
      <EmptyState
        heading="Search a product to enable customization"
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <p>
          You can customize the product's customization options by selecting a product.
        </p>
      </EmptyState>
    ) : undefined;


  const promotedBulkActions = [
    {
      content: 'Enable',
      onAction: () => handleEnableCustomization,
    },
  ];
  return (
    <Page>
      <TitleBar title="Remix app template" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Get started with product designer
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This template serves as a starting point for building your embedded app.
                    It demonstrates key interface patterns such as an additional page in the app navigation
                    and examples of Admin GraphQL mutations, providing a solid foundation for your app development.
                  </Text>
                </BlockStack>
                <InlineStack gap="300">
                  <Button loading={isLoading} onClick={generateProduct}>
                    Enable App Embed
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Enable Product Designer
                  </Text>
                  <Text variant="bodyMd" as="p">
                    By default customization is not enabled for a product, search and enable customization for a product.
                  </Text>
                </BlockStack>
                <Card>
                  <BlockStack gap="300">
                    <ResourceList
                      resourceName={{ singular: 'product', plural: 'products' }}
                      items={searchResults}
                      selectedItems={selectedProducts}
                      selectable={true}
                      loading={productSearchFetcher.state === "loading"}
                      onSelectionChange={(selectedItems) => {
                        if (Array.isArray(selectedItems)) {
                          setSelectedProducts(selectedItems);
                        }
                      }}

                      promotedBulkActions={promotedBulkActions}

                      emptyState={emptyStateMarkup}


                      filterControl={
                        <TextField
                          label=""
                          value={productSearchTerm}
                          onChange={handleProductSearchChange}
                          placeholder="Search products by name..."
                          autoComplete="off"
                          prefix={<Icon source={SearchIcon} tone="base" />}
                          clearButton
                          onClearButtonClick={() => handleProductSearchChange("")}
                        />
                      }

                      renderItem={(product) => {
                        const { id, title, featuredImage } = product;
                        const productId = id.replace('gid://shopify/Product/', '');
                        const shortcutActions = [{ content: 'View latest order', url: `product/${productId}` }]

                        return (
                          <ResourceItem
                            id={id}
                            onClick={() => handleProductSelect(id)}
                            shortcutActions={shortcutActions}
                            media={
                              <Thumbnail
                                source={featuredImage || ''}
                                alt={title}
                                size="medium"
                              />
                            }
                          >
                            <Text variant="bodyMd" as="h3">
                              {title}
                            </Text>
                            <Text variant="bodySm" as="p" tone="subdued">
                              Product ID: {productId}
                            </Text>
                          </ResourceItem>
                        );
                      }}
                    />
                  </BlockStack>
                </Card>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
