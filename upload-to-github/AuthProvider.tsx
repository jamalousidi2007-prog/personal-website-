"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase/client";
import { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD } from "@/lib/constants";
import { emailToKey } from "@/lib/emailKey";

export type UserRole = "superadmin" | "admin" | "viewer";

type EmailOnlyUser = {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

type AuthUser = User | EmailOnlyUser;

type AuthContextType = {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  roleLoading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (email: string, newPassword: string) => Promise<void>;
};

type AccessMeta = {
  role: UserRole;
  banned: boolean;
  deleted?: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);
const EMAIL_SESSION_STORAGE_KEY = "personal_site_email";
const LOGOUT_PENDING_STORAGE_KEY = "personal_site_logout_pending";
const BANNED_MESSAGE_STORAGE_KEY = "personal_site_banned_message";
const GOOGLE_REDIRECT_PENDING_KEY = "personal_site_google_redirect";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createEmailOnlyUser(emailRaw: string): EmailOnlyUser {
  const email = normalizeEmail(emailRaw);
  return {
    uid: emailToKey(email),
    email,
    displayName: email.split("@")[0] || email,
    emailVerified: true,
  };
}

function getDefaultRole(email?: string | null): UserRole {
  if (email?.toLowerCase() === SUPER_ADMIN_EMAIL) return "superadmin";
  return "viewer";
}

function resolveRole(email: string, accessRole?: UserRole): UserRole {
  if (email.toLowerCase() === SUPER_ADMIN_EMAIL) return "superadmin";
  return accessRole ?? getDefaultRole(email);
}

function rememberBannedMessage() {
  localStorage.setItem(BANNED_MESSAGE_STORAGE_KEY, "تم حظر هذا الحساب من طرف جمال. لا يمكنك الدخول حتى يتم إزالة الحظر.");
}

function rememberDeletedMessage() {
  localStorage.setItem(BANNED_MESSAGE_STORAGE_KEY, "تم حذف حسابك من طرف جمال. لا يمكنك الدخول بهذا البريد. استخدم بريدا إلكترونيا آخر.");
}

async function forceBlockedExit(isDeleted?: boolean) {
  if (isDeleted) {
    rememberDeletedMessage();
  } else {
    rememberBannedMessage();
  }
  clearSession();
  const auth = getFirebaseAuth();
  if (auth?.currentUser) {
    await signOut(auth);
  }
  window.location.replace("/");
}

async function ensureAccessAndProfile(uid: string, emailRaw: string): Promise<AccessMeta> {
  console.log("[Auth] ensureAccessAndProfile: start for", emailRaw, "uid:", uid);
  const db = getFirebaseDb();
  if (!db) {
    console.log("[Auth] ensureAccessAndProfile: no Firestore DB, returning default role");
    return { role: getDefaultRole(emailRaw), banned: false };
  }

  const email = normalizeEmail(emailRaw);
  const key = emailToKey(email);
  const accessRef = doc(db, "access_list", key);
  const usersRef = doc(db, "users", uid);

  // Read with 10s timeout to prevent hanging
  const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), ms));
  console.log("[Auth] ensureAccessAndProfile: reading Firestore docs...");
  const [accessSnap, userSnap] = await Promise.race([
    Promise.all([getDoc(accessRef), getDoc(usersRef)]),
    timeout(10000),
  ]);
  console.log("[Auth] ensureAccessAndProfile: Firestore read done. access exists:", accessSnap.exists(), "user exists:", userSnap.exists());

  const accessRole = accessSnap.exists()
    ? (accessSnap.data().role as UserRole | undefined)
    : undefined;
  const accessBanned = accessSnap.exists() ? Boolean(accessSnap.data().banned) : false;
  const accessDeleted = accessSnap.exists() ? Boolean(accessSnap.data().deleted) : false;
  const role = resolveRole(email, accessRole);

  // Write in parallel with 10s timeout
  await Promise.race([
    Promise.all([
      setDoc(
        usersRef,
        {
          uid,
          email,
          role,
          banned: accessBanned,
          status: "online",
          lastSeenText: "Online",
          updatedAt: serverTimestamp(),
          createdAt: userSnap.exists() ? userSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
        },
        { merge: true }
      ),
      setDoc(
        accessRef,
        {
          email,
          role,
          banned: accessBanned,
          status: "online",
          lastSeenText: "Online",
          updatedAt: serverTimestamp(),
          createdAt: accessSnap.exists() ? accessSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
        },
        { merge: true }
      ),
    ]),
    timeout(10000),
  ]);

  return { role, banned: accessBanned || accessDeleted, deleted: accessDeleted };
}

async function notifySuperAdminLogin(emailRaw: string) {
  const db = getFirebaseDb();
  if (!db) return;

  const email = normalizeEmail(emailRaw);
  if (!email || email === SUPER_ADMIN_EMAIL) return;

  try {
    const threadId = [emailToKey(email), emailToKey(SUPER_ADMIN_EMAIL)].sort((a, b) => a.localeCompare(b)).join("__");
    const threadRef = doc(db, "chat_threads", threadId);

    await setDoc(
      threadRef,
      {
        participants: [SUPER_ADMIN_EMAIL, email],
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await addDoc(collection(db, "chat_threads", threadId, "messages"), {
      text: `User joined: ${email}`,
      senderEmail: SUPER_ADMIN_EMAIL,
      receiverEmail: SUPER_ADMIN_EMAIL,
      systemOnlyFor: SUPER_ADMIN_EMAIL,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("[Auth] notifySuperAdminLogin failed", error);
  }
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function setSessionCookie() {
  const token = generateSessionToken();
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `site_session=${token}; Path=/; SameSite=Lax${secureFlag}; Max-Age=2592000`;
}

function clearSession() {
  localStorage.removeItem(EMAIL_SESSION_STORAGE_KEY);
  document.cookie = "site_session=; Path=/; Max-Age=0";
}

function setLogoutPending() {
  window.sessionStorage.setItem(LOGOUT_PENDING_STORAGE_KEY, "1");
}

function clearLogoutPending() {
  window.sessionStorage.removeItem(LOGOUT_PENDING_STORAGE_KEY);
}

function isLogoutPending() {
  return window.sessionStorage.getItem(LOGOUT_PENDING_STORAGE_KEY) === "1";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const restoreEmailSession = async () => {
      const savedEmail = localStorage.getItem(EMAIL_SESSION_STORAGE_KEY);

      if (!savedEmail) {
        setRole(null);
        setRoleLoading(false);
        setLoading(false);
        document.cookie = "site_session=; Path=/; Max-Age=0";
        return;
      }

      const nextUser = createEmailOnlyUser(savedEmail);
      setUser(nextUser);
      setSessionCookie();
      setRoleLoading(true);

      try {
        const meta = await ensureAccessAndProfile(nextUser.uid, nextUser.email);

        if (meta.banned) {
          if (meta.deleted) {
            rememberDeletedMessage();
          } else {
            rememberBannedMessage();
          }
          clearSession();
          setUser(null);
          setRole(null);
        } else {
          setRole(meta.role);
        }
      } catch (e) {
        console.error("[Auth] ensureAccessAndProfile failed", e);
        setRole(resolveRole(nextUser.email));
      } finally {
        setRoleLoading(false);
        setLoading(false);
      }
    };

    const auth = getFirebaseAuth();
    if (!auth) {
      void restoreEmailSession();
      return;
    }

    // Clear any stale redirect state and pick up any pending redirect results
    getRedirectResult(auth).catch(() => {});

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[Auth] onAuthStateChanged:", firebaseUser?.email ?? "no user");

      if (isLogoutPending()) {
        if (firebaseUser) await signOut(auth);
        clearSession();
        clearLogoutPending();
        setUser(null);
        setRole(null);
        setRoleLoading(false);
        setLoading(false);
        return;
      }

      if (!firebaseUser) {
        // If we just came back from a Google redirect, wait for the user
        if (window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === "1") {
          console.log("[Auth] Waiting for Google redirect result...");
          try {
            const result = await getRedirectResult(auth);
            if (result?.user) {
              // Got user from redirect — process them below
              firebaseUser = result.user;
            } else {
              // No user from redirect — wait a bit more via inner listener
              const waited = await new Promise<User | null>((resolve) => {
                const t = setTimeout(() => resolve(null), 15000);
                const u = onAuthStateChanged(auth, (usr) => {
                  if (usr) { clearTimeout(t); u(); resolve(usr); }
                });
              });
              if (waited) {
                firebaseUser = waited;
              } else {
                window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
                void restoreEmailSession();
                return;
              }
            }
          } catch {
            window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
            void restoreEmailSession();
            return;
          }
        } else {
          void restoreEmailSession();
          return;
        }
      }

      // User is authenticated — set everything
      console.log("[Auth] User authenticated, setting user:", firebaseUser.email);
      localStorage.removeItem(EMAIL_SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
      setUser(firebaseUser);
      setSessionCookie();
      setRoleLoading(true);

      try {
        console.log("[Auth] Calling ensureAccessAndProfile for:", firebaseUser.email);
        const meta = await ensureAccessAndProfile(firebaseUser.uid, firebaseUser.email ?? "");
        console.log("[Auth] ensureAccessAndProfile result:", meta);
        if (meta.banned) {
          if (meta.deleted) {
            rememberDeletedMessage();
          } else {
            rememberBannedMessage();
          }
          await signOut(auth);
          setUser(null);
          setRole(null);
          clearSession();
        } else {
          setRole(meta.role);
          await notifySuperAdminLogin(firebaseUser.email ?? "");
        }
      } catch (e) {
        console.error("[Auth] ensureAccessAndProfile failed", e);
        // Even if Firestore writes fail, allow the user to proceed with default role
        setRole(resolveRole(firebaseUser.email ?? ""));
      } finally {
        console.log("[Auth] Setting loading=false, role set");
        setRoleLoading(false);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.email || user.email.toLowerCase() === SUPER_ADMIN_EMAIL) return;
    const db = getFirebaseDb();
    if (!db) return;

    // Skip the real-time ban-check listener — Firestore security rules may
    // deny read access on access_list for regular users, which would cause
    // onSnapshot to fire the error callback and incorrectly log the user out.
    // Ban/deletion enforcement is already handled inside ensureAccessAndProfile
    // during login, which runs with elevated context after authentication.
    // The periodic re-check below is sufficient for runtime ban enforcement.

    // Instead, poll every 30 seconds with getDoc (which also fails silently on
    // permission denied but does NOT force-logout the user)
    const key = emailToKey(user.email);
    const accessRef = doc(db, "access_list", key);

    const checkBan = async () => {
      try {
        const snap = await getDoc(accessRef);
        if (snap.exists()) {
          const data = snap.data();
          const isBanned = Boolean(data?.banned);
          const isDeleted = Boolean(data?.deleted);
          if (isBanned || isDeleted) {
            await forceBlockedExit(isDeleted);
          }
        }
        // If doc doesn't exist, do NOT force logout — it may just be a
        // Firestore rules issue or the doc was moved
      } catch {
        // Permission denied or network error — silently ignore
        // The user already passed ensureAccessAndProfile during login
      }
    };

    // Check once after 5 seconds, then every 30 seconds
    const initialTimer = setTimeout(() => {
      checkBan();
    }, 5000);

    const intervalTimer = setInterval(checkBan, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [user]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role,
      loading,
      roleLoading,
      configured: isFirebaseConfigured,
      signIn: async (email, password) => {
        clearLogoutPending();
        const normalizedEmail = normalizeEmail(email);

        if (normalizedEmail === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
          const superUser = createEmailOnlyUser(normalizedEmail);
          localStorage.setItem(EMAIL_SESSION_STORAGE_KEY, superUser.email);
          setUser(superUser);
          setSessionCookie();
          setRole("superadmin");
          setRoleLoading(false);
          setLoading(false);
          const db = getFirebaseDb();
          if (db) {
            await ensureAccessAndProfile(superUser.uid, superUser.email);
          }
          return;
        }

        const auth = getFirebaseAuth();
        if (!auth) throw new Error("Firebase is not configured yet.");

        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        if (credential.user.email) {
          const meta = await ensureAccessAndProfile(credential.user.uid, credential.user.email);
          if (meta.banned) {
            if (meta.deleted) { rememberDeletedMessage(); } else { rememberBannedMessage(); }
            await signOut(auth);
            throw new Error("ACCESS_BANNED");
          }
          await notifySuperAdminLogin(credential.user.email);
        }
      },
      signUp: async (email, password) => {
        clearLogoutPending();
        const auth = getFirebaseAuth();
        if (!auth) throw new Error("Firebase is not configured yet.");

        const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
        if (credential.user.email) {
          const meta = await ensureAccessAndProfile(credential.user.uid, credential.user.email);
          if (meta.banned) {
            if (meta.deleted) { rememberDeletedMessage(); } else { rememberBannedMessage(); }
            await signOut(auth);
            throw new Error("ACCESS_BANNED");
          }
          await notifySuperAdminLogin(credential.user.email);
        }
      },
      signInWithEmail: async (emailRaw: string) => {
        clearLogoutPending();
        const nextUser = createEmailOnlyUser(emailRaw);
        localStorage.setItem(EMAIL_SESSION_STORAGE_KEY, nextUser.email);
        setUser(nextUser);
        setSessionCookie();
        setRoleLoading(true);

        const meta = await ensureAccessAndProfile(nextUser.uid, nextUser.email);
        if (meta.banned) {
          if (meta.deleted) {
            rememberDeletedMessage();
          } else {
            rememberBannedMessage();
          }
          clearSession();
          setUser(null);
          setRole(null);
          setRoleLoading(false);
          throw new Error("ACCESS_BANNED");
        }

        setRole(meta.role);
        setRoleLoading(false);
        setLoading(false);
      },
      signInWithGoogle: async () => {
        clearLogoutPending();
        const auth = getFirebaseAuth();
        if (!auth) throw new Error("Firebase is not configured yet.");

        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        try {
          console.log("[Auth] signInWithGoogle: trying popup...");
          // Try popup first (fastest, no page reload)
          const result = await signInWithPopup(auth, provider);
          console.log("[Auth] signInWithGoogle: popup succeeded, user:", result.user.email);
          // onAuthStateChanged will handle the rest
        } catch (popupError: unknown) {
          const msg = popupError instanceof Error ? popupError.message : "";
          console.error("[Auth] signInWithGoogle: popup failed:", msg);
          if (msg.includes("popup-blocked") || msg.includes("popup-closed-by-user")) {
            // Popup blocked — fall back to redirect
            console.log("[Auth] signInWithGoogle: falling back to redirect...");
            window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, "1");
            await signInWithRedirect(auth, provider);
          } else {
            throw popupError;
          }
        }
      },
      signOutUser: async () => {
        try {
          setLogoutPending();
          const auth = getFirebaseAuth();
          const db = getFirebaseDb();

          if (db && user?.email) {
            const key = emailToKey(user.email);
            await updateDoc(doc(db, "access_list", key), {
              status: "offline",
              lastSeenText: new Date().toISOString(),
              updatedAt: serverTimestamp(),
            });
          }

          if (auth?.currentUser) {
            await signOut(auth);
          }
        } finally {
          clearSession();
          setUser(null);
          setRole(null);
          setLoading(false);
          setRoleLoading(false);
        }
      },
      sendPasswordReset: async email => {
        const auth = getFirebaseAuth();
        if (!auth) throw new Error("Firebase is not configured yet.");
        await sendPasswordResetEmail(auth, normalizeEmail(email));
      },
      confirmPasswordReset: async email => {
        const auth = getFirebaseAuth();
        if (!auth) throw new Error("Firebase is not configured yet.");
        await sendPasswordResetEmail(auth, normalizeEmail(email));
      },
    }),
    [user, role, loading, roleLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
