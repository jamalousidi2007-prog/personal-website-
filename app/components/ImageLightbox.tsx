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
      <img
        src={src}
        alt={alt}
        className={styles.image}
        onClick={(event) => {
          event.stopPropagation();
          onImageClick?.();
        }}
      />
    </div>
  );
}
