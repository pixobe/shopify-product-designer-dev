import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@shopify/polaris";
import { PlusCircleIcon } from "@shopify/polaris-icons";
/**
 *
 * @returns
 */
export default function CustomizeButton(props) {
  const { btn_background, btn_color, btn_label, btn_placement } = props;
  const [targetEl, setTargetEl] = useState(null);

  useEffect(() => {
    if (btn_placement !== "floating") {
      // Example: append to product form
      const el = document.querySelector(".product-form__buttons");
      if (el) {
        setTargetEl(el);
      }
    }
  }, [btn_placement]);

  const floatingButton = (
    <div
      style={{
        position: "fixed",
        bottom: "50px",
        right: "50px",
        zIndex: 1000,
      }}
    >
      <button
        style={{
          backgroundColor: btn_background,
          color: btn_color,
          borderRadius: "50%",
          width: "50px",
          height: "50px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <icon-edit></icon-edit>
      </button>
    </div>
  );

  if (btn_placement === "floating") {
    return floatingButton;
  }

  const inlineButton = (
    <button
      style={{
        backgroundColor: btn_background,
        color: btn_color,
        marginTop: "1rem",
      }}
      type="button"
      className="button button--full-width button--secondary"
    >
      {btn_label}
      <Icon source={PlusCircleIcon} tone="inherit" />
    </button>
  );

  // If target element found, append as child
  if (targetEl) {
    return createPortal(inlineButton, targetEl);
  }

  // Fallback: render floating button instead of inline
  return floatingButton;
}
