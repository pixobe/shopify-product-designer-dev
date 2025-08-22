import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
  webhooks: {
    APP_UNINSTALLED: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks",
    },
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      // This hook fires every time a merchant authenticates with your app
      // including during the initial installation
      console.log(`App authenticated for shop: ${session.shop}`);

      // You can check if this is a new installation by looking for existing data
      // or by checking if this is the first time this shop has authenticated

      // Example: Check if this shop has any existing data in your database
      const existingData = await prisma.session.findFirst({
        where: { shop: session.shop },
      });

      if (!existingData) {
        console.log(`New app installation detected for shop: ${session.shop}`);

        // Perform any setup tasks for new installations here
        // For example:
        // - Create initial store settings
        // - Set up default configurations
        // - Send welcome emails
        // - Initialize store-specific data

        // Example: Create initial store settings
        // await prisma.storeSettings.create({
        //   data: {
        //     shop: session.shop,
        //     // Add any default settings
        //   }
        // });
      }

      // Register webhooks for this shop
      await shopify.registerWebhooks({ session });
    },
  },
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
