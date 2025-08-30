import { useFetcher } from "@remix-run/react";
import {
    Text,
    BlockStack,
    Modal,
    TextField,
    Spinner,
    InlineGrid,
    Thumbnail,
    ResourceList,
    Card,
    ResourceItem,
    Box,
    Checkbox,
    Icon
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { useEffect, useState, useCallback } from "react";

export type ShopifyImage = {
    id: string;
    alt: string;
    mimeType: string;
    image: {
        url: string;
        width: number;
        height: number;
    };
};

interface ShopifyFilesResponse {
    success: boolean;
    result: ShopifyImage[];
    error?: string;
    hasMore?: boolean;
    total?: number;
}

export interface SelectedImageData {
    id: string;
    name: string;
    url: string;
    source: 'shopify';
}

interface ImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    isGrid: boolean;
    onAddImages?: (imageData: SelectedImageData[]) => void;
}

export function ImageSelectionModal({
    isOpen,
    isGrid,
    onClose,
    onAddImages
}: ImageModalProps) {
    const fetcher = useFetcher<ShopifyFilesResponse>();
    const [hasLoaded, setHasLoaded] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [searchValue, setSearchValue] = useState("");
    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

    const performSearch = useCallback((query: string) => {
        const searchUrl = query.trim()
            ? `/api/media?q=${encodeURIComponent(query)}&limit=250`
            : "/api/media?limit=250";
        fetcher.load(searchUrl);
    }, [fetcher]);

    useEffect(() => {
        if (isOpen && !hasLoaded && fetcher.state === "idle") {
            // Fetch more images by default (250 instead of 100)
            performSearch("");
            setHasLoaded(true);
        }
    }, [isOpen, hasLoaded, fetcher, performSearch]);

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            setHasLoaded(false);
            setSelectedImages([]);
            setSearchValue("");
            if (searchTimeout) {
                clearTimeout(searchTimeout);
                setSearchTimeout(null);
            }
        }
    }, [isOpen, searchTimeout]);

    // Handle search with debounce
    const handleSearchChange = useCallback((value: string) => {
        setSearchValue(value);

        // Clear existing timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Set new timeout for debounced search
        const newTimeout = setTimeout(() => {
            performSearch(value);
        }, 500);

        setSearchTimeout(newTimeout);
    }, [searchTimeout, performSearch]);

    const handleImageClick = (imageId: string, checked: boolean) => {
        setSelectedImages(prev => {
            if (!checked) {
                // Remove from selection
                return prev.filter(id => id !== imageId);
            } else {
                // Add to selection
                return [...prev, imageId];
            }
        });
    };

    const handleAddSelectedImages = () => {
        console.log('handleAddSelectedImages called with:', selectedImages.length, 'selected images');

        if (onAddImages && fetcher.data?.result) {
            const selectedImageData: SelectedImageData[] = fetcher.data.result
                .filter(image => selectedImages.includes(image.id))
                .map(image => ({
                    id: image.id,
                    name: image.alt || 'Untitled',
                    url: image.image.url,
                    source: 'shopify' as const
                }));

            console.log('Sending image data to parent:', selectedImageData);
            onAddImages(selectedImageData);
            onClose();
        } else {
            console.log('No onAddImages callback or no data available');
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Select Images from Shopify Media"
            size="fullScreen"
            primaryAction={{
                content: `Add ${selectedImages.length} Selected Image${selectedImages.length !== 1 ? 's' : ''}`,
                onAction: handleAddSelectedImages,
                disabled: selectedImages.length === 0
            }}
            secondaryActions={[{
                content: 'Cancel',
                onAction: onClose
            }]}
        >
            <Modal.Section>
                <BlockStack gap="100">
                    <TextField
                        label="Search files"
                        placeholder="Search files by name..."
                        autoComplete="off"
                        value={searchValue}
                        onChange={handleSearchChange}
                        prefix={<Icon source={SearchIcon} tone="base" />}
                        clearButton
                        onClearButtonClick={() => handleSearchChange("")}
                    />

                    {fetcher.state === 'loading' ? (
                        <BlockStack gap="400" align="center" inlineAlign="center">
                            <Spinner size="large" />
                            <Text as="p" alignment="center">
                                Loading Shopify media files...
                            </Text>
                        </BlockStack>
                    ) : fetcher.data?.result ? (
                        <>
                            <Text as="p" variant="bodySm" tone="subdued">
                                {searchValue ? (
                                    `${fetcher.data.result.length} images found for "${searchValue}"`
                                ) : (
                                    `${fetcher.data.result.length} images available`
                                )}{fetcher.data.hasMore ? ' (more available)' : ''}
                            </Text>
                            {isGrid ? (
                                <Card>
                                    <InlineGrid gap="300" columns={5}>
                                        {fetcher.data.result.map((item) => {
                                            const { id, image, alt } = item;
                                            const isSelected = selectedImages.includes(item.id);

                                            return (
                                                <div
                                                    key={id}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => handleImageClick(item.id, !isSelected)}
                                                >
                                                    <Box
                                                        borderRadius="100"
                                                        padding="400"
                                                        background={isSelected ? "bg-fill-tertiary" : "bg-fill-secondary"}
                                                        position="relative"
                                                    >
                                                        <Thumbnail
                                                            source={image.url}
                                                            size="large"
                                                            alt={alt || "Image"}
                                                        />

                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '2px',
                                                            left: '2px',
                                                        }}>
                                                            <Checkbox
                                                                label=""
                                                                checked={isSelected}
                                                                onChange={(checked) => {
                                                                    handleImageClick(item.id, checked);
                                                                }}
                                                            />
                                                        </div>
                                                    </Box>
                                                </div>
                                            );
                                        })}
                                    </InlineGrid>
                                </Card>
                            ) : (
                                <ResourceList
                                    resourceName={{ singular: 'image', plural: 'images' }}
                                    items={fetcher.data.result}
                                    renderItem={(item) => {
                                        const { id, image, alt } = item;
                                        const isSelected = selectedImages.includes(id);
                                        const media = (
                                            <Thumbnail
                                                source={image.url}
                                                size="large"
                                                alt={alt || "Image"}
                                            />
                                        );

                                        return (
                                            <ResourceItem
                                                onClick={() => handleImageClick(id, !isSelected)}
                                                id={id}
                                                media={media}
                                                accessibilityLabel={`${isSelected ? 'Deselect' : 'Select'} ${alt || "image"}`}
                                                shortcutActions={isSelected ? [{ content: '✓ Selected', onAction: () => { } }] : []}
                                            >
                                                {alt || "No description"}
                                            </ResourceItem>
                                        );
                                    }}
                                />
                            )}
                        </>
                    ) : fetcher.data?.error ? (
                        <Text as="p" alignment="center">
                            {fetcher.data.error}
                        </Text>
                    ) : (
                        <Text as="p" alignment="center">
                            No media files found.
                        </Text>
                    )}
                </BlockStack>
            </Modal.Section>
        </Modal>
    );
}