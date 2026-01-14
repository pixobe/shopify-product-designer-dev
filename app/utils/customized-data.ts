import { getProductVariantMedia } from "app/utils/graphql/product-media";
import { getAppMetafield } from "./graphql/app-metadata";
import { METADATA_FIELD_APP_SETTINGS } from "app/constants/settings";

/**
 *
 * @param admin
 * @param pixobeId
 * @param variantId
 * @returns
 */
export const getCustomizedData = async (
  admin: any,
  variantId: string,
  pixobeId?: string,
  shop?: string,
): Promise<any> => {
  try {
    const [variantDetails, config, data] = await Promise.all([
      getProductVariantMedia(admin, variantId),
      getAppMetafield(admin, METADATA_FIELD_APP_SETTINGS, { shop }),
      getAppMetafield(admin, pixobeId),
    ]);

    const media = variantDetails.media;
    const meta = { name: variantDetails.name, id: variantDetails.id };
    return { media, config, meta, data };
  } catch (e: any) {
    console.error("Unable to fetch custom data", e.message);
    return {};
  }
};
