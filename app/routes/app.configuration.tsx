import {
  Card,
  Layout,
  Page,
  Text,
  BlockStack,
  Tabs,
  TextField,
  Button,
  FormLayout,
  InlineStack,
  ResourceList,
  ResourceItem,
  ButtonGroup,
  EmptyState,
  Thumbnail,
  Banner,
  InlineGrid,
  Box,
  Icon,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { PlusIcon, ImageAddIcon, XIcon, ChevronDownIcon, ChevronUpIcon } from '@shopify/polaris-icons';
import { ImageSelectionModal, type SelectedImageData } from "../components/ImageModal";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";


interface Font {
  id: string;
  name: string;
  url: string;
}

interface ImageFile {
  id: string;
  name: string;
  url: string;
}

interface Gallery {
  id: string;
  name: string;
  images: ImageFile[];
}

interface ShopifyFilesResponse {
  success: boolean;
  files: any[];
  error?: string;
}

interface ConfigurationData {
  fonts: Font[];
  galleries: Gallery[];
}

interface LoaderData {
  success: boolean;
  configuration: ConfigurationData;
  metafieldId: string | null;
}

// Loader function to get saved configuration
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Get the shop with the configuration metafield
    const shopResponse = await admin.graphql(`
      query getConfiguration {
        shop {
          id
          metafield(namespace: "$app", key: "pixobe-app-config") {
            id
            value
            jsonValue
          }
        }
      }
    `);

    const shopData = await shopResponse.json();
    const metafield = shopData.data?.shop?.metafield;

    if (metafield) {
      // Parse the configuration data
      const configData = metafield.jsonValue || JSON.parse(metafield.value);

      return ({
        success: true,
        configuration: configData,
        metafieldId: metafield.id
      });
    } else {
      // No configuration found, return default config
      return ({
        success: true,
        configuration: {
          fonts: [
            { id: '1', name: 'Arial', url: '' },
            { id: '2', name: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto' },
          ],
          galleries: []
        },
        metafieldId: null
      });
    }

  } catch (error) {
    console.error("Error loading configuration:", error);
    return ({
      success: false,
      configuration: {
        fonts: [
          { id: '1', name: 'Arial', url: '' },
          { id: '2', name: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto' },
        ],
        galleries: []
      },
      metafieldId: null
    });
  }
};


export default function ConfigurationPage() {
  const { configuration } = useLoaderData<LoaderData>();
  const [selectedTab, setSelectedTab] = useState(0);
  const fetcher = useFetcher<ShopifyFilesResponse>();

  // Modal state for Shopify media selection
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);

  // Initialize state with loaded configuration
  const [fonts, setFonts] = useState<Font[]>(configuration.fonts);
  const [galleries, setGalleries] = useState<Gallery[]>(configuration.galleries);

  const [newFont, setNewFont] = useState({ name: '', url: '' });
  const [editingFont, setEditingFont] = useState<Font | null>(null);
  const [newGalleryName, setNewGalleryName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedGalleries, setExpandedGalleries] = useState<Set<string>>(new Set());

  const tabs = [
    {
      id: 'text',
      content: 'Fonts',
      accessibilityLabel: 'Fonts Settings',
      panelID: 'fonts-settings',
    },
    {
      id: 'image',
      content: 'Gallery',
      accessibilityLabel: 'Gallery Settings',
      panelID: 'gallery-settings',
    },
  ];

  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
  };

  const handleAddFont = () => {
    if (newFont.name.trim()) {
      const font: Font = {
        id: Date.now().toString(),
        name: newFont.name.trim(),
        url: newFont.url.trim(),
      };
      setFonts(prev => [...prev, font]);
      setNewFont({ name: '', url: '' });
    }
  };

  const handleEditFont = (font: Font) => {
    setEditingFont(font);
    setNewFont({ name: font.name, url: font.url });
  };

  const handleUpdateFont = () => {
    if (editingFont && newFont.name.trim()) {
      setFonts(prev => prev.map(font =>
        font.id === editingFont.id
          ? { ...font, name: newFont.name.trim(), url: newFont.url.trim() }
          : font
      ));
      setEditingFont(null);
      setNewFont({ name: '', url: '' });
    }
  };

  const handleDeleteFont = (fontId: string) => {
    setFonts(prev => prev.filter(font => font.id !== fontId));
  };

  const handleCancelEdit = () => {
    setEditingFont(null);
    setNewFont({ name: '', url: '' });
  };

  // Save configuration function
  const handleSaveConfiguration = async () => {
    setIsLoading(true);

    const configurationData = {
      fonts,
      galleries
    };

    try {
      const response = await fetch('/api/save-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configurationData)
      });

      const result = await response.json();

      if (result.success) {
        console.log('Configuration saved successfully');
        // You could add a success toast here if needed
      } else {
        console.error('Failed to save configuration:', result.error);
        // You could add an error toast here if needed
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Effect to handle loading state when fetcher data arrives
  useEffect(() => {
    if (fetcher.data) {
      console.log('Fetcher data received:', fetcher.data);
      if (isLoadingMedia) {
        setIsLoadingMedia(false);
        setIsMediaModalOpen(true);
      }
    }
  }, [fetcher.data, isLoadingMedia]);

  // Gallery management functions
  const handleShopifyGallerySelect = (galleryId: string) => {
    setSelectedGalleryId(galleryId);
    setIsMediaModalOpen(true);
  }

  const handleCreateGallery = () => {
    // Only create gallery if name is provided and not empty
    if (!newGalleryName.trim()) {
      return;
    }

    const gallery: Gallery = {
      id: Date.now().toString(),
      name: newGalleryName.trim(),
      images: []
    };
    setGalleries(prev => [gallery, ...prev]);
    setNewGalleryName('');
  };

  const handleDeleteGallery = (galleryId: string) => {
    setGalleries(prev => prev.filter(gallery => gallery.id !== galleryId));
  };

  const handleDeleteImage = useCallback((galleryId: string, imageId: string) => {
    setGalleries(prev => prev.map(gallery =>
      gallery.id === galleryId
        ? { ...gallery, images: gallery.images.filter(img => img.id !== imageId) }
        : gallery
    ));
  }, []);

  // Gallery expansion functions
  const toggleGalleryExpansion = useCallback((galleryId: string) => {
    setExpandedGalleries(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(galleryId)) {
        newExpanded.delete(galleryId);
      } else {
        newExpanded.add(galleryId);
      }
      return newExpanded;
    });
  }, []);

  const isGalleryExpanded = useCallback((galleryId: string) => {
    return expandedGalleries.has(galleryId);
  }, [expandedGalleries]);

  // Handle adding images from modal to selected gallery
  const handleAddImages = useCallback((selectedImages: SelectedImageData[]) => {

    if (selectedGalleryId && selectedImages.length > 0) {
      // Convert SelectedImageData to ImageFile format
      const imageFiles: ImageFile[] = selectedImages.map(img => ({
        id: img.id,
        name: img.name,
        url: img.url
      }));


      setGalleries(prev => {
        const updatedGalleries = prev.map(gallery => {
          if (gallery.id === selectedGalleryId) {
            // Get existing image IDs for faster lookup
            const existingImageIds = new Set(gallery.images.map(img => img.id));
            // Filter out duplicates
            const newImages = imageFiles.filter(newImg => !existingImageIds.has(newImg.id));
            return {
              ...gallery,
              images: [...gallery.images, ...newImages]
            };
          }
          return gallery;
        });

        return updatedGalleries;
      });

      setSelectedGalleryId(null);
    } else {
      console.log('No gallery selected or no images to add');
    }
  }, [selectedGalleryId]);


  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return (
          <BlockStack gap="400">
            <FormLayout>
              <Banner tone="info">
                Configured fonts are available for users to apply when adding text in the product designer.
              </Banner>

              <BlockStack gap="300">
                <Box
                  background={editingFont ? "bg-fill-tertiary" : "bg-fill-transparent-active"}
                  shadow={editingFont ? "200" : "0"}
                  padding={"400"} borderRadius="200">
                  <BlockStack gap="300">
                    <TextField
                      label="Font Name"
                      value={newFont.name}
                      onChange={(value) => setNewFont(prev => ({ ...prev, name: value }))}
                      placeholder="Enter font name"
                      autoComplete="off"
                    />
                    <TextField
                      label="Font URL (Optional)"
                      value={newFont.url}
                      onChange={(value) => setNewFont(prev => ({ ...prev, url: value }))}
                      placeholder="https://fonts.googleapis.com/css2?family=FontName (leave empty for system font)"
                      autoComplete="url"
                      helpText="Optional: Provide a URL to load custom fonts, or leave empty to use system default fonts"
                    />
                  </BlockStack>
                </Box>
                <InlineStack gap="200" align="end">
                  {editingFont ? (
                    <ButtonGroup>
                      <Button onClick={handleCancelEdit} variant="tertiary" >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleUpdateFont}
                        variant="secondary"
                        disabled={!newFont.name.trim()}
                      >
                        Update Font
                      </Button>
                    </ButtonGroup>
                  ) : (
                    <Button
                      onClick={handleAddFont}
                      variant="secondary"
                      icon={PlusIcon}
                      disabled={!newFont.name.trim()}
                    >
                      Add Font
                    </Button>
                  )}
                </InlineStack>
              </BlockStack>

              <Text as="h3" variant="headingSm">
                Added Fonts
              </Text>

              <ResourceList
                resourceName={{ singular: 'font', plural: 'fonts' }}
                items={fonts}
                renderItem={(item) => {
                  const { id, name, url } = item;
                  return (
                    <ResourceItem
                      id={id}
                      accessibilityLabel={`Font ${name}`}
                      onClick={() => { }}
                    >
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <BlockStack gap="100">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {name}
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {url || 'System default font'}
                            </Text>
                          </BlockStack>
                          <ButtonGroup>
                            <Button
                              size="slim"
                              onClick={() => handleEditFont(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="slim"
                              variant="tertiary"
                              tone="critical"
                              onClick={() => handleDeleteFont(id)}
                            >
                              Delete
                            </Button>
                          </ButtonGroup>
                        </InlineStack>
                      </BlockStack>
                    </ResourceItem>
                  );
                }}
              />
            </FormLayout>
          </BlockStack>
        );
      case 1:
        return (
          <BlockStack gap="400">
            <FormLayout>
              <Banner tone="info">
                Media gallery images can be applied by users when personalizing products.
              </Banner>

              <BlockStack gap="300">
                <TextField
                  label="Gallery Name"
                  value={newGalleryName}
                  onChange={setNewGalleryName}
                  placeholder="Enter gallery name"
                  autoComplete="off"
                />
              </BlockStack>

              <InlineStack gap="200">
                <Button
                  onClick={handleCreateGallery}
                  variant="primary"
                  icon={PlusIcon}
                  disabled={!newGalleryName.trim()}
                >
                  Create Gallery
                </Button>
              </InlineStack>

              {galleries.length > 0 ? (
                <BlockStack gap="300">
                  {galleries.map((item) => {
                    const { id, name, images } = item;

                    return (
                      <Card key={id} roundedAbove="sm">
                        <BlockStack gap="300">
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text as="h2" variant="headingSm">
                                {name}
                              </Text>
                              <Text as="p" variant="bodyMd" tone="subdued">
                                {images.length} image{images.length !== 1 ? 's' : ''}
                              </Text>
                            </BlockStack>
                            <ButtonGroup>
                              <Button
                                size="slim"
                                onClick={() => handleShopifyGallerySelect(id)}
                                icon={ImageAddIcon}
                              >
                                Add Media
                              </Button>
                              <Button
                                size="slim"
                                variant="tertiary"
                                tone="critical"
                                onClick={() => handleDeleteGallery(id)}
                              >
                                Delete Gallery
                              </Button>
                            </ButtonGroup>
                          </InlineStack>

                          {images.length > 0 && (
                            <BlockStack gap="200">
                              {(() => {
                                const IMAGES_TO_SHOW = 10; // Show 10 images initially (2 rows of 5)
                                const isExpanded = isGalleryExpanded(id);
                                const imagesToDisplay = isExpanded ? images : images.slice(0, IMAGES_TO_SHOW);
                                const remainingCount = images.length - IMAGES_TO_SHOW;

                                return (
                                  <>
                                    <InlineGrid gap="300" columns={7}>
                                      {imagesToDisplay.map((image) => (
                                        <div key={image.id}>
                                          <Box
                                            borderRadius="100"
                                            padding="400"
                                            background="bg-fill-secondary"
                                            position="relative"
                                          >
                                            <Thumbnail
                                              source={image.url}
                                              alt={image.name}
                                              size="large"
                                            />
                                            <div style={{
                                              position: 'absolute',
                                              top: '2px',
                                              right: '2px'
                                            }}>
                                              <Button
                                                size="slim"
                                                variant="tertiary"
                                                tone="critical"
                                                onClick={() => handleDeleteImage(id, image.id)}
                                                icon={<Icon source={XIcon} tone="base" />}
                                              />
                                            </div>
                                          </Box>
                                        </div>
                                      ))}
                                    </InlineGrid>

                                    {!isExpanded && remainingCount > 0 && (
                                      <BlockStack gap="200">
                                        <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                                          +{remainingCount} more image{remainingCount !== 1 ? 's' : ''}
                                        </Text>
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                          <Button
                                            size="slim"
                                            variant="tertiary"
                                            onClick={() => toggleGalleryExpansion(id)}
                                            icon={<Icon source={ChevronDownIcon} tone="base" />}
                                          >
                                            View All {images.length.toString()} Images
                                          </Button>
                                        </div>
                                      </BlockStack>
                                    )}

                                    {isExpanded && images.length > IMAGES_TO_SHOW && (
                                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <Button
                                          size="slim"
                                          variant="tertiary"
                                          onClick={() => toggleGalleryExpansion(id)}
                                          icon={<Icon source={ChevronUpIcon} tone="base" />}
                                        >
                                          Show Less
                                        </Button>
                                      </div>
                                    )}
                                  </>
                                );
                              })()
                              }
                            </BlockStack>
                          )}
                        </BlockStack>
                      </Card>
                    );
                  })}
                </BlockStack>
              ) : (
                <EmptyState
                  heading="Create a gallery to get started"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    You can use galleries to organize and manage your images for the product designer.
                  </p>
                </EmptyState>
              )}
            </FormLayout>
          </BlockStack>
        );
      default:
        return null;
    }
  };

  return (
    <Page>
      <TitleBar title="Easy Product Designer">
        <button
          variant="primary"
          onClick={handleSaveConfiguration}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
                <Box padding={"400"}>
                  {renderTabContent()}
                </Box>
              </Tabs>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
      <ImageSelectionModal
        isOpen={isMediaModalOpen}
        isGrid={true}
        onClose={() => {
          setIsMediaModalOpen(false);
          setSelectedGalleryId(null);
        }}
        onAddImages={handleAddImages}
      />
    </Page>
  );
}
