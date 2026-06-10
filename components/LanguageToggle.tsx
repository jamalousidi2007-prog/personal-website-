"use client";

import { useLanguage } from "./LanguageProvider";

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="lang-toggle" role="group" aria-label="language switcher">
      <button className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
        AR
      </button>
      <button className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>
        FR
      </button>
      <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
        EN
      </button>
    </div>
  );
}
