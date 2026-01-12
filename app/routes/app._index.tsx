import {
  useLoaderData,
  type ActionFunctionArgs,
  type HeadersFunction,
  type LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getSampleOrderId } from "app/utils/graphql/order-sample";

type LoaderData = {
  appEmbedDeepLink: string;
  productConfigurationUrl: string;
  orderDetailsPageUrl: string
};

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LoaderData> => {
  const { session, admin } = await authenticate.admin(request);
  const EXTENSION_ID = process.env.SHOPIFY_API_KEY;
  const shop = session.shop?.replace(".myshopify.com", "");

  if (!EXTENSION_ID) {
    throw new Error("SHOPIFY_API_KEY is not configured");
  }
  if (!shop) {
    throw new Error("Shop domain is missing from the session");
  }
  const shopDomain = shop.replace(".myshopify.com", "") ?? null;

  const EXTENSION_NAME = "embed-block";
  const appEmbedDeepLink = `https://${session.shop}/admin/themes/current/editor?template=product&context=apps&activateAppId=${EXTENSION_ID}/${EXTENSION_NAME}`;
  const productConfigurationUrl = `/app/products`;

  const sampleOrderId = await getSampleOrderId(admin)

  const orderDetailsPageUrl = `https://admin.shopify.com/store/${shopDomain}/orders/${sampleOrderId}`

  return { appEmbedDeepLink, productConfigurationUrl, orderDetailsPageUrl };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  const { appEmbedDeepLink, productConfigurationUrl, orderDetailsPageUrl } = useLoaderData<typeof loader>();

  const handleEnableApp = () => {
    if (typeof window === "undefined") return;
    window.open(appEmbedDeepLink, "_blank", "noopener");
  };

  return (
    <s-page heading="Setup Guide">
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
                accessibilityLabel="Toggle setup guide"
                variant="tertiary"
                tone="neutral"
                icon="chevron-up"
              />
            </s-grid>

            <s-paragraph>
              Follow this step-by-step guide to enable product customization on your store.
            </s-paragraph>

            <s-paragraph color="subdued">
              0 out of 3 steps completed
            </s-paragraph>
          </s-grid>

          <s-box borderRadius="base" border="base" background="base">
            {/* Step 1 */}
            <s-box>
              <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
                <s-checkbox label="Enable the app" />
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

                      <s-ordered-list>
                        <s-list-item> Turn on the app embed ✨</s-list-item>
                        <s-list-item> Save your theme changes!</s-list-item>
                        <s-list-item> Style the button to match your brand vibe using the settings panel.</s-list-item>
                      </s-ordered-list>

                      <s-paragraph color="subdued">
                        You only need to do this once per theme. If you change or
                        publish a new theme, this step may need to be completed again.
                      </s-paragraph>

                      <s-button variant="auto" onClick={handleEnableApp}>
                        <s-grid gridTemplateColumns="24px 1fr"><s-icon type="app-extension"></s-icon>Embed Block</s-grid>
                      </s-button>
                    </s-grid>
                  </s-grid>
                </s-box>
              </s-box>
            </s-box>

            <s-divider />

            {/* Step 2 placeholder */}
            <s-box>
              <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
                <s-checkbox label="Configure Product" />
                <s-button
                  accessibilityLabel="Toggle step 2 details"
                  variant="tertiary"
                  icon="chevron-up"
                />
              </s-grid>

              <s-box padding="small" paddingBlockStart="none">
                <s-box padding="base" background="subdued" borderRadius="base">
                  <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                    <s-grid gap="small-200">

                      <s-paragraph color="subdued">
                        Upload the media assets that will be available in the designer.
                        These assets can be assigned at the product level or specifically to individual variants, ensuring the correct media appears for each selection.
                      </s-paragraph>

                      <s-button variant="auto" href={productConfigurationUrl}>
                        <s-grid gridTemplateColumns="24px 1fr"><s-icon type="settings"></s-icon>Product Settings</s-grid>
                      </s-button>
                    </s-grid>
                  </s-grid>
                </s-box>
              </s-box>
            </s-box>

            <s-divider />

            {/* Step 3 placeholder */}
            <s-box>
              <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
                <s-checkbox label="Order block" />
                <s-button
                  accessibilityLabel="Toggle step 3 details"
                  variant="tertiary"
                  icon="chevron-up"
                />
              </s-grid>

              <s-box padding="small" paddingBlockStart="none">
                <s-box padding="base" background="subdued" borderRadius="base">
                  <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                    <s-grid gap="small-200">
                      <s-paragraph>
                        Add the order block to the order details page to view
                        customization details. This allows you to review customer customizations directly
                        from the Shopify admin
                      </s-paragraph>
                      <s-paragraph color="subdued">
                        Scroll down the order details page to find the Order Block
                      </s-paragraph>

                      <s-button variant="auto" href={orderDetailsPageUrl}>
                        <s-grid gridTemplateColumns="24px 1fr"><s-icon type="apps"></s-icon>Order Block</s-grid>
                      </s-button>
                    </s-grid>
                  </s-grid>
                </s-box>
              </s-box>
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
