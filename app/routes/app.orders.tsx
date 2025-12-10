import { FormEvent, useEffect, useState } from "react";

type OrderCustomizationSuccess = {
  ok: true;
  order: {
    id: string;
    name: string | null;
  };
  file: {
    id: string;
    url: string;
    mimeType: string | null;
    fileStatus: string | null;
  };
  fileData: unknown;
};


export default function OrderCustomizationsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<"idle" | "loading" | "error" | "success">("idle");
  const [customization, setCustomization] =
    useState<OrderCustomizationSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);


  const [displayBg, setDisplayBg] = useState(true);

  // -------------------------------------------
  // 🔥 AUTO-LOAD ORDER IF order_id EXISTS IN URL
  // -------------------------------------------
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

  // -------------------------------------------
  // 🔥 FORM-HANDLER (manual search)
  // -------------------------------------------
  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchOrder(query.trim());
  };

  return (
    <s-page heading="Order Customization">
      {/* Search Section — always visible unless auto-loaded? 
          The requirement says: show normal search field when order_id NOT provided.
          We still show it even when auto-loaded, so user can search again. */}
      <s-section>
        <form onSubmit={handleSearch}>
          <s-stack direction="inline" gap="base">
            <s-search-field
              label="Search"
              labelAccessibilityVisibility="exclusive"
              placeholder="Enter Order ID. eg: 7026433098032"
              value={query}
              onInput={(event: any) => {
                setQuery(event?.target?.value ?? "");
              }}
            />
            <s-button type="submit" variant="primary">
              Search
            </s-button>
          </s-stack>
        </form>
      </s-section>

      <s-section heading="Customization">
        {status === "loading" && <s-text>Loading...</s-text>}

        {status === "error" && error && (
          <s-text tone="critical">{error}</s-text>
        )}

        {status === "success" && customization && (
          <s-section>
            <s-grid>
              <s-switch
                label="Show Product Media"
                details="Hide or display the product media in the downloaded customization file."
                checked={displayBg}
                defaultChecked={true}
                // For web components, `onChange` is usually safer than `onInput`
                onInput={(event: any) => {
                  // Polaris web components typically expose `checked` on the target
                  const target = event.currentTarget as HTMLInputElement;
                  setDisplayBg(target.checked);
                }}
              />
              <p-viewer
                background={displayBg}
                media={customization.media}
                data={customization.fileData}
                config={customization.config}></p-viewer>
            </s-grid>
          </s-section>
        )}

        {status === "idle" && (
          <s-text>Enter an order ID to preview its saved customization.</s-text>
        )}
      </s-section>
    </s-page>
  );
}
