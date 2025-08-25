import { createPortal } from "react-dom";

export default function FullScreenOverlay({ active, onClose, children }) {
  if (!active) return null;

  return createPortal(
    <div className="custom-overlay">
      <div className="custom-overlay-content">{children}</div>
    </div>,
    document.body,
  );
}
