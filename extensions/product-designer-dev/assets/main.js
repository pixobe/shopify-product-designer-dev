class PixobeCustomizeButton extends HTMLElement {
  constructor() {
    super();
    this.isInitialized = false;
  }

  static get observedAttributes() {
    return ["label", "variant-id", "position", "product-id"];
  }

  connectedCallback() {
    if (!this.isInitialized) {
      this.render();
      this.setupButton();
      this.isInitialized = true;
    }

    // Register with global listener manager
  }

  disconnectedCallback() {
    this.isInitialized = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && name === "label") {
      this.render();
    }
  }

  get label() {
    return this.getAttribute("label") || "Customize";
  }

  get variantId() {
    const cartForm = document.querySelector('form[action="/cart/add"]');
    if (cartForm) {
      const variantId = cartForm.querySelector('input[name="id"]').value;
      if (variantId) {
        return variantId;
      }
    }
    return this.getAttribute("variant-id") || "";
  }

  get productId() {
    return this.getAttribute("product-id") || "";
  }

  render() {
    this.innerHTML = `<button class="button button--full-width button--secondary" type="button">${this.label}</button>`;
  }

  setupButton() {
    const button = this.querySelector(".button");
    if (!button) return;

    button.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleOnClick();
    });
  }

  async handleOnClick() {
    const button = this.querySelector(".button");
    if (!button) return;

    button.disabled = true;
    button.classList.add("loading");

    const modal = document.getElementById("pixobe-customize-modal");
    if (modal) {
      modal.open = true;
      modal.replaceChildren(); // Clear modal content for loading state
    }

    try {
      const data = await this.fetchProductConfig();
      this.handleConfigSuccess(data);
    } catch (err) {
      this.handleConfigError(err);
    } finally {
      button.disabled = false;
      button.classList.remove("loading");
    }
  }

  async fetchProductConfig() {
    // if both not found throw an error
    if (!this.productId && !this.variantId) {
      throw new Error("No product or variant ID available");
    }

    const res = await fetch(
      `/apps/pixobe-product-designer/product-config?productId=${this.productId}&variantId=${this.variantId}`,
    );

    // Attempt to parse the response as JSON even if it's not "ok"
    const data = await res.json();

    // Check if the response was not OK (status 400-599)
    if (!res.ok) {
      // Use the error message from the server response if available
      const serverMessage = data?.message || res.statusText;
      throw new Error(`Error ${res.status}: ${serverMessage}`);
    }

    return data;
  }

  handleConfigSuccess(data) {
    const modal = document.getElementById("pixobe-customize-modal");
    if (!modal || !data.success || !data.result) {
      // Handle a malformed success response as an error
      this.handleConfigError(new Error("Unexpected response from server."));
      return;
    }

    const productDesigner = document.createElement("product-designer");
    productDesigner.config = data.result.config || {};
    productDesigner.media = data.result.media || [];
    productDesigner.meta = data.result.meta || {};

    const spinner = document.createElement("pixobes-spinner");

    // Set up cart listener
    productDesigner.addEventListener("cart", async (e) => {
      const config = e.detail;
      const id = this.variantId || this.productId;
      modal.appendChild(spinner);
      await this.handleAddToCart(id, 1, config);
      window.location.reload();
    });

    modal.replaceChildren(productDesigner);
  }

  async handleAddToCart(id, quantity = 1, config) {
    if (!id) {
      console.error("Product or Variant ID not available for add to cart");
      return;
    }

    const data = {
      items: [
        {
          id,
          quantity,
          properties: {
            _pixobe_custom_data: config,
            Customize: "true",
          },
        },
      ],
    };

    try {
      const res = await fetch(window.Shopify.routes.root + "cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        // If the server returns an error, attempt to read the JSON for a specific message
        const data = await res.json();
        const serverMessage = data?.description || res.statusText;
        throw new Error(`Add to cart failed: ${serverMessage}`);
      }
      const result = await res.json();

      return result;
    } catch (err) {
      console.error("Add to cart failed:", err);
      // It might be helpful to throw here so the original caller can handle it
      throw err;
    }
  }

  handleConfigError(err) {
    const modal = document.getElementById("pixobe-customize-modal");
    if (!modal) return;

    const div = document.createElement("div");
    const errorMessage =
      err?.message || "An unexpected error occurred. Please try again.";
    div.textContent = errorMessage;
    modal.closeButton = true;
    modal.replaceChildren(div);
  }
}

if (!customElements.get("pixobe-customize-button")) {
  customElements.define("pixobe-customize-button", PixobeCustomizeButton);
}
