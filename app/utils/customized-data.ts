import { getProductVariantMedia } from "app/utils/graphql/product-media";
import { getAppMetafield } from "./graphql/app-metadata";
import { METADATA_FIELD_APP_SETTINGS } from "app/constants/settings";

export const getCustomizedData = async (
  admin: any,
  pixobeId: string,
  variantId: string,
): Promise<any> => {
  try {
    const [variantDetails, config, data] = await Promise.all([
      getProductVariantMedia(admin, variantId),
      getAppMetafield(admin, METADATA_FIELD_APP_SETTINGS),
      getAppMetafield(admin, pixobeId),
    ]);

    const meta = { name: variantDetails.name, id: variantDetails.id };

    return { media: variantDetails.media, config, meta, data };
  } catch (e: any) {
    console.error("Unable to fetch custom data", e.message);
    return {};
  }
};
