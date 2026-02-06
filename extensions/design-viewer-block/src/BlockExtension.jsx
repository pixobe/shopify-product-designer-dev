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
  const [state, setState] = useState({
    status: "loading", // 'loading' | 'success' | 'error' | 'no-order'
    isCustomized: false,
    errorMessage: null,
  });

  const orderId = data?.selected?.[0]?.id;
  const appUrl = orderId
    ? `/app/orders?order_id=${encodeURIComponent(orderId)}`
    : "/app/orders";

  useEffect(() => {
    if (!orderId) {
      setState({
        status: "no-order",
        isCustomized: false,
        errorMessage: null,
      });
      return;
    }

    let isCancelled = false;

    const checkCustomization = async () => {
      try {
        const result = await query(ORDER_CUSTOMIZATION_QUERY, {
          variables: { id: orderId },
        });

        if (isCancelled) return;

        // Handle GraphQL errors
        if (result?.errors?.length) {
          const errorMessage = result.errors[0]?.message || "Unknown error";

          console.log("Error while retrieving order data", errorMessage);
          const isAccessError =
            errorMessage.toLowerCase().includes("access") ||
            errorMessage.toLowerCase().includes("permission") ||
            errorMessage.toLowerCase().includes("unauthorized");

          setState({
            status: "error",
            isCustomized: false,
            errorMessage: isAccessError
              ? i18n.translate("accessError")
              : i18n.translate("queryError"),
          });
          return;
        }

        // Access order data directly
        const order = result?.data?.order;

        // Handle missing order data
        if (!order) {
          setState({
            status: "error",
            isCustomized: false,
            errorMessage: i18n.translate("orderNotFound"),
          });
          return;
        }

        const lineItems = order.lineItems?.nodes ?? [];
        const hasCustomization = lineItems.some((item) =>
          item.customAttributes?.some(
            (attr) =>
              attr?.key === CUSTOMIZATION_PROPERTY_KEY &&
              attr?.value?.trim() !== "",
          ),
        );

        setState({
          status: "success",
          isCustomized: hasCustomization,
          errorMessage: null,
        });
      } catch (error) {
        if (!isCancelled) {
          setState({
            status: "error",
            isCustomized: false,
            errorMessage: i18n.translate("networkError"),
          });
        }
      }
    };

    checkCustomization();

    return () => {
      isCancelled = true;
    };
  }, [orderId, query, i18n]);

  const renderContent = () => {
    switch (state.status) {
      case "loading":
        return <s-text color="subdued">{i18n.translate("loading")}</s-text>;

      case "error":
        return (
          <s-banner tone="critical">
            <s-text>{state.errorMessage}</s-text>
          </s-banner>
        );

      case "no-order":
        return (
          <s-text color="subdued">{i18n.translate("noOrderSelected")}</s-text>
        );

      case "success":
        return state.isCustomized ? (
          <s-box>
            <s-link href={appUrl}>{i18n.translate("linkTitle")}</s-link>{" "}
            <s-text>{i18n.translate("title")}</s-text>
          </s-box>
        ) : (
          <s-text color="subdued">{i18n.translate("notCustomized")}</s-text>
        );

      default:
        return null;
    }
  };

  return (
    <s-admin-block heading="Pixobe Order Customization">
      <s-stack direction="block">{renderContent()}</s-stack>
    </s-admin-block>
  );
}
