
import {
    Card,
    Text,
    BlockStack,
    EmptyState,
    Thumbnail,
    Modal,
    Grid,
    Spinner,
    Checkbox,
} from "@shopify/polaris";

interface ShopifyFile {
    id: string;
    alt?: string;
    createdAt?: string;
    updatedAt?: string;
    fileStatus?: string;
    image?: {
        url?: string;
        width?: number;
        height?: number;
    };
}

interface ShopifyFilesResponse {
    success: boolean;
    files: ShopifyFile[];
    error?: string;
}

interface FetcherData {
    data?: ShopifyFilesResponse;
    state: string;
}

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddImages: () => void;
    selectedImages: string[];
    onImageSelection: (imageId: string, isSelected: boolean) => void;
    fetcher: FetcherData;
    isLoading: boolean;
}

export function ImageSelectionModal({
    isOpen,
    onClose,
    onAddImages,
    selectedImages,
    onImageSelection,
    fetcher,
    isLoading
}: ImageModalProps) {
    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Select Images from Shopify Media"
            primaryAction={{
                content: `Add ${selectedImages.length} Selected Image${selectedImages.length !== 1 ? 's' : ''}`,
                onAction: onAddImages,
                disabled: selectedImages.length === 0
            }}
            secondaryActions={[{
                content: 'Cancel',
                onAction: onClose
            }]}
        >
            <Modal.Section>
                {isLoading || fetcher.state === 'loading' ? (
                    <BlockStack gap="400" align="center" inlineAlign="center">
                        <Spinner size="large" />
                        <Text as="p" alignment="center">
                            Loading Shopify media files...
                        </Text>
                    </BlockStack>
                ) : fetcher.data?.files ? (
                    <BlockStack gap="400">
                        <Text as="p" tone="subdued">
                            Select the images you want to add to your gallery. Click on images to select them.
                        </Text>

                        {fetcher.data.files.filter((file: ShopifyFile) => file.image?.url).length === 0 ? (
                            <EmptyState
                                heading="No images found"
                                image="https://cdn.shopify.com/s/files/1/2376/3301/products/emptystate-files.png"
                            >
                                <p>No image files were found in your Shopify media library.</p>
                            </EmptyState>
                        ) : (
                            <Grid>
                                {fetcher.data.files
                                    .filter((file: ShopifyFile) => file.image?.url)
                                    .map((file: ShopifyFile) => {
                                        const imageId = `shopify-${file.id}`;
                                        const isSelected = selectedImages.includes(imageId);
                                        const imageUrl = file.image?.url;
                                        const imageName = file.alt || imageUrl?.split('/').pop() || 'Shopify Image';

                                        return (
                                            <Grid.Cell
                                                key={file.id}
                                                columnSpan={{ xs: 6, sm: 4, md: 3, lg: 2, xl: 2 }}
                                            >
                                                <Card>
                                                    <BlockStack gap="200">
                                                        <div
                                                            style={{
                                                                position: 'relative',
                                                                cursor: 'pointer',
                                                                border: isSelected ? '2px solid #008060' : '2px solid transparent',
                                                                borderRadius: '4px'
                                                            }}
                                                            onClick={() => onImageSelection(imageId, !isSelected)}
                                                        >
                                                            <Thumbnail
                                                                source={imageUrl || ''}
                                                                alt={imageName}
                                                                size="large"
                                                            />
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '8px',
                                                                right: '8px'
                                                            }}>
                                                                <Checkbox
                                                                    label={`Select ${imageName}`}
                                                                    labelHidden
                                                                    checked={isSelected}
                                                                    onChange={(checked) => onImageSelection(imageId, checked)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <Text as="p" variant="bodySm" truncate>
                                                            {imageName}
                                                        </Text>
                                                    </BlockStack>
                                                </Card>
                                            </Grid.Cell>
                                        );
                                    })
                                }
                            </Grid>
                        )}
                    </BlockStack>
                ) : (
                    <EmptyState
                        heading="Failed to load media"
                        image="https://cdn.shopify.com/s/files/1/2376/3301/products/emptystate-files.png"
                    >
                        <p>There was an error loading your Shopify media files. Please try again.</p>
                    </EmptyState>
                )}
            </Modal.Section>
        </Modal>
    )
}
