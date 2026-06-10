import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// License Firebase config (always points to the developer's Firebase)
const licenseFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_LICENSE_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_LICENSE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_LICENSE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_LICENSE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_LICENSE_FIREBASE_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_LICENSE_FIREBASE_APP_ID || ""
};

export const isLicenseSystemConfigured = Boolean(
  licenseFirebaseConfig.apiKey &&
    licenseFirebaseConfig.projectId &&
    licenseFirebaseConfig.appId
);

let licenseApp: FirebaseApp | null = null;

function getLicenseApp(): FirebaseApp | null {
  if (!isLicenseSystemConfigured) return null;
  const existing = getApps().find((a) => a.name === "license");
  if (existing) return existing;
  licenseApp = initializeApp(licenseFirebaseConfig as Record<string, string>, "license");
  return licenseApp;
}

function getLicenseDb() {
  const app = getLicenseApp();
  if (!app) return null;
  return getFirestore(app);
}

// Types
export interface LicenseData {
  key: string;
  clientName: string;
  clientEmail: string;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  active: boolean;
  notes: string;
}

export interface LicenseInfo extends LicenseData {
  expired: boolean;
  daysRemaining: number;
}

// Generate cryptographically random license key
function generateLicenseKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  let result = "LIC-";
  for (let i = 0; i < 16; i++) {
    result += chars[array[i] % chars.length];
    if (i === 3 || i === 7 || i === 11) result += "-";
  }
  return result;
}

// Create a new license
export async function createLicense(
  clientName: string,
  clientEmail: string,
  durationDays: number,
  notes: string = ""
): Promise<LicenseData | null> {
  const db = getLicenseDb();
  if (!db) return null;

  const key = generateLicenseKey();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const data: LicenseData = {
    key,
    clientName,
    clientEmail,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
    active: true,
    notes
  };

  await setDoc(doc(db, "licenses", key), data);
  return data;
}

// Get all licenses
export async function getLicenses(): Promise<LicenseInfo[]> {
  const db = getLicenseDb();
  if (!db) return [];

  const snapshot = await getDocs(collection(db, "licenses"));
  const now = Date.now();

  return snapshot.docs.map((d: QueryDocumentSnapshot) => {
    const data = d.data() as LicenseData;
    const expiresMs = data.expiresAt?.toMillis?.() ?? 0;
    const daysRemaining = Math.max(0, Math.ceil((expiresMs - now) / (1000 * 60 * 60 * 24)));
    return {
      ...data,
      expired: expiresMs < now,
      daysRemaining
    };
  });
}

// Toggle license active status
export async function toggleLicense(key: string, active: boolean): Promise<boolean> {
  const db = getLicenseDb();
  if (!db) return false;
  try {
    await updateDoc(doc(db, "licenses", key), { active });
    return true;
  } catch {
    return false;
  }
}

// Extend license by N days
export async function extendLicense(key: string, days: number): Promise<boolean> {
  const db = getLicenseDb();
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, "licenses", key));
    if (!snap.exists()) return false;
    const data = snap.data() as LicenseData;
    const currentExpiry = data.expiresAt?.toMillis?.() ?? Date.now();
    const newExpiry = new Date(currentExpiry + days * 24 * 60 * 60 * 1000);
    await updateDoc(doc(db, "licenses", key), {
      expiresAt: Timestamp.fromDate(newExpiry),
      active: true
    });
    return true;
  } catch {
    return false;
  }
}

// Delete a license
export async function deleteLicense(key: string): Promise<boolean> {
  const db = getLicenseDb();
  if (!db) return false;
  try {
    await deleteDoc(doc(db, "licenses", key));
    return true;
  } catch {
    return false;
  }
}

// Verify a license (used by LicenseGuard in client copies)
export async function verifyLicense(key: string): Promise<{
  valid: boolean;
  expired: boolean;
  clientName: string;
  expiresAt: string;
} | null> {
  const db = getLicenseDb();
  if (!db || !key) return null;

  try {
    const snap = await getDoc(doc(db, "licenses", key));
    if (!snap.exists()) return { valid: false, expired: false, clientName: "", expiresAt: "" };

    const data = snap.data() as LicenseData;
    const expiresMs = data.expiresAt?.toMillis?.() ?? 0;
    const expired = expiresMs < Date.now();
    const valid = data.active && !expired;

    return {
      valid,
      expired,
      clientName: data.clientName,
      expiresAt: data.expiresAt?.toDate?.()?.toLocaleDateString("ar-MA") ?? ""
    };
  } catch (err) {
    console.error("[LicenseService] verifyLicense error:", err);
    return null;
  }
}
