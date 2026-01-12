import {
  useLoaderData,
  type ActionFunctionArgs,
  type HeadersFunction,
  type LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const { session } = await authenticate.admin(request);
  const myshopifydomain = session.shop;
  // 1. Use the API Key (Client ID) instead of the Extension UUID
  const apiKey = process.env.SHOPIFY_API_KEY;
  // 2. Use your block's handle (the Liquid filename without extension)
  const blockHandle = "customize-button";
  // placement
  const target = "main";
  // 'product-information' is not a standard section ID; themes like Dawn use 'main'
  const appBlockDeepLink = `https://${myshopifydomain}/admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/${blockHandle}&target=${target}`;
  return { appBlockDeepLink };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return null;
};

export default function Index() {
  const { appBlockDeepLink } = useLoaderData() as { appBlockDeepLink: string };

  return (
    <s-page heading="Pixobe Product designer">
      <s-section>
        <s-grid gap="base">
          <s-grid gap="small-200">
            <s-grid
              gridTemplateColumns="1fr auto auto"
              gap="small-300"
              alignItems="center"
            >
              <s-heading>Setup Guide</s-heading>
              <s-button
                accessibilityLabel="Dismiss Guide"
                variant="tertiary"
                tone="neutral"
                icon="x"
              />
              <s-button
                accessibilityLabel="Toggle setup guide"
                variant="tertiary"
                tone="neutral"
                icon="chevron-up"
              />
            </s-grid>
            <s-paragraph>
              Use this personalized guide to get your store ready for sales.
            </s-paragraph>
            <s-paragraph color="subdued">0 out of 3 steps completed</s-paragraph>
          </s-grid>
          <s-box borderRadius="base" border="base" background="base">
            <s-box>
              <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
                <s-checkbox label="Upload an image for your puzzle" />
                <s-button
                  accessibilityLabel="Toggle step 1 details"
                  variant="tertiary"
                  icon="chevron-up"
                />
              </s-grid>
              <s-box padding="small" paddingBlockStart="none">
                <s-box padding="base" background="subdued" borderRadius="base">
                  <s-grid
                    gridTemplateColumns="1fr auto"
                    gap="base"
                    alignItems="center"
                  >
                    <s-grid gap="small-200">
                      <s-paragraph>
                        Start by uploading a high-quality image that will be used to
                        create your puzzle. For best results, use images that are at
                        least 1200x1200 pixels.
                      </s-paragraph>
                      <s-stack direction="inline" gap="small-200">
                        <s-button variant="primary">Upload image</s-button>
                        <s-button variant="tertiary" tone="neutral">
                          {" "}
                          Image requirements{" "}
                        </s-button>
                      </s-stack>
                    </s-grid>
                    <s-box maxBlockSize="80px" maxInlineSize="80px">
                      <s-image
                        src="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd10aac7bd9c7ad02030f48cfa0.svg"
                        alt="Customize checkout illustration"
                      />
                    </s-box>
                  </s-grid>
                </s-box>
              </s-box>
            </s-box>
            <s-divider />
            <s-box>
              <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
                <s-checkbox label="Choose a puzzle template" />
                <s-button
                  accessibilityLabel="Toggle step 2 details"
                  variant="tertiary"
                  icon="chevron-down"
                />
              </s-grid>
              <s-box
                padding="small"
                paddingBlockStart="none"
              />
            </s-box>
            <s-divider />
            <s-box>
              <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
                <s-checkbox label="Customize puzzle piece shapes" />
                <s-button
                  accessibilityLabel="Toggle step 3 details"
                  variant="tertiary"
                  icon="chevron-down"
                />
              </s-grid>
              <s-box
                padding="small"
                paddingBlockStart="none"
              />
            </s-box>
          </s-box>
        </s-grid>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
