"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Sanitize redirect target: only allow same-origin relative paths
  const safePath = pathname && pathname.startsWith("/") && !pathname.startsWith("//")
    ? pathname
    : "/";
  const nextPath = safePath;

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/?next=${encodeURIComponent(nextPath)}`);
    }
  }, [loading, nextPath, router, user]);

  if (loading) {
    return (
      <main className="page-shell">
        <div className="container">
          <div
            style={{
              minHeight: "40vh",
              display: "grid",
              placeItems: "center",
              color: "#dbeafe",
              textAlign: "center",
              padding: "2rem",
              borderRadius: "18px",
              border: "1px solid #ffffff18",
              background: "linear-gradient(180deg, #101a2d 0%, #0e1729 55%, #0a1220 100%)"
            }}
          >
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.4rem" }}>جاري تحميل الصفحة...</div>
              <div style={{ fontSize: "0.82rem", color: "#8fa9c8" }}>يرجى الانتظار قليلًا بينما نتحقق من تسجيل الدخول.</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
