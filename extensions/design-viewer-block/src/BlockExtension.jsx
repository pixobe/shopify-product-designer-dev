import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const { i18n, data } = shopify;

  const selected = data?.selected;
  const orderId = selected?.[0]?.id;

  // Construct full admin URL dynamically
  const appUrl = `/app/orders?order_id=${encodeURIComponent(orderId)}`;

  return (
    <s-admin-block heading="Pixobe">
      <s-stack direction="block">
        <s-text type="strong">{i18n.translate("title")}</s-text>
        <s-link href={appUrl}>{i18n.translate("linkTitle")}</s-link>
      </s-stack>
    </s-admin-block>
  );
}
