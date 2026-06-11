"use client";

import { useLanguage } from "./LanguageProvider";

interface LicenseExpiredProps {
  clientName: string;
  expiresAt: string;
  expired: boolean;
  licenseKey: string;
}

export default function LicenseExpired({ clientName, expiresAt, expired, licenseKey }: LicenseExpiredProps) {
  const { lang } = useLanguage();

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a0a 50%, #0a0a1a 100%)",
      zIndex: 99999,
      fontFamily: "system-ui, -apple-system, sans-serif",
      direction: lang === "ar" ? "rtl" : "ltr",
    }}>
      <div style={{
        maxWidth: 440,
        width: "90%",
        padding: "2.5rem 2rem",
        borderRadius: 16,
        border: "1px solid #ef444440",
        background: "linear-gradient(180deg, #1a0c0e, #150b12)",
        boxShadow: "0 0 60px #ef444415, 0 20px 40px #00000060",
        textAlign: "center",
      }}>
        {/* Icon */}
        <div style={{
          fontSize: 56,
          marginBottom: 20,
          filter: "drop-shadow(0 4px 12px #ef444450)",
        }}>
          {expired ? "\u26A0\uFE0F" : "\u{1F512}"}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          color: "#ef4444",
          margin: "0 0 0.8rem",
          lineHeight: 1.3,
        }}>
          {lang === "ar" ? "انتهت صلاحية الاشتراك" :
           lang === "fr" ? "Abonnement expire" :
           "Subscription Expired"}
        </h1>

        {/* Description */}
        <p style={{
          fontSize: "0.88rem",
          color: "#90a8c7",
          lineHeight: 1.7,
          margin: "0 0 1.5rem",
        }}>
          {expired ? (
            lang === "ar"
              ? "لقد انتهت صلاحية اشتراكك في هذا الموقع. يرجى التواصل مع المسؤول لتجديد الاشتراك."
              : lang === "fr"
                ? "Votre abonnement a ce site a expire. Veuillez contacter l'administrateur pour le renouveler."
                : "Your subscription to this site has expired. Please contact the administrator to renew."
          ) : (
            lang === "ar"
              ? "تم تعليق اشتراكك في هذا الموقع. يرجى التواصل مع المسؤول."
              : lang === "fr"
                ? "Votre abonnement a ete suspendu. Veuillez contacter l'administrateur."
                : "Your subscription has been suspended. Please contact the administrator."
          )}
        </p>

        {/* Info Card */}
        <div style={{
          background: "#0e182980",
          borderRadius: 10,
          padding: "1rem",
          marginBottom: "1.5rem",
          border: "1px solid #ffffff10",
        }}>
          {clientName && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.35rem 0",
              fontSize: "0.8rem",
              borderBottom: "1px solid #ffffff08",
            }}>
              <span style={{ color: "#7a95b8" }}>
                {lang === "ar" ? "العميل" : lang === "fr" ? "Client" : "Client"}
              </span>
              <span style={{ color: "#e0e8f0", fontWeight: 500 }}>{clientName}</span>
            </div>
          )}
          {expiresAt && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.35rem 0",
              fontSize: "0.8rem",
              borderBottom: "1px solid #ffffff08",
            }}>
              <span style={{ color: "#7a95b8" }}>
                {lang === "ar" ? "تاريخ الانتهاء" : lang === "fr" ? "Date d'expiration" : "Expiry date"}
              </span>
              <span style={{ color: "#ef4444", fontWeight: 500 }}>{expiresAt}</span>
            </div>
          )}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0.35rem 0",
            fontSize: "0.8rem",
          }}>
            <span style={{ color: "#7a95b8" }}>
              {lang === "ar" ? "مفتاح الرخصة" : lang === "fr" ? "Cle de licence" : "License key"}
            </span>
            <span style={{ color: "#60a5fa", fontFamily: "monospace", fontSize: "0.75rem" }}>{licenseKey}</span>
          </div>
        </div>

        {/* Contact Info */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a5f20, #1e40af10)",
          borderRadius: 10,
          padding: "1rem",
          border: "1px solid #3b82f620",
        }}>
          <p style={{
            fontSize: "0.82rem",
            color: "#60a5fa",
            margin: "0 0 0.4rem",
            fontWeight: 600,
          }}>
            {lang === "ar" ? "لتجديد الاشتراك تواصل معنا:" :
             lang === "fr" ? "Pour renouveler, contactez-nous :" :
             "To renew, contact us:"}
          </p>
          <p style={{
            fontSize: "0.85rem",
            color: "#e0e8f0",
            margin: 0,
            direction: "ltr",
          }}>
            jamalousidi2007@gmail.com
          </p>
        </div>

        {/* Footer */}
        <p style={{
          fontSize: "0.68rem",
          color: "#556b84",
          marginTop: "1.5rem",
          marginBottom: 0,
        }}>
          {lang === "ar" ? "هذه الصفحة لا يمكن تجاوزها" :
           lang === "fr" ? "Cette page ne peut pas etre contournee" :
           "This page cannot be bypassed"}
        </p>
      </div>
    </div>
  );
}
