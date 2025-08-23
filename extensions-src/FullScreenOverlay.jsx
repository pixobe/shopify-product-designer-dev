import { createPortal } from "react-dom";

export default function FullScreenOverlay({ active, onClose, children }) {
  if (!active) return null;

  return createPortal(
    <div className="custom-overlay">
      <div className="custom-overlay-content">
        {children}
        <button onClick={onClose} className="custom-overlay-close">
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}
