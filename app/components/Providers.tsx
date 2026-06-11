"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import LanguageToggle from "@/components/LanguageToggle";
import { LanguageProvider } from "@/components/LanguageProvider";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <AuthProvider>
        <LanguageToggle />
        {children}
      </AuthProvider>
    </LanguageProvider>
  );
}