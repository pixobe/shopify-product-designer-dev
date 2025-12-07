const normalizeValue = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const getProductIdFromDom = () => {
  const selectors = [
    () => document.body?.dataset.productId ?? null,
    () => document.body?.dataset.productGid ?? null,
    () => document.documentElement?.dataset.productId ?? null,
    () =>
      document
        .querySelector("[data-product-id]")
        ?.getAttribute("data-product-id") ?? null,
    () =>
      document
        .querySelector("[data-product-gid]")
        ?.getAttribute("data-product-gid") ?? null,
  ];

  for (const selector of selectors) {
    const candidate = normalizeValue(selector());
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

const getProductIdFromShopifyGlobals = () => {
  const analytics = window.ShopifyAnalytics?.meta;
  const pageResource = window?.meta?.page;

  const candidates = [
    () => analytics?.product?.id,
    () => analytics?.product?.gid,
    () => analytics?.product?.resourceId,
    () => analytics?.page?.resourceId,
    () => pageResource?.resourceId,
  ];

  for (const candidate of candidates) {
    const value = normalizeValue(candidate());
    if (value) {
      return value;
    }
  }

  return null;
};

const getProductId = () => {
  const queryParam = normalizeValue(
    new URLSearchParams(window.location.search).get("productId"),
  );
  if (queryParam) {
    return queryParam;
  }

  return getProductIdFromDom() ?? getProductIdFromShopifyGlobals();
};

const DESIGN_CONFIG_ENDPOINT = "/apps/pixobe-product-designer/design-config";
const DIALOG_SELECTOR = "[data-pixobe-dialog]";
const PIXOBE_DESIGNER_TAG = "product-designer";

const ensureDialog = () => {
  let dialog = document.querySelector(DIALOG_SELECTOR);

  if (dialog) {
    return dialog;
  }

  dialog = document.createElement("dialog");
  dialog.setAttribute("data-pixobe-dialog", "");
  document.body.appendChild(dialog);

  return dialog;
};

const ensureDesignerElement = (dialog) => {
  let designer = dialog.querySelector(PIXOBE_DESIGNER_TAG);

  if (designer) {
    return designer;
  }

  designer = document.createElement(PIXOBE_DESIGNER_TAG);
  designer.setAttribute("data-pixobe-designer", "");
  dialog.appendChild(designer);

  return designer;
};

const showDialog = (dialog) => {
  if (dialog.open) {
    return;
  }

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "open");
};

const closeDialog = (dialog) => {
  if (!dialog || !dialog.open) {
    return;
  }

  // If it's a <dialog> element with a close() method
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }

  // Fallback: just remove the open attribute
  dialog.removeAttribute("open");
};

const applyDesignPayload = (designer, payload) => {
  designer.config = payload?.config ?? {};
  designer.media = Array.isArray(payload?.media) ? payload.media : [];
  designer.meta = {
    id: "1066",
    name: "Round Neck T-Shirt",
    price: "50",
    currency: "&#36;",
    description:
      "Neque porro quisquam est qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit",
  };
  designer.labels = {};
  console.log(designer.media, "<<");
};

const fetchDesignPayload = async (productId) => {
  const endpoint = new URL(DESIGN_CONFIG_ENDPOINT, window.location.origin);
  endpoint.searchParams.set("productId", productId);

  try {
    const response = await fetch(endpoint.toString());

    if (!response.ok) {
      console.error(
        "Design config fetch failed",
        response.status,
        response.statusText,
      );
      return { config: {}, media: [] };
    }

    const payload = await response.json().catch(() => null);

    return {
      config: payload?.config ?? {},
      media: Array.isArray(payload?.media) ? payload.media : [],
    };
  } catch (error) {
    console.error("Unable to fetch design config", error);
    return { config: {}, media: [] };
  }
};

async function onCustomizeButtonClick() {
  const productId = getProductId();
  if (!productId) {
    console.warn("Unable to determine productId for design config request");
    return;
  }
  const dialog = ensureDialog();
  const designerElement = ensureDesignerElement(dialog);
  const designPayload = await fetchDesignPayload(productId);
  applyDesignPayload(designerElement, designPayload);

  designerElement.addEventListener("cart", async (e) => {
    console.log("cart ", e.detail);
  });

  designerElement.addEventListener("cancel", async (e) => {
    closeDialog(dialog);
  });

  showDialog(dialog);
}
