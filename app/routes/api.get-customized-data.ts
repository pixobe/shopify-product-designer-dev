import { data, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getCustomizedData } from "app/utils/customized-data";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, storefront, session } =
    await authenticate.public.appProxy(request);

  if (!admin || !storefront) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const pixobeId = url.searchParams.get("pixobeId")?.trim();
  const variantId = url.searchParams.get("variantId")?.trim();

  if (!pixobeId || !variantId) {
    return data({ error: "Required fields missing" }, { status: 400 });
  }

  try {
    const payload = await getCustomizedData(
      admin,
      variantId,
      pixobeId,
      session?.shop,
    );
    if (!payload) {
      return data({ error: "Customized data not found" }, { status: 404 });
    }
    return data(payload);
  } catch (error: any) {
    console.error("Failed to load customized data", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
};

export const action = async () =>
  data({ error: "Method Not Allowed" }, { status: 405 });
