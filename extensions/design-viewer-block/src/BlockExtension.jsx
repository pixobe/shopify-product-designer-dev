import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

const CUSTOMIZATION_PROPERTY_KEY = "_pixobeid";

const ORDER_CUSTOMIZATION_QUERY = `#graphql
  query OrderCustomizationCheck($id: ID!) {
    order(id: $id) {
      id
      lineItems(first: 50) {
        nodes {
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
`;

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const { i18n, data, query } = shopify;
  const [isCustomized, setIsCustomized] = useState(null);

  const selected = data?.selected;
  const orderId = selected?.[0]?.id;

  // Construct full admin URL dynamically
  const appUrl = orderId
    ? `/app/orders?order_id=${encodeURIComponent(orderId)}`
    : "/app/orders";

  useEffect(() => {
    let isMounted = true;

    if (!orderId) {
      setIsCustomized(false);
      return () => {
        isMounted = false;
      };
    }

    (async () => {
      try {
        const result = await query(ORDER_CUSTOMIZATION_QUERY, {
          variables: { id: orderId },
        });

        if (!isMounted) return;
        if (result?.errors?.length) {
          setIsCustomized(false);
          return;
        }

        const lineItems = result?.data?.order?.lineItems?.nodes ?? [];
        const hasCustomization = lineItems.some((item) =>
          (item.customAttributes ?? []).some(
            (attr) =>
              attr?.key === CUSTOMIZATION_PROPERTY_KEY &&
              (attr?.value ?? "").trim() !== "",
          ),
        );

        setIsCustomized(hasCustomization);
      } catch (error) {
        if (!isMounted) return;
        setIsCustomized(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [orderId, query]);

  return (
    <s-admin-block heading="Pixobe Order Customization">
      <s-stack direction="block">
        {isCustomized === null ? (
          <s-text color="subdued">{i18n.translate("loading")}</s-text>
        ) : isCustomized ? (
          <s-box>
            <s-link href={appUrl}>{i18n.translate("linkTitle")}</s-link>{" "}
            <s-text>{i18n.translate("title")}</s-text>
          </s-box>
        ) : (
          <s-text color="subdued">{i18n.translate("notCustomized")}</s-text>
        )}
      </s-stack>
    </s-admin-block>
  );
}
