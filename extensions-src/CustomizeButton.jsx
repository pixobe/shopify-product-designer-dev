import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@shopify/polaris";
import { EditIcon } from "@shopify/polaris-icons";
import FullScreenOverlay from "./FullScreenOverlay";

export default function CustomizeButton(props) {
  const { btn_background, btn_color, btn_label, btn_placement } = props;
  console.log("Button Props:", props);
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
    console.log("Fetching product config...");
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
    console.log(data);
    setOverlayActive((prev) => !prev);
  };

  const floatingButton = (
    <div
      className="floating"
      style={{ "--btn-background": btn_background, "--btn-color": btn_color }}
    >
      <button type="button" className="button-floating" onClick={toggleOverlay}>
        <Icon source={EditIcon} color="base" />
      </button>

      <FullScreenOverlay active={overlayActive} onClose={toggleOverlay}>
        <product-designer></product-designer>
      </FullScreenOverlay>
    </div>
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
        <product-designer config={response?.config}></product-designer>
      </FullScreenOverlay>
    </div>
  );

  if (btn_placement === "floating") return floatingButton;
  if (targetEl) return createPortal(inlineButton, targetEl);
  return floatingButton;
}
