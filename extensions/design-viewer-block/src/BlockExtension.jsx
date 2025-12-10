import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const { i18n, data, extension } = shopify;

  const selected = data?.selected;
  const orderId = selected?.[0]?.id;

  console.log(shopify);

  // Construct full admin URL dynamically
  const appUrl = `/app/orders?order_id=${encodeURIComponent(orderId)}`;

  return (
    <s-admin-block heading="Product Customization">
      <s-stack direction="block">
        <s-link href={appUrl}>
          {i18n.translate("view-design", { orderId })}
        </s-link>
      </s-stack>
    </s-admin-block>
  );
}
