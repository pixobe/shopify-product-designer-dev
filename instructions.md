# Implement the Code

- Think like a shopify expert developer
- refer to shopify mcp server for best practices and documentaion
- Refer to the new product variant definition here
  ```
  [metaobjects.app.pixobe_media_item]
  name = "Pixobe Media Settings"
  display_name_field = "PixobeMediaItem"
  description = "Stores a media reference plus Pixobe's raw configuration payload."
  ```

[metaobjects.app.pixobe_media_item.access]
admin = "merchant_read_write"
storefront = "public_read"

[metaobjects.app.pixobe_media_item.fields.config]
name = "Product Media config json"
type = "json"
description = "Arbitrary Pixobe configuration copied verbatim into the object's `config`."

[variant.metafields.app.pixobe_media_items]
type = "list.metaobject_reference<$app:product_media_item>"
name = "Pixobe Media Config"
description = "Ordered list of Pixobe media entries attached to the product."

[variant.metafields.app.pixobe_media_items.access]
storefront = "public_read"
admin = "merchant_read_write"

```

- update/modify the method addMediaToProductVariant
- Should take variantId:string, config:MediaPayload ( Single Object, that has metaobjectId )
- if metaObjectId is present, update the data otherwise create a new metaobject and associate it to variant's metafield "pixobe_media_items"
```
