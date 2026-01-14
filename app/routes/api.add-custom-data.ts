// app/routes/apps.customizer.upload.tsx
import {
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { randomUUID } from "node:crypto";
import { authenticate } from "../shopify.server";
import { setAppMetafield } from "app/utils/graphql/app-metadata";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.public.appProxy(request);
  if (!admin) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const pixobeId = url.searchParams.get("pixobeId");
    const key = pixobeId ?? randomUUID();
    const result = await setAppMetafield(admin, key, body, {
      shop: session?.shop,
    });
    if (!result.success) {
      return data(
        { error: result.message ?? "Failed to save app data" },
        { status: 500 },
      );
    }
    return data({ key });
  } catch (e: any) {
    console.error("ADD_CUSTOM_DATA", e);
    return data({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
};

// Optional: block GETs with 405 to make this clearly POST-only
export const loader = async (_args: LoaderFunctionArgs) =>
  new Response("Method Not Allowed", { status: 405 });
