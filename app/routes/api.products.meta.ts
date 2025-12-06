import type { ActionFunctionArgs } from "react-router";
import { data } from "react-router";

import { authenticate } from "../shopify.server";
import {
  PIXOBE_MEDIA_METAOBJECT_TYPE,
  PIXOBE_MEDIA_METAFIELD_KEY,
  PIXOBE_MEDIA_METAFIELD_NAMESPACE,
} from "../constants/customization";

interface MediaPayload {
  id: string;
  alt?: string;
  name?: string;
  url?: string;
  grid?: Record<string, unknown> | null;
  showGrid?: boolean;
  etching?: boolean;
  metaobjectId?: string;
}

const buildConfigFieldValue = (media: MediaPayload) => JSON.stringify(media);

const buildMetaobjectFields = (media: MediaPayload) => [
  { key: "config", value: buildConfigFieldValue(media) },
];

const createMetaobject = async (admin: any, media: MediaPayload) => {
  const response = await admin.graphql(
    `#graphql
      mutation CreatePixobeMediaEntry($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        metaobject: {
          type: PIXOBE_MEDIA_METAOBJECT_TYPE,
          fields: [
            {
              key: "config",
              value: JSON.stringify(media),
            },
          ],
        },
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.metaobjectCreate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }
  const id = body.data?.metaobjectCreate?.metaobject?.id;
  if (!id) throw new Error("Missing metaobject id in response");

  return id;
};

const updateMetaobject = async (
  admin: any,
  id: string,
  media: MediaPayload,
) => {
  const response = await admin.graphql(
    `#graphql
      mutation UpdatePixobeMediaEntry(
        $id: ID!
        $metaobject: MetaobjectUpdateInput!
      ) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        id,
        metaobject: {
          fields: [
            {
              key: "config",
              value: JSON.stringify(media),
            },
          ],
        },
      },
    },
  );

  const body = await response.json();
  const errors = body.data?.metaobjectUpdate?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: any) => e.message).join(", "));
  }

  const updatedId = body.data?.metaobjectUpdate?.metaobject?.id;
  if (!updatedId) {
    throw new Error("Missing metaobject id in update response");
  }

  return updatedId as string;
};

const persistMetafield = async (
  admin: any,
  productId: string,
  metaobjectIds: string[],
) => {
  const response = await admin.graphql(
    `#graphql
      mutation SetPixobeMediaMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: PIXOBE_MEDIA_METAFIELD_NAMESPACE,
            key: PIXOBE_MEDIA_METAFIELD_KEY,
            type: "list.metaobject_reference",
            value: JSON.stringify(metaobjectIds),
          },
        ],
      },
    },
  );

  const jsonResponse = await response.json();
  const userErrors = jsonResponse.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      userErrors.map((error: { message: string }) => error.message).join(", "),
    );
  }
};

const parseRequestPayload = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    return {
      productId: body.productId as string | undefined,
      media: (body.media as MediaPayload[]) ?? [],
    };
  }

  const formData = await request.formData();
  const mediaRaw = formData.get("media");

  return {
    productId: formData.get("productId")?.toString(),
    media:
      typeof mediaRaw === "string"
        ? (JSON.parse(mediaRaw) as MediaPayload[])
        : [],
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin } = await authenticate.admin(request);
    const { productId, media } = await parseRequestPayload(request);

    if (!productId) {
      return data({ error: "Missing product id" }, { status: 400 });
    }

    if (!Array.isArray(media)) {
      return data(
        { error: "Media selection should be array" },
        { status: 400 },
      );
    }

    const metaobjectIds: string[] = [];

    console.log("Items:**************", media);

    for (const item of media) {
      try {
        let metaobjectId: string;

        if (item.metaobjectId) {
          metaobjectId = await updateMetaobject(admin, item.id, item);
        } else {
          metaobjectId = await createMetaobject(admin, item);
        }

        metaobjectIds.push(metaobjectId);
      } catch (err) {
        console.error("Unable to sync metaobject", err);
        return data({ error: "Unable to sync metaobjects" }, { status: 422 });
      }
    }

    await persistMetafield(admin, productId, metaobjectIds);

    return data({ metaobjectIds });
  } catch (error: any) {
    console.error("Failed to persist product media metafield", error);
    return data(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
};
