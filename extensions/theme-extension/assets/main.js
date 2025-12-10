const normalizeValue = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const getVariant = () => {
  const variableQueryParam = normalizeVariantIdValue(
    new URLSearchParams(window.location.search).get("variant"),
  );

  if (variableQueryParam) {
    return variableQueryParam;
  }

  return getCurrentVariantId();
};

const DESIGN_CONFIG_ENDPOINT = "/apps/pixobe-product-designer/design-config";
const UPLOAD_CONFIG_ENDPOINT = "/apps/pixobe-product-designer/upload";
const DIALOG_SELECTOR = "[data-pixobe-dialog]";
const PIXOBE_DESIGNER_TAG = "product-designer";
const VARIANT_ID_PREFIX = "gid://shopify/ProductVariant/";

const normalizeVariantIdValue = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = `${value}`.trim();
  if (!normalized) {
    return null;
  }
  return normalized;
};

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

const removeExistingDesigner = (dialog) => {
  const existingDesigner = dialog.querySelector(PIXOBE_DESIGNER_TAG);
  if (existingDesigner) {
    existingDesigner.remove();
  }
};

const ensureDesignerElement = (dialog) => {
  removeExistingDesigner(dialog);
  const designer = document.createElement(PIXOBE_DESIGNER_TAG);
  return designer;
};

const clearDialogContents = (dialog) => {
  dialog.replaceChildren();
};

const showDialog = (dialog) => {
  if (dialog.open) {
    return;
  }

  clearDialogContents(dialog);
  if (typeof dialog.showModal === "function") {
    dialog.appendChild(document.createElement("pixobe-spinner"));
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

const removeSpinner = (dialog) => {
  const spinner = dialog.querySelector("pixobe-spinner");
  if (spinner) {
    spinner.remove();
  }
};

const applyDesignPayload = (dialog, designer, payload) => {
  designer.config = payload?.config ?? {};
  designer.media = Array.isArray(payload?.media) ? payload.media : [];
  designer.meta = {
    name: "Round Neck T-Shirt",
  };
  designer.labels = {};
  // Remove spinner before appending designer
  dialog.appendChild(designer);
};

const fetchDesignPayload = async (productId, variantId) => {
  const endpoint = new URL(DESIGN_CONFIG_ENDPOINT, window.location.origin);
  endpoint.searchParams.set("productId", productId);
  endpoint.searchParams.set("variantId", variantId);
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

const fetchCartToken = async () => {
  try {
    const response = await fetch("/cart.js");
    if (!response.ok) {
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object") {
      return null;
    }

    if (typeof data.token === "string" && data.token.trim()) {
      return data.token.trim();
    }

    if (typeof data.id === "string" && data.id.trim()) {
      return data.id.trim();
    }

    return null;
  } catch (error) {
    console.warn("Unable to fetch cart token", error);
    return null;
  }
};

const addConfiguredItemToCart = async ({ id, quantity, config }) => {
  const form = new FormData();
  form.append("json", JSON.stringify(config ?? {}));

  if (id) {
    form.append("variant_id", id);
  }

  const res = await fetch(UPLOAD_CONFIG_ENDPOINT, {
    method: "POST",
    body: form,
  });
  const uploadPayload = await res.json().catch(() => null);

  if (!res.ok || !uploadPayload?.ok) {
    const message =
      uploadPayload?.error ?? uploadPayload?.message ?? "Upload failed";
    throw new Error(message);
  }

  const fileGid = uploadPayload.fileGid;

  const response = await fetch("/cart/add.js", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          id,
          quantity,
          properties: {
            _pixobeid: fileGid,
          },
        },
      ],
    }),
  });

  const cartData = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (cartData && cartData.error) || "Unable to add item";
    throw new Error(message);
  }

  return uploadPayload;
};

function getCurrentVariantId() {
  const productForm = document.querySelector("form.product-form");
  if (!productForm) return null;

  const idInput = productForm.querySelector('input[name="id"]');
  if (!idInput) return null;

  return idInput.value; // this is the current variant ID
}

/**
 *
 * @param {*} e
 * @returns
 */
async function pcustomize(e) {
  const target = e.currentTarget;
  if (!target) return;

  // disable button + loading state
  target.disabled = true;
  target.classList.add("is-loading");

  try {
    const productId = target.dataset.product;
    const variantId = getVariant();
    if (!productId && !variantId) {
      console.warn("Unable to determine productId for design config request");
      // if we can't continue, re-enable immediately
      target.disabled = false;
      target.classList.remove("is-loading");
      return;
    }

    const dialog = ensureDialog();
    showDialog(dialog);

    const designPayload = await fetchDesignPayload(productId, variantId);
    const designerElement = ensureDesignerElement(dialog);

    console.log("Customie", designPayload);

    applyDesignPayload(dialog, designerElement, designPayload);

    // When user finishes and adds to cart
    const cartHandler = async (event) => {
      const detail = (event && event.detail) || {};
      const resolvedProductId = deriveProductId(detail, productId);
      const configPayload = detail.design || {};
      if (!variantId) {
        console.warn("Designer cart event missing variant id", detail);
        designerElement.addEventListener("cart", cartHandler, { once: true });
        target.disabled = false;
        target.classList.remove("is-loading");
        return;
      }

      const id = variantId ? variantId : resolvedProductId;

      try {
        await addConfiguredItemToCart({
          id,
          quantity: 1,
          config: configPayload,
        });

        closeDialog(dialog);
      } catch (error) {
        console.error("Unable to add configured item to cart", error.message);
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

    const onLoaded = () => {
      const spinner = dialog.querySelector("pixobe-spinner");
      spinner.remove();
    };

    const onCloseEvent = () => {
      target.disabled = false;
      target.classList.remove("is-loading");
      closeDialog(dialog);
    };

    designerElement.addEventListener("cart", cartHandler, { once: true });
    // on loaded
    designerElement.addEventListener("loaded", onLoaded, { once: true });
    // When user cancels customization
    designerElement.addEventListener("cancel", onCloseEvent, { once: true });

    // The End
  } catch (error) {
    console.error("Error while opening designer:", error);
    // in case of any failure, restore the button state and remove spinner
    const dialog = document.querySelector(DIALOG_SELECTOR);
    if (dialog) {
      removeSpinner(dialog);
      closeDialog(dialog);
    }
    target.disabled = false;
    target.classList.remove("is-loading");
  }
}
