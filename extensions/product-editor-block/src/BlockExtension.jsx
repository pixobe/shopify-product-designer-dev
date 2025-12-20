import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const {
    i18n,
    data,
    extension: { target },
  } = shopify;
  const selectedProduct = data?.selected;
  const productId = selectedProduct?.[0]?.id;

  // Construct full admin URL dynamically
  const appUrl = `/app/configure-product-media?id=${encodeURIComponent(productId)}`;

  return (
    <s-admin-block heading="Product Editor">
      <s-stack direction="block">
        {i18n.translate("welcome")}
        <s-link href={appUrl}>{i18n.translate("click")}</s-link>{" "}
      </s-stack>
    </s-admin-block>
  );
}
