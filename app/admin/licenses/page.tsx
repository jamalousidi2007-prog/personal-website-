"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createLicense,
  getLicenses,
  toggleLicense,
  extendLicense,
  deleteLicense,
  isLicenseSystemConfigured,
  type LicenseInfo,
  type LicenseData
} from "@/lib/licenseService";

export default function AdminLicensesPage() {
  const { lang } = useLanguage();
  const { user, role } = useAuth();

  const [licenses, setLicenses] = useState<LicenseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdLicense, setCreatedLicense] = useState<LicenseData | null>(null);
  const [copied, setCopied] = useState("");

  const isSuperAdmin = role === "superadmin";

  const fetchLicenses = useCallback(async () => {
    if (!isLicenseSystemConfigured) return;
    setLoading(true);
    const data = await getLicenses();
    setLicenses(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) fetchLicenses();
  }, [user, fetchLicenses]);

  const handleCreate = async () => {
    if (!newClientName.trim() || !newClientEmail.trim()) return;
    setCreating(true);
    const result = await createLicense(newClientName.trim(), newClientEmail.trim(), newDuration, newNotes.trim());
    if (result) {
      setCreatedLicense(result);
      setShowForm(false);
      setNewClientName("");
      setNewClientEmail("");
      setNewNotes("");
      fetchLicenses();
    }
    setCreating(false);
  };

  const handleToggle = async (key: string, currentActive: boolean) => {
    await toggleLicense(key, !currentActive);
    fetchLicenses();
  };

  const handleExtend = async (key: string) => {
    await extendLicense(key, 30);
    fetchLicenses();
  };

  const handleDelete = async (key: string) => {
    const confirm = lang === "ar" ? "هل تريد حذف هذه الرخصة؟" : "Delete this license?";
    if (!window.confirm(confirm)) return;
    await deleteLicense(key);
    fetchLicenses();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  const getEnvTemplate = (key: string) => {
    return `# License Key (provided by developer)
NEXT_PUBLIC_LICENSE_KEY=${key}

# License Server (do NOT change these)
NEXT_PUBLIC_LICENSE_FIREBASE_API_KEY=${process.env.NEXT_PUBLIC_LICENSE_FIREBASE_API_KEY || "YOUR_LICENSE_FIREBASE_API_KEY"}
NEXT_PUBLIC_LICENSE_FIREBASE_AUTH_DOMAIN=${process.env.NEXT_PUBLIC_LICENSE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com"}
NEXT_PUBLIC_LICENSE_FIREBASE_PROJECT_ID=${process.env.NEXT_PUBLIC_LICENSE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID"}
NEXT_PUBLIC_LICENSE_FIREBASE_STORAGE_BUCKET=${process.env.NEXT_PUBLIC_LICENSE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.firebasestorage.app"}
NEXT_PUBLIC_LICENSE_FIREBASE_SENDER_ID=${process.env.NEXT_PUBLIC_LICENSE_FIREBASE_SENDER_ID || "YOUR_SENDER_ID"}
NEXT_PUBLIC_LICENSE_FIREBASE_APP_ID=${process.env.NEXT_PUBLIC_LICENSE_FIREBASE_APP_ID || "YOUR_APP_ID"}

# Your own Firebase (for your data)
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_PROJECT.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# EmailJS (optional)
NEXT_PUBLIC_EMAILJS_SERVICE_ID=
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
NEXT_PUBLIC_EMAILJS_TEMPLATE_ALERT=
NEXT_PUBLIC_EMAILJS_TEMPLATE_DAILY=`;
  };

  // Redirect non-superadmin
  if (user && !isSuperAdmin) {
    return (
      <main className="page-shell">
        <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <h2 style={{ color: "#ef4444" }}>
            {lang === "ar" ? "غير مصرح" : lang === "fr" ? "Non autorise" : "Not Authorized"}
          </h2>
          <Link href="/home" style={{ color: "#60a5fa" }}>
            {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
          </Link>
        </div>
      </main>
    );
  }

  const activeCount = licenses.filter((l) => l.active && !l.expired).length;

  return (
    <main className="page-shell">
      <div className="container" style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.8rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/home" style={{
              color: "#60a5fa", textDecoration: "none", fontSize: "0.85rem",
              padding: "0.3rem 0.8rem", borderRadius: 6,
              background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)"
            }}>
              {"\u2190"} {lang === "ar" ? "رجوع" : "Back"}
            </Link>
            <h1 style={{ color: "#e0e8f0", fontSize: "1.2rem", margin: 0 }}>
              {lang === "ar" ? "\u{1F511} \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0631\u062E\u0635" :
               lang === "fr" ? "\u{1F511} Gestion des licences" :
               "\u{1F511} License Management"}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <span style={{
              color: "#34d399", fontSize: "0.8rem",
              background: "rgba(52,211,153,0.1)", padding: "0.3rem 0.8rem", borderRadius: 20,
              border: "1px solid rgba(52,211,153,0.2)"
            }}>
              {activeCount} {lang === "ar" ? "نشطة" : "active"}
            </span>
            <button onClick={() => { setShowForm(true); setCreatedLicense(null); }} style={{
              background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8,
              padding: "0.5rem 1rem", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600
            }}>
              + {lang === "ar" ? "رخصة جديدة" : lang === "fr" ? "Nouvelle licence" : "New License"}
            </button>
          </div>
        </div>

        {!isLicenseSystemConfigured && (
          <div style={{
            background: "#78350f30", border: "1px solid #f59e0b44", borderRadius: 10,
            padding: "1rem", marginBottom: "1rem", color: "#fbbf24", fontSize: "0.85rem"
          }}>
            {lang === "ar"
              ? "\u26A0\uFE0F نظام الرخص غير مهيأ. أضف NEXT_PUBLIC_LICENSE_FIREBASE_* في .env.local"
              : "\u26A0\uFE0F License system not configured. Add NEXT_PUBLIC_LICENSE_FIREBASE_* vars to .env.local"}
          </div>
        )}

        {/* Created License Card */}
        {createdLicense && (
          <div style={{
            background: "linear-gradient(180deg, #0a2a1a, #0a1a12)", border: "1px solid #34d39944",
            borderRadius: 12, padding: "1.2rem", marginBottom: "1.5rem"
          }}>
            <h3 style={{ color: "#34d399", fontSize: "1rem", margin: "0 0 0.8rem" }}>
              {lang === "ar" ? "\u2705 تم إنشاء الرخصة جديدة!" : "\u2705 New license created!"}
            </h3>
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              background: "#0e1829", padding: "0.6rem 0.8rem", borderRadius: 8, marginBottom: "0.8rem"
            }}>
              <code style={{ color: "#60a5fa", fontFamily: "monospace", flex: 1, fontSize: "0.9rem" }}>
                {createdLicense.key}
              </code>
              <button onClick={() => copyToClipboard(createdLicense.key, "key")} style={{
                background: copied === "key" ? "#34d399" : "#3b82f6", color: "#fff",
                border: "none", borderRadius: 6, padding: "0.3rem 0.6rem",
                fontSize: "0.75rem", cursor: "pointer"
              }}>
                {copied === "key"
                  ? (lang === "ar" ? "\u2713 تم" : "Copied")
                  : (lang === "ar" ? "نسخ" : "Copy")}
              </button>
            </div>

            {/* Instructions */}
            <div style={{
              background: "#0e182980", borderRadius: 8, padding: "1rem", marginBottom: "0.8rem",
              border: "1px solid #ffffff10"
            }}>
              <h4 style={{ color: "#fbbf24", fontSize: "0.85rem", margin: "0 0 0.6rem" }}>
                {lang === "ar" ? "\u{1F4CB} تعليمات للعميل:" : "\u{1F4CB} Client Instructions:"}
              </h4>
              <ol style={{ color: "#90a8c7", fontSize: "0.78rem", lineHeight: 2, paddingLeft: "1.2rem", margin: 0 }}>
                <li>{lang === "ar" ? "انسخ مجلد المشروع كاملاً" : "Copy the entire project folder"}</li>
                <li>{lang === "ar" ? "احذف مجلدات: node_modules, .next, .git" : "Delete folders: node_modules, .next, .git"}</li>
                <li>{lang === "ar" ? "أنشئ مشروع Firebase جديد" : "Create a new Firebase project"}</li>
                <li>{lang === "ar" ? "فعّل Authentication + Firestore" : "Enable Authentication + Firestore"}</li>
                <li>{lang === "ar" ? "شغّل npm install ثم npm run build" : "Run npm install then npm run build"}</li>
                <li>{lang === "ar" ? "انشر على Vercel أو سيرفر خاص" : "Deploy to Vercel or custom server"}</li>
              </ol>
            </div>

            {/* .env.local template */}
            <div style={{
              background: "#0e1829", borderRadius: 8, padding: "0.8rem",
              border: "1px solid #ffffff10", position: "relative"
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem"
              }}>
                <span style={{ color: "#7a95b8", fontSize: "0.75rem" }}>.env.local</span>
                <button onClick={() => copyToClipboard(getEnvTemplate(createdLicense.key), "env")} style={{
                  background: copied === "env" ? "#34d399" : "#3b82f6", color: "#fff",
                  border: "none", borderRadius: 6, padding: "0.25rem 0.6rem",
                  fontSize: "0.72rem", cursor: "pointer"
                }}>
                  {copied === "env"
                    ? (lang === "ar" ? "\u2713 تم النسخ" : "Copied!")
                    : (lang === "ar" ? "نسخ الكل" : "Copy All")}
                </button>
              </div>
              <pre style={{
                color: "#90a8c7", fontSize: "0.68rem", lineHeight: 1.6,
                margin: 0, overflow: "auto", maxHeight: 200, fontFamily: "monospace",
                direction: "ltr", textAlign: "left"
              }}>
                {getEnvTemplate(createdLicense.key)}
              </pre>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showForm && !createdLicense && (
          <div style={{
            background: "linear-gradient(180deg, #0f172a, #0b1322)", border: "1px solid #3b82f644",
            borderRadius: 12, padding: "1.2rem", marginBottom: "1.5rem"
          }}>
            <h3 style={{ color: "#60a5fa", fontSize: "1rem", margin: "0 0 1rem" }}>
              {lang === "ar" ? "\u0625\u0646\u0634\u0627\u0621 \u0631\u062E\u0635\u0629 \u062C\u062F\u064A\u062F\u0629" : "Create New License"}
            </h3>
            <div style={{ display: "grid", gap: "0.8rem" }}>
              <div>
                <label style={{ color: "#7a95b8", fontSize: "0.75rem", display: "block", marginBottom: "0.3rem" }}>
                  {lang === "ar" ? "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 *" : "Client Name *"}
                </label>
                <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                  placeholder={lang === "ar" ? "أحمد محمد" : "Ahmed Mohamed"}
                  style={{
                    width: "100%", padding: "0.5rem 0.7rem", borderRadius: 8,
                    border: "1px solid #2a3a5c", background: "#0e1829", color: "#e0e8f0",
                    fontSize: "0.85rem", outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>
              <div>
                <label style={{ color: "#7a95b8", fontSize: "0.75rem", display: "block", marginBottom: "0.3rem" }}>
                  {lang === "ar" ? "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A *" : "Client Email *"}
                </label>
                <input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="client@email.com" dir="ltr"
                  style={{
                    width: "100%", padding: "0.5rem 0.7rem", borderRadius: 8,
                    border: "1px solid #2a3a5c", background: "#0e1829", color: "#e0e8f0",
                    fontSize: "0.85rem", outline: "none", boxSizing: "border-box"
                  }}
                />
              </div>
              <div>
                <label style={{ color: "#7a95b8", fontSize: "0.75rem", display: "block", marginBottom: "0.3rem" }}>
                  {lang === "ar" ? "\u0645\u062F\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643" : "Duration"}
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {[30, 60, 90, 365].map((d) => (
                    <button key={d} onClick={() => setNewDuration(d)} style={{
                      flex: 1, padding: "0.5rem", borderRadius: 8, cursor: "pointer",
                      border: newDuration === d ? "1px solid #3b82f6" : "1px solid #2a3a5c",
                      background: newDuration === d ? "#3b82f620" : "#0e1829",
                      color: newDuration === d ? "#60a5fa" : "#7a95b8",
                      fontSize: "0.8rem", fontWeight: newDuration === d ? 600 : 400
                    }}>
                      {d} {lang === "ar" ? "يوم" : lang === "fr" ? "jours" : "days"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ color: "#7a95b8", fontSize: "0.75rem", display: "block", marginBottom: "0.3rem" }}>
                  {lang === "ar" ? "\u0645\u0644\u0627\u062D\u0638\u0627\u062A" : "Notes"}
                </label>
                <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2}
                  placeholder={lang === "ar" ? "ملاحظات إضافية..." : "Additional notes..."}
                  style={{
                    width: "100%", padding: "0.5rem 0.7rem", borderRadius: 8,
                    border: "1px solid #2a3a5c", background: "#0e1829", color: "#e0e8f0",
                    fontSize: "0.85rem", outline: "none", resize: "vertical", fontFamily: "inherit",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.3rem" }}>
                <button onClick={handleCreate} disabled={creating} style={{
                  flex: 1, padding: "0.6rem", background: "#3b82f6", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: "0.9rem", cursor: "pointer",
                  fontWeight: 600, opacity: creating ? 0.6 : 1
                }}>
                  {creating ? "..." : (lang === "ar" ? "\u0625\u0646\u0634\u0627\u0621" : "Create")}
                </button>
                <button onClick={() => setShowForm(false)} style={{
                  padding: "0.6rem 1.5rem", background: "transparent", color: "#90a8c7",
                  border: "1px solid #2a3a5c", borderRadius: 8, fontSize: "0.85rem", cursor: "pointer"
                }}>
                  {lang === "ar" ? "\u0625\u0644\u063A\u0627\u0621" : "Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Licenses Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#7a95b8" }}>
            {lang === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : licenses.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "3rem", color: "#556b84",
            border: "1px dashed #2a3a5c", borderRadius: 12
          }}>
            {lang === "ar" ? "لا توجد رخص بعد" : "No licenses yet"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {licenses.map((lic) => {
              const statusColor = !lic.active ? "#ef4444" : lic.expired ? "#f59e0b" : "#34d399";
              const statusText = !lic.active
                ? (lang === "ar" ? "\u{1F6D1} معلقة" : "\u{1F6D1} Suspended")
                : lic.expired
                  ? (lang === "ar" ? "\u23F0 منتهية" : "\u23F0 Expired")
                  : (lang === "ar" ? "\u2705 نشطة" : "\u2705 Active");

              return (
                <div key={lic.key} style={{
                  background: "linear-gradient(135deg, #0f172a, #0b1322)",
                  border: "1px solid #ffffff10", borderRadius: 10, padding: "1rem",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "0.5rem"
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                        <span style={{ color: "#e0e8f0", fontWeight: 600, fontSize: "0.9rem" }}>
                          {lic.clientName}
                        </span>
                        <span style={{
                          color: statusColor, fontSize: "0.7rem", background: `${statusColor}15`,
                          padding: "0.15rem 0.5rem", borderRadius: 12
                        }}>
                          {statusText}
                        </span>
                      </div>
                      <div style={{ color: "#7a95b8", fontSize: "0.75rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                        <span dir="ltr">{lic.clientEmail}</span>
                        <span style={{ fontFamily: "monospace", color: "#60a5fa" }}>{lic.key}</span>
                      </div>
                      <div style={{ color: "#556b84", fontSize: "0.7rem", marginTop: "0.2rem" }}>
                        {lang === "ar" ? "ينتهي" : "Expires"}: {lic.expiresAt?.toDate?.()?.toLocaleDateString?.("ar-MA") ?? ""}
                        {lic.active && !lic.expired && (
                          <span style={{ color: "#34d399", marginLeft: "0.5rem" }}>
                            ({lic.daysRemaining} {lang === "ar" ? "يوم متبقي" : "days left"})
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <button onClick={() => copyToClipboard(lic.key, `k-${lic.key}`)} style={{
                        background: copied === `k-${lic.key}` ? "#34d399" : "#1e3a5f", color: "#fff",
                        border: "none", borderRadius: 6, padding: "0.3rem 0.6rem", fontSize: "0.72rem", cursor: "pointer"
                      }}>
                        {copied === `k-${lic.key}` ? "\u2713" : (lang === "ar" ? "نسخ" : "Copy")}
                      </button>
                      <button onClick={() => handleToggle(lic.key, lic.active)} style={{
                        background: lic.active ? "#ef444420" : "#34d39920",
                        color: lic.active ? "#ef4444" : "#34d399",
                        border: `1px solid ${lic.active ? "#ef444440" : "#34d39940"}`,
                        borderRadius: 6, padding: "0.3rem 0.6rem", fontSize: "0.72rem", cursor: "pointer"
                      }}>
                        {lic.active
                          ? (lang === "ar" ? "تعليق" : "Suspend")
                          : (lang === "ar" ? "تفعيل" : "Activate")}
                      </button>
                      <button onClick={() => handleExtend(lic.key)} style={{
                        background: "#3b82f620", color: "#60a5fa",
                        border: "1px solid #3b82f640", borderRadius: 6,
                        padding: "0.3rem 0.6rem", fontSize: "0.72rem", cursor: "pointer"
                      }}>
                        +30 {lang === "ar" ? "يوم" : "d"}
                      </button>
                      <button onClick={() => handleDelete(lic.key)} style={{
                        background: "#ef444415", color: "#ef4444",
                        border: "1px solid #ef444430", borderRadius: 6,
                        padding: "0.3rem 0.6rem", fontSize: "0.72rem", cursor: "pointer"
                      }}>
                        {lang === "ar" ? "حذف" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
