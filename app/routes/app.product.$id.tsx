import {
    Layout,
    Page,
    Text
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request, params }: LoaderFunctionArgs) {
    await authenticate.admin(request);
    const { id } = params;
    console.log("product id ", id)
    return ({ productId: id });
}

export default function ProductCustomizationPage() {
    const { productId } = useLoaderData<typeof loader>();
    return (
        <Page>
            <TitleBar title="Configuration">
            </TitleBar>
            <Layout>
                <Layout.Section>
                    <Text as="p">
                        {productId}
                    </Text>
                </Layout.Section>
            </Layout>
        </Page>
    );
}