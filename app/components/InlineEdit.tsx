"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./HomeDashboard.module.css";

const STORAGE_KEY = "inline-text-overrides";

type EditableTextProps = {
  id: string;
  defaultText: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  editable?: boolean;
};

function readStore(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export default function EditableText({ id, defaultText, className, as = "span", editable = true }: EditableTextProps) {
  const Tag = as;
  const [value, setValue] = useState(defaultText);
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const store = readStore();
    setValue(store[id] ?? defaultText);
  }, [defaultText, id]);

  const tooltip = useMemo(() => "Click to edit", []);

  const save = (next: string) => {
    const trimmed = next.trim();
    const finalText = trimmed.length ? trimmed : defaultText;
    setValue(finalText);
    const store = readStore();
    store[id] = finalText;
    writeStore(store);
  };

  return (
    <div className={styles.inlineEditContainer}>
      <Tag
        ref={(node) => {
          ref.current = node as HTMLElement | null;
        }}
        className={className}
        contentEditable={editing}
        suppressContentEditableWarning
        onBlur={(e) => {
          if (!editable) return;
          setEditing(false);
          save(e.currentTarget.textContent || "");
        }}
        onKeyDown={(e) => {
          if (!editable) return;
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
            setValue(defaultText);
            requestAnimationFrame(() => {
              if (ref.current) ref.current.textContent = defaultText;
            });
            (e.currentTarget as HTMLElement).blur();
          }
        }}
        title={editable ? tooltip : undefined}
        style={{ outline: editable && editing ? "1px dashed #60a5fa" : "none", borderRadius: "6px" }}
      >
        {value}
      </Tag>
      {editable && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setEditing(true);
            requestAnimationFrame(() => ref.current?.focus());
          }}
          className={styles.editTrigger}
          aria-label="Edit text"
          title={tooltip}
        >
          قلم
        </button>
      )}
    </div>
  );
}
