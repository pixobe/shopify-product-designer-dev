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
  DropZone,
  Thumbnail,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { PlusIcon, ImageIcon } from '@shopify/polaris-icons';

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

export default function ConfigurationPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const app = useAppBridge();

  const [fonts, setFonts] = useState<Font[]>([
    { id: '1', name: 'Arial', url: '' },
    { id: '2', name: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto' },
  ]);

  const [newFont, setNewFont] = useState({ name: '', url: '' });
  const [editingFont, setEditingFont] = useState<Font | null>(null);

  // Gallery management state
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [newGalleryName, setNewGalleryName] = useState('');
  const [uploadingImages, setUploadingImages] = useState<{ [galleryId: string]: boolean }>({});

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

  // Gallery management functions
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

  // Image management functions
  const handleImageUpload = useCallback((files: File[], galleryId: string) => {
    setUploadingImages(prev => ({ ...prev, [galleryId]: true }));

    // Convert files to ImageFile objects
    const newImages: ImageFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file) // In real app, you'd upload to server
    }));

    setGalleries(prev => prev.map(gallery =>
      gallery.id === galleryId
        ? { ...gallery, images: [...gallery.images, ...newImages] }
        : gallery
    ));

    setUploadingImages(prev => ({ ...prev, [galleryId]: false }));
  }, []);

  const handleShopifyGallerySelect = useCallback(async (galleryId: string) => {
    try {
      const selection = await app.resourcePicker({
        type: 'product',
        multiple: true,
      });

      if (selection && selection.length > 0) {
        // Extract images from selected products
        const newImages: ImageFile[] = [];
        selection.forEach((product: any) => {
          if (product.images && product.images.length > 0) {
            product.images.forEach((image: any) => {
              newImages.push({
                id: `shopify-${image.id}`,
                name: image.altText || `${product.title} - Image`,
                url: image.originalSrc || image.url
              });
            });
          }
        });

        if (newImages.length > 0) {
          setGalleries(prev => prev.map(gallery =>
            gallery.id === galleryId
              ? { ...gallery, images: [...gallery.images, ...newImages] }
              : gallery
          ));
        }
      }
    } catch (error) {
      console.error('Error selecting from Shopify gallery:', error);
    }
  }, [app]);

  const handleDeleteImage = useCallback((galleryId: string, imageId: string) => {
    setGalleries(prev => prev.map(gallery =>
      gallery.id === galleryId
        ? { ...gallery, images: gallery.images.filter(img => img.id !== imageId) }
        : gallery
    ));
  }, []);

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
                    const isUploading = uploadingImages[id] || false;

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
                                icon={ImageIcon}
                                disabled={isUploading}
                              >
                                Select from Gallery
                              </Button>
                              <Button
                                size="slim"
                                variant="tertiary"
                                tone="critical"
                                onClick={() => handleDeleteGallery(id)}
                                disabled={isUploading}
                              >
                                Delete
                              </Button>
                            </ButtonGroup>
                          </InlineStack>

                          {/* Image Upload Area */}
                          <DropZone
                            accept="image/*"
                            type="image"
                            allowMultiple
                            onDrop={(files) => handleImageUpload(files, id)}
                            disabled={isUploading}
                          >
                            <DropZone.FileUpload actionTitle="Add images" actionHint="or drop files to upload" />
                          </DropZone>

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
    </Page>
  );
}


