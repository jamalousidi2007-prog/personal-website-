"use client";

import { useEffect, useState, type ReactNode } from "react";
import { verifyLicense, isLicenseSystemConfigured } from "@/lib/licenseService";
import LicenseExpired from "./LicenseExpired";

interface LicenseGuardProps {
  children: ReactNode;
}

interface LicenseStatus {
  valid: boolean;
  expired: boolean;
  clientName: string;
  expiresAt: string;
}

export default function LicenseGuard({ children }: LicenseGuardProps) {
  const licenseKey = process.env.NEXT_PUBLIC_LICENSE_KEY || "";

  // If no license key is set, this is the developer's copy - allow everything
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // No license key = developer's copy, skip check
    if (!licenseKey) {
      setChecking(false);
      return;
    }

    // License system not configured = skip check (graceful fallback)
    if (!isLicenseSystemConfigured) {
      console.warn("[LicenseGuard] License Firebase not configured, skipping check");
      setChecking(false);
      return;
    }

    // Verify license
    let cancelled = false;
    setChecking(true);

    verifyLicense(licenseKey).then((result) => {
      if (cancelled) return;
      if (!result) {
        // Network error - allow access (graceful fallback)
        console.error("[LicenseGuard] Could not verify license, allowing access");
        setChecking(false);
        return;
      }
      setStatus(result);
      setChecking(false);
    }).catch(() => {
      if (cancelled) return;
      console.error("[LicenseGuard] License check failed, allowing access");
      setChecking(false);
    });

    return () => { cancelled = true; };
  }, [licenseKey]);

  // No license key = developer's copy, render normally
  if (!licenseKey) {
    return <>{children}</>;
  }

  // Still checking - show loading
  if (checking) {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a1a",
        zIndex: 99999,
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: "3px solid #2a3a5c",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // License invalid - show expired page
  if (status && !status.valid) {
    return (
      <LicenseExpired
        clientName={status.clientName}
        expiresAt={status.expiresAt}
        expired={status.expired}
        licenseKey={licenseKey}
      />
    );
  }

  // License valid - render normally
  return <>{children}</>;
}
