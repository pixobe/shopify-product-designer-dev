/**
 *
 * @name: PixobeCustomizeButton Web Component
 */

// PixobeCustomizeButton Web Component
class PixobeCustomizeButton extends HTMLElement {
  constructor() {
    super();
    this.isInitialized = false;
  }

  static get observedAttributes() {
    return ["label", "variant", "position", "product-id"];
  }

  connectedCallback() {
    if (!this.isInitialized) {
      this.render();
      this.setupEventListeners();
      this.isInitialized = true;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.isInitialized) {
      this.render();
    }
  }

  get label() {
    return this.getAttribute("label") || "Customize";
  }

  get variant() {
    return this.getAttribute("variant") || "primary";
  }

  get position() {
    return this.getAttribute("position") || "default";
  }

  get productId() {
    return this.getAttribute("product-id") || "";
  }

  render() {
    const buttonHTML = `
      <button class="button button--full-width button--secondary" type="button">
        ${this.label}
      </button>
    `;

    this.innerHTML = buttonHTML;
  }

  setupEventListeners() {
    const button = this.querySelector(".button");

    button.addEventListener("click", (event) => {
      event.preventDefault();
      this.handleOnClick();
    });
  }

  handleOnClick() {
    // Add loading state
    const button = this.querySelector(".button");
    button.classList.add("loading");
    button.disabled = true;

    const modal = document.getElementById("pixobe-customize-modal");
    modal.open = true;

    // Make GET call to product-config endpoint
    this.fetchProductConfig()
      .then((data) => {
        // Handle successful response
        this.handleConfigSuccess(data);
      })
      .catch((error) => {
        this.handleConfigError(error);
      })
      .finally(() => {
        // Remove loading state
        button.classList.remove("loading");
        button.disabled = false;
      });
  }

  async fetchProductConfig() {
    const productId = this.productId;
    const url = `/apps/pixobe-product-designer/product-config?productId=${productId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  handleConfigSuccess(data) {
    const modal = document.getElementById("pixobe-customize-modal");
    if (data.success && data.result) {
      const productDesigner = document.createElement("product-designer");
      // Set config, media, and meta to the element
      productDesigner.config = data.result.config || {};
      productDesigner.media = data.result.media || [];
      productDesigner.meta = data.result.meta || {};

      // Store the variant ID for cart operations
      this.variantId = data.result.meta?.variantId;

      this.productDesignerElement = productDesigner;
      productDesigner.addEventListener(
        "cart",
        this.onCustomizeEvent.bind(this),
      );
      // Query for the modal and attach the element
      modal.replaceChildren(productDesigner);
    }
  }

  onCustomizeEvent(event) {
    // Get variantId from stored meta data
    const variantId =
      this.variantId || this.getAttribute("variant-id") || this.productId;

    if (variantId) {
      this.handleAddToCart(variantId, 1);
    }
  }

  async handleAddToCart(variantId, quantity = 1) {
    fetch(window.Shopify.routes.root + "cart/add.js", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            id: variantId, // Replace with the actual variant ID
            quantity: quantity, // Replace with the desired quantity
          },
        ],
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Item added to cart:", data);
        // Handle successful addition (e.g., update cart count, show confirmation)
      })
      .catch((error) => {
        console.error("Error adding to cart:", error);
        // Handle errors
      });
  }

  handleConfigError(error) {
    // Handle error
    const modal = document.getElementById("pixobe-customize-modal");
    modal.closeButton = true;
    const p = document.createElement("p");
    p.innerHTML =
      error.message ||
      "Unable to load product configuration. Please try again later.";
    modal.replaceChildren(p);
  }

  // Public methods
  setLoading(isLoading) {
    const button = this.querySelector(".button");
    if (isLoading) {
      button.classList.add("loading");
      button.disabled = true;
    } else {
      button.classList.remove("loading");
      button.disabled = false;
    }
  }

  updateLabel(newLabel) {
    this.setAttribute("label", newLabel);
  }
}

// Register the custom element
if (!customElements.get("pixobe-customize-button")) {
  customElements.define("pixobe-customize-button", PixobeCustomizeButton);
}
