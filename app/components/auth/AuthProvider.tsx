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
  const db = getFirebaseDb();
  if (!db) return { role: getDefaultRole(emailRaw), banned: false };

  const email = normalizeEmail(emailRaw);
  const key = emailToKey(email);
  const accessRef = doc(db, "access_list", key);
  const usersRef = doc(db, "users", uid);

  // Add timeout to prevent hanging
  const timeout = (ms: number) => new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error("Firestore timeout")), ms)
  );

  // Read access_list and user docs (non-fatal if fails)
  let accessSnap: any = null;
  let userSnap: any = null;
  let accessRole: UserRole | undefined = undefined;
  let accessBanned = false;
  let accessDeleted = false;

  try {
    [accessSnap, userSnap] = await Promise.race([
      Promise.all([getDoc(accessRef), getDoc(usersRef)]),
      timeout(10000),
    ]);
    
    if (accessSnap?.exists()) {
      accessRole = accessSnap.data().role as UserRole | undefined;
      accessBanned = Boolean(accessSnap.data().banned);
      accessDeleted = Boolean(accessSnap.data().deleted);
    }
  } catch (readErr) {
    console.warn("[Auth] Failed to read user/access docs (non-fatal):", readErr);
    // Non-fatal: assume default role and not banned
  }

  const role = resolveRole(email, accessRole);

  // Write user and access docs (non-fatal if fails)
  try {
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
            createdAt: userSnap?.exists() ? userSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
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
            createdAt: accessSnap?.exists() ? accessSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
          },
          { merge: true }
        ),
      ]),
      timeout(10000),
    ]);
  } catch (writeErr) {
    console.warn("[Auth] Failed to write user/access docs (non-fatal):", writeErr);
    // Non-fatal: continue even if writes fail
  }

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
  console.log("[Auth] Session cookie set, path=/");
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
      console.log("[Auth] User authenticated:", firebaseUser.email);
      localStorage.removeItem(EMAIL_SESSION_STORAGE_KEY);
      window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
      setUser(firebaseUser);
      setSessionCookie();
      setRoleLoading(true);

      try {
        console.log("[Auth] Calling ensureAccessAndProfile...");
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
          console.log("[Auth] Setting role:", meta.role);
          setRole(meta.role);
          await notifySuperAdminLogin(firebaseUser.email ?? "");
        }
      } catch (e) {
        console.error("[Auth] ensureAccessAndProfile failed", e);
        setRole(resolveRole(firebaseUser.email ?? ""));
      } finally {
        console.log("[Auth] Login complete, loading=false");
        setRoleLoading(false);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Polling-based ban check (replaces onSnapshot to avoid permission-denied false positives)
  useEffect(() => {
    if (!user?.email || user.email.toLowerCase() === SUPER_ADMIN_EMAIL) return;
    const db = getFirebaseDb();
    if (!db) return;

    const accessRef = doc(db, "access_list", emailToKey(user.email));

    const checkBan = async () => {
      try {
        const snap = await getDoc(accessRef);
        if (snap.exists()) {
          const data = snap.data();
          const isBanned = Boolean(data?.banned);
          const isDeleted = Boolean(data?.deleted);
          if (isBanned || isDeleted) {
            setUser(null);
            setRole(null);
            setLoading(false);
            setRoleLoading(false);
            await forceBlockedExit(isDeleted);
          }
        }
      } catch {
        // Permission denied - silently ignore (normal for some users)
      }
    };

    // Check after 5 seconds, then every 30 seconds
    const initialTimer = setTimeout(checkBan, 5000);
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
        const email = normalizeEmail(emailRaw);
        
        // Check if email is banned (but allow any real email to login via OTP)
        const db = getFirebaseDb();
        if (db) {
          try {
            const key = emailToKey(email);
            const accessRef = doc(db, "access_list", key);
            const accessSnap = await getDoc(accessRef);
            
            // Only block if explicitly banned
            if (accessSnap.exists()) {
              const data = accessSnap.data();
              if (data?.banned) {
                if (data?.deleted) { rememberDeletedMessage(); } else { rememberBannedMessage(); }
                throw new Error("ACCESS_BANNED");
              }
            }
          } catch (banCheckErr) {
            // If it's ACCESS_BANNED, re-throw it
            if (banCheckErr instanceof Error && banCheckErr.message === "ACCESS_BANNED") {
              throw banCheckErr;
            }
            // Otherwise (permission denied, etc), allow login to continue
            console.warn("[Auth] Ban check failed (non-fatal):", banCheckErr);
          }
        }
        
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
          // Try popup first (fastest, no page reload)
          console.log("[Auth] signInWithGoogle: calling signInWithPopup...");
          await signInWithPopup(auth, provider);
          console.log("[Auth] signInWithGoogle: signInWithPopup succeeded");
        } catch (popupError: unknown) {
          const msg = popupError instanceof Error ? popupError.message : "";
          console.log("[Auth] signInWithGoogle: popup error:", msg);
          if (msg.includes("popup-blocked") || msg.includes("popup-closed-by-user")) {
            // Popup blocked — fall back to redirect
            console.log("[Auth] signInWithGoogle: falling back to redirect");
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
