import { Fragment, useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@shopify/polaris";
import { EditIcon } from "@shopify/polaris-icons";
import FullScreenOverlay from "./FullScreenOverlay";

function CreateCustomizeOverlay({ overlayActive, toggleOverlay, result }) {
  const containerRef = useRef(null);
  const designerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (result) {
      if (!designerRef.current) {
        designerRef.current = document.createElement("product-designer");
        containerRef.current.appendChild(designerRef.current);
      }
      designerRef.current.config = result.config;
      designerRef.current.media = result.media;
      designerRef.current.meta = result.meta;
    } else {
      if (designerRef.current) {
        designerRef.current.remove();
        designerRef.current = null;
      }
    }
  }, [result]);

  return (
    <FullScreenOverlay active={overlayActive} onClose={toggleOverlay}>
      <div ref={containerRef} className="container-ref" />
    </FullScreenOverlay>
  );
}

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

  const result = response?.result;

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

      <CreateCustomizeOverlay
        overlayActive={overlayActive}
        toggleOverlay={toggleOverlay}
        result={result}
      />
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

      <CreateCustomizeOverlay
        overlayActive={overlayActive}
        toggleOverlay={toggleOverlay}
        result={result}
      />
    </div>
  );

  if (btn_placement === "floating") return floatingButton;
  if (targetEl) return createPortal(inlineButton, targetEl);
  return floatingButton;
}
