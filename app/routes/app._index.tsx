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
      <s-section heading="Instructions">
        <s-paragraph>
          Add the Pixobe app block to your Product template in the Theme Editor:
        </s-paragraph>
        <s-paragraph>
          <a href={appBlockDeepLink} target="_blank" rel="noreferrer">
            Open Theme Editor (Product template) and add the app block
          </a>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
