import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { GetShopMedia, SearchShopMediaByName } from "../utils/media";

type MediaItem = {
  id: string;
  alt: string;
  url: string;
  width: number | null;
  height: number | null;
  mimeType?: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const first = Number(url.searchParams.get("first") ?? 50);
  const query = url.searchParams.get("query");

  const response = query && query.trim()
    ? await SearchShopMediaByName(admin, query.trim(), first)
    : await GetShopMedia(admin, first);
  const data = await response.json();

  const media: MediaItem[] = (data.data?.files?.edges ?? [])
    .map(({ node }: any) => ({
      id: node.id as string,
      alt: node.alt ?? "",
      url: node.image?.url ?? "",
      width: node.image?.width ?? null,
      height: node.image?.height ?? null,
      mimeType: node.mimeType ?? undefined,
    }))
    .filter((item: MediaItem) => Boolean(item.url));

  return { media };
};
