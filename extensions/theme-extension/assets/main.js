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
  const productQueryParam = normalizeValue(
    new URLSearchParams(window.location.search).get("productId"),
  );

  const variableQueryParam = normalizeValue(
    new URLSearchParams(window.location.search).get("variant"),
  );

  console.log("Variable query param", variableQueryParam);

  const queryParam = variableQueryParam || productQueryParam;

  if (queryParam) {
    return queryParam;
  }

  const productId = getProductIdFromDom() ?? getProductIdFromShopifyGlobals();
  if (productId) {
    return productId;
  }
};

const DESIGN_CONFIG_ENDPOINT = "/apps/pixobe-product-designer/design-config";
const CART_ENDPOINT = "/apps/pixobe-product-designer/cart";
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

const deriveVariantId = (detail) => {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  return (
    detail.variantId ||
    detail.variant_id ||
    (detail.variant && detail.variant.id) ||
    detail.id ||
    null
  );
};

const deriveProductId = (detail, fallback) => {
  if (
    detail &&
    typeof detail.productId === "string" &&
    detail.productId.trim()
  ) {
    return detail.productId.trim();
  }

  if (
    detail &&
    typeof detail.product_id === "string" &&
    detail.product_id.trim()
  ) {
    return detail.product_id.trim();
  }

  if (detail && detail.product && typeof detail.product.id === "string") {
    return detail.product.id;
  }

  return fallback || null;
};

const normalizeCartQuantity = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.trunc(parsed));
    }
  }

  return 1;
};

const sanitizeProperties = (value) => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return Object.assign({}, value);
};

const addConfiguredItemToCart = async ({
  variantId,
  productId,
  quantity,
  config,
  properties,
}) => {
  const body = {
    variantId,
    productId,
    quantity,
  };

  if (config !== undefined) {
    body.config = config;
  }

  if (properties && Object.keys(properties).length) {
    body.properties = properties;
  }

  const response = await fetch(CART_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = (payload && payload.error) || "Unable to add item";
    throw new Error(message);
  }

  return payload;
};

function getCurrentVariantId() {
  const productForm = document.querySelector("form.product-form");
  if (!productForm) return null;

  const idInput = productForm.querySelector('input[name="id"]');
  if (!idInput) return null;

  return idInput.value; // this is the current variant ID
}

async function onCustomizeButtonClick(e) {
  const target = e.currentTarget;
  if (!target) return;

  // disable button + loading state
  target.disabled = true;
  target.classList.add("is-loading");

  try {
    const productId = getProductId();
    console.log("ProductID", productId);
    if (!productId) {
      console.warn("Unable to determine productId for design config request");
      // if we can't continue, re-enable immediately
      target.disabled = false;
      target.classList.remove("is-loading");
      return;
    }

    const dialog = ensureDialog();
    const designerElement = ensureDesignerElement(dialog);
    const designPayload = await fetchDesignPayload(productId);

    applyDesignPayload(designerElement, designPayload);

    // When user finishes and adds to cart
    const cartHandler = async (event) => {
      const detail = (event && event.detail) || {};
      const variantId = deriveVariantId(detail);
      const resolvedProductId = deriveProductId(detail, productId);
      const configPayload =
        detail.config ||
        detail.customConfig ||
        detail.designerConfig ||
        detail.payload;

      if (!variantId) {
        console.warn("Designer cart event missing variant id", detail);
        designerElement.addEventListener("cart", cartHandler, { once: true });
        target.disabled = false;
        target.classList.remove("is-loading");
        return;
      }

      try {
        await addConfiguredItemToCart({
          variantId,
          productId: resolvedProductId,
          quantity: normalizeCartQuantity(detail.quantity || detail.qty || 1),
          config: configPayload,
          properties: sanitizeProperties(detail.properties || null),
        });

        closeDialog(dialog);
      } catch (error) {
        console.error("Unable to add configured item to cart", error);
        if (typeof window !== "undefined" && window.alert) {
          window.alert("Unable to add item to cart. Please try again.");
        }
        designerElement.addEventListener("cart", cartHandler, { once: true });
        return;
      } finally {
        target.disabled = false;
        target.classList.remove("is-loading");
      }
    };

    designerElement.addEventListener("cart", cartHandler, { once: true });

    // When user cancels customization
    designerElement.addEventListener(
      "cancel",
      () => {
        target.disabled = false;
        target.classList.remove("is-loading");
        closeDialog(dialog);
      },
      { once: true },
    );

    showDialog(dialog);
  } catch (error) {
    console.error("Error while opening designer:", error);
    // in case of any failure, restore the button state
    target.disabled = false;
    target.classList.remove("is-loading");
  }
}
