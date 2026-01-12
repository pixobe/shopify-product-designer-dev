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
  const appUrl = `/app/customize?id=${encodeURIComponent(productId)}`;

  return (
    <s-admin-block heading="Pixobe Product Configuration">
      <s-stack direction="block">
        <s-box>
          <s-link href={appUrl}>{i18n.translate("click")}</s-link>{" "}
          {i18n.translate("welcome")}
        </s-box>
      </s-stack>
    </s-admin-block>
  );
}
