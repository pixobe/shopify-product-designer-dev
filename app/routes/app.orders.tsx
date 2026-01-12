import { FormEvent, useEffect, useState } from "react";

/**
 * 
 */
type OrderCustomizationItem = {
  lineItemId: string | null;
  variantId: string | null;
  pixobeId: string;
  meta: {
    id: string;
    name: string | null;
  } | null;
  media: unknown;
  data: unknown;
};

type OrderCustomizationSuccess = {
  order: {
    id: string;
    name: string | null;
  };
  items: OrderCustomizationItem[];
  config: unknown;
};


export default function OrderCustomizationsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<"idle" | "loading" | "error" | "success">("idle");
  const [customization, setCustomization] =
    useState<OrderCustomizationSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawOrderId = params.get("order_id");

    if (!rawOrderId) {
      return; // show the normal search UI
    }

    // Decode gid://shopify/Order/7026433098032
    let decoded = "";
    try {
      decoded = decodeURIComponent(rawOrderId);
    } catch {
      decoded = rawOrderId;
    }

    // Extract numeric ID if it's a Shopify GID
    const numericIdMatch = decoded.match(/Order\/(\d+)/);
    const numericId = numericIdMatch ? numericIdMatch[1] : decoded;

    // Trigger search automatically
    setQuery(numericId);
    searchOrder(numericId);
  }, []);

  // -------------------------------------------
  // 🔥 SEARCH FUNCTION USED BY BOTH page-load + form submit
  // -------------------------------------------
  const searchOrder = async (orderId: string) => {
    if (!orderId.trim()) {
      setError("Enter an order ID to load its customization.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    setCustomization(null);

    try {
      const response = await fetch(
        `/api/orders?orderId=${encodeURIComponent(orderId)}`
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to load the customization.");
      }

      setCustomization(payload);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setStatus("error");
    }
  };

  return (
    <s-page heading="Order Customization">

      <s-grid alignItems="center">
        {status === "loading" &&
          <s-grid blockSize="100%" inlineSize="100%" background="subdued" padding="small"
            justifyContent="center">
            <s-spinner accessibilityLabel="Loading" size="large" />
          </s-grid>}

        {status === "error" && error && (
          <s-text tone="critical">{error}</s-text>
        )}
        {status === "success" && customization && (
          <s-grid>
            {customization.items.map((item, index) => (
              <s-box
                padding="base"
                key={item.lineItemId ?? item.pixobeId ?? `item-${index}`}
              >
                <s-section>
                  {item.meta?.name && (
                    <s-heading>{item.meta.name}</s-heading>
                  )}

                  <p-viewdesign
                    meta={item.meta}
                    media={item.media}
                    data={
                      (item.data as { design?: unknown } | null | undefined)
                        ?.design
                    }
                    config={customization.config}
                  ></p-viewdesign>
                </s-section>
              </s-box>
            ))}
          </s-grid>

        )}

        {status === "idle" && (
          <s-text>Enter an order ID to preview its saved customization.</s-text>
        )}
      </s-grid>
    </s-page>
  );
}
