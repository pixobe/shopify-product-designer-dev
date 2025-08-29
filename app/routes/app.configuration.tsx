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
  Banner
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { TitleBar } from "@shopify/app-bridge-react";
import { useFetcher } from "@remix-run/react";
import { PlusIcon, ImageAddIcon } from '@shopify/polaris-icons';
import { ImageSelectionModal } from "../components/ImageModal";


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


export default function ConfigurationPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const fetcher = useFetcher<ShopifyFilesResponse>();

  // Modal state for Shopify media selection
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [currentGalleryId, setCurrentGalleryId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);

  const [fonts, setFonts] = useState<Font[]>([
    { id: '1', name: 'Arial', url: '' },
    { id: '2', name: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto' },
  ]);

  const [newFont, setNewFont] = useState({ name: '', url: '' });
  const [editingFont, setEditingFont] = useState<Font | null>(null);

  // Gallery management state
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [newGalleryName, setNewGalleryName] = useState('');

  const tabs = [
    {
      id: 'text',
      content: 'Text',
      accessibilityLabel: 'Text Settings',
      panelID: 'text-settings',
    },
    {
      id: 'image',
      content: 'Image',
      accessibilityLabel: 'Image Settings',
      panelID: 'image-settings',
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
  const handleShopifyGallerySelect = useCallback(async (galleryId: string) => {
    setCurrentGalleryId(galleryId);
    setSelectedImages([]);

    try {
      // Always fetch fresh data when opening modal
      setIsLoadingMedia(true);
      fetcher.load('/api/shopify-files');
      // Modal will open when data is loaded (handled by useEffect)
    } catch (error) {
      console.error('Error fetching Shopify files:', error);
      setIsLoadingMedia(false);
    }
  }, [fetcher]);

  const handleAddSelectedImages = () => {
    console.log('Adding selected images:', selectedImages);
    console.log('Current gallery ID:', currentGalleryId);
    console.log('Fetcher data:', fetcher.data);

    if (currentGalleryId && selectedImages.length > 0) {
      // Map selected image IDs to actual image data from fetcher
      const imageFiles: ImageFile[] = selectedImages.map(imageId => {
        const file = fetcher.data?.files?.find((f: any) => `shopify-${f.id}` === imageId);
        console.log(`Mapping image ${imageId}:`, file);
        return {
          id: imageId,
          name: file?.alt || file?.image?.url?.split('/').pop() || 'Shopify Image',
          url: file?.image?.url || '',
        };
      }).filter(img => img.url); // Filter out any invalid images

      console.log('Mapped image files:', imageFiles);

      if (imageFiles.length > 0) {
        setGalleries(prev =>
          prev.map(gallery =>
            gallery.id === currentGalleryId
              ? { ...gallery, images: [...gallery.images, ...imageFiles] }
              : gallery
          )
        );
      }
    }

    // Reset modal state
    setIsMediaModalOpen(false);
    setSelectedImages([]);
    setCurrentGalleryId(null);
  };

  const handleCloseMediaModal = () => {
    setIsMediaModalOpen(false);
    setSelectedImages([]);
    setCurrentGalleryId(null);
  };

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
    setGalleries(prev => [...prev, gallery]);
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

  const handleImageSelection = (imageId: string, isSelected: boolean) => {
    setSelectedImages(prev => {
      if (isSelected) {
        return prev.includes(imageId) ? prev : [...prev, imageId];
      } else {
        return prev.filter(id => id !== imageId);
      }
    });
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return (
          <Card>
            <BlockStack gap="400">
              <FormLayout>
                <Text as="h3" variant="headingSm">
                  Font Management
                </Text>

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
                  <InlineStack gap="200">
                    {editingFont ? (
                      <ButtonGroup>
                        <Button
                          onClick={handleUpdateFont}
                          variant="secondary"
                          disabled={!newFont.name.trim()}
                        >
                          Update Font
                        </Button>
                        <Button onClick={handleCancelEdit} variant="tertiary" >
                          Cancel
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
          </Card>
        );
      case 1:
        return (
          <Card>
            <BlockStack gap="400">
              <FormLayout>
                <Text as="h3" variant="headingSm">
                  Gallery Management
                </Text>

                <Banner tone="info">
                  Create galleries to organize images for your product designer. You can upload new images or select existing ones from your Shopify media gallery.
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
                  <Button
                    onClick={() => {
                      console.log('Fetching Shopify files for testing...');
                      fetcher.load('/api/shopify-files');
                    }}
                    variant="secondary"
                  >
                    Test Fetch Files
                  </Button>
                </InlineStack>

                <ResourceList
                  resourceName={{ singular: 'gallery', plural: 'galleries' }}
                  items={galleries}
                  emptyState={
                    <EmptyState
                      heading="Create a gallery to get started"
                      image="https://cdn.shopify.com/s/files/1/2376/3301/products/emptystate-files.png"
                    >
                      <p>
                        You can use galleries to organize and manage your images for the product designer.
                      </p>
                    </EmptyState>
                  }
                  renderItem={(item) => {
                    const { id, name, images } = item;

                    return (
                      <ResourceItem
                        id={id}
                        accessibilityLabel={`Gallery ${name}`}
                        onClick={() => { }}
                      >
                        <BlockStack gap="300">
                          <InlineStack align="space-between">
                            <BlockStack gap="100">
                              <Text as="span" variant="bodyMd" fontWeight="semibold">
                                {name}
                              </Text>
                              <Text as="span" variant="bodySm" tone="subdued">
                                {images.length} image{images.length !== 1 ? 's' : ''}
                              </Text>
                            </BlockStack>
                            <ButtonGroup>
                              <Button
                                size="slim"
                                onClick={() => handleShopifyGallerySelect(id)}
                                icon={ImageAddIcon}
                              >
                                Media
                              </Button>
                              <Button
                                size="slim"
                                variant="tertiary"
                                tone="critical"
                                onClick={() => handleDeleteGallery(id)}
                              >
                                Delete
                              </Button>
                            </ButtonGroup>
                          </InlineStack>

                          {/* Image Thumbnails */}
                          {images.length > 0 && (
                            <BlockStack gap="200">
                              <Text as="h4" variant="headingXs">
                                Gallery Images
                              </Text>
                              <InlineStack gap="200" wrap={false}>
                                {images.slice(0, 5).map((image) => (
                                  <div key={image.id} style={{ position: 'relative', display: 'inline-block' }}>
                                    <Thumbnail
                                      source={image.url}
                                      alt={image.name}
                                      size="small"
                                    />
                                    <div style={{
                                      position: 'absolute',
                                      top: '-8px',
                                      right: '-8px'
                                    }}>
                                      <Button
                                        size="micro"
                                        variant="tertiary"
                                        tone="critical"
                                        onClick={() => handleDeleteImage(id, image.id)}
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                {images.length > 5 && (
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    +{images.length - 5} more
                                  </Text>
                                )}
                              </InlineStack>
                            </BlockStack>
                          )}
                        </BlockStack>
                      </ResourceItem>
                    );
                  }}
                />
              </FormLayout>
            </BlockStack>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Page>
      <TitleBar title="Configuration" >
        <button variant="primary">
          Generate a product
        </button>
      </TitleBar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
              {renderTabContent()}
            </Tabs>
          </BlockStack>
        </Layout.Section>
      </Layout>

      <ImageSelectionModal
        isOpen={isMediaModalOpen}
        onClose={handleCloseMediaModal}
        onAddImages={handleAddSelectedImages}
        selectedImages={selectedImages}
        onImageSelection={handleImageSelection}
        fetcher={fetcher}
        isLoading={isLoadingMedia}
      />
    </Page>
  );
}