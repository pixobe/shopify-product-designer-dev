import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@shopify/polaris";
import { EditIcon } from "@shopify/polaris-icons";
import FullScreenOverlay from "./FullScreenOverlay";

export default function CustomizeButton(props) {
  const { btn_background, btn_color, btn_label, btn_placement } = props;
  const [targetEl, setTargetEl] = useState(null);
  const [overlayActive, setOverlayActive] = useState(false);

  const [response, setResponse] = useState(null);

  useEffect(() => {
    if (btn_placement !== "floating") {
      const el = document.querySelector(".product-form__buttons");
      if (el) setTargetEl(el);
    }
  }, [btn_placement]);

  const toggleOverlay = async () => {
    const res = await fetch(
      "/apps/pixobe-product-designer/product-config?productId=9486903247152",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
    const data = await res.json();
    setResponse(data);
    setOverlayActive((prev) => !prev);
  };

  // const result = response?.result;
  // console.log("Product Config result:", result);

  const result = {
    config: {},
    media: [
      {
        src: "https://cdn.shopify.com/s/files/1/0813/7575/6592/files/PurpleTshirt01.webp?v=1718792164",
        stroke: "",
      },
    ],
    meta: {
      name: "TShirt",
    },
  };
  const floatingButton = (
    <Fragment>
      <button
        type="button"
        className="floating button-floating"
        style={{ "--btn-background": btn_background, "--btn-color": btn_color }}
        onClick={toggleOverlay}
      >
        <Icon source={EditIcon} color="base" />
      </button>

      <FullScreenOverlay active={overlayActive} onClose={toggleOverlay}>
        {result && (
          <div
            ref={(el) => {
              if (el && result) {
                // Clear any existing content
                el.innerHTML = "";

                // Create the web component
                const productDesigner =
                  document.createElement("product-designer");

                // Set properties directly on the element
                productDesigner.config = result.config;
                productDesigner.media = result.media;
                productDesigner.meta = result.meta;

                // Append to container
                el.appendChild(productDesigner);
              }
            }}
          />
        )}
      </FullScreenOverlay>
    </Fragment>
  );

  const inlineButton = (
    <div
      style={{ "--btn-background": btn_background, "--btn-color": btn_color }}
    >
      <button
        type="button"
        onClick={toggleOverlay}
        className="button button--full-width button--secondary button-inline"
      >
        {btn_label}
      </button>

      <FullScreenOverlay active={overlayActive} onClose={toggleOverlay}>
        {result && (
          <div
            className="customize-container"
            ref={(el) => {
              if (el && result) {
                // Clear any existing content
                el.innerHTML = "";

                // Create the web component
                const productDesigner =
                  document.createElement("product-designer");

                // Set properties directly on the element
                productDesigner.config = result.config;
                productDesigner.media = result.media;
                productDesigner.meta = result.meta;

                // Append to container
                el.appendChild(productDesigner);
              }
            }}
          />
        )}
      </FullScreenOverlay>
    </div>
  );

  if (btn_placement === "floating") return floatingButton;
  if (targetEl) return createPortal(inlineButton, targetEl);
  return floatingButton;
}
