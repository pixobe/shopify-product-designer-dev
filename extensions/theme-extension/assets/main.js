const DESIGN_CONFIG_ENDPOINT = "/apps/pixobe-product-designer/design-config";
const UPLOAD_CONFIG_ENDPOINT = "/apps/pixobe-product-designer/upload";
const DIALOG_SELECTOR = "[data-pixobe-dialog]";
const PIXOBE_DESIGNER_TAG = "product-designer";

const normalizeVariantIdValue = (value) => {
  if (value == null) return null;
  const normalized = `${value}`.trim();
  return normalized || null;
};

const getCurrentVariantId = () => {
  const idInput = document.querySelector('form.product-form input[name="id"]');
  return idInput?.value || null;
};

const getVariant = (defaultValue = null) => {
  const param = new URLSearchParams(window.location.search).get("variant");
  const normalizedDefault = normalizeVariantIdValue(defaultValue);
  return (
    normalizeVariantIdValue(param) || getCurrentVariantId() || normalizedDefault
  );
};

const ensureDialog = () => {
  let dialog = document.querySelector(DIALOG_SELECTOR);
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.setAttribute("data-pixobe-dialog", "");
  document.body.appendChild(dialog);
  return dialog;
};

const showDialog = (dialog) => {
  if (dialog.open) return;

  dialog.replaceChildren(document.createElement("p-spinner"));
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "open");
  }
};

const closeDialog = (dialog) => {
  if (!dialog?.open) return;

  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
};

const applyDesignPayload = (dialog, designer, payload) => {
  designer.config = payload?.config ?? {};
  designer.media = Array.isArray(payload?.media) ? payload.media : [];
  designer.meta = { name: "Round Neck T-Shirt" };
  try {
    designer.labels = window?.pixobeLabels ?? {};
  } catch (e) {
    designer.labels = {};
  }
  dialog.appendChild(designer);
};

const fetchDesignPayload = async (productId, variantId) => {
  const endpoint = new URL(DESIGN_CONFIG_ENDPOINT, window.location.origin);
  endpoint.searchParams.set("productId", productId);
  endpoint.searchParams.set("variantId", variantId);

  try {
    const response = await fetch(endpoint.toString());
    if (!response.ok) return { config: {}, media: [] };

    const payload = await response.json().catch(() => null);
    return {
      config: payload?.config ?? {},
      media: Array.isArray(payload?.media) ? payload.media : [],
    };
  } catch {
    return { config: {}, media: [] };
  }
};

const deriveProductId = (detail, fallback) => {
  if (detail?.productId?.trim?.()) return detail.productId.trim();
  if (detail?.product_id?.trim?.()) return detail.product_id.trim();
  if (detail?.product?.id) return detail.product.id;
  return fallback || null;
};

const addConfiguredItemToCart = async ({ id, quantity, config }) => {
  const form = new FormData();
  form.append("json", JSON.stringify(config ?? {}));
  if (id) form.append("variant_id", id);

  const res = await fetch(UPLOAD_CONFIG_ENDPOINT, {
    method: "POST",
    body: form,
  });
  const uploadPayload = await res.json().catch(() => null);

  if (!res.ok || !uploadPayload?.ok) {
    throw new Error(
      uploadPayload?.error ?? uploadPayload?.message ?? "Upload failed",
    );
  }

  try {
    const response = await fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id,
            quantity,
            properties: { _pixobeid: uploadPayload.fileGid },
          },
        ],
      }),
    });

    const res = await response.json();
    if (!response.ok) {
      console.log(res);
      const message = res.message || "Unable to add item";
      throw new Error(message);
    }
  } catch (e) {
    throw e;
  }
};

async function openPixobeCustomization(e) {
  const target = e.currentTarget;
  if (!target) return;

  target.disabled = true;
  target.classList.add("is-loading");

  const resetButton = () => {
    target.disabled = false;
    target.classList.remove("is-loading");
  };

  try {
    const productId = target.dataset.product;
    const buttonVariantId = normalizeVariantIdValue(target.dataset.variant);
    const variantId = getVariant(buttonVariantId);

    if (!productId && !variantId) {
      resetButton();
      return;
    }

    const dialog = ensureDialog();
    showDialog(dialog);

    const designPayload = await fetchDesignPayload(productId, variantId);
    const designerElement = document.createElement(PIXOBE_DESIGNER_TAG);

    applyDesignPayload(dialog, designerElement, designPayload);

    const cartHandler = async (event) => {
      const detail = event?.detail || {};
      const resolvedProductId = deriveProductId(detail, productId);
      const configPayload = detail.design || {};

      if (!variantId) {
        designerElement.addEventListener("cart", cartHandler, { once: true });
        resetButton();
        return;
      }

      const id = variantId || resolvedProductId;

      try {
        await addConfiguredItemToCart({
          id,
          quantity: 1,
          config: configPayload,
        });
        window.location.reload();
      } catch (error) {
        const msg =
          error.message || "Unable to add item to cart. Please try again.";
        if (window?.alert) {
          window.alert(msg);
        }
      } finally {
        resetButton();
        closeDialog(dialog);
      }
    };

    const onLoaded = () => {
      dialog.querySelector("p-spinner")?.remove();
    };

    const onCloseEvent = () => {
      resetButton();
      closeDialog(dialog);
    };

    designerElement.addEventListener("cart", cartHandler, { once: true });
    designerElement.addEventListener("loaded", onLoaded, { once: true });
    designerElement.addEventListener("cancel", onCloseEvent, { once: true });
  } catch (error) {
    const dialog = document.querySelector(DIALOG_SELECTOR);
    if (dialog) {
      dialog.querySelector("p-spinner")?.remove();
      closeDialog(dialog);
    }
    resetButton();
  }
}
