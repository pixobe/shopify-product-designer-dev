import { getProductVariantMedia } from "app/utils/graphql/product-media";
import { getAppMetafield } from "./graphql/app-metadata";
import { METADATA_FIELD_APP_SETTINGS } from "app/constants/settings";

export const getCustomizedData = async (
  admin: any,
  pixobeId: string,
  variantId: string,
): Promise<any> => {
  try {
    const variantDetails = await getProductVariantMedia(admin, variantId);
    const config = await getAppMetafield(admin, METADATA_FIELD_APP_SETTINGS);
    const meta = { name: variantDetails.name, id: variantDetails.id };
    const data = await getAppMetafield(admin, pixobeId);
    return { media: variantDetails.media, config, meta, data };
  } catch (e: any) {
    console.error("Unable to fetch custom data", e.message);
    return {};
  }
  return null;
};
