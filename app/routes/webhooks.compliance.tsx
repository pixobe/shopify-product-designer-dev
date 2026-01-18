import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);
  console.log("Compliance payload:", payload);

  if (topic === "SHOP_REDACT" || topic === "shop/redact") {
    const shopDomain =
      (payload as { shop_domain?: string }).shop_domain ?? shop;

    if (shopDomain) {
      await db.session.deleteMany({ where: { shop: shopDomain } });
      console.log(`Deleted data for shop ${shopDomain}`);
    } else {
      console.log("No shop domain found for shop/redact payload");
    }
  }

  return new Response(null, { status: 200 });
};
