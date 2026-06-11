"use client";

import { useEffect } from "react";
import styles from "./ImageLightbox.module.css";

type Props = {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
  onImageClick?: () => void;
};

export default function ImageLightbox({ open, src, alt = "image", onClose, onImageClick }: Props) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close preview">
        ×
      </button>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
        <img
          src={src}
          alt={alt}
          className={styles.image}
          style={{ cursor: onImageClick ? "pointer" : "default" }}
          onClick={(event) => {
            event.stopPropagation();
            if (onImageClick) {
              onImageClick();
            } else {
              onClose();
            }
          }}
        />
        {onImageClick && (
          <span style={{ color: "#9cb0c9", fontSize: "0.78rem", background: "#0f172acc", padding: "0.3rem 0.8rem", borderRadius: "8px" }}>
            Click image to change
          </span>
        )}
      </div>
    </div>
  );
}
