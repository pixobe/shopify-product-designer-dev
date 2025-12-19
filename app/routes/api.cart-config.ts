import { data, type LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  loadPixobeDesignSettings,
  loadPixobeProductMedia,
} from "../utils/design-config";

const ORDER_ID_PREFIX = "gid://shopify/Order/";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const FILE_QUERY = `#graphql
query GenericFileCustomization($id: ID!) {
  node(id: $id) {
    ... on GenericFile {
      id
      url
      mimeType
      fileStatus
    }
  }
}
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const variant = (url.searchParams.get("variant") ?? "").trim();
  const fileId = (url.searchParams.get("fileId") ?? "").trim();

  if (!fileId) {
    return data({ message: `Mandatory key pixobeId missing` }, 404);
  }

  const fileResponse = await admin.graphql(FILE_QUERY, {
    variables: { id: fileId },
  });
  const fileResult = await fileResponse.json();

  if (!fileResult) {
    return data(
      { message: "Shopify returned errors while fetching the file" },
      502,
    );
  }

  const genericFile = fileResult.data?.node;
  if (!genericFile?.url) {
    return jsonResponse(
      { ok: false, error: "Linked GenericFile not found" },
      404,
    );
  }

  let fileText: string;
  try {
    const networkResponse = await fetch(genericFile.url);
    if (!networkResponse.ok) {
      return jsonResponse(
        { ok: false, error: "Unable to download the customization file" },
        502,
      );
    }

    fileText = await networkResponse.text();
  } catch (error: any) {
    return jsonResponse(
      {
        ok: false,
        error: "Failed to download the customization file",
        details: error?.message,
      },
      502,
    );
  }

  let fileData: unknown;
  try {
    fileData = JSON.parse(fileText);
  } catch (error: any) {
    return jsonResponse(
      {
        ok: false,
        error: "Customization file is not valid JSON",
        details: error?.message,
      },
      502,
    );
  }

  const configPromise = loadPixobeDesignSettings(admin);
  const mediaPromise = loadPixobeProductMedia(admin, null, variant);
  const [config, media] = await Promise.all([configPromise, mediaPromise]);

  return jsonResponse({
    fileData,
    config,
    media,
  });
};

export const action = async () =>
  jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
